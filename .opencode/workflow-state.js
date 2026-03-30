#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const {
  ESCALATION_RETRY_THRESHOLD,
  addReleaseWorkItem,
  advanceStage,
  clearIssues,
  clearVerificationEvidence,
  claimTask,
  claimMigrationSlice,
  completeBackgroundRun,
  createTask,
  createMigrationSlice,
  createReleaseCandidate,
  createWorkItem,
  getApprovalBottlenecks,
  getBackgroundRun,
  getBackgroundRuns,
  getDefinitionOfDone,
  getIssueAgingReport,
  getOpsSummary,
  getPolicyExecutionTrace,
  getProfile,
  getQaFailureSummary,
  getReleaseCandidateReadiness,
  getReleaseDashboard,
  getReleaseReadiness,
  getRuntimeShortSummary,
  getWorkItemCloseoutSummary,
  getTaskAgingReport,
  getRuntimeStatus,
  getWorkflowAnalytics,
  getWorkflowMetrics,
  getVersionInfo,
  integrationCheck,
  linkArtifact,
  listMigrationSlices,
  listReleaseCandidates,
  listStaleIssues,
  listTasks,
  listWorkItems,
  listProfiles,
  reassignTask,
  recordRollbackPlan,
  recordIssue,
  recordVerificationEvidence,
  reconcileCompletedWorkItems,
  removeReleaseWorkItem,
  releaseTask,
  resolveStatePath,
  routeRework,
  runDoctor,
  scaffoldAndLinkArtifact,
  selectActiveWorkItem,
  assignMigrationQaOwner,
  assignQaOwner,
  setParallelization,
  setMigrationSliceStatus,
  setReleaseApproval,
  setReleaseStatus,
  setRoutingProfile,
  setTaskStatus,
  setApproval,
  showState,
  showReleaseCandidate,
  showWorkItemState,
  startBackgroundRun,
  startHotfix,
  syncInstallManifest,
  startFeature,
  startTask,
  cancelBackgroundRun,
  updateIssueStatus,
  draftReleaseNotes,
  validateMigrationSliceBoardForWorkItem,
  validateReleaseNotes,
  validateTaskAllocation,
  validateHotfix,
  validateWorkItemBoard,
  validateState,
} = require("./lib/workflow-state-controller")
const { resolveWorkItemPaths, validateActiveMirror } = require("./lib/work-item-store")
const { getRuntimeContext } = require("./lib/runtime-summary")
const { flattenArtifactRefs } = require("./lib/runtime-guidance")

function printUsage() {
  console.log(`Usage:
  node .opencode/workflow-state.js [--state <path>] show
  node .opencode/workflow-state.js [--state <path>] status
  node .opencode/workflow-state.js [--state <path>] status --short
  node .opencode/workflow-state.js [--state <path>] resume-summary
  node .opencode/workflow-state.js [--state <path>] resume-summary --short
  node .opencode/workflow-state.js [--state <path>] doctor
  node .opencode/workflow-state.js [--state <path>] doctor --short
  node .opencode/workflow-state.js [--state <path>] version
  node .opencode/workflow-state.js [--state <path>] profiles
  node .opencode/workflow-state.js [--state <path>] show-profile <name>
  node .opencode/workflow-state.js [--state <path>] sync-install-manifest <name>
  node .opencode/workflow-state.js [--state <path>] validate
  node .opencode/workflow-state.js [--state <path>] start-feature <feature_id> <feature_slug>
  node .opencode/workflow-state.js [--state <path>] start-task <mode> <feature_id> <feature_slug> <mode_reason>
  node .opencode/workflow-state.js [--state <path>] create-work-item <mode> <feature_id> <feature_slug> <mode_reason>
  node .opencode/workflow-state.js [--state <path>] list-work-items
  node .opencode/workflow-state.js [--state <path>] task-aging-report
  node .opencode/workflow-state.js [--state <path>] workflow-analytics
  node .opencode/workflow-state.js [--state <path>] ops-summary
  node .opencode/workflow-state.js [--state <path>] create-release-candidate <release_id> <title>
  node .opencode/workflow-state.js [--state <path>] list-release-candidates
  node .opencode/workflow-state.js [--state <path>] show-release-candidate <release_id>
  node .opencode/workflow-state.js [--state <path>] add-release-work-item <release_id> <work_item_id>
  node .opencode/workflow-state.js [--state <path>] remove-release-work-item <release_id> <work_item_id>
  node .opencode/workflow-state.js [--state <path>] set-release-status <release_id> <status>
  node .opencode/workflow-state.js [--state <path>] set-release-approval <release_id> <gate> <status> [approved_by] [approved_at] [notes]
  node .opencode/workflow-state.js [--state <path>] record-rollback-plan <release_id> <summary> <owner> <trigger_signals_csv>
  node .opencode/workflow-state.js [--state <path>] draft-release-notes <release_id>
  node .opencode/workflow-state.js [--state <path>] validate-release-notes <release_id>
  node .opencode/workflow-state.js [--state <path>] check-release-gates <release_id>
  node .opencode/workflow-state.js [--state <path>] release-dashboard
  node .opencode/workflow-state.js [--state <path>] start-hotfix <release_id> <mode> <feature_id> <feature_slug> <reason>
  node .opencode/workflow-state.js [--state <path>] validate-hotfix <work_item_id>
  node .opencode/workflow-state.js [--state <path>] show-work-item <work_item_id>
  node .opencode/workflow-state.js [--state <path>] closeout-summary <work_item_id>
  node .opencode/workflow-state.js [--state <path>] release-readiness
  node .opencode/workflow-state.js [--state <path>] show-dod
  node .opencode/workflow-state.js [--state <path>] validate-dod
  node .opencode/workflow-state.js [--state <path>] reconcile-work-items <work_item_id> [additional_work_item_ids...]
  node .opencode/workflow-state.js [--state <path>] activate-work-item <work_item_id>
  node .opencode/workflow-state.js [--state <path>] advance-stage <stage>
  node .opencode/workflow-state.js [--state <path>] set-approval <gate> <status> [approved_by] [approved_at] [notes]
  node .opencode/workflow-state.js [--state <path>] link-artifact <kind> <path>
  node .opencode/workflow-state.js [--state <path>] scaffold-artifact <task_card|scope_package|solution_package|migration_report> <slug>
  node .opencode/workflow-state.js [--state <path>] set-routing-profile <work_intent> <behavior_delta> <dominant_uncertainty> <scope_shape> <selection_reason>
  node .opencode/workflow-state.js [--state <path>] set-parallelization <parallel_mode> [why] [integration_checkpoint] [max_active_execution_tracks]
  node .opencode/workflow-state.js [--state <path>] list-tasks <work_item_id>
  node .opencode/workflow-state.js [--state <path>] create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]
  node .opencode/workflow-state.js [--state <path>] validate-task-allocation <work_item_id>
  node .opencode/workflow-state.js [--state <path>] integration-check <work_item_id>
  node .opencode/workflow-state.js [--state <path>] claim-task <work_item_id> <task_id> <owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] release-task <work_item_id> <task_id> <requested_by>
  node .opencode/workflow-state.js [--state <path>] reassign-task <work_item_id> <task_id> <owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] set-task-status <work_item_id> <task_id> <status>
  node .opencode/workflow-state.js [--state <path>] validate-work-item-board <work_item_id>
  node .opencode/workflow-state.js [--state <path>] list-migration-slices <work_item_id>
  node .opencode/workflow-state.js [--state <path>] create-migration-slice <work_item_id> <slice_id> <title> <kind>
  node .opencode/workflow-state.js [--state <path>] claim-migration-slice <work_item_id> <slice_id> <owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] assign-migration-qa-owner <work_item_id> <slice_id> <qa_owner> <requested_by>
  node .opencode/workflow-state.js [--state <path>] set-migration-slice-status <work_item_id> <slice_id> <status>
  node .opencode/workflow-state.js [--state <path>] validate-migration-slice-board <work_item_id>
  node .opencode/workflow-state.js [--state <path>] record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>
  node .opencode/workflow-state.js [--state <path>] update-issue-status <issue_id> <status>
  node .opencode/workflow-state.js [--state <path>] list-stale-issues
  node .opencode/workflow-state.js [--state <path>] issue-aging-report
  node .opencode/workflow-state.js [--state <path>] record-verification-evidence <id> <kind> <scope> <summary> <source> [command] [exit_status] [artifact_refs]
  node .opencode/workflow-state.js [--state <path>] clear-verification-evidence
  node .opencode/workflow-state.js [--state <path>] start-background-run <title> [payload_json] [work_item_id] [task_id]
  node .opencode/workflow-state.js [--state <path>] list-background-runs
  node .opencode/workflow-state.js [--state <path>] show-background-run <run_id>
  node .opencode/workflow-state.js [--state <path>] complete-background-run <run_id> [output_json]
  node .opencode/workflow-state.js [--state <path>] cancel-background-run <run_id>
  node .opencode/workflow-state.js [--state <path>] check-stage-readiness
  node .opencode/workflow-state.js [--state <path>] workflow-metrics
  node .opencode/workflow-state.js [--state <path>] approval-bottlenecks
  node .opencode/workflow-state.js [--state <path>] qa-failure-summary
  node .opencode/workflow-state.js [--state <path>] policy-trace
  node .opencode/workflow-state.js [--state <path>] clear-issues
  node .opencode/workflow-state.js [--state <path>] route-rework <issue_type> [repeat_failed_fix=true|false]`)
}

