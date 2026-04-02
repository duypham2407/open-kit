import fs from "node:fs"
import path from "node:path"

import { listBackgroundRuns } from "./background-run-store.js"
import { validateMigrationSliceBoard } from "./migration-slice-rules.js"
import { readWorkItemIndex, resolveWorkItemPaths } from "./work-item-store.js"
import {
  getArtifactReadiness,
  getIssueTelemetry,
  getNextAction,
  getParallelizationSummary,
  getVerificationReadiness,
  summarizeArtifactReadinessLines,
  summarizeVerificationEvidence,
  summarizeVerificationReadinessLine,
} from "./runtime-guidance.js"
import { applySequentialConstraintsToTasks } from "./sequential-constraints.js"

const ACTIVE_TASK_STATUSES = new Set(["claimed", "in_progress", "qa_in_progress"])
const ALLOCATION_ACTIVE_TASK_STATUSES = new Set(["claimed", "in_progress", "qa_ready", "qa_in_progress"])
const QA_PENDING_TASK_STATUSES = new Set(["dev_done", "qa_ready"])
const DEPENDENCY_SATISFIED_STATUSES = new Set(["dev_done", "qa_ready", "qa_in_progress", "done", "cancelled"])
const CONCURRENCY_QUEUE_REASONS = new Set(["exclusive-active", "exclusive-window", "parallel-cap", "shared-artifact", "unsafe-zone"])
const BACKGROUND_RUN_LONG_RUNNING_THRESHOLD_MS = 30 * 60 * 1000
const ACTIVE_MIGRATION_SLICE_STATUSES = new Set(["claimed", "in_progress", "parity_ready"])