function parseGlobalFlags(argv) {
  const args = [...argv]
  let statePath = null

  while (args[0] === "--state") {
    args.shift()
    if (!args[0]) {
      throw new Error("Missing value for --state")
    }
    statePath = args.shift()
  }

  return { args, statePath }
}

function printState(prefix, result) {
  console.log(prefix)
  console.log(`State file: ${result.statePath}`)
  printRuntimeTaskContext(result.runtimeContext)
  console.log(JSON.stringify(result.state, null, 2))
}

function printRuntimeTaskContext(context) {
  if (!context) {
    return
  }

  if (context.activeWorkItemId) {
    console.log(`active work item id: ${context.activeWorkItemId}`)
  }

  if (typeof context.workItemCount === "number") {
    console.log(`work items tracked: ${context.workItemCount}`)
  }

  if (context.taskBoardSummary) {
    console.log(
      `task board: ${context.taskBoardSummary.total} tasks | ready ${context.taskBoardSummary.ready} | active ${context.taskBoardSummary.active}`,
    )
    if (context.taskBoardSummary.activeTasks.length > 0) {
      console.log(`active tasks: ${context.taskBoardSummary.activeTasks.join("; ")}`)
    }
    if ((context.taskBoardSummary.sharedArtifactQueuedTaskIds ?? []).length > 0) {
      const queuedTaskId = context.taskBoardSummary.sharedArtifactQueuedTaskIds[0]
      const conflictingTaskIds = context.taskBoardSummary.sharedArtifactConflictTaskIdsByTaskId?.[queuedTaskId] ?? []
      const conflictingArtifactRefs = context.taskBoardSummary.sharedArtifactConflictRefsByTaskId?.[queuedTaskId] ?? []
      console.log(
        `shared-artifact waits: ${queuedTaskId}${conflictingTaskIds.length > 0 ? ` <- ${conflictingTaskIds.join(", ")}` : ""}${conflictingArtifactRefs.length > 0 ? ` | refs=${conflictingArtifactRefs.join(", ")}` : ""}`,
      )
    }
  }

  if (context.migrationSliceSummary) {
    console.log(
      `migration slices: ${context.migrationSliceSummary.total} total | ready ${context.migrationSliceSummary.ready} | active ${context.migrationSliceSummary.active} | blocked ${context.migrationSliceSummary.blocked} | verified ${context.migrationSliceSummary.verified} | incomplete ${context.migrationSliceSummary.incomplete ?? 0}`,
    )
    if ((context.migrationSliceSummary.activeSliceIds ?? []).length > 0) {
      console.log(`active migration slices: ${context.migrationSliceSummary.activeSliceIds.join(", ")}`)
    }
    if ((context.migrationSliceSummary.blockedSliceIds ?? []).length > 0) {
      console.log(`blocked migration slices: ${context.migrationSliceSummary.blockedSliceIds.join(", ")}`)
    }
  }

  if (context.migrationSliceReadiness?.nextGate) {
    console.log(
      `migration slice readiness: ${context.migrationSliceReadiness.status} | next gate ${context.migrationSliceReadiness.nextGate} | blocked ${context.migrationSliceReadiness.nextGateBlocked ? "yes" : "no"}`,
    )
    for (const blocker of context.migrationSliceReadiness.blockers ?? []) {
      console.log(`migration slice blocker: ${blocker}`)
    }
  }

  if (context.nextAction) {
    console.log(`next action: ${context.nextAction}`)
  }

  if (context.lastAutoScaffoldLine) {
    console.log(context.lastAutoScaffoldLine)
  }

  if (Array.isArray(context.artifactReadinessLines) && context.artifactReadinessLines.length > 0) {
    console.log(`artifact readiness: ${context.artifactReadinessLines.join(" | ")}`)
  }

  if (context.parallelization?.parallel_mode) {
    console.log(`parallel mode: ${context.parallelization.parallel_mode}`)
  }

  if (context.orchestrationHealth?.reason) {
    console.log(
      `orchestration: ${context.orchestrationHealth.blocked ? "blocked" : context.orchestrationHealth.dispatchable ? "dispatchable" : "waiting"} | ${context.orchestrationHealth.reason}`,
    )
  }

  if (context.orchestrationHealth?.recommendedAction) {
    console.log(`workflow recommendation: ${context.orchestrationHealth.recommendedAction}`)
  }

  if (context.backgroundRunSummary?.total > 0) {
    console.log(
      `background runs: ${context.backgroundRunSummary.total} total | running ${context.backgroundRunSummary.running} | completed ${context.backgroundRunSummary.completed} | cancelled ${context.backgroundRunSummary.cancelled}`,
    )
    if ((context.backgroundRunSummary.staleLinkedRunIds ?? []).length > 0) {
      console.log(`stale linked runs: ${context.backgroundRunSummary.staleLinkedRunIds.join(", ")}`)
    }
    if ((context.backgroundRunSummary.longRunningRunIds ?? []).length > 0) {
      console.log(`long-running runs: ${context.backgroundRunSummary.longRunningRunIds.join(", ")}`)
    }
  }
}

function printRuntimeStatus(runtime) {
  console.log("OpenKit runtime status:")
  console.log(`project root: ${runtime.projectRoot}`)
  console.log(`kit: ${runtime.kitName} v${runtime.kitVersion}`)
  console.log(`entry agent: ${runtime.entryAgent}`)
  console.log(`active profile: ${runtime.activeProfile}`)
  console.log(`registry: ${runtime.registryPath}`)
  console.log(`install manifest: ${runtime.installManifestPath}`)
  console.log(`state file: ${runtime.statePath}`)
  console.log(`mode: ${runtime.state.mode}`)
  console.log(`stage: ${runtime.state.current_stage}`)
  console.log(`status: ${runtime.state.status}`)
  console.log(`owner: ${runtime.state.current_owner}`)
  if (runtime.state.feature_id && runtime.state.feature_slug) {
    console.log(`work item: ${runtime.state.feature_id} (${runtime.state.feature_slug})`)
  }
  printRuntimeTaskContext(runtime.runtimeContext)
  if (runtime.runtimeContext.verificationReadinessLine) {
    console.log(runtime.runtimeContext.verificationReadinessLine)
  }
  if (runtime.runtimeContext.issueTelemetry) {
    console.log(
      `issues: ${runtime.runtimeContext.issueTelemetry.total} total | ${runtime.runtimeContext.issueTelemetry.open} open | ${runtime.runtimeContext.issueTelemetry.repeated} repeated`,
    )
  }
}

function printRuntimeStatusShort(summary) {
  console.log(`${summary.mode} | ${summary.stage} | ${summary.owner}`)
  if (summary.nextAction) {
    console.log(`next: ${summary.nextAction}`)
  }
  if (summary.lastAutoScaffold?.path) {
    console.log(`auto-scaffold: ${summary.lastAutoScaffold.artifact} -> ${summary.lastAutoScaffold.path}`)
  }
  if (summary.backgroundRunSummary?.total > 0) {
    console.log(`background: ${summary.backgroundRunSummary.total} total | running ${summary.backgroundRunSummary.running}`)
  }
  console.log(summary.readiness)
}

function summarizeApprovalStatuses(state) {
  const summary = {
    pending: [],
    approved: [],
    rejected: [],
    other: [],
  }

  for (const [gate, approval] of Object.entries(state?.approvals ?? {})) {
    const status = approval?.status ?? "other"
    if (status === "pending") {
      summary.pending.push(gate)
    } else if (status === "approved") {
      summary.approved.push(gate)
    } else if (status === "rejected") {
      summary.rejected.push(gate)
    } else {
      summary.other.push(`${gate}:${status}`)
    }
  }

  return summary
}

function buildResumeSummary(runtime) {
  const { state, runtimeContext } = runtime
  const approvals = summarizeApprovalStatuses(state)
  const artifacts = flattenArtifactRefs(state)
  const issues = Array.isArray(state?.issues) ? state.issues : []

  return {
    state_file: runtime.statePath,
    mode: state.mode,
    stage: state.current_stage,
    status: state.status,
    owner: state.current_owner,
    feature_id: state.feature_id ?? null,
    feature_slug: state.feature_slug ?? null,
    active_work_item_id: runtimeContext.activeWorkItemId ?? null,
    next_safe_action: runtimeContext.nextAction ?? null,
    approvals,
    linked_artifacts: artifacts,
    artifact_readiness: runtimeContext.artifactReadinessLines ?? [],
    verification_readiness: runtimeContext.verificationReadiness ?? null,
    verification_evidence: runtimeContext.verificationEvidenceLines ?? [],
    issue_telemetry: runtimeContext.issueTelemetry ?? null,
    task_board: runtimeContext.taskBoardSummary ?? null,
    migration_slice_board: runtimeContext.migrationSliceSummary ?? null,
    migration_slice_readiness: runtimeContext.migrationSliceReadiness ?? null,
    parallelization: runtimeContext.parallelization ?? null,
    last_auto_scaffold: runtimeContext.lastAutoScaffold ?? null,
    escalated_from: state.escalated_from ?? null,
    escalation_reason: state.escalation_reason ?? null,
    issues,
    read_next: [
      "AGENTS.md",
      "context/navigation.md",
      "context/core/workflow.md",
      "context/core/session-resume.md",
    ],
    diagnostics: {
      global: "openkit doctor",
      runtime: "node .opencode/workflow-state.js doctor",
    },
  }
}