function getMigrationSliceBoardDetails(projectRoot, state) {
  if (!state || state.mode !== "migration" || !state.work_item_id) {
    return {
      present: false,
      summary: null,
      valid: null,
      error: null,
    }
  }

  const boardPath = path.join(resolveWorkItemPaths(projectRoot, state.work_item_id).workItemDir, "migration-slices.json")
  if (!fs.existsSync(boardPath)) {
    return {
      present: false,
      summary: null,
      valid: null,
      error: null,
    }
  }

  let board = null
  try {
    board = JSON.parse(fs.readFileSync(boardPath, "utf8"))
  } catch (error) {
    return {
      present: true,
      summary: null,
      valid: false,
      error: `Malformed JSON at '${boardPath}': ${error.message}`,
    }
  }

  try {
    validateMigrationSliceBoard({
      ...board,
      mode: state.mode,
      current_stage: state.current_stage,
      parallel_mode: state.parallelization?.parallel_mode ?? "none",
      issues: board.issues ?? [],
    })
  } catch (error) {
    return {
      present: true,
      summary: null,
      valid: false,
      error: error.message,
    }
  }

  const slices = Array.isArray(board.slices) ? board.slices : []
  const activeSlices = slices.filter((slice) => ACTIVE_MIGRATION_SLICE_STATUSES.has(slice.status))
  const blockedSlices = slices.filter((slice) => slice.status === "blocked")
  const verifiedSlices = slices.filter((slice) => slice.status === "verified")
  const queuedSlices = slices.filter((slice) => slice.status === "queued")
  const readySlices = slices.filter((slice) => slice.status === "ready")
  const incompleteSlices = slices.filter((slice) => !["verified", "cancelled"].includes(slice.status))

  let readiness = {
    status: "clear",
    blockers: [],
    nextGate: null,
    nextGateBlocked: false,
    incompleteSliceIds: incompleteSlices.map((slice) => slice.slice_id),
  }

  if (state.current_stage === "migration_upgrade") {
    readiness = {
      status: incompleteSlices.length > 0 ? "review-blocked" : "clear",
      blockers: [
        ...(activeSlices.length > 0
          ? [`active migration slices remain before migration_code_review: ${activeSlices.map((slice) => slice.slice_id).join(", ")}`]
          : []),
        ...(incompleteSlices.length > 0
          ? [
              `incomplete migration slices remain before migration_code_review: ${incompleteSlices
                .map((slice) => slice.slice_id)
                .join(", ")}`,
            ]
          : []),
      ],
      nextGate: "migration_code_review",
      nextGateBlocked: incompleteSlices.length > 0,
      incompleteSliceIds: incompleteSlices.map((slice) => slice.slice_id),
    }
  } else if (state.current_stage === "migration_verify") {
    readiness = {
      status: incompleteSlices.length > 0 ? "done-blocked" : "clear",
      blockers:
        incompleteSlices.length > 0
          ? [
              `incomplete migration slices remain before migration_done: ${incompleteSlices
                .map((slice) => slice.slice_id)
                .join(", ")}`,
            ]
          : [],
      nextGate: "migration_done",
      nextGateBlocked: incompleteSlices.length > 0,
      incompleteSliceIds: incompleteSlices.map((slice) => slice.slice_id),
    }
  }

  return {
    present: true,
    summary: {
      total: slices.length,
      queued: queuedSlices.length,
      ready: readySlices.length,
      active: activeSlices.length,
      blocked: blockedSlices.length,
      verified: verifiedSlices.length,
      incomplete: incompleteSlices.length,
      activeSliceIds: activeSlices.map((slice) => slice.slice_id),
      blockedSliceIds: blockedSlices.map((slice) => slice.slice_id),
      verifiedSliceIds: verifiedSlices.map((slice) => slice.slice_id),
    },
    readiness,
    valid: true,
    error: null,
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function getWorkItemIndexIfExists(projectRoot) {
  const indexPath = path.join(projectRoot, ".opencode", "work-items", "index.json")
  if (!fs.existsSync(indexPath)) {
    return null
  }

  return readWorkItemIndex(projectRoot)
}

function formatActiveTask(task) {
  if (task.status === "qa_in_progress" && task.qa_owner) {
    return `${task.task_id} (${task.status}, qa: ${task.qa_owner})`
  }

  if (task.primary_owner) {
    return `${task.task_id} (${task.status}, primary: ${task.primary_owner})`
  }

  return `${task.task_id} (${task.status})`
}

function isQaTask(task) {
  return task.kind === "qa" || task.kind === "verification"
}

function parseTimestampMs(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getRunTimestamp(run) {
  return run.updated_at ?? run.updatedAt ?? run.created_at ?? run.createdAt ?? null
}

function isLongRunningRun(run, nowMs = Date.now()) {
  if (run.status !== "running") {
    return false
  }

  const timestampMs = parseTimestampMs(getRunTimestamp(run))
  return timestampMs !== null && nowMs - timestampMs >= BACKGROUND_RUN_LONG_RUNNING_THRESHOLD_MS
}

function getUnresolvedDependencies(task, taskIndex) {
  return (task.depends_on ?? []).filter((dependencyId) => {
    const dependency = taskIndex.get(dependencyId)
    return !dependency || !DEPENDENCY_SATISFIED_STATUSES.has(dependency.status)
  })
}

function uniqueValues(values = []) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function normalizePathPrefix(value) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().replace(/^\.\//, "")
  if (trimmed.length === 0) {
    return null
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

function artifactRefMatchesZone(artifactRef, zonePrefix) {
  if (typeof artifactRef !== "string" || artifactRef.length === 0 || typeof zonePrefix !== "string" || zonePrefix.length === 0) {
    return false
  }

  const normalizedArtifactRef = artifactRef.replace(/^\.\//, "")
  return normalizedArtifactRef === zonePrefix.slice(0, -1) || normalizedArtifactRef.startsWith(zonePrefix)
}

function getSafeParallelZoneCoverage(task, safeParallelZones = []) {
  const normalizedZones = uniqueValues(safeParallelZones.map(normalizePathPrefix).filter(Boolean))
  const uncoveredArtifactRefs = (task.artifact_refs ?? []).filter((artifactRef) => {
    return !normalizedZones.some((zonePrefix) => artifactRefMatchesZone(artifactRef, zonePrefix))
  })

  return {
    normalizedZones,
    uncoveredArtifactRefs: uniqueValues(uncoveredArtifactRefs),
  }
}

function buildActiveArtifactUsage(activeTasks = []) {
  const usage = new Map()

  for (const task of activeTasks) {
    for (const artifactRef of task.artifact_refs ?? []) {
      const owners = usage.get(artifactRef) ?? []
      owners.push(task.task_id)
      usage.set(artifactRef, owners)
    }
  }

  return usage
}

function getSharedArtifactConflicts(task, activeArtifactUsage) {
  const conflictingTaskIds = new Set()
  const conflictingArtifactRefs = []

  for (const artifactRef of task.artifact_refs ?? []) {
    const owners = activeArtifactUsage.get(artifactRef) ?? []
    if (owners.length === 0) {
      continue
    }

    conflictingArtifactRefs.push(artifactRef)
    for (const ownerTaskId of owners) {
      conflictingTaskIds.add(ownerTaskId)
    }
  }

  return {
    conflictingTaskIds: [...conflictingTaskIds],
    conflictingArtifactRefs: uniqueValues(conflictingArtifactRefs),
  }
}

function describeAllocationWindow(parallelization, activeTasks) {
  const parallelMode = parallelization?.parallel_mode ?? "none"
  const safeParallelZones = parallelization?.safe_parallel_zones ?? []
  const maxTracks = typeof parallelization?.max_active_execution_tracks === "number"
    ? parallelization.max_active_execution_tracks
    : null
  const exclusiveActiveTaskIds = activeTasks
    .filter((task) => task.concurrency_class === "exclusive")
    .map((task) => task.task_id)
  const activeArtifactUsage = buildActiveArtifactUsage(activeTasks)

  let capReason = null
  if (parallelMode === "none" && activeTasks.length >= 1) {
    capReason = "parallel-mode-none"
  } else if (exclusiveActiveTaskIds.length > 0) {
    capReason = "exclusive-task-active"
  } else if (maxTracks !== null && activeTasks.length >= maxTracks) {
    capReason = "max-tracks-reached"
  }

  const effectiveLimit = maxTracks !== null ? maxTracks : parallelMode === "none" ? 1 : null

  return {
    parallelMode,
    maxActiveExecutionTracks: maxTracks,
    activeExecutionCount: activeTasks.length,
    canStartMore: capReason === null,
    capReason,
    safeParallelZones,
    exclusiveActiveTaskIds,
    activeArtifactUsage,
    parallelCapacityRemaining:
      effectiveLimit === null ? null : Math.max(0, effectiveLimit - activeTasks.length),
  }
}

function rankDispatchableTask(task, boardStage) {
  if (boardStage === "full_qa") {
    return task.status === "qa_ready" ? 400 : 350
  }

  const concurrencyWeight = {
    exclusive: 300,
    parallel_limited: 200,
    parallel_safe: 100,
  }

  return concurrencyWeight[task.concurrency_class] ?? 0
}

function getTaskDispatchability(task, { boardStage, taskIndex, allocation }) {
  const unresolvedDependencies = getUnresolvedDependencies(task, taskIndex)
  const blockedBy = task.blocked_by ?? []
  const sequentialConstraintDependencies = (task.sequential_constraint_dependencies ?? []).filter((dependencyId) => {
    return unresolvedDependencies.includes(dependencyId)
  })
  const { conflictingTaskIds, conflictingArtifactRefs } = getSharedArtifactConflicts(task, allocation.activeArtifactUsage)
  const { normalizedZones, uncoveredArtifactRefs } = getSafeParallelZoneCoverage(task, allocation.safeParallelZones)
  const stageReady =
    (boardStage === "full_qa" && (task.status === "qa_ready" || task.status === "dev_done")) ||
    (boardStage !== "full_qa" && task.status === "ready" && !isQaTask(task))
  const sequentialConstraintQueued =
    boardStage !== "full_qa" &&
    task.status === "queued" &&
    sequentialConstraintDependencies.length > 0 &&
    unresolvedDependencies.length === sequentialConstraintDependencies.length &&
    blockedBy.every((dependencyId) => sequentialConstraintDependencies.includes(dependencyId))

  if (!stageReady && !sequentialConstraintQueued) {
    return {
      dispatchable: false,
      stageReady: false,
      reason: "stage",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  if (unresolvedDependencies.length > 0 || blockedBy.length > 0) {
    return {
      dispatchable: false,
      stageReady: stageReady || sequentialConstraintQueued,
      reason: sequentialConstraintDependencies.length > 0 ? "sequential-constraint" : "dependencies",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  if (allocation.exclusiveActiveTaskIds.length > 0) {
    return {
      dispatchable: false,
      stageReady: true,
      reason: "exclusive-active",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  if (task.concurrency_class === "exclusive" && allocation.activeExecutionCount > 0) {
    return {
      dispatchable: false,
      stageReady: true,
      reason: "exclusive-window",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  if (
    task.concurrency_class === "parallel_limited" &&
    allocation.activeExecutionCount > 0 &&
    uncoveredArtifactRefs.length > 0
  ) {
    return {
      dispatchable: false,
      stageReady: true,
      reason: "unsafe-zone",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  if (conflictingTaskIds.length > 0) {
    return {
      dispatchable: false,
      stageReady: true,
      reason: "shared-artifact",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  if (allocation.capReason === "parallel-mode-none" || allocation.capReason === "max-tracks-reached") {
    return {
      dispatchable: false,
      stageReady: true,
      reason: "parallel-cap",
      unresolvedDependencies,
      blockedBy,
      sequentialConstraintDependencies,
      conflictingActiveTaskIds: conflictingTaskIds,
      conflictingArtifactRefs,
      safeParallelZones: normalizedZones,
      uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
      priority: -1,
    }
  }

  return {
    dispatchable: true,
    stageReady: true,
    reason: null,
    unresolvedDependencies,
    blockedBy,
    sequentialConstraintDependencies,
    conflictingActiveTaskIds: conflictingTaskIds,
    conflictingArtifactRefs,
    safeParallelZones: normalizedZones,
    uncoveredZoneArtifactRefs: uncoveredArtifactRefs,
    priority: rankDispatchableTask(task, boardStage),
  }
}

function buildOrchestrationHealth({ boardStage, summary, allocation, integrationCheckpoint }) {
  const hasNoReadyOrActive = summary.ready === 0 && summary.active === 0
  const staleRunIds = [...summary.staleRunningRuns, ...summary.longRunningRunIds].filter(
    (value, index, values) => values.indexOf(value) === index,
  )
  const primaryTaskId =
    summary.dispatchableTaskIds[0] ??
    summary.exclusiveQueuedTaskIds[0] ??
    summary.dependencyBlockedTaskIds[0] ??
    summary.blockedTaskIds[0] ??
    summary.activeTaskIds[0] ??
    null

  if (summary.dispatchableTaskIds.length > 0) {
    if (boardStage === "full_qa") {
      return {
        status: "dispatchable-qa-handoff",
        blocked: false,
        dispatchable: true,
        reason: `task board is ready for QA handoff: ${summary.dispatchableTaskIds.join(", ")}`,
        recommendedAction: `Assign QA owner and move '${summary.dispatchableTaskIds[0]}' into 'qa_in_progress'.`,
        dispatchableTaskIds: summary.dispatchableTaskIds,
        activeTaskIds: summary.activeTaskIds,
        qaPendingTaskIds: summary.qaPendingTaskIds,
        dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
        blockedTaskIds: summary.blockedTaskIds,
        staleRunningRunIds: staleRunIds,
      }
    }

    return {
      status: "dispatchable-implementation",
      blocked: false,
      dispatchable: true,
      reason: `task board has dispatchable implementation task(s): ${summary.dispatchableTaskIds.join(", ")}`,
      recommendedAction: `Dispatch ready task '${summary.dispatchableTaskIds[0]}' for implementation.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.concurrencyQueued > 0 && allocation.canStartMore === false) {
    const reasonByCap = {
      "parallel-mode-none": "parallel execution is disabled while another task is already active",
      "exclusive-task-active": "an exclusive task is already active",
      "max-tracks-reached": "max active execution tracks have been reached",
    }

    return {
      status: "parallel-cap-reached",
      blocked: false,
      dispatchable: false,
      reason: `task board has stage-ready work but no parallel capacity is currently available because ${reasonByCap[allocation.capReason] ?? "capacity is exhausted"}`,
      recommendedAction:
        summary.activeTaskIds.length > 0
          ? `Wait for active task '${summary.activeTaskIds[0]}' to finish or free a parallel slot before dispatching more work.`
          : "Wait for a parallel slot before dispatching more work.",
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.exclusiveQueuedTaskIds.length > 0 && summary.dispatchable === 0) {
    return {
      status: "waiting-exclusive-window",
      blocked: false,
      dispatchable: false,
      reason: `exclusive task(s) await an isolated execution window: ${summary.exclusiveQueuedTaskIds.join(", ")}`,
      recommendedAction:
        summary.activeTaskIds.length > 0
          ? `Let active task '${summary.activeTaskIds[0]}' finish before dispatching exclusive task '${summary.exclusiveQueuedTaskIds[0]}'.`
          : `Reserve an isolated execution window for exclusive task '${summary.exclusiveQueuedTaskIds[0]}'.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.sharedArtifactQueuedTaskIds.length > 0 && summary.dispatchable === 0) {
    const queuedTaskId = summary.sharedArtifactQueuedTaskIds[0]
    const conflictingTaskIds = summary.sharedArtifactConflictTaskIdsByTaskId?.[queuedTaskId] ?? []
    const conflictingArtifactRefs = summary.sharedArtifactConflictRefsByTaskId?.[queuedTaskId] ?? []

    return {
      status: "waiting-shared-artifact-window",
      blocked: false,
      dispatchable: false,
      reason: `task board has stage-ready work waiting on shared artifact ownership for '${queuedTaskId}'${conflictingArtifactRefs.length > 0 ? ` (${conflictingArtifactRefs.join(", ")})` : ""}`,
      recommendedAction:
        conflictingTaskIds.length > 0
          ? `Let active task '${conflictingTaskIds[0]}' release the shared artifact surface before dispatching '${queuedTaskId}'.`
          : `Wait for the shared artifact surface to clear before dispatching '${queuedTaskId}'.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.sequentialConstraintQueuedTaskIds.length > 0 && summary.dispatchable === 0) {
    const queuedTaskId = summary.sequentialConstraintQueuedTaskIds[0]
    const constraintDependencies = summary.sequentialConstraintDepsByTaskId?.[queuedTaskId] ?? []

    return {
      status: "waiting-sequential-constraint",
      blocked: false,
      dispatchable: false,
      reason: `task board has stage-ready work waiting for sequential constraint order on '${queuedTaskId}'${constraintDependencies.length > 0 ? ` (${constraintDependencies.join(", ")})` : ""}`,
      recommendedAction:
        constraintDependencies.length > 0
          ? `Finish '${constraintDependencies[0]}' before dispatching '${queuedTaskId}', or update sequential_constraints if the enforced order is no longer correct.`
          : `Review sequential_constraints before dispatching '${queuedTaskId}'.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.unsafeZoneQueuedTaskIds.length > 0 && summary.dispatchable === 0) {
    const queuedTaskId = summary.unsafeZoneQueuedTaskIds[0]
    const uncoveredArtifactRefs = summary.unsafeZoneRefsByTaskId?.[queuedTaskId] ?? []

    return {
      status: "waiting-safe-parallel-zone",
      blocked: false,
      dispatchable: false,
      reason: `parallel-limited task '${queuedTaskId}' is outside the declared safe parallel zones${uncoveredArtifactRefs.length > 0 ? ` (${uncoveredArtifactRefs.join(", ")})` : ""}`,
      recommendedAction:
        uncoveredArtifactRefs.length > 0
          ? `Keep '${queuedTaskId}' sequential or expand safe_parallel_zones to cover ${uncoveredArtifactRefs.join(", ")}.`
          : `Keep '${queuedTaskId}' sequential or expand safe_parallel_zones before dispatching it in parallel.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (staleRunIds.length > 0 && hasNoReadyOrActive) {
    return {
      status: "stale-running-runs",
      blocked: true,
      dispatchable: false,
      reason: `task board has no ready or active tasks but background runs still need inspection: ${staleRunIds.join(", ")}`,
      recommendedAction: `Inspect background run '${staleRunIds[0]}' because its execution context appears stale.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.qaPending > 0 && hasNoReadyOrActive) {
    if (boardStage === "full_implementation" && integrationCheckpoint) {
      return {
        status: "waiting-integration-checkpoint",
        blocked: false,
        dispatchable: false,
        reason: `task board has no ready or active tasks because implementation work is complete and integration checkpoint '${integrationCheckpoint}' is pending`,
        recommendedAction: `Run integration checkpoint '${integrationCheckpoint}' or advance the work item once the checkpoint is satisfied.`,
        dispatchableTaskIds: summary.dispatchableTaskIds,
        activeTaskIds: summary.activeTaskIds,
        qaPendingTaskIds: summary.qaPendingTaskIds,
        dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
        blockedTaskIds: summary.blockedTaskIds,
        staleRunningRunIds: staleRunIds,
      }
    }

    return {
      status: "waiting-stage-advance",
      blocked: false,
      dispatchable: false,
      reason: `task board has no ready or active tasks because completed tasks are waiting for the work item to advance beyond '${boardStage}'`,
      recommendedAction: `Advance the work item beyond '${boardStage}' after reconciling completed tasks.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.dependencyBlocked > 0 && hasNoReadyOrActive) {
    return {
      status: "blocked-by-dependencies",
      blocked: true,
      dispatchable: false,
      reason: `task board has no ready or active tasks because dependencies remain unresolved for: ${summary.dependencyBlockedTaskIds.join(", ")}`,
      recommendedAction: `Resolve dependency blockers for '${summary.dependencyBlockedTaskIds[0]}' before dispatching more work.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.blocked > 0 && hasNoReadyOrActive) {
    return {
      status: "blocked-by-tasks",
      blocked: true,
      dispatchable: false,
      reason: `task board has no ready or active tasks because blocked tasks remain: ${summary.blockedTaskIds.join(", ")}`,
      recommendedAction: `Unblock or replan blocked task '${summary.blockedTaskIds[0]}' before dispatching more work.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.active > 0) {
    return {
      status: "active",
      blocked: false,
      dispatchable: false,
      reason: `task board has active execution tasks: ${summary.activeTaskIds.join(", ")}`,
      recommendedAction: `Continue active task '${primaryTaskId}' before dispatching more work.`,
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  if (summary.total > 0) {
    return {
      status: "blocked-no-dispatchable-task",
      blocked: true,
      dispatchable: false,
      reason: "task board has no ready or active tasks",
      recommendedAction: "Reconcile task statuses on the board before dispatching more work.",
      dispatchableTaskIds: summary.dispatchableTaskIds,
      activeTaskIds: summary.activeTaskIds,
      qaPendingTaskIds: summary.qaPendingTaskIds,
      dependencyBlockedTaskIds: summary.dependencyBlockedTaskIds,
      blockedTaskIds: summary.blockedTaskIds,
      staleRunningRunIds: staleRunIds,
    }
  }

  return {
    status: "idle",
    blocked: false,
    dispatchable: false,
    reason: null,
    recommendedAction: null,
    dispatchableTaskIds: [],
    activeTaskIds: [],
    qaPendingTaskIds: [],
    dependencyBlockedTaskIds: [],
    blockedTaskIds: [],
    staleRunningRunIds: staleRunIds,
  }
}

function getTaskBoardDetails(projectRoot, state, relatedBackgroundRuns = []) {
  if (!state || state.mode !== "full" || !state.work_item_id) {
    return {
      present: false,
      summary: null,
      orchestrationHealth: {
        status: "not-applicable",
        blocked: false,
        dispatchable: false,
        reason: null,
        recommendedAction: null,
        dispatchableTaskIds: [],
        activeTaskIds: [],
        qaPendingTaskIds: [],
        dependencyBlockedTaskIds: [],
        blockedTaskIds: [],
        staleRunningRunIds: [],
      },
    }
  }

  const boardPath = path.join(resolveWorkItemPaths(projectRoot, state.work_item_id).workItemDir, "tasks.json")
  const board = readJsonIfExists(boardPath)
  if (!board) {
    return {
      present: false,
      summary: null,
      orchestrationHealth: {
        status: "missing-task-board",
        blocked: false,
        dispatchable: false,
        reason: null,
        recommendedAction: null,
        dispatchableTaskIds: [],
        activeTaskIds: [],
        qaPendingTaskIds: [],
        dependencyBlockedTaskIds: [],
        blockedTaskIds: [],
        staleRunningRunIds: [],
      },
    }
  }

  let tasks = Array.isArray(board.tasks) ? board.tasks : []
  try {
    tasks = applySequentialConstraintsToTasks(tasks, state.parallelization)
  } catch (_error) {
    // Keep doctor/status observable even when sequential_constraints are malformed.
  }
  const boardStage = board.current_stage ?? state.current_stage ?? null
  const taskIndex = new Map(tasks.map((task) => [task.task_id, task]))
  const displayActiveTasks = tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status))
  const allocationActiveTasks = tasks.filter((task) => ALLOCATION_ACTIVE_TASK_STATUSES.has(task.status))
  const allocation = describeAllocationWindow(state.parallelization, allocationActiveTasks)
  const dispatchAnalysis = tasks.map((task) => ({
    task,
    ...getTaskDispatchability(task, { boardStage, taskIndex, allocation }),
  }))
  const dispatchableTasks = dispatchAnalysis
    .filter((entry) => entry.dispatchable)
    .sort((left, right) => right.priority - left.priority)
    .map((entry) => entry.task)
  const qaPendingTasks = tasks.filter((task) => QA_PENDING_TASK_STATUSES.has(task.status))
  const blockedTasks = tasks.filter((task) => task.status === "blocked")
  const dependencyBlockedTasks = dispatchAnalysis
    .filter((entry) => entry.reason === "dependencies")
    .map((entry) => entry.task)
  const sequentialConstraintQueuedEntries = dispatchAnalysis.filter((entry) => entry.reason === "sequential-constraint")
  const sharedArtifactQueuedEntries = dispatchAnalysis.filter((entry) => entry.reason === "shared-artifact")
  const unsafeZoneQueuedEntries = dispatchAnalysis.filter((entry) => entry.reason === "unsafe-zone")
  const concurrencyQueuedTasks = dispatchAnalysis
    .filter((entry) => CONCURRENCY_QUEUE_REASONS.has(entry.reason))
    .map((entry) => entry.task)
  const exclusiveQueuedTasks = dispatchAnalysis
    .filter((entry) => entry.reason === "exclusive-active" || entry.reason === "exclusive-window")
    .map((entry) => entry.task)
  const longRunningRuns = relatedBackgroundRuns.filter((run) => isLongRunningRun(run))
  const staleLinkedRuns = relatedBackgroundRuns.filter((run) => {
    if (run.status !== "running" || !run.task_id) {
      return false
    }

    const linkedTask = taskIndex.get(run.task_id)
    return !linkedTask || !ACTIVE_TASK_STATUSES.has(linkedTask.status)
  })

  const summary = {
    total: tasks.length,
    queued: tasks.filter((task) => task.status === "queued").length,
    ready: tasks.filter((task) => task.status === "ready").length,
    blocked: blockedTasks.length,
    active: displayActiveTasks.length,
    activeTasks: displayActiveTasks.map(formatActiveTask),
    activeTaskIds: displayActiveTasks.map((task) => task.task_id),
    allocationActive: allocationActiveTasks.length,
    allocationActiveTaskIds: allocationActiveTasks.map((task) => task.task_id),
    qaPending: qaPendingTasks.length,
    qaPendingTaskIds: qaPendingTasks.map((task) => task.task_id),
    dependencyBlocked: dependencyBlockedTasks.length,
    dependencyBlockedTaskIds: dependencyBlockedTasks.map((task) => task.task_id),
    sequentialConstraintQueuedTaskIds: sequentialConstraintQueuedEntries.map((entry) => entry.task.task_id),
    sequentialConstraintDepsByTaskId: Object.fromEntries(
      sequentialConstraintQueuedEntries.map((entry) => [entry.task.task_id, entry.sequentialConstraintDependencies ?? []]),
    ),
    blockedTaskIds: blockedTasks.map((task) => task.task_id),
    done: tasks.filter((task) => task.status === "done").length,
    cancelled: tasks.filter((task) => task.status === "cancelled").length,
    stageReadyCount: dispatchAnalysis.filter((entry) => entry.stageReady).length,
    stageReadyTaskIds: dispatchAnalysis.filter((entry) => entry.stageReady).map((entry) => entry.task.task_id),
    dispatchable: dispatchableTasks.length,
    dispatchableTaskIds: dispatchableTasks.map((task) => task.task_id),
    concurrencyQueued: concurrencyQueuedTasks.length,
    concurrencyQueuedTaskIds: concurrencyQueuedTasks.map((task) => task.task_id),
    exclusiveQueuedTaskIds: exclusiveQueuedTasks.map((task) => task.task_id),
    sharedArtifactQueuedTaskIds: sharedArtifactQueuedEntries.map((entry) => entry.task.task_id),
    sharedArtifactConflictTaskIdsByTaskId: Object.fromEntries(
      sharedArtifactQueuedEntries.map((entry) => [entry.task.task_id, entry.conflictingActiveTaskIds ?? []]),
    ),
    sharedArtifactConflictRefsByTaskId: Object.fromEntries(
      sharedArtifactQueuedEntries.map((entry) => [entry.task.task_id, entry.conflictingArtifactRefs ?? []]),
    ),
    unsafeZoneQueuedTaskIds: unsafeZoneQueuedEntries.map((entry) => entry.task.task_id),
    unsafeZoneRefsByTaskId: Object.fromEntries(
      unsafeZoneQueuedEntries.map((entry) => [entry.task.task_id, entry.uncoveredZoneArtifactRefs ?? []]),
    ),
    waitingForStageAdvance: qaPendingTasks.length > 0 && displayActiveTasks.length === 0 && dispatchableTasks.length === 0,
    waitingForIntegrationCheckpoint:
      boardStage === "full_implementation" && Boolean(state.parallelization?.integration_checkpoint) && qaPendingTasks.length > 0 && displayActiveTasks.length === 0 && dispatchableTasks.length === 0,
    allocation,
    staleRunningRuns: staleLinkedRuns.map((run) => run.run_id ?? run.id),
    longRunningRunIds: longRunningRuns.map((run) => run.run_id ?? run.id),
  }

  return {
    present: true,
    summary,
    orchestrationHealth: buildOrchestrationHealth({
      boardStage,
      summary,
      allocation,
      integrationCheckpoint: state.parallelization?.integration_checkpoint ?? null,
    }),
  }
}

function getRuntimeContext(projectRoot, state) {
  const index = getWorkItemIndexIfExists(projectRoot)
  const backgroundRuns = listBackgroundRuns(projectRoot)
  const artifactReadiness = getArtifactReadiness(state)
  const verificationReadiness = getVerificationReadiness(state)
  const issueTelemetry = getIssueTelemetry(state)
  const relatedBackgroundRuns = backgroundRuns.filter((run) => !state?.work_item_id || run.work_item_id === state.work_item_id)
  const taskBoard = getTaskBoardDetails(projectRoot, state, relatedBackgroundRuns)
  const migrationSliceBoard = getMigrationSliceBoardDetails(projectRoot, state)

  return {
    activeWorkItemId: index?.active_work_item_id ?? state?.work_item_id ?? null,
    workItemCount: index?.work_items?.length ?? null,
    taskBoardPresent: taskBoard.present,
    taskBoardSummary: taskBoard.summary,
    migrationSliceBoardPresent: migrationSliceBoard.present,
    migrationSliceSummary: migrationSliceBoard.summary,
    migrationSliceReadiness: migrationSliceBoard.readiness ?? null,
    migrationSliceBoardValid: migrationSliceBoard.valid,
    migrationSliceBoardError: migrationSliceBoard.error,
    orchestrationHealth: taskBoard.orchestrationHealth,
    nextAction: getNextAction(state),
    lastAutoScaffold: state?.last_auto_scaffold ?? null,
    lastAutoScaffoldLine:
      state?.last_auto_scaffold && state.last_auto_scaffold.path
        ? `last auto-scaffold: ${state.last_auto_scaffold.artifact} -> ${state.last_auto_scaffold.path} @ ${state.last_auto_scaffold.stage}`
        : null,
    artifactReadiness,
    artifactReadinessLines: summarizeArtifactReadinessLines(state),
    verificationReadiness,
    verificationReadinessLine: summarizeVerificationReadinessLine(state),
    verificationEvidenceLines: summarizeVerificationEvidence(state),
    issueTelemetry,
    parallelization: getParallelizationSummary(state),
    backgroundRuns: relatedBackgroundRuns,
    backgroundRunSummary: {
      total: relatedBackgroundRuns.length,
      running: relatedBackgroundRuns.filter((run) => run.status === "running").length,
      completed: relatedBackgroundRuns.filter((run) => run.status === "completed").length,
      cancelled: relatedBackgroundRuns.filter((run) => run.status === "cancelled").length,
      staleLinkedRunIds: taskBoard.summary?.staleRunningRuns ?? [],
      longRunningRunIds: taskBoard.summary?.longRunningRunIds ?? [],
    },
  }
}

export {
  getRuntimeContext,
}