function printResumeSummary(runtime) {
  const { state, runtimeContext } = runtime
  const approvals = summarizeApprovalStatuses(state)
  const artifacts = flattenArtifactRefs(state)
  const issues = Array.isArray(state?.issues) ? state.issues : []

  console.log("OpenKit resume summary:")
  console.log(`state file: ${runtime.statePath}`)
  console.log(`mode: ${state.mode}`)
  console.log(`stage: ${state.current_stage}`)
  console.log(`status: ${state.status}`)
  console.log(`owner: ${state.current_owner}`)
  if (state.feature_id && state.feature_slug) {
    console.log(`work item: ${state.feature_id} (${state.feature_slug})`)
  }
  if (runtimeContext.activeWorkItemId) {
    console.log(`active work item id: ${runtimeContext.activeWorkItemId}`)
  }
  if (runtimeContext.nextAction) {
    console.log(`next safe action: ${runtimeContext.nextAction}`)
  }
  if (runtimeContext.lastAutoScaffoldLine) {
    console.log(runtimeContext.lastAutoScaffoldLine)
  }
  console.log(
    `pending approvals: ${approvals.pending.length > 0 ? approvals.pending.join(", ") : "none"}`,
  )
  if (approvals.approved.length > 0) {
    console.log(`approved gates: ${approvals.approved.join(", ")}`)
  }
  if (approvals.rejected.length > 0) {
    console.log(`rejected gates: ${approvals.rejected.join(", ")}`)
  }
  if (approvals.other.length > 0) {
    console.log(`other gate states: ${approvals.other.join(", ")}`)
  }
  if (artifacts.length > 0) {
    console.log("linked artifacts:")
    for (const artifact of artifacts) {
      console.log(`- ${artifact.artifact}: ${artifact.path}`)
    }
  } else {
    console.log("linked artifacts: none")
  }
  if (Array.isArray(runtimeContext.artifactReadinessLines) && runtimeContext.artifactReadinessLines.length > 0) {
    console.log(`artifact readiness: ${runtimeContext.artifactReadinessLines.join(" | ")}`)
  }
  if (runtimeContext.verificationReadinessLine) {
    console.log(runtimeContext.verificationReadinessLine)
  }
  if (Array.isArray(runtimeContext.verificationEvidenceLines) && runtimeContext.verificationEvidenceLines.length > 0) {
    console.log(`verification evidence: ${runtimeContext.verificationEvidenceLines.join(" | ")}`)
  }
  if (runtimeContext.taskBoardSummary) {
    console.log(
      `task board: ${runtimeContext.taskBoardSummary.total} tasks | ready ${runtimeContext.taskBoardSummary.ready} | active ${runtimeContext.taskBoardSummary.active}`,
    )
    if (runtimeContext.taskBoardSummary.activeTasks.length > 0) {
      console.log(`active tasks: ${runtimeContext.taskBoardSummary.activeTasks.join("; ")}`)
    }
  }
  if (runtimeContext.migrationSliceSummary) {
    console.log(
      `migration slices: ${runtimeContext.migrationSliceSummary.total} total | ready ${runtimeContext.migrationSliceSummary.ready} | active ${runtimeContext.migrationSliceSummary.active} | blocked ${runtimeContext.migrationSliceSummary.blocked} | verified ${runtimeContext.migrationSliceSummary.verified} | incomplete ${runtimeContext.migrationSliceSummary.incomplete ?? 0}`,
    )
    if ((runtimeContext.migrationSliceSummary.activeSliceIds ?? []).length > 0) {
      console.log(`active migration slices: ${runtimeContext.migrationSliceSummary.activeSliceIds.join(", ")}`)
    }
  }
  if (runtimeContext.migrationSliceReadiness?.nextGate) {
    console.log(
      `migration slice readiness: ${runtimeContext.migrationSliceReadiness.status} | next gate ${runtimeContext.migrationSliceReadiness.nextGate} | blocked ${runtimeContext.migrationSliceReadiness.nextGateBlocked ? "yes" : "no"}`,
    )
    for (const blocker of runtimeContext.migrationSliceReadiness.blockers ?? []) {
      console.log(`migration slice blocker: ${blocker}`)
    }
  }
  if (runtimeContext.parallelization?.parallel_mode) {
    console.log(`parallel mode: ${runtimeContext.parallelization.parallel_mode}`)
  }
  if (state.escalated_from) {
    console.log(`escalated from: ${state.escalated_from}`)
  }
  if (state.escalation_reason) {
    console.log(`escalation reason: ${state.escalation_reason}`)
  }
  if (issues.length > 0) {
    console.log("open issues:")
    for (const issue of issues) {
      const title = issue?.title ?? issue?.issue_id ?? "unknown issue"
      const type = issue?.type ? ` | ${issue.type}` : ""
      const severity = issue?.severity ? ` | ${issue.severity}` : ""
      console.log(`- ${title}${type}${severity}`)
    }
  } else {
    console.log("open issues: none")
  }
  if (runtimeContext.issueTelemetry) {
    console.log(
      `issue telemetry: ${runtimeContext.issueTelemetry.total} total | ${runtimeContext.issueTelemetry.open} open | ${runtimeContext.issueTelemetry.repeated} repeated | ${runtimeContext.issueTelemetry.staleSignals} stale-signals`,
    )
  }
  console.log(
    "read next: AGENTS.md -> context/navigation.md -> context/core/workflow.md -> context/core/session-resume.md",
  )
  console.log(
    "diagnostics: openkit doctor for global readiness | node .opencode/workflow-state.js doctor for runtime diagnostics",
  )
}

function printResumeSummaryShort(runtime) {
  const summary = buildResumeSummary(runtime)
  console.log(`${summary.mode} | ${summary.stage} | ${summary.owner}`)
  if (summary.next_safe_action) {
    console.log(`next: ${summary.next_safe_action}`)
  }
  console.log(
    `approvals pending: ${summary.approvals.pending.length > 0 ? summary.approvals.pending.join(", ") : "none"}`,
  )
}

function printDoctorReport(report) {
  console.log("OpenKit doctor:")
  console.log(`active profile: ${report.runtime.activeProfile}`)
  console.log(`registry: ${report.runtime.registryPath}`)
  console.log(`install manifest: ${report.runtime.installManifestPath}`)
  printRuntimeTaskContext(report.runtime.runtimeContext)
  if (Array.isArray(report.runtime.backgroundRuns) && report.runtime.backgroundRuns.length > 0) {
    console.log(`background runs tracked: ${report.runtime.backgroundRuns.length}`)
  }
  for (const check of report.checks) {
    console.log(`[${check.ok ? "ok" : "error"}] ${check.label}`)
  }
  console.log(
    `Summary: ${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.error} error`,
  )
}

function printDoctorReportShort(report) {
  console.log(`doctor | ok ${report.summary.ok} | error ${report.summary.error}`)
  const runtimeContext = report.runtime?.runtimeContext
  if (runtimeContext?.orchestrationHealth?.reason) {
    console.log(
      `orchestration: ${runtimeContext.orchestrationHealth.blocked ? "blocked" : runtimeContext.orchestrationHealth.dispatchable ? "dispatchable" : "waiting"} | ${runtimeContext.orchestrationHealth.reason}`,
    )
  }
  if ((runtimeContext?.backgroundRunSummary?.longRunningRunIds ?? []).length > 0) {
    console.log(`long-running runs: ${runtimeContext.backgroundRunSummary.longRunningRunIds.join(", ")}`)
  }
}

function printBackgroundRuns(result) {
  console.log("OpenKit background runs:")
  if (result.runs.length === 0) {
    console.log("none")
    return
  }

  for (const run of result.runs) {
    console.log(`${run.run_id} | ${run.status} | ${run.title}`)
  }
}

function printBackgroundRun(result) {
  console.log(JSON.stringify(result.run, null, 2))
}

function printProfiles(profiles) {
  console.log("OpenKit profiles:")
  for (const profile of profiles) {
    const marker = profile.defaultForRepository ? "*" : " "
    console.log(`${marker} ${profile.name} - ${profile.description}`)
  }
}

function printProfile(profile) {
  console.log(`Profile: ${profile.name}`)
  console.log(`default: ${profile.defaultForRepository ? "yes" : "no"}`)
  console.log(`components: ${profile.componentRefs.join(", ")}`)
}

function printVersion(info) {
  console.log(`OpenKit version: ${info.kitVersion}`)
  console.log(`active profile: ${info.activeProfile}`)
}

function printWorkItems(result) {
  console.log(`Active work item: ${result.index.active_work_item_id ?? "none"}`)
  for (const item of result.workItems) {
    const marker = item.work_item_id === result.index.active_work_item_id ? "*" : " "
    console.log(`${marker} ${item.work_item_id} | ${item.feature_id} | ${item.mode} | ${item.status}`)
    if (item.next_action) {
      console.log(`  next action: ${item.next_action}`)
    }
  }
}

function printWorkItem(result) {
  console.log(`Work item: ${result.state.work_item_id}`)
  console.log(`feature: ${result.state.feature_id} (${result.state.feature_slug})`)
  console.log(`mode: ${result.state.mode}`)
  console.log(`stage: ${result.state.current_stage}`)
  console.log(`status: ${result.state.status}`)
  const runtimeContext = getRuntimeContext(path.dirname(path.dirname(result.statePath)), result.state)
  if (runtimeContext.nextAction) {
    console.log(`next action: ${runtimeContext.nextAction}`)
  }
  if (runtimeContext.artifactReadinessLines.length > 0) {
    console.log(`artifact readiness: ${runtimeContext.artifactReadinessLines.join(" | ")}`)
  }
}

function printTasks(result) {
  console.log(`Tasks for ${result.workItemId}:`)
  for (const task of result.tasks) {
    console.log(`${task.task_id} | ${task.status} | ${task.kind} | ${task.title}`)
  }
}

function printMigrationSlices(result) {
  console.log(`Migration slices for ${result.workItemId}:`)
  for (const slice of result.slices) {
    console.log(`${slice.slice_id} | ${slice.status} | ${slice.kind} | ${slice.title}`)
  }
}

function printCloseoutSummary(result) {
  console.log(`Work item: ${result.workItemId}`)
  console.log(`ready to close: ${result.readyToClose ? "yes" : "no"}`)
  if (result.missingRequiredArtifacts.length > 0) {
    console.log(`missing required artifacts: ${result.missingRequiredArtifacts.map((entry) => entry.artifact).join(", ")}`)
  }
  if (result.recommendedArtifacts.length > 0) {
    console.log(`recommended artifacts now: ${result.recommendedArtifacts.map((entry) => entry.artifact).join(", ")}`)
  }
  if (result.unresolvedIssues.length > 0) {
    console.log(`unresolved issues: ${result.unresolvedIssues.length}`)
  }
  if (result.activeTasks.length > 0) {
    console.log(`active tasks: ${result.activeTasks.map((task) => task.task_id).join(", ")}`)
  }
  if (result.verificationReadiness?.status) {
    console.log(`verification readiness: ${result.verificationReadiness.status}`)
  }
}

function printReconcileReport(result) {
  console.log(`Work items checked: ${result.workItems.length}`)
  console.log(`all ready to close: ${result.allReadyToClose ? "yes" : "no"}`)
  if (result.conflicts.length > 0) {
    console.log("artifact conflicts:")
    for (const conflict of result.conflicts) {
      console.log(`- ${conflict.path}: ${conflict.first} vs ${conflict.second}`)
    }
  }
  for (const item of result.workItems) {
    console.log(`- ${item.workItemId}: ${item.readyToClose ? "ready" : "needs attention"}`)
  }
}

function printTaskAllocation(result) {
  console.log(`Task allocation is valid for work item '${result.workItemId}'`)
  console.log(`active execution tasks: ${result.activeTasks.length}`)
}

function printIntegrationCheck(result) {
  console.log(`Integration ready: ${result.integrationReady ? "yes" : "no"}`)
  if (result.incompleteTasks.length > 0) {
    console.log(`incomplete tasks: ${result.incompleteTasks.map((task) => task.task_id).join(", ")}`)
  }
}

function printStageReadiness(result) {
  console.log(`stage: ${result.state.current_stage}`)
  console.log(`ready: ${result.ready ? "yes" : "no"}`)
  if (result.blockers.length > 0) {
    console.log(`blockers: ${result.blockers.join("; ")}`)
  }
}

function printIssueList(result) {
  console.log(`issues: ${result.issues.length}`)
  for (const issue of result.issues) {
    console.log(`${issue.issue_id} | ${issue.current_status} | repeats ${issue.repeat_count} | reopens ${issue.reopen_count} | ${issue.title}`)
  }
}

function printIssueAgingReport(result) {
  console.log(`issue totals: ${result.telemetry.total} total | ${result.telemetry.open} open | ${result.telemetry.repeated} repeated`) 
  for (const issue of result.issues) {
    console.log(`${issue.issue_id} | ${issue.current_status} | blocked_since ${issue.blocked_since ?? "none"} | last_updated ${issue.last_updated_at}`)
  }
}

function printWorkflowMetrics(result) {
  console.log(`work item: ${result.workItemId}`)
  console.log(`mode: ${result.mode}`)
  console.log(`stage: ${result.stage}`)
  console.log(`retry count: ${result.retryCount}`)
  console.log(`issues: ${result.issueTelemetry.total} total | ${result.issueTelemetry.open} open | ${result.issueTelemetry.repeated} repeated`)
  console.log(`verification: ${result.verificationReadiness.status}`)
  console.log(`tasks: ${result.taskCount} total | ${result.activeTaskCount} active`)
  console.log(`migration slices: ${result.migrationSliceCount}`)
  if (result.blocked.length > 0) {
    console.log(`blockers: ${result.blocked.join("; ")}`)
  }
}

function printApprovalBottlenecks(result) {
  console.log(`pending approvals: ${result.pending.length}`)
  for (const gate of result.pending) {
    console.log(`${gate.gate}${gate.notes ? ` | ${gate.notes}` : ""}`)
  }
}

function printQaFailureSummary(result) {
  console.log(`retry count: ${result.retryCount}`)
  console.log(`qa-linked issues: ${result.qaIssues.length}`)
  for (const issue of result.qaIssues) {
    console.log(`${issue.issue_id} | ${issue.type} | ${issue.rooted_in} | repeats ${issue.repeat_count}`)
  }
}

function printTaskAgingReport(result) {
  console.log(`work items scanned: ${result.reports.length}`)
  for (const report of result.reports) {
    console.log(`${report.work_item_id} | ${report.mode} | stale tasks ${report.stale_task_count}`)
  }
}

function printDefinitionOfDone(result) {
  console.log(`mode: ${result.mode}`)
  console.log(`stage: ${result.stage}`)
  console.log(`ready: ${result.ready ? "yes" : "no"}`)
  if (result.summary) {
    console.log(`summary: ${result.summary}`)
  }
  console.log(`required approvals: ${result.requiredApprovals.join(", ") || "none"}`)
  console.log(`required artifacts: ${result.requiredArtifacts.join(", ") || "none"}`)
  if (result.missingApprovals.length > 0) {
    console.log(`missing approvals: ${result.missingApprovals.join(", ")}`)
  }
  if (result.missingArtifacts.length > 0) {
    console.log(`missing artifacts: ${result.missingArtifacts.join(", ")}`)
  }
  console.log(`verification readiness: ${result.verificationReadiness.status}`)
  console.log(`unresolved issues: ${result.unresolvedIssues.length}`)
}

function printReleaseReadiness(result) {
  console.log(`work item: ${result.workItemId}`)
  console.log(`mode: ${result.mode}`)
  console.log(`stage: ${result.stage}`)
  console.log(`release ready: ${result.releaseReady ? "yes" : "no"}`)
  if (result.blockers.length > 0) {
    console.log(`blockers: ${result.blockers.join("; ")}`)
  }
}

function printWorkflowAnalytics(result) {
  console.log(`total work items: ${result.analytics.totalWorkItems}`)
  console.log(`by mode: quick ${result.analytics.byMode.quick} | migration ${result.analytics.byMode.migration} | full ${result.analytics.byMode.full}`)
  console.log(`open issues: ${result.analytics.totalOpenIssues}`)
  console.log(`repeated issues: ${result.analytics.totalRepeatedIssues}`)
  console.log(`total retries: ${result.analytics.totalRetries}`)
  console.log(`total escalations: ${result.analytics.totalEscalations}`)
}

function printOpsSummary(result) {
  console.log(`${result.mode} | ${result.stage} | ${result.owner}`)
  if (result.nextAction) {
    console.log(`next: ${result.nextAction}`)
  }
  console.log(`pending approvals: ${result.pendingApprovals.length > 0 ? result.pendingApprovals.join(", ") : "none"}`)
  console.log(`open issues: ${result.openIssues}`)
  console.log(`blockers: ${result.blockers.length > 0 ? result.blockers.join("; ") : "none"}`)
}

function printPolicyTrace(result) {
  console.log(`policies: ${result.policies.length}`)
  for (const policy of result.policies) {
    console.log(`${policy.id}`)
    console.log(`  docs: ${policy.docs.join(", ")}`)
    console.log(`  runtime: ${policy.runtime.join(", ")}`)
    console.log(`  tests: ${policy.tests.join(", ")}`)
  }
}

function printReleaseCandidates(result) {
  console.log(`active release: ${result.index.active_release_id ?? "none"}`)
  for (const release of result.index.releases) {
    console.log(`${release.release_id} | ${release.status} | risk ${release.risk_level} | ${release.title}`)
  }
}

function printReleaseCandidate(result) {
  console.log(`release: ${result.candidate.release_id}`)
  console.log(`title: ${result.candidate.title}`)
  console.log(`status: ${result.candidate.status}`)
  console.log(`risk: ${result.candidate.risk_level}`)
  console.log(`work items: ${result.candidate.included_work_items.join(", ") || "none"}`)
  console.log(`hotfix work items: ${result.candidate.hotfix_work_items.join(", ") || "none"}`)
}

function printReleaseGateResult(result) {
  console.log(`release: ${result.releaseId}`)
  console.log(`ready: ${result.ready ? "yes" : "no"}`)
  if (result.blockers.length > 0) {
    console.log(`blockers: ${result.blockers.join("; ")}`)
  }
  if (result.warnings.length > 0) {
    console.log(`warnings: ${result.warnings.join("; ")}`)
  }
}

function printReleaseDashboard(result) {
  console.log(`release candidates: ${result.dashboard.total}`)
  console.log(`ready: ${result.dashboard.ready} | blocked: ${result.dashboard.blocked}`)
  console.log(`rollback covered: ${result.dashboard.rollbackCovered}`)
  console.log(`notes ready: ${result.dashboard.notesReady}`)
}

function toBoolean(value) {
  return value === "true"
}

function requireArgument(value, placeholder, command) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${command} requires ${placeholder}`)
  }

  return value
}

function enrichStateResult(result, statePath) {
  const runtimeRoot = path.dirname(path.dirname(statePath ?? result.statePath))
  return {
    ...result,
    runtimeContext: getRuntimeContext(runtimeRoot, result.state),
  }
}

function extendDoctorReport(report, statePath) {
  const runtimeRoot = path.dirname(path.dirname(statePath))
  const checks = [...report.checks]
  const runtimeContext = getRuntimeContext(runtimeRoot, report.runtime.state)
  const activeWorkItemId = runtimeContext.activeWorkItemId
  const indexPath = path.join(runtimeRoot, ".opencode", "work-items", "index.json")
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : null
  const activeWorkItem = index?.work_items?.find((entry) => entry.work_item_id === activeWorkItemId) ?? null
  let activePointerOk = !index || !activeWorkItemId
  let mirrorOk = !index || !activeWorkItemId
  let boardOk = true
  let migrationBoardCheckRequired = false
  let migrationBoardOk = true

  if (index && activeWorkItemId) {
    const activeStatePath = resolveWorkItemPaths(runtimeRoot, activeWorkItemId).statePath
    activePointerOk = fs.existsSync(activeStatePath)

    try {
      validateActiveMirror(runtimeRoot)
      mirrorOk = true
    } catch (_error) {
      mirrorOk = false
    }
  }

  if (report.runtime.state?.mode === "full" && report.runtime.state?.work_item_id) {
    boardOk = report.runtime.state.current_stage === "full_implementation" || report.runtime.state.current_stage === "full_qa"
      ? runtimeContext.taskBoardPresent
      : true
  } else if (!report.runtime.state && activeWorkItem?.mode === "full") {
    try {
      validateWorkItemBoard(activeWorkItemId, statePath)
      boardOk = true
    } catch (_error) {
      boardOk = false
    }
  }

  const migrationBoardWorkItemId = report.runtime.state?.mode === "migration"
    ? report.runtime.state.work_item_id
    : !report.runtime.state && activeWorkItem?.mode === "migration"
      ? activeWorkItemId
      : null

  if (migrationBoardWorkItemId) {
    const migrationBoardPath = path.join(
      resolveWorkItemPaths(runtimeRoot, migrationBoardWorkItemId).workItemDir,
      "migration-slices.json",
    )

    if (fs.existsSync(migrationBoardPath)) {
      migrationBoardCheckRequired = true
      try {
        validateMigrationSliceBoardForWorkItem(migrationBoardWorkItemId, statePath)
        migrationBoardOk = true
      } catch (_error) {
        migrationBoardOk = false
      }
    }
  }

  const workflowChecks = [
    { label: "active work item pointer resolves to stored state", ok: activePointerOk },
    { label: "compatibility mirror matches active work item state", ok: mirrorOk },
    { label: "active work item task board is valid", ok: boardOk },
  ]

  if (migrationBoardCheckRequired) {
    workflowChecks.push({ label: "active work item migration slice board is valid", ok: migrationBoardOk })
  }

  workflowChecks.push({ label: "background run summaries are readable", ok: Array.isArray(runtimeContext.backgroundRuns) })

  checks.push(...workflowChecks)

  const summary = checks.reduce(
    (counts, check) => {
      if (check.ok) {
        counts.ok += 1
      } else {
        counts.error += 1
      }
      return counts
    },
    { ok: 0, warn: 0, error: 0 },
  )

  return {
    ...report,
    runtime: {
      ...report.runtime,
      runtimeContext,
    },
    checks,
    summary,
  }
}

async function main() {
  const { args, statePath } = parseGlobalFlags(process.argv.slice(2))
  const [command, ...rest] = args

  if (!command) {
    printUsage()
    process.exit(1)
  }

  let result
  switch (command) {
    case "show":
      result = enrichStateResult(showState(statePath), statePath)
      printState("Workflow state:", result)
      return
    case "status":
      if (rest.includes("--short")) {
        printRuntimeStatusShort(getRuntimeShortSummary(statePath))
        return
      }
      result = getRuntimeStatus(statePath)
      printRuntimeStatus(result)
      return
    case "resume-summary":
      result = getRuntimeStatus(statePath)
      if (rest.includes("--json")) {
        console.log(JSON.stringify(buildResumeSummary(result), null, 2))
        return
      }
      if (rest.includes("--short")) {
        printResumeSummaryShort(result)
        return
      }
      printResumeSummary(result)
      return
    case "doctor":
      result = extendDoctorReport(runDoctor(statePath), resolveStatePath(statePath))
      if (rest.includes("--short")) {
        printDoctorReportShort(result)
        process.exit(result.summary.error > 0 ? 1 : 0)
        return
      }
      printDoctorReport(result)
      process.exit(result.summary.error > 0 ? 1 : 0)
      return
    case "version":
      result = getVersionInfo(statePath)
      printVersion(result)
      return
    case "profiles":
      result = listProfiles(statePath)
      printProfiles(result)
      return
    case "show-profile":
      result = getProfile(rest[0], statePath)
      printProfile(result)
      return
    case "sync-install-manifest":
      result = syncInstallManifest(rest[0], statePath)
      console.log(`Updated install manifest profile to '${result.profile.name}'`)
      console.log(`Install manifest: ${result.installManifestPath}`)
      return
    case "validate":
      result = validateState(statePath)
      console.log(`Workflow state is valid: ${result.statePath}`)
      return
    case "start-feature":
      result = startFeature(rest[0], rest[1], statePath)
      console.log(`Started feature ${rest[0]} (${rest[1]})`)
      console.log(`State file: ${result.statePath}`)
      return
    case "start-task":
      result = startTask(rest[0], rest[1], rest[2], rest.slice(3).join(" "), statePath)
      console.log(`Started ${result.state.mode} task ${rest[1]} (${rest[2]})`)
      console.log(`State file: ${result.statePath}`)
      return
    case "create-work-item":
      result = createWorkItem(rest[0], rest[1], rest[2], rest.slice(3).join(" "), statePath)
      console.log(`Created ${result.state.mode} work item ${rest[1]} (${rest[2]})`)
      console.log(`State file: ${result.statePath}`)
      return
    case "list-work-items":
      result = listWorkItems(statePath)
      printWorkItems(result)
      return
    case "task-aging-report":
      result = getTaskAgingReport(statePath)
      printTaskAgingReport(result)
      return
    case "start-background-run":
      result = startBackgroundRun(rest[0], rest[1], rest[2], rest[3], statePath)
      console.log(`Started background run '${result.run.run_id}'`)
      return
    case "list-background-runs":
      result = getBackgroundRuns(statePath)
      printBackgroundRuns(result)
      return
    case "show-background-run":
      result = getBackgroundRun(rest[0], statePath)
      printBackgroundRun(result)
      return
    case "complete-background-run":
      result = completeBackgroundRun(rest[0], rest[1], statePath)
      console.log(`Completed background run '${result.run.run_id}'`)
      return
    case "cancel-background-run":
      result = cancelBackgroundRun(rest[0], statePath)
      console.log(`Cancelled background run '${result.run.run_id}'`)
      return
    case "workflow-analytics":
      result = getWorkflowAnalytics(statePath)
      printWorkflowAnalytics(result)
      return
    case "ops-summary":
      result = getOpsSummary(statePath)
      printOpsSummary(result)
      return
    case "create-release-candidate":
      result = createReleaseCandidate(rest[0], rest[1], statePath)
      console.log(`Created release candidate '${result.candidate.release_id}'`)
      return
    case "list-release-candidates":
      result = listReleaseCandidates(statePath)
      printReleaseCandidates(result)
      return
    case "show-release-candidate":
      result = showReleaseCandidate(rest[0], statePath)
      printReleaseCandidate(result)
      return
    case "add-release-work-item":
      result = addReleaseWorkItem(rest[0], rest[1], statePath)
      console.log(`Added work item '${rest[1]}' to release '${rest[0]}'`)
      return
    case "remove-release-work-item":
      result = removeReleaseWorkItem(rest[0], rest[1], statePath)
      console.log(`Removed work item '${rest[1]}' from release '${rest[0]}'`)
      return
    case "set-release-status":
      result = setReleaseStatus(rest[0], rest[1], statePath)
      console.log(`Updated release '${rest[0]}' to '${rest[1]}'`)
      return
    case "set-release-approval":
      result = setReleaseApproval(rest[0], rest[1], rest[2], rest[3], rest[4], rest[5], statePath)
      console.log(`Updated release approval '${rest[1]}' on '${rest[0]}'`)
      return
    case "record-rollback-plan":
      result = recordRollbackPlan(rest[0], rest[1], rest[2], rest[3].split(","), statePath)
      console.log(`Recorded rollback plan for release '${rest[0]}'`)
      return
    case "draft-release-notes":
      result = draftReleaseNotes(rest[0], statePath)
      console.log(`Drafted release notes at '${result.notesPath}'`)
      return
    case "validate-release-notes":
      result = validateReleaseNotes(rest[0], statePath)
      console.log(`release notes ready: ${result.ready ? "yes" : "no"}`)
      if (result.blockers.length > 0) {
        console.log(`blockers: ${result.blockers.join("; ")}`)
      }
      process.exit(result.ready ? 0 : 1)
      return
    case "check-release-gates":
      result = getReleaseCandidateReadiness(rest[0], statePath)
      printReleaseGateResult(result)
      process.exit(result.ready ? 0 : 1)
      return
    case "release-dashboard":
      result = getReleaseDashboard(statePath)
      printReleaseDashboard(result)
      return
    case "start-hotfix":
      result = startHotfix(rest[0], rest[1], rest[2], rest[3], rest[4], statePath)
      console.log(`Started hotfix work item '${result.workItemId}' for release '${rest[0]}'`)
      return
    case "validate-hotfix":
      result = validateHotfix(rest[0], statePath)
      console.log(`hotfix ready: ${result.ready ? "yes" : "no"}`)
      process.exit(result.ready ? 0 : 1)
      return
    case "show-work-item":
      result = showWorkItemState(rest[0], statePath)
      printWorkItem(result)
      return
    case "closeout-summary":
      result = getWorkItemCloseoutSummary(rest[0], statePath)
      printCloseoutSummary(result)
      process.exit(result.readyToClose ? 0 : 1)
      return
    case "release-readiness":
      result = getReleaseReadiness(statePath)
      printReleaseReadiness(result)
      process.exit(result.releaseReady ? 0 : 1)
      return
    case "show-dod":
      result = getDefinitionOfDone(statePath)
      printDefinitionOfDone(result)
      return
    case "validate-dod":
      result = getDefinitionOfDone(statePath)
      printDefinitionOfDone(result)
      process.exit(result.ready ? 0 : 1)
      return
    case "reconcile-work-items":
      result = reconcileCompletedWorkItems(statePath, rest)
      printReconcileReport(result)
      process.exit(result.allReadyToClose ? 0 : 1)
      return
    case "activate-work-item":
      result = selectActiveWorkItem(rest[0], statePath)
      console.log(`Activated work item '${result.state.work_item_id}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "advance-stage":
      result = advanceStage(rest[0], statePath)
      console.log(`Advanced workflow to stage '${result.state.current_stage}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "check-stage-readiness":
      result = getWorkflowMetrics(statePath)
      const ready = result.blocked.length === 0
      printStageReadiness({ state: { current_stage: result.stage }, ready, blockers: result.blocked })
      process.exit(ready ? 0 : 1)
      return
    case "set-approval":
      result = setApproval(rest[0], rest[1], rest[2], rest[3], rest[4], statePath)
      console.log(`Updated approval gate '${rest[0]}' to '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "link-artifact":
      result = linkArtifact(rest[0], rest[1], statePath)
      console.log(`Linked artifact '${rest[0]}' -> '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "scaffold-artifact":
      result = scaffoldAndLinkArtifact(rest[0], rest[1], statePath)
      console.log(`Created artifact '${rest[0]}' at '${result.artifactPath}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-routing-profile":
      result = setRoutingProfile(rest[0], rest[1], rest[2], rest[3], rest.slice(4).join(" "), statePath)
      console.log(`Updated routing profile for mode '${result.state.mode}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-parallelization":
      result = setParallelization(rest[0], rest[1] ?? null, rest[2] ?? null, rest[3] ?? null, statePath)
      console.log(`Updated parallelization for mode '${result.state.mode}' to '${result.state.parallelization.parallel_mode}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "list-tasks":
      result = listTasks(rest[0], statePath)
      printTasks(result)
      return
    case "create-task":
      result = createTask(
        rest[0],
        {
          task_id: rest[1],
          title: rest[2],
          kind: rest[3],
          ...(rest[4] && rest[5]
            ? {
                worktree_metadata: {
                  task_id: rest[1],
                  branch: rest[4],
                  worktree_path: rest[5],
                },
              }
            : {}),
          concurrency_class: rest[6] ?? "parallel_safe",
        },
        statePath,
      )
      console.log(`Created task '${rest[1]}' on work item '${rest[0]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "validate-task-allocation":
      result = validateTaskAllocation(rest[0], statePath)
      printTaskAllocation(result)
      return
    case "integration-check":
      result = integrationCheck(rest[0], statePath)
      printIntegrationCheck(result)
      process.exit(result.integrationReady ? 0 : 1)
      return
    case "workflow-metrics":
      result = getWorkflowMetrics(statePath)
      printWorkflowMetrics(result)
      return
    case "approval-bottlenecks":
      result = getApprovalBottlenecks(statePath)
      printApprovalBottlenecks(result)
      process.exit(result.pending.length === 0 ? 0 : 1)
      return
    case "qa-failure-summary":
      result = getQaFailureSummary(statePath)
      printQaFailureSummary(result)
      return
    case "policy-trace":
      result = getPolicyExecutionTrace()
      printPolicyTrace(result)
      return
    case "claim-task":
      result = claimTask(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "claim-task"),
      })
      console.log(`Claimed task '${rest[1]}' for '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "release-task":
      result = releaseTask(rest[0], rest[1], statePath, {
        requestedBy: requireArgument(rest[2], "<requested_by>", "release-task"),
      })
      console.log(`Released task '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "reassign-task":
      result = reassignTask(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "reassign-task"),
      })
      console.log(`Reassigned task '${rest[1]}' to '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "assign-qa-owner":
      result = assignQaOwner(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "assign-qa-owner"),
      })
      console.log(`Assigned QA owner '${rest[2]}' to task '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-task-status":
      result = setTaskStatus(rest[0], rest[1], rest[2], statePath)
      console.log(`Updated task '${rest[1]}' to '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "validate-work-item-board":
      result = validateWorkItemBoard(rest[0], statePath)
      console.log(`Task board is valid for work item '${result.workItemId}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "list-migration-slices":
      result = listMigrationSlices(rest[0], statePath)
      printMigrationSlices(result)
      return
    case "create-migration-slice":
      result = createMigrationSlice(
        rest[0],
        {
          slice_id: rest[1],
          title: rest[2],
          kind: rest[3],
        },
        statePath,
      )
      console.log(`Created migration slice '${rest[1]}' on work item '${rest[0]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "claim-migration-slice":
      result = claimMigrationSlice(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "claim-migration-slice"),
      })
      console.log(`Claimed migration slice '${rest[1]}' for '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "assign-migration-qa-owner":
      result = assignMigrationQaOwner(rest[0], rest[1], rest[2], statePath, {
        requestedBy: requireArgument(rest[3], "<requested_by>", "assign-migration-qa-owner"),
      })
      console.log(`Assigned migration QA owner '${rest[2]}' to slice '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "set-migration-slice-status":
      result = setMigrationSliceStatus(rest[0], rest[1], rest[2], statePath)
      console.log(`Updated migration slice '${rest[1]}' to '${rest[2]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "validate-migration-slice-board":
      result = validateMigrationSliceBoardForWorkItem(rest[0], statePath)
      console.log(`Migration slice board is valid for work item '${result.workItemId}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "record-issue":
      result = recordIssue(
        {
          issue_id: rest[0],
          title: rest[1],
          type: rest[2],
          severity: rest[3],
          rooted_in: rest[4],
          recommended_owner: rest[5],
          evidence: rest[6],
          artifact_refs: rest[7],
        },
        statePath,
      )
      console.log(`Recorded issue '${rest[0]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "update-issue-status":
      result = updateIssueStatus(rest[0], rest[1], statePath)
      console.log(`Updated issue '${rest[0]}' to '${rest[1]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "list-stale-issues":
      result = listStaleIssues(statePath)
      printIssueList(result)
      process.exit(result.issues.length === 0 ? 0 : 1)
      return
    case "issue-aging-report":
      result = getIssueAgingReport(statePath)
      printIssueAgingReport(result)
      return
    case "record-verification-evidence":
      result = recordVerificationEvidence(
        {
          id: rest[0],
          kind: rest[1],
          scope: rest[2],
          summary: rest[3],
          source: rest[4],
          command: rest[5] ?? null,
          exit_status: rest[6] === undefined ? null : Number(rest[6]),
          artifact_refs: rest[7] ? rest[7].split(",") : [],
          recorded_at: new Date().toISOString(),
        },
        statePath,
      )
      console.log(`Recorded verification evidence '${rest[0]}'`)
      console.log(`State file: ${result.statePath}`)
      return
    case "clear-verification-evidence":
      result = clearVerificationEvidence(statePath)
      console.log("Cleared verification evidence")
      console.log(`State file: ${result.statePath}`)
      return
    case "clear-issues":
      result = clearIssues(statePath)
      console.log("Cleared workflow issues")
      console.log(`State file: ${result.statePath}`)
      return
    case "route-rework":
      result = routeRework(rest[0], toBoolean(rest[1] ?? "false"), statePath)
      console.log(`Routed rework for '${rest[0]}' to stage '${result.state.current_stage}'`)
      if (result.state.retry_count >= ESCALATION_RETRY_THRESHOLD) {
        console.log(
          `Escalation threshold reached: retry_count is at or above ${ESCALATION_RETRY_THRESHOLD}`,
        )
      }
      console.log(`State file: ${result.statePath}`)
      return
    case "help":
      printUsage()
      return
    default:
      throw new Error(`Unknown command '${command}'`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
