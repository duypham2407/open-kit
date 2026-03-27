const fs = require("fs")
const path = require("path")

const {
  resolveKitRoot,
  resolveProjectRoot,
  resolveRuntimeRoot,
  resolveStatePath,
} = require("./runtime-paths")

const {
  bootstrapRuntimeStore,
  bootstrapLegacyWorkflowState,
  deriveWorkItemId,
  readWorkItemIndex,
  readWorkItemState,
  resolveWorkItemPaths,
  setActiveWorkItem,
  writeCompatibilityMirror,
  writeWorkItemIndex,
  writeWorkItemState,
} = require("./work-item-store")
const {
  bootstrapReleaseStore,
  readReleaseCandidate,
  readReleaseIndex,
  resolveReleaseCandidatePaths,
  resolveReleasePaths,
  upsertReleaseIndexEntry,
  writeReleaseCandidate,
  writeReleaseIndex,
} = require("./release-store")
const {
  ARTIFACT_KINDS,
  ESCALATION_RETRY_THRESHOLD,
  ISSUE_SEVERITIES,
  ISSUE_STATUS_VALUES,
  ISSUE_TYPES,
  MODE_VALUES,
  PARALLEL_MODES,
  RECOMMENDED_OWNERS,
  ROOTED_IN_VALUES,
  ROUTING_BEHAVIOR_DELTA_VALUES,
  ROUTING_DOMINANT_UNCERTAINTY_VALUES,
  ROUTING_SCOPE_SHAPE_VALUES,
  ROUTING_WORK_INTENT_VALUES,
  STAGE_OWNERS,
  STAGE_SEQUENCE,
  STATUS_VALUES,
  VERIFICATION_EVIDENCE_KINDS,
  createDefaultRoutingProfile,
  createEmptyApprovals,
  createEmptyArtifacts,
  createDefaultParallelization,
  getApprovalGatesForMode,
  getInitialStageForMode,
  getModeForStage,
  getNextStage,
  getReworkRoute,
  getTransitionGate,
} = require("./workflow-state-rules")
const { getContractConsistencyReport: buildContractConsistencyReport } = require("./contract-consistency")
const { SUPPORTED_SCAFFOLDS, scaffoldArtifact } = require("./artifact-scaffolder")
const { captureRevision, guardWrite, planGuardedMirrorRefresh } = require("./state-guard")
const {
  VALID_ASSIGNMENT_AUTHORITIES,
  decideQaFailLocalRework,
  validateParallelAssignments,
  validateReassignmentAuthority,
  validateWorktreeMetadata,
} = require("./parallel-execution-rules")
const { validateTaskBoard, validateTaskShape, validateTaskStatus, validateTaskTransition } = require("./task-board-rules")
const {
  validateMigrationSliceBoard,
  validateMigrationSliceShape,
  validateMigrationSliceStatus,
  validateMigrationSliceTransition,
} = require("./migration-slice-rules")
const {
  flattenArtifactRefs,
  getArtifactReadiness,
  getDodRule,
  getIssueTelemetry,
  getNextAction,
  getVerificationReadiness,
} = require("./runtime-guidance")

function fail(message) {
  const error = new Error(message)
  error.isWorkflowStateError = true
  throw error
}

function formatModeLabel(mode) {
  return typeof mode === "string" && mode.length > 0 ? `${mode.charAt(0).toUpperCase()}${mode.slice(1)}` : "Unknown"
}

function timestamp() {
  return new Date().toISOString()
}

const RELEASE_STATUS_VALUES = ["draft", "candidate", "approved", "released", "rolled_back", "cancelled"]
const RELEASE_RISK_VALUES = ["low", "medium", "high"]
const RELEASE_APPROVAL_GATES = ["qa_to_release", "release_to_ship"]

function getReleaseNotesPath(projectRoot, releaseId) {
  return path.join(projectRoot, "release-notes", `${releaseId}.md`)
}

function createEmptyReleaseApprovals() {
  return RELEASE_APPROVAL_GATES.reduce((approvals, gate) => {
    approvals[gate] = {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    }
    return approvals
  }, {})
}

function createReleaseCandidateShape(releaseId, title) {
  return {
    release_id: releaseId,
    title,
    status: "draft",
    created_at: timestamp(),
    updated_at: timestamp(),
    target_window: null,
    included_work_items: [],
    risk_level: "medium",
    notes_path: path.posix.join("release-notes", `${releaseId}.md`),
    rollback_plan: null,
    approvals: createEmptyReleaseApprovals(),
    blockers: [],
    hotfix_work_items: [],
  }
}

function ensureReleaseApprovalShape(gate, approval) {
  ensureObject(approval, `release.approvals.${gate}`)
  for (const key of ["status", "approved_by", "approved_at", "notes"]) {
    if (!(key in approval)) {
      fail(`release.approvals.${gate}.${key} is required`)
    }
  }
  ensureKnown(approval.status, ["pending", "approved", "rejected"], `release.approvals.${gate}.status`)
  ensureNullableString(approval.approved_by, `release.approvals.${gate}.approved_by`)
  ensureNullableString(approval.approved_at, `release.approvals.${gate}.approved_at`)
  ensureNullableString(approval.notes, `release.approvals.${gate}.notes`)
}

function validateReleaseCandidate(candidate) {
  ensureObject(candidate, "release candidate")
  for (const key of [
    "release_id",
    "title",
    "status",
    "created_at",
    "updated_at",
    "target_window",
    "included_work_items",
    "risk_level",
    "notes_path",
    "rollback_plan",
    "approvals",
    "blockers",
    "hotfix_work_items",
  ]) {
    if (!(key in candidate)) {
      fail(`release candidate.${key} is required`)
    }
  }

  ensureString(candidate.release_id, "release candidate.release_id")
  ensureString(candidate.title, "release candidate.title")
  ensureKnown(candidate.status, RELEASE_STATUS_VALUES, "release candidate.status")
  ensureString(candidate.created_at, "release candidate.created_at")
  ensureString(candidate.updated_at, "release candidate.updated_at")
  ensureNullableString(candidate.target_window, "release candidate.target_window")
  ensureArray(candidate.included_work_items, "release candidate.included_work_items")
  ensureKnown(candidate.risk_level, RELEASE_RISK_VALUES, "release candidate.risk_level")
  ensureString(candidate.notes_path, "release candidate.notes_path")
  ensureArray(candidate.blockers, "release candidate.blockers")
  ensureArray(candidate.hotfix_work_items, "release candidate.hotfix_work_items")
  ensureObject(candidate.approvals, "release candidate.approvals")
  for (const gate of RELEASE_APPROVAL_GATES) {
    if (!(gate in candidate.approvals)) {
      fail(`release candidate.approvals.${gate} is required`)
    }
    ensureReleaseApprovalShape(gate, candidate.approvals[gate])
  }
  if (candidate.rollback_plan !== null) {
    ensureObject(candidate.rollback_plan, "release candidate.rollback_plan")
    for (const key of ["summary", "owner", "trigger_signals", "recorded_at"]) {
      if (!(key in candidate.rollback_plan)) {
        fail(`release candidate.rollback_plan.${key} is required`)
      }
    }
    ensureString(candidate.rollback_plan.summary, "release candidate.rollback_plan.summary")
    ensureString(candidate.rollback_plan.owner, "release candidate.rollback_plan.owner")
    ensureArray(candidate.rollback_plan.trigger_signals, "release candidate.rollback_plan.trigger_signals")
    ensureString(candidate.rollback_plan.recorded_at, "release candidate.rollback_plan.recorded_at")
  }
}

function readState(customStatePath) {
  const statePath = resolveStatePath(customStatePath)

  let raw
  try {
    raw = fs.readFileSync(statePath, "utf8")
  } catch (error) {
    fail(`Unable to read workflow state file at '${statePath}': ${error.message}`)
  }

  try {
    return {
      statePath,
      state: JSON.parse(raw),
    }
  } catch (error) {
    fail(`Malformed workflow state JSON at '${statePath}': ${error.message}`)
  }
}

function writeState(statePath, state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

function createEmptyWorkItemIndex() {
  return {
    active_work_item_id: null,
    work_items: [],
  }
}

function ensureWorkItemStoreReady(customStatePath) {
  const runtimeRoot = resolveRuntimeRoot(customStatePath)
  const projectRoot = resolveProjectRoot(customStatePath)

  if (runtimeRoot !== projectRoot) {
    const runtimePaths = resolveWorkItemPaths(runtimeRoot, "__bootstrap__")
    const projectPaths = resolveWorkItemPaths(projectRoot, "__bootstrap__")

    if (!fs.existsSync(runtimePaths.indexPath) && fs.existsSync(projectPaths.workflowStatePath)) {
      fs.mkdirSync(path.dirname(runtimePaths.workflowStatePath), { recursive: true })
      fs.copyFileSync(projectPaths.workflowStatePath, runtimePaths.workflowStatePath)

      if (fs.existsSync(projectPaths.workItemsDir) && !fs.existsSync(runtimePaths.workItemsDir)) {
        fs.cpSync(projectPaths.workItemsDir, runtimePaths.workItemsDir, { recursive: true })
      }
    }
  }

  bootstrapRuntimeStore(runtimeRoot)

  return runtimeRoot
}

function upsertWorkItemIndexEntry(index, state, workItemId, relativeStatePath) {
  const nextEntry = {
    work_item_id: workItemId,
    feature_id: state.feature_id,
    feature_slug: state.feature_slug,
    mode: state.mode,
    status: state.status,
    state_path: relativeStatePath,
  }

  const existingIndex = index.work_items.findIndex((entry) => entry.work_item_id === workItemId)
  if (existingIndex === -1) {
    index.work_items.push(nextEntry)
  } else {
    index.work_items[existingIndex] = nextEntry
  }

  return nextEntry
}

function readManagedState(customStatePath, workItemId = null) {
  const statePath = resolveStatePath(customStatePath)
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const index = readWorkItemIndex(projectRoot)
  const resolvedWorkItemId = workItemId ?? index.active_work_item_id

  if (!resolvedWorkItemId) {
    fail("Active work item pointer missing")
  }

  return {
    statePath,
    projectRoot,
    index,
    workItemId: resolvedWorkItemId,
    state: readWorkItemState(projectRoot, resolvedWorkItemId),
  }
}

function persistManagedState(customStatePath, state, options = {}) {
  const statePath = resolveStatePath(customStatePath)
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const workItemId = options.workItemId ?? deriveWorkItemId(state)
  const workItemPaths = resolveWorkItemPaths(projectRoot, workItemId)
  const index = fs.existsSync(workItemPaths.indexPath)
    ? readWorkItemIndex(projectRoot)
    : createEmptyWorkItemIndex()
  const hasPersistedState = fs.existsSync(workItemPaths.statePath)
  const currentPersistedState = hasPersistedState ? readWorkItemState(projectRoot, workItemId) : null
  const previousIndexSnapshot = JSON.parse(JSON.stringify(index))
  const hadMirrorState = fs.existsSync(statePath)
  const previousMirrorState = hadMirrorState ? readState(statePath).state : null

  if (currentPersistedState) {
    guardWrite({
      currentState: currentPersistedState,
      expectedRevision: options.expectedRevision,
      nextState: state,
    })
  }

  const persistedState = writeWorkItemState(projectRoot, workItemId, state)
  try {
    validateManagedState(persistedState, projectRoot, workItemId)

    const nextActiveWorkItemId = options.activateWorkItemId ?? workItemId
    const mirrorRefreshPlan = planGuardedMirrorRefresh({
      activeWorkItemId: nextActiveWorkItemId,
      targetWorkItemId: workItemId,
      nextState: persistedState,
    })

    if (mirrorRefreshPlan.shouldRefreshMirror) {
      const preflightMirrorState = fs.existsSync(statePath) ? readState(statePath).state : null

      if (preflightMirrorState && options.expectedMirrorRevision) {
        guardWrite({
          currentState: preflightMirrorState,
          expectedRevision: options.expectedMirrorRevision,
          nextState: persistedState,
        })
      }

      writeCompatibilityMirror(projectRoot, persistedState)

      const mirrorState = readState(statePath).state
      const mirrorRevision = captureRevision(mirrorState)

      if (mirrorRevision !== mirrorRefreshPlan.mirrorRevision) {
        fail(
          `Compatibility mirror refresh revision conflict for active work item '${workItemId}'; expected ${mirrorRefreshPlan.mirrorRevision} but found ${mirrorRevision}`,
        )
      }
    }

    upsertWorkItemIndexEntry(index, persistedState, workItemId, workItemPaths.relativeStatePath)
    index.active_work_item_id = nextActiveWorkItemId
    writeWorkItemIndex(projectRoot, index)
  } catch (error) {
    if (currentPersistedState) {
      writeWorkItemState(projectRoot, workItemId, currentPersistedState)
    } else if (fs.existsSync(workItemPaths.statePath)) {
      fs.rmSync(workItemPaths.statePath)
    }

    if (previousMirrorState) {
      writeCompatibilityMirror(projectRoot, previousMirrorState)
    } else if (!hadMirrorState && fs.existsSync(statePath)) {
      fs.rmSync(statePath)
    }

    try {
      writeWorkItemIndex(projectRoot, previousIndexSnapshot)
    } catch (_rollbackError) {
      // Preserve the original failure after best-effort rollback.
    }
    throw error
  }

  return {
    statePath,
    projectRoot,
    index,
    state: persistedState,
  }
}

function getTaskBoardPath(projectRoot, workItemId) {
  return path.join(resolveWorkItemPaths(projectRoot, workItemId).workItemDir, "tasks.json")
}

function readTaskBoardIfExists(projectRoot, workItemId) {
  const taskBoardPath = getTaskBoardPath(projectRoot, workItemId)
  if (!fs.existsSync(taskBoardPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(taskBoardPath, "utf8"))
  } catch (error) {
    fail(`Malformed JSON at '${taskBoardPath}': ${error.message}`)
  }
}

function writeTaskBoard(projectRoot, workItemId, board) {
  const taskBoardPath = getTaskBoardPath(projectRoot, workItemId)
  fs.mkdirSync(path.dirname(taskBoardPath), { recursive: true })
  fs.writeFileSync(taskBoardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
  return board
}

function getMigrationSliceBoardPath(projectRoot, workItemId) {
  return path.join(resolveWorkItemPaths(projectRoot, workItemId).workItemDir, "migration-slices.json")
}

function readMigrationSliceBoardIfExists(projectRoot, workItemId) {
  const boardPath = getMigrationSliceBoardPath(projectRoot, workItemId)
  if (!fs.existsSync(boardPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(boardPath, "utf8"))
  } catch (error) {
    fail(`Malformed JSON at '${boardPath}': ${error.message}`)
  }
}

function writeMigrationSliceBoard(projectRoot, workItemId, board) {
  const boardPath = getMigrationSliceBoardPath(projectRoot, workItemId)
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
  return board
}

function buildBoardView(state, board) {
  return {
    mode: state.mode,
    current_stage: state.current_stage,
    tasks: board?.tasks ?? [],
    issues: board?.issues ?? [],
  }
}

function buildMigrationSliceBoardView(state, board) {
  return {
    mode: state.mode,
    current_stage: state.current_stage,
    parallel_mode: state.parallelization?.parallel_mode ?? "none",
    slices: board?.slices ?? [],
    issues: board?.issues ?? [],
  }
}

function readWorkItemContext(workItemId, customStatePath) {
  ensureString(workItemId, "work_item_id")
  const statePath = resolveStatePath(customStatePath)
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const state = readWorkItemState(projectRoot, workItemId)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  return {
    statePath,
    projectRoot,
    workItemId,
    state,
  }
}

function requireFullModeWorkItem(state, workItemId) {
  if (state.mode !== "full") {
    fail(`Work item '${workItemId}' must be in full mode to use a task board`)
  }
}

function requireMigrationModeWorkItem(state, workItemId) {
  if (state.mode !== "migration") {
    fail(`Work item '${workItemId}' must be in migration mode to use migration slices`)
  }
}

function isTaskBoardStageAllowed(stage) {
  return ["full_solution", "full_implementation", "full_code_review", "full_qa", "full_done"].includes(stage)
}

function requireTaskBoardStage(state, workItemId, action = "use a task board") {
  if (!isTaskBoardStageAllowed(state.current_stage)) {
    fail(
      `Work item '${workItemId}' must reach 'full_solution' before it can ${action}; current stage is '${state.current_stage}'`,
    )
  }
}

function requireMigrationSliceBoardStage(state, workItemId, action = "use migration slices") {
  if (!["migration_strategy", "migration_upgrade", "migration_verify", "migration_done"].includes(state.current_stage)) {
    fail(
      `Work item '${workItemId}' must reach 'migration_strategy' before it can ${action}; current stage is '${state.current_stage}'`,
    )
  }
}

function buildBoardForValidation(state, board) {
  validateParallelAssignments(board.tasks ?? [])

  return {
    ...board,
    mode: state.mode,
    current_stage: state.current_stage,
    issues: board.issues ?? [],
  }
}

function buildMigrationBoardForValidation(state, board) {
  return {
    ...board,
    mode: state.mode,
    current_stage: state.current_stage,
    parallel_mode: state.parallelization?.parallel_mode ?? "none",
    issues: board.issues ?? [],
  }
}

function withTaskBoard(workItemId, customStatePath, mutator) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  requireFullModeWorkItem(state, workItemId)
  requireTaskBoardStage(state, workItemId)

  const existingBoard = readTaskBoardIfExists(projectRoot, workItemId)
  const baseBoard = buildBoardView(state, existingBoard)
  const nextBoard = mutator(JSON.parse(JSON.stringify(baseBoard)), context)
  const validatedBoard = validateTaskBoard(buildBoardForValidation(state, nextBoard))
  writeTaskBoard(projectRoot, workItemId, validatedBoard)

  return {
    ...context,
    board: validatedBoard,
  }
}

function withMigrationSliceBoard(workItemId, customStatePath, mutator) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  requireMigrationModeWorkItem(state, workItemId)
  requireMigrationSliceBoardStage(state, workItemId)

  const existingBoard = readMigrationSliceBoardIfExists(projectRoot, workItemId)
  const baseBoard = buildMigrationSliceBoardView(state, existingBoard)
  const nextBoard = mutator(JSON.parse(JSON.stringify(baseBoard)), context)
  const validatedBoard = validateMigrationSliceBoard(buildMigrationBoardForValidation(state, nextBoard))
  writeMigrationSliceBoard(projectRoot, workItemId, validatedBoard)

  return {
    ...context,
    board: validatedBoard,
  }
}

function findTask(board, taskId) {
  ensureString(taskId, "task_id")
  const task = board.tasks.find((entry) => entry.task_id === taskId)
  if (!task) {
    fail(`Unknown task '${taskId}'`)
  }
  return task
}

function buildTaskRecord(taskInput) {
  ensureObject(taskInput, "task")
  ensureString(taskInput.task_id, "task.task_id")
  ensureString(taskInput.title, "task.title")
  ensureString(taskInput.kind, "task.kind")

  if (taskInput.worktree_metadata !== undefined) {
    validateWorktreeMetadata(taskInput.worktree_metadata)
  }

  const now = timestamp()

  return validateTaskShape({
    task_id: taskInput.task_id,
    title: taskInput.title,
    summary: taskInput.summary ?? taskInput.title,
    kind: taskInput.kind,
    concurrency_class: taskInput.concurrency_class ?? "parallel_safe",
    status: taskInput.status ?? "ready",
    primary_owner: taskInput.primary_owner ?? null,
    qa_owner: taskInput.qa_owner ?? null,
    depends_on: taskInput.depends_on ?? [],
    blocked_by: taskInput.blocked_by ?? [],
    artifact_refs: taskInput.artifact_refs ?? [],
    plan_refs: taskInput.plan_refs ?? [],
    branch_or_worktree: taskInput.branch_or_worktree ?? taskInput.worktree_metadata?.worktree_path ?? null,
    created_by: taskInput.created_by ?? "SolutionLead",
    created_at: taskInput.created_at ?? now,
    updated_at: taskInput.updated_at ?? now,
  })
}

function buildMigrationSliceRecord(sliceInput) {
  ensureObject(sliceInput, "migration slice")
  ensureString(sliceInput.slice_id, "migration_slice.slice_id")
  ensureString(sliceInput.title, "migration_slice.title")
  ensureString(sliceInput.kind, "migration_slice.kind")

  const now = timestamp()

  return validateMigrationSliceShape({
    slice_id: sliceInput.slice_id,
    title: sliceInput.title,
    summary: sliceInput.summary ?? sliceInput.title,
    kind: sliceInput.kind,
    status: sliceInput.status ?? "ready",
    primary_owner: sliceInput.primary_owner ?? null,
    qa_owner: sliceInput.qa_owner ?? null,
    depends_on: sliceInput.depends_on ?? [],
    blocked_by: sliceInput.blocked_by ?? [],
    artifact_refs: sliceInput.artifact_refs ?? [],
    preserved_invariants: sliceInput.preserved_invariants ?? [],
    compatibility_risks: sliceInput.compatibility_risks ?? [],
    verification_targets: sliceInput.verification_targets ?? [],
    rollback_notes: sliceInput.rollback_notes ?? [],
    created_by: sliceInput.created_by ?? "SolutionLead",
    created_at: sliceInput.created_at ?? now,
    updated_at: sliceInput.updated_at ?? now,
  })
}

function validateManagedState(state, projectRoot, workItemId, options = {}) {
  validatePrimaryArtifactContracts(state, projectRoot)

  const taskBoard = readTaskBoardIfExists(projectRoot, workItemId)
  const migrationSliceBoard = readMigrationSliceBoardIfExists(projectRoot, workItemId)
  const effectiveParallelization = state.parallelization ?? createDefaultParallelization(state.mode)

  if (state.mode !== "full") {
    if (taskBoard !== null) {
      fail(`${formatModeLabel(state.mode)} mode cannot carry a task board; task boards are full-delivery only`)
    }
  }

  if (state.mode !== "migration" && migrationSliceBoard !== null) {
    fail(`${formatModeLabel(state.mode)} mode cannot carry a migration slice board; migration slice boards are migration-only`)
  }

  if (state.mode === "migration" && migrationSliceBoard !== null) {
    requireMigrationSliceBoardStage(state, workItemId, "carry migration slices")
    validateMigrationSliceBoard(
      buildMigrationBoardForValidation(
        {
          ...state,
          parallelization: effectiveParallelization,
        },
        migrationSliceBoard,
      ),
    )
  }

  if (state.mode !== "full") {
    return null
  }

  if (taskBoard === null) {
    return null
  }

  requireTaskBoardStage(state, workItemId, "carry a task board")

  const boardStage = options.boardStage ?? taskBoard.current_stage ?? state.current_stage
  validateTaskBoard({
    ...taskBoard,
    mode: state.mode,
    current_stage: boardStage,
  })

  return taskBoard
}

function requireValidTaskBoard(state, projectRoot, workItemId, boardStage, reason) {
  const taskBoard = readTaskBoardIfExists(projectRoot, workItemId)
  const effectiveParallelization = state.parallelization ?? createDefaultParallelization(state.mode)

  if (state.mode !== "full") {
    if (taskBoard !== null) {
      fail(`${formatModeLabel(state.mode)} mode cannot carry a task board; task boards are full-delivery only`)
    }
    fail(reason)
  }

  if (taskBoard === null) {
    fail(reason)
  }

  validateTaskBoard({
    ...taskBoard,
    mode: state.mode,
    current_stage: boardStage,
  })

  if (effectiveParallelization.parallel_mode === "none") {
    const activeTasks = (taskBoard.tasks ?? []).filter((task) => ["claimed", "in_progress", "qa_ready", "qa_in_progress"].includes(task.status))
    if (activeTasks.length > 1) {
      fail("parallel_mode 'none' does not allow multiple active execution tasks")
    }
  }

  return taskBoard
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch (error) {
    fail(`Malformed JSON at '${filePath}': ${error.message}`)
  }
}

function getManifestPaths(projectRoot, manifest) {
  const kit = manifest?.kit ?? {}
  const registryPath = kit.registry?.path
    ? path.resolve(projectRoot, kit.registry.path)
    : path.join(projectRoot, "registry.json")
  const installManifestPath = kit.installManifest?.path
    ? path.resolve(projectRoot, kit.installManifest.path)
    : path.join(projectRoot, ".opencode", "install-manifest.json")

  return {
    registryPath,
    installManifestPath,
  }
}

function tryReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, readable: false, data: null }
  }

  try {
    return {
      exists: true,
      readable: true,
      data: JSON.parse(fs.readFileSync(filePath, "utf8")),
    }
  } catch (_error) {
    return {
      exists: true,
      readable: false,
      data: null,
    }
  }
}

function getRegistry(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)
  const { registryPath } = getManifestPaths(projectRoot, manifest)
  const registry = readJsonIfExists(registryPath)

  if (!registry) {
    fail(`Unable to read registry metadata at '${registryPath}'`)
  }

  return {
    projectRoot,
    manifestPath,
    registryPath,
    manifest,
    registry,
  }
}

function getInstallManifest(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)
  const { installManifestPath } = getManifestPaths(projectRoot, manifest)
  const installManifest = readJsonIfExists(installManifestPath)

  if (!installManifest) {
    fail(`Unable to read install manifest at '${installManifestPath}'`)
  }

  return {
    projectRoot,
    manifestPath,
    installManifestPath,
    manifest,
    installManifest,
  }
}

function listProfiles(customStatePath) {
  const { registry } = getRegistry(customStatePath)
  return registry.profiles ?? []
}

function getProfile(profileName, customStatePath) {
  ensureString(profileName, "profile name")
  const { registry } = getRegistry(customStatePath)
  const profiles = registry.profiles ?? []
  const profile = profiles.find((entry) => entry.name === profileName)

  if (!profile) {
    fail(`Unknown profile '${profileName}'`)
  }

  return profile
}

function syncInstallManifest(profileName, customStatePath) {
  const profile = getProfile(profileName, customStatePath)
  const { installManifestPath, installManifest } = getInstallManifest(customStatePath)

  const nextManifest = JSON.parse(JSON.stringify(installManifest))
  nextManifest.installation = nextManifest.installation ?? {}
  nextManifest.installation.activeProfile = profile.name
  writeState(installManifestPath, nextManifest)

  return {
    installManifestPath,
    installManifest: nextManifest,
    profile,
  }
}

function ensureObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`)
  }
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`)
  }
}

function ensureString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`)
  }
}

function ensureNullableString(value, label) {
  if (value !== null && typeof value !== "string") {
    fail(`${label} must be a string or null`)
  }
}

function ensureKnown(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    fail(`${label} must be one of: ${allowedValues.join(", ")}`)
  }
}

function ensureGateShape(gateName, gateValue) {
  ensureObject(gateValue, `approvals.${gateName}`)
  for (const key of ["status", "approved_by", "approved_at", "notes"]) {
    if (!(key in gateValue)) {
      fail(`approvals.${gateName}.${key} is required`)
    }
  }

  ensureKnown(gateValue.status, ["pending", "approved", "rejected"], `approvals.${gateName}.status`)
  ensureNullableString(gateValue.approved_by, `approvals.${gateName}.approved_by`)
  ensureNullableString(gateValue.approved_at, `approvals.${gateName}.approved_at`)
  ensureNullableString(gateValue.notes, `approvals.${gateName}.notes`)
}

function ensureIssueShape(issue, index) {
  ensureObject(issue, `issues[${index}]`)

  for (const key of [
    "issue_id",
    "title",
    "type",
    "severity",
    "rooted_in",
    "recommended_owner",
    "evidence",
    "artifact_refs",
    "current_status",
    "opened_at",
    "last_updated_at",
    "reopen_count",
    "repeat_count",
    "blocked_since",
  ]) {
    if (!(key in issue)) {
      fail(`issues[${index}].${key} is required`)
    }
  }

  ensureString(issue.issue_id, `issues[${index}].issue_id`)
  ensureString(issue.title, `issues[${index}].title`)
  ensureKnown(issue.type, ISSUE_TYPES, `issues[${index}].type`)
  ensureKnown(issue.severity, ISSUE_SEVERITIES, `issues[${index}].severity`)
  ensureKnown(issue.rooted_in, ROOTED_IN_VALUES, `issues[${index}].rooted_in`)
  ensureString(issue.recommended_owner, `issues[${index}].recommended_owner`)
  ensureString(issue.evidence, `issues[${index}].evidence`)
  ensureKnown(issue.current_status, ISSUE_STATUS_VALUES, `issues[${index}].current_status`)
  ensureString(issue.opened_at, `issues[${index}].opened_at`)
  ensureString(issue.last_updated_at, `issues[${index}].last_updated_at`)

  if (typeof issue.reopen_count !== "number" || Number.isNaN(issue.reopen_count) || issue.reopen_count < 0) {
    fail(`issues[${index}].reopen_count must be a non-negative number`)
  }

  if (typeof issue.repeat_count !== "number" || Number.isNaN(issue.repeat_count) || issue.repeat_count < 0) {
    fail(`issues[${index}].repeat_count must be a non-negative number`)
  }

  ensureNullableString(issue.blocked_since, `issues[${index}].blocked_since`)

  const allowedOwners = RECOMMENDED_OWNERS[issue.type] ?? []
  if (!allowedOwners.includes(issue.recommended_owner)) {
    fail(`issues[${index}].recommended_owner must be one of: ${allowedOwners.join(", ")}`)
  }

  if (typeof issue.artifact_refs === "string") {
    issue.artifact_refs = [issue.artifact_refs]
  }

  ensureArray(issue.artifact_refs, `issues[${index}].artifact_refs`)
}

function ensureVerificationEvidenceEntry(entry, index) {
  ensureObject(entry, `verification_evidence[${index}]`)

  for (const key of ["id", "kind", "scope", "summary", "recorded_at", "source"]) {
    if (!(key in entry)) {
      fail(`verification_evidence[${index}].${key} is required`)
    }
  }

  ensureString(entry.id, `verification_evidence[${index}].id`)
  ensureKnown(entry.kind, VERIFICATION_EVIDENCE_KINDS, `verification_evidence[${index}].kind`)
  ensureString(entry.scope, `verification_evidence[${index}].scope`)
  ensureString(entry.summary, `verification_evidence[${index}].summary`)
  ensureString(entry.recorded_at, `verification_evidence[${index}].recorded_at`)
  ensureString(entry.source, `verification_evidence[${index}].source`)

  if (entry.command !== undefined && entry.command !== null) {
    ensureString(entry.command, `verification_evidence[${index}].command`)
  }

  if (entry.exit_status !== undefined && entry.exit_status !== null) {
    if (typeof entry.exit_status !== "number" || Number.isNaN(entry.exit_status)) {
      fail(`verification_evidence[${index}].exit_status must be a number or null`)
    }
  }

  if (entry.artifact_refs !== undefined) {
    ensureArray(entry.artifact_refs, `verification_evidence[${index}].artifact_refs`)
  }
}

function validateArtifacts(artifacts) {
  ensureObject(artifacts, "artifacts")
  for (const key of ["task_card", "scope_package", "solution_package", "migration_report", "qa_report", "adr"]) {
    if (!(key in artifacts)) {
      artifacts[key] = key === "adr" ? [] : null
    }
  }

  ensureNullableString(artifacts.task_card, "artifacts.task_card")
  ensureNullableString(artifacts.scope_package, "artifacts.scope_package")
  ensureNullableString(artifacts.solution_package, "artifacts.solution_package")
  ensureNullableString(artifacts.migration_report, "artifacts.migration_report")
  ensureNullableString(artifacts.qa_report, "artifacts.qa_report")
  ensureArray(artifacts.adr, "artifacts.adr")
}

function validateRoutingProfile(routingProfile) {
  ensureObject(routingProfile, "routing_profile")

  for (const key of [
    "work_intent",
    "behavior_delta",
    "dominant_uncertainty",
    "scope_shape",
    "selection_reason",
  ]) {
    if (!(key in routingProfile)) {
      fail(`routing_profile.${key} is required`)
    }
  }

  ensureKnown(routingProfile.work_intent, ROUTING_WORK_INTENT_VALUES, "routing_profile.work_intent")
  ensureKnown(routingProfile.behavior_delta, ROUTING_BEHAVIOR_DELTA_VALUES, "routing_profile.behavior_delta")
  ensureKnown(
    routingProfile.dominant_uncertainty,
    ROUTING_DOMINANT_UNCERTAINTY_VALUES,
    "routing_profile.dominant_uncertainty",
  )
  ensureKnown(routingProfile.scope_shape, ROUTING_SCOPE_SHAPE_VALUES, "routing_profile.scope_shape")
  ensureString(routingProfile.selection_reason, "routing_profile.selection_reason")
}

function validateRoutingProfileForMode(mode, routingProfile) {
  if (mode === "quick") {
    if (routingProfile.work_intent !== "maintenance") {
      fail("routing_profile.work_intent must be 'maintenance' for quick mode")
    }

    if (routingProfile.behavior_delta !== "preserve") {
      fail("routing_profile.behavior_delta must be 'preserve' for quick mode")
    }

    if (routingProfile.dominant_uncertainty !== "low_local") {
      fail("routing_profile.dominant_uncertainty must be 'low_local' for quick mode")
    }

    if (routingProfile.scope_shape === "cross_boundary") {
      fail("routing_profile.scope_shape cannot be 'cross_boundary' for quick mode")
    }

    return
  }

  if (mode === "migration") {
    if (routingProfile.work_intent !== "modernization") {
      fail("routing_profile.work_intent must be 'modernization' for migration mode")
    }

    if (routingProfile.behavior_delta !== "preserve") {
      fail("routing_profile.behavior_delta must be 'preserve' for migration mode")
    }

    if (routingProfile.dominant_uncertainty !== "compatibility") {
      fail("routing_profile.dominant_uncertainty must be 'compatibility' for migration mode")
    }

    return
  }

  const supportsFullMode =
    routingProfile.dominant_uncertainty === "product" ||
    routingProfile.behavior_delta !== "preserve" ||
    routingProfile.work_intent === "feature" ||
    routingProfile.scope_shape === "cross_boundary"

  if (!supportsFullMode) {
    fail(
      "routing_profile must reflect product uncertainty, changed behavior, feature intent, or cross-boundary scope for full mode",
    )
  }
}

function validateArtifactSignatureForMode(mode, artifacts) {
  if (mode === "quick") {
    for (const key of ["migration_report", "qa_report"]) {
      if (artifacts[key] !== null) {
        fail(`artifacts.${key} must be null in quick mode`)
      }
    }

    if (artifacts.adr.length > 0) {
      fail("artifacts.adr must stay empty in quick mode")
    }

    return
  }

  if (mode === "migration") {
    for (const key of ["task_card", "qa_report"]) {
      if (artifacts[key] !== null) {
        fail(`artifacts.${key} must be null in migration mode`)
      }
    }

    return
  }

  for (const key of ["task_card", "migration_report"]) {
    if (artifacts[key] !== null) {
      fail(`artifacts.${key} must be null in full mode`)
    }
  }
}

function readArtifactTextIfLinked(projectRoot, artifactPath, label) {
  if (typeof artifactPath !== "string" || artifactPath.length === 0) {
    return null
  }

  const resolvedPath = path.isAbsolute(artifactPath) ? artifactPath : path.resolve(projectRoot, artifactPath)
  if (!fs.existsSync(resolvedPath)) {
    return null
  }

  return fs.readFileSync(resolvedPath, "utf8")
}

function requireArtifactSections(projectRoot, artifactCandidates, label, headings) {
  const candidates = Array.isArray(artifactCandidates) ? artifactCandidates : [artifactCandidates]
  let text = null

  for (const candidate of candidates) {
    text = readArtifactTextIfLinked(projectRoot, candidate.path, candidate.label)
    if (text !== null) {
      break
    }
  }

  if (text === null) {
    return
  }

  for (const heading of headings) {
    if (!text.includes(heading)) {
      fail(`${label} is missing required section '${heading}'`)
    }
  }
}

function validatePrimaryArtifactContracts(state, projectRoot) {
  if (state.mode === "full") {
    if (state.current_stage !== "full_intake") {
      requireArtifactSections(projectRoot, [{ path: state.artifacts.scope_package, label: "artifacts.scope_package" }], "artifacts.scope_package", [
        "## Goal",
        "## In Scope",
        "## Out of Scope",
        "## Acceptance Criteria Matrix",
      ])
    }

    if (["full_implementation", "full_code_review", "full_qa", "full_done"].includes(state.current_stage)) {
      requireArtifactSections(projectRoot, [{ path: state.artifacts.solution_package, label: "artifacts.solution_package" }], "artifacts.solution_package", [
        "## Recommended Path",
        "## Impacted Surfaces",
        "## Implementation Slices",
        "## Validation Matrix",
        "## Integration Checkpoint",
      ])
    }

    if (state.current_stage === "full_done") {
      requireArtifactSections(projectRoot, state.artifacts.qa_report, "artifacts.qa_report", [
        "## Overall Status",
        "## Test Evidence",
        "## Issues",
      ])
    }

    if (["full_qa", "full_done"].includes(state.current_stage)) {
      const hasReviewEvidence = state.verification_evidence.some(
        (entry) => entry.kind === "review" && entry.scope === "full_code_review",
      )
      if (!hasReviewEvidence) {
        fail("verification_evidence must include a review entry for 'full_code_review' before QA or done")
      }
    }
  }

  if (state.mode === "migration" && ["migration_verify", "migration_done"].includes(state.current_stage)) {
    const hasReviewEvidence = state.verification_evidence.some(
      (entry) => entry.kind === "review" && entry.scope === "migration_code_review",
    )
    if (!hasReviewEvidence) {
      fail("verification_evidence must include a review entry for 'migration_code_review' before verify or done")
    }
  }
}

function validateParallelization(parallelization, mode) {
  if (parallelization === null || parallelization === undefined) {
    parallelization = createDefaultParallelization(mode)
  }

  ensureObject(parallelization, "parallelization")

  for (const key of [
    "parallel_mode",
    "why",
    "safe_parallel_zones",
    "sequential_constraints",
    "integration_checkpoint",
    "max_active_execution_tracks",
  ]) {
    if (!(key in parallelization)) {
      fail(`parallelization.${key} is required`)
    }
  }

  ensureKnown(parallelization.parallel_mode, PARALLEL_MODES, "parallelization.parallel_mode")
  ensureNullableString(parallelization.why, "parallelization.why")
  ensureArray(parallelization.safe_parallel_zones, "parallelization.safe_parallel_zones")
  ensureArray(parallelization.sequential_constraints, "parallelization.sequential_constraints")
  ensureNullableString(parallelization.integration_checkpoint, "parallelization.integration_checkpoint")

  if (
    parallelization.max_active_execution_tracks !== null &&
    (typeof parallelization.max_active_execution_tracks !== "number" ||
      Number.isNaN(parallelization.max_active_execution_tracks) ||
      parallelization.max_active_execution_tracks < 1)
  ) {
    fail("parallelization.max_active_execution_tracks must be a positive number or null")
  }

  if (mode === "quick" && parallelization.parallel_mode !== "none") {
    fail("parallelization.parallel_mode must be 'none' in quick mode")
  }
}

function validateApprovals(mode, approvals) {
  ensureObject(approvals, "approvals")

  const requiredGates = getApprovalGatesForMode(mode)
  const approvalKeys = Object.keys(approvals)

  for (const gate of requiredGates) {
    if (!(gate in approvals)) {
      fail(`approvals.${gate} is required for mode '${mode}'`)
    }
    ensureGateShape(gate, approvals[gate])
  }

  for (const gate of approvalKeys) {
    if (!requiredGates.includes(gate)) {
      fail(`approvals.${gate} is not valid for mode '${mode}'`)
    }
  }
}

function validateStateObject(state, options = {}) {
  ensureObject(state, "workflow state")

  for (const key of [
    "feature_id",
    "feature_slug",
    "mode",
    "mode_reason",
    "routing_profile",
    "current_stage",
    "status",
    "current_owner",
    "artifacts",
    "approvals",
    "issues",
    "verification_evidence",
    "retry_count",
    "escalated_from",
    "escalation_reason",
    "updated_at",
  ]) {
    if (!(key in state)) {
      fail(`${key} is required`)
    }
  }

  if (state.feature_id !== null) {
    ensureString(state.feature_id, "feature_id")
  }

  if (state.feature_slug !== null) {
    ensureString(state.feature_slug, "feature_slug")
  }

  ensureKnown(state.mode, MODE_VALUES, "mode")
  ensureString(state.mode_reason, "mode_reason")
  if (!("parallelization" in state) || state.parallelization === undefined) {
    state.parallelization = createDefaultParallelization(state.mode)
  }
  validateRoutingProfile(state.routing_profile)
  validateRoutingProfileForMode(state.mode, state.routing_profile)
  validateParallelization(state.parallelization, state.mode)
  ensureKnown(state.current_stage, STAGE_SEQUENCE, "current_stage")
  ensureKnown(state.status, STATUS_VALUES, "status")

  const stageMode = getModeForStage(state.current_stage)
  if (stageMode !== state.mode) {
    fail(`current_stage '${state.current_stage}' does not belong to mode '${state.mode}'`)
  }

  if (options.strictOwner !== false) {
    const expectedOwner = STAGE_OWNERS[state.current_stage]
    if (state.current_owner !== expectedOwner) {
      fail(`current_owner must be '${expectedOwner}' for stage '${state.current_stage}'`)
    }
  }

  validateArtifacts(state.artifacts)
  validateArtifactSignatureForMode(state.mode, state.artifacts)
  validateApprovals(state.mode, state.approvals)

  ensureArray(state.issues, "issues")
  state.issues.forEach((issue, index) => ensureIssueShape(issue, index))
  ensureArray(state.verification_evidence, "verification_evidence")
  state.verification_evidence.forEach((entry, index) => ensureVerificationEvidenceEntry(entry, index))

  if (typeof state.retry_count !== "number" || Number.isNaN(state.retry_count) || state.retry_count < 0) {
    fail("retry_count must be a non-negative number")
  }

  if (state.escalated_from !== null) {
    ensureKnown(state.escalated_from, ["quick", "migration"], "escalated_from")
  }

  ensureNullableString(state.escalation_reason, "escalation_reason")
  ensureNullableString(state.updated_at, "updated_at")

  if (state.escalated_from === null && state.escalation_reason !== null) {
    fail("escalation_reason must be null when escalated_from is null")
  }

  if ((state.escalated_from === "quick" || state.escalated_from === "migration") && state.mode !== "full") {
    fail("mode must be 'full' when escalated_from records an escalated lane")
  }

  return state
}

function createFreshState({ workItemId, mode, featureId, featureSlug, modeReason, updatedAt }) {
  const initialStage = getInitialStageForMode(mode)

  return {
    work_item_id: workItemId,
    feature_id: featureId,
    feature_slug: featureSlug,
    mode,
    mode_reason: modeReason,
    routing_profile: createDefaultRoutingProfile(mode, modeReason),
    parallelization: createDefaultParallelization(mode),
    current_stage: initialStage,
    status: "in_progress",
    current_owner: STAGE_OWNERS[initialStage],
    artifacts: createEmptyArtifacts(),
    approvals: createEmptyApprovals(mode),
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: updatedAt,
  }
}

function buildReadinessSummary(state, context = {}) {
  const artifactReadiness = getArtifactReadiness(state)
  const verificationReadiness = getVerificationReadiness(state)
  const missingRequiredArtifacts = artifactReadiness.filter((entry) => entry.status === "missing-required")
  const unresolvedIssues = Array.isArray(state.issues)
    ? state.issues.filter((issue) => issue.current_status !== "resolved" && issue.current_status !== "closed")
    : []
  const issueTelemetry = getIssueTelemetry(state)
  const blockers = []

  if (missingRequiredArtifacts.length > 0) {
    blockers.push(
      `missing required artifacts: ${missingRequiredArtifacts.map((entry) => entry.artifact).join(", ")}`,
    )
  }

  if (verificationReadiness.status === "missing-evidence") {
    blockers.push(
      `missing verification evidence${verificationReadiness.missingKinds.length > 0 ? ` (${verificationReadiness.missingKinds.join(", ")})` : ""}`,
    )
  }

  if (unresolvedIssues.length > 0) {
    blockers.push(`unresolved issues: ${unresolvedIssues.length}`)
  }

  if (context.requireTaskBoard === true && context.taskBoardValid !== true) {
    blockers.push("task board readiness not satisfied")
  }

  return {
    ready: blockers.length === 0,
    blockers,
    artifactReadiness,
    verificationReadiness,
    unresolvedIssues,
    issueTelemetry,
  }
}

function assertStageExitReadiness(state, context = {}) {
  const summary = buildReadinessSummary(state, context)
  if (!summary.ready) {
    fail(`Stage readiness failed for '${state.current_stage}': ${summary.blockers.join("; ")}`)
  }

  return summary
}

function setRoutingProfile(workIntent, behaviorDelta, dominantUncertainty, scopeShape, selectionReason, customStatePath) {
  ensureKnown(workIntent, ROUTING_WORK_INTENT_VALUES, "routing_profile.work_intent")
  ensureKnown(behaviorDelta, ROUTING_BEHAVIOR_DELTA_VALUES, "routing_profile.behavior_delta")
  ensureKnown(
    dominantUncertainty,
    ROUTING_DOMINANT_UNCERTAINTY_VALUES,
    "routing_profile.dominant_uncertainty",
  )
  ensureKnown(scopeShape, ROUTING_SCOPE_SHAPE_VALUES, "routing_profile.scope_shape")
  ensureString(selectionReason, "routing_profile.selection_reason")

  return mutate(customStatePath, (state) => {
    state.routing_profile = {
      work_intent: workIntent,
      behavior_delta: behaviorDelta,
      dominant_uncertainty: dominantUncertainty,
      scope_shape: scopeShape,
      selection_reason: selectionReason,
    }
    return state
  })
}

function mutate(customStatePath, mutator) {
  const context = readManagedState(customStatePath)
  const { state, workItemId, index, projectRoot } = context
  const expectedRevision = captureRevision(state)
  const expectedMirrorRevision = index.active_work_item_id === workItemId ? expectedRevision : null
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)
  const nextState = mutator(JSON.parse(JSON.stringify(state)), context)
  nextState.updated_at = timestamp()
  validateStateObject(nextState)
  return persistManagedState(customStatePath, nextState, {
    expectedRevision,
    expectedMirrorRevision,
    workItemId,
    activateWorkItemId: index.active_work_item_id ?? workItemId,
  })
}

function mutateWorkItem(workItemId, customStatePath, mutator) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  const index = readWorkItemIndex(projectRoot)
  const expectedRevision = captureRevision(state)
  const expectedMirrorRevision = index.active_work_item_id === workItemId ? expectedRevision : null

  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  const nextState = mutator(JSON.parse(JSON.stringify(state)), context)
  nextState.updated_at = timestamp()
  validateStateObject(nextState)

  return persistManagedState(customStatePath, nextState, {
    expectedRevision,
    expectedMirrorRevision,
    workItemId,
    activateWorkItemId: index.active_work_item_id ?? workItemId,
  })
}

function showState(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)
  return { statePath, state }
}

function showWorkItemState(workItemId, customStatePath) {
  ensureString(workItemId, "work_item_id")
  const { statePath, projectRoot, state } = readManagedState(customStatePath, workItemId)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  return {
    statePath,
    workItemStatePath: resolveWorkItemPaths(projectRoot, workItemId).statePath,
    state,
  }
}

function createWorkItem(mode, featureId, featureSlug, modeReason, customStatePath) {
  return startTask(mode, featureId, featureSlug, modeReason, customStatePath)
}

function listWorkItems(customStatePath) {
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const index = readWorkItemIndex(projectRoot)
  return {
    projectRoot,
    index,
    workItems: index.work_items.map((entry) => {
      const state = readWorkItemState(projectRoot, entry.work_item_id)
      return {
        ...entry,
        next_action: getNextAction(state),
        artifact_readiness: getArtifactReadiness(state),
      }
    }),
  }
}

function getWorkItemCloseoutSummary(workItemId, customStatePath) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state } = context
  validateStateObject(state)

  const artifactReadiness = getArtifactReadiness(state)
  const missingRequiredArtifacts = artifactReadiness.filter((entry) => entry.status === "missing-required")
  const recommendedArtifacts = artifactReadiness.filter((entry) => entry.status === "recommended-now")
  const linkedArtifacts = flattenArtifactRefs(state)
  const unresolvedIssues = Array.isArray(state.issues) ? state.issues : []
  const board = state.mode === "full" ? readTaskBoardIfExists(context.projectRoot, workItemId) : null
  const activeTasks = Array.isArray(board?.tasks)
    ? board.tasks.filter((task) => ["claimed", "in_progress", "qa_in_progress"].includes(task.status))
    : []

  return {
    ...context,
    artifactReadiness,
    linkedArtifacts,
    missingRequiredArtifacts,
    recommendedArtifacts,
    unresolvedIssues,
    activeTasks,
    verificationReadiness: getVerificationReadiness(state),
    readyToClose:
      state.status === "done" &&
      missingRequiredArtifacts.length === 0 &&
      getVerificationReadiness(state).status !== "missing-evidence" &&
      unresolvedIssues.length === 0 &&
      activeTasks.length === 0,
  }
}

function recordVerificationEvidence(entry, customStatePath) {
  return mutate(customStatePath, (state) => {
    const nextEntry = {
      artifact_refs: [],
      command: null,
      exit_status: null,
      ...entry,
    }

    ensureVerificationEvidenceEntry(nextEntry, state.verification_evidence.length)
    state.verification_evidence.push(nextEntry)
    return state
  })
}

function clearVerificationEvidence(customStatePath) {
  return mutate(customStatePath, (state) => {
    state.verification_evidence = []
    return state
  })
}

function updateIssueStatus(issueId, nextStatus, customStatePath) {
  ensureString(issueId, "issue_id")
  ensureKnown(nextStatus, ISSUE_STATUS_VALUES, "issue_status")

  return mutate(customStatePath, (state) => {
    const issue = state.issues.find((entry) => entry.issue_id === issueId)
    if (!issue) {
      fail(`Unknown issue '${issueId}'`)
    }

    if (issue.current_status === "resolved" && nextStatus === "open") {
      issue.reopen_count += 1
    }

    issue.current_status = nextStatus
    issue.last_updated_at = timestamp()
    if (nextStatus === "open" && issue.blocked_since === null) {
      issue.blocked_since = timestamp()
    }
    if (nextStatus === "resolved" || nextStatus === "closed") {
      issue.blocked_since = null
    }

    if (state.issues.every((entry) => entry.current_status === "resolved" || entry.current_status === "closed")) {
      state.status = state.current_stage.endsWith("_done") ? "done" : "in_progress"
    }

    return state
  })
}

function listStaleIssues(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  const staleIssues = state.issues.filter(
    (issue) => issue.current_status === "open" && (issue.reopen_count > 0 || issue.repeat_count > 0 || issue.blocked_since),
  )

  return {
    statePath,
    state,
    issues: staleIssues,
  }
}

function getIssueAgingReport(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  return {
    statePath,
    state,
    telemetry: getIssueTelemetry(state),
    issues: state.issues,
  }
}

function getWorkflowMetrics(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  const board = state.mode === "full" ? readTaskBoardIfExists(projectRoot, workItemId) : null
  const migrationBoard = state.mode === "migration" ? readMigrationSliceBoardIfExists(projectRoot, workItemId) : null
  const readiness = buildReadinessSummary(state, {
    requireTaskBoard: state.mode === "full" && ["full_implementation", "full_qa", "full_done"].includes(state.current_stage),
    taskBoardValid: state.mode !== "full" || state.current_stage === "full_solution" ? true : Boolean(board),
  })

  return {
    statePath,
    workItemId,
    mode: state.mode,
    stage: state.current_stage,
    retryCount: state.retry_count,
    issueTelemetry: readiness.issueTelemetry,
    verificationReadiness: readiness.verificationReadiness,
    artifactReadiness: readiness.artifactReadiness,
    taskCount: Array.isArray(board?.tasks) ? board.tasks.length : 0,
    activeTaskCount: Array.isArray(board?.tasks)
      ? board.tasks.filter((task) => ["claimed", "in_progress", "qa_in_progress"].includes(task.status)).length
      : 0,
    migrationSliceCount: Array.isArray(migrationBoard?.slices) ? migrationBoard.slices.length : 0,
    blocked: readiness.blockers,
  }
}

function getApprovalBottlenecks(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  const pending = Object.entries(state.approvals)
    .filter(([, approval]) => approval.status === "pending")
    .map(([gate, approval]) => ({ gate, notes: approval.notes }))

  return {
    statePath,
    workItemId,
    pending,
  }
}

function getQaFailureSummary(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  const qaIssues = state.issues.filter((issue) => issue.rooted_in === "implementation" || issue.rooted_in === "architecture")

  return {
    statePath,
    workItemId,
    retryCount: state.retry_count,
    qaIssues,
  }
}

function getTaskAgingReport(customStatePath) {
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const index = readWorkItemIndex(projectRoot)
  const reports = []

  for (const item of index.work_items) {
    const state = readWorkItemState(projectRoot, item.work_item_id)
    const board = state.mode === "full" ? readTaskBoardIfExists(projectRoot, item.work_item_id) : null
    const tasks = Array.isArray(board?.tasks) ? board.tasks : []
    const staleTasks = tasks.filter((task) => ["claimed", "in_progress", "qa_in_progress", "blocked"].includes(task.status))
    reports.push({
      work_item_id: item.work_item_id,
      mode: state.mode,
      stale_task_count: staleTasks.length,
      stale_tasks: staleTasks.map((task) => ({ task_id: task.task_id, status: task.status, updated_at: task.updated_at })),
    })
  }

  return {
    projectRoot,
    reports,
  }
}

function getRuntimeShortSummary(customStatePath) {
  const runtime = getRuntimeStatus(customStatePath)
  const readiness = buildReadinessSummary(runtime.state, {
    requireTaskBoard: runtime.state.mode === "full" && ["full_implementation", "full_qa", "full_done"].includes(runtime.state.current_stage),
    taskBoardValid: true,
  })

  return {
    mode: runtime.state.mode,
    stage: runtime.state.current_stage,
    owner: runtime.state.current_owner,
    nextAction: getNextAction(runtime.state),
    readiness: readiness.ready ? "ready" : `blocked: ${readiness.blockers.join("; ")}`,
  }
}

function getDefinitionOfDone(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)

  const rule = getDodRule(state.mode)
  const readiness = buildReadinessSummary(state, {
    requireTaskBoard: state.mode === "full" && ["full_implementation", "full_qa", "full_done"].includes(state.current_stage),
    taskBoardValid: true,
  })
  const approvals = Object.entries(state.approvals)
  const missingApprovals = (rule?.requiredApprovals ?? []).filter(
    (gate) => state.approvals?.[gate]?.status !== "approved",
  )
  const missingArtifacts = (rule?.requiredArtifacts ?? []).filter((artifactId) => {
    const entry = readiness.artifactReadiness.find((artifact) => artifact.artifact === artifactId)
    return !entry || entry.status !== "present"
  })

  return {
    statePath,
    workItemId,
    mode: state.mode,
    stage: state.current_stage,
    summary: rule?.summary ?? null,
    requiredApprovals: rule?.requiredApprovals ?? [],
    requiredArtifacts: rule?.requiredArtifacts ?? [],
    requiredEvidenceStages: rule?.requiredEvidenceStages ?? [],
    missingApprovals,
    missingArtifacts,
    verificationReadiness: readiness.verificationReadiness,
    unresolvedIssues: readiness.unresolvedIssues,
    ready: missingApprovals.length === 0 && missingArtifacts.length === 0 && readiness.ready,
  }
}

function getReleaseReadiness(customStatePath) {
  const managed = readManagedState(customStatePath)
  const closeout = getWorkItemCloseoutSummary(managed.workItemId ?? managed.state.work_item_id, customStatePath)
  const dod = getDefinitionOfDone(customStatePath)
  const blockers = []

  if (!dod.ready) {
    blockers.push("definition-of-done not satisfied")
  }
  if (!closeout.readyToClose) {
    blockers.push("work item is not ready to close")
  }
  if (closeout.unresolvedIssues.some((issue) => issue.severity === "critical" || issue.severity === "high")) {
    blockers.push("high-severity or critical issues remain open")
  }

  return {
    workItemId: closeout.workItemId,
    mode: closeout.state.mode,
    stage: closeout.state.current_stage,
    releaseReady: blockers.length === 0,
    blockers,
    dod,
    closeout,
  }
}

function getWorkflowAnalytics(customStatePath) {
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const index = readWorkItemIndex(projectRoot)
  const analytics = {
    totalWorkItems: index.work_items.length,
    byMode: { quick: 0, migration: 0, full: 0 },
    totalOpenIssues: 0,
    totalRepeatedIssues: 0,
    totalRetries: 0,
    totalEscalations: 0,
    stageCounts: {},
  }

  for (const item of index.work_items) {
    const state = readWorkItemState(projectRoot, item.work_item_id)
    analytics.byMode[state.mode] += 1
    analytics.totalRetries += state.retry_count ?? 0
    analytics.totalEscalations += state.escalated_from ? 1 : 0
    analytics.stageCounts[state.current_stage] = (analytics.stageCounts[state.current_stage] ?? 0) + 1
    const telemetry = getIssueTelemetry(state)
    analytics.totalOpenIssues += telemetry.open
    analytics.totalRepeatedIssues += telemetry.repeated
  }

  return {
    projectRoot,
    analytics,
  }
}

function getOpsSummary(customStatePath) {
  const runtime = getRuntimeStatus(customStatePath)
  const readiness = buildReadinessSummary(runtime.state, {
    requireTaskBoard: runtime.state.mode === "full" && ["full_implementation", "full_qa", "full_done"].includes(runtime.state.current_stage),
    taskBoardValid: true,
  })
  const pendingApprovals = Object.entries(runtime.state.approvals)
    .filter(([, approval]) => approval.status === "pending")
    .map(([gate]) => gate)

  return {
    mode: runtime.state.mode,
    stage: runtime.state.current_stage,
    owner: runtime.state.current_owner,
    nextAction: getNextAction(runtime.state),
    blockers: readiness.blockers,
    pendingApprovals,
    openIssues: readiness.issueTelemetry.open,
  }
}

function getPolicyExecutionTrace() {
  return {
    policies: [
      {
        id: "verification-before-completion",
        docs: [
          "skills/verification-before-completion/SKILL.md",
          "context/core/project-config.md",
          "context/core/workflow-state-schema.md",
        ],
        runtime: [
          ".opencode/lib/runtime-guidance.js#getVerificationReadiness",
          ".opencode/lib/workflow-state-controller.js#assertStageExitReadiness",
        ],
        tests: [
          ".opencode/tests/workflow-state-controller.test.js",
          "tests/runtime/governance-enforcement.test.js",
        ],
      },
      {
        id: "issue-lifecycle-and-escalation",
        docs: [
          "context/core/workflow-state-schema.md",
          "context/core/session-resume.md",
        ],
        runtime: [
          ".opencode/lib/workflow-state-controller.js#recordIssue",
          ".opencode/lib/workflow-state-controller.js#updateIssueStatus",
          ".opencode/lib/workflow-state-controller.js#routeRework",
        ],
        tests: [
          ".opencode/tests/workflow-state-controller.test.js",
        ],
      },
      {
        id: "task-board-only-for-full",
        docs: [
          "context/core/workflow.md",
          "docs/maintainer/parallel-execution-matrix.md",
        ],
        runtime: [
          ".opencode/lib/workflow-state-controller.js#requireValidTaskBoard",
          ".opencode/lib/task-board-rules.js",
        ],
        tests: [
          ".opencode/tests/workflow-state-controller.test.js",
          ".opencode/tests/workflow-contract-consistency.test.js",
        ],
      },
    ],
  }
}

function createReleaseCandidate(releaseId, title, customStatePath) {
  ensureString(releaseId, "release_id")
  ensureString(title, "title")

  const projectRoot = resolveProjectRoot(customStatePath)
  const index = bootstrapReleaseStore(projectRoot)
  if (index.releases.some((entry) => entry.release_id === releaseId)) {
    fail(`Release candidate '${releaseId}' already exists`)
  }

  const candidate = createReleaseCandidateShape(releaseId, title)
  validateReleaseCandidate(candidate)
  const paths = resolveReleaseCandidatePaths(projectRoot, releaseId)
  writeReleaseCandidate(projectRoot, releaseId, candidate)
  upsertReleaseIndexEntry(index, candidate, releaseId, paths.relativeReleasePath)
  index.active_release_id = releaseId
  writeReleaseIndex(projectRoot, index)

  return { projectRoot, candidate }
}

function listReleaseCandidates(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const index = bootstrapReleaseStore(projectRoot)
  return { projectRoot, index }
}

function showReleaseCandidate(releaseId, customStatePath) {
  ensureString(releaseId, "release_id")
  const projectRoot = resolveProjectRoot(customStatePath)
  bootstrapReleaseStore(projectRoot)
  const candidate = readReleaseCandidate(projectRoot, releaseId)
  validateReleaseCandidate(candidate)
  return { projectRoot, candidate }
}

function mutateReleaseCandidate(releaseId, customStatePath, mutator) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const index = bootstrapReleaseStore(projectRoot)
  const current = readReleaseCandidate(projectRoot, releaseId)
  validateReleaseCandidate(current)
  const next = mutator(JSON.parse(JSON.stringify(current)))
  next.updated_at = timestamp()
  validateReleaseCandidate(next)
  writeReleaseCandidate(projectRoot, releaseId, next)
  const paths = resolveReleaseCandidatePaths(projectRoot, releaseId)
  upsertReleaseIndexEntry(index, next, releaseId, paths.relativeReleasePath)
  if (!index.active_release_id) {
    index.active_release_id = releaseId
  }
  writeReleaseIndex(projectRoot, index)
  return { projectRoot, candidate: next }
}

function addReleaseWorkItem(releaseId, workItemId, customStatePath) {
  ensureString(workItemId, "work_item_id")
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  readWorkItemState(projectRoot, workItemId)
  return mutateReleaseCandidate(releaseId, customStatePath, (candidate) => {
    if (!candidate.included_work_items.includes(workItemId)) {
      candidate.included_work_items.push(workItemId)
    }
    return candidate
  })
}

function removeReleaseWorkItem(releaseId, workItemId, customStatePath) {
  ensureString(workItemId, "work_item_id")
  return mutateReleaseCandidate(releaseId, customStatePath, (candidate) => {
    candidate.included_work_items = candidate.included_work_items.filter((entry) => entry !== workItemId)
    return candidate
  })
}

function setReleaseStatus(releaseId, status, customStatePath) {
  ensureKnown(status, RELEASE_STATUS_VALUES, "release_status")
  return mutateReleaseCandidate(releaseId, customStatePath, (candidate) => {
    candidate.status = status
    return candidate
  })
}

function setReleaseApproval(releaseId, gate, status, approvedBy, approvedAt, notes, customStatePath) {
  ensureKnown(gate, RELEASE_APPROVAL_GATES, "release_approval_gate")
  ensureKnown(status, ["pending", "approved", "rejected"], "release_approval_status")
  return mutateReleaseCandidate(releaseId, customStatePath, (candidate) => {
    candidate.approvals[gate] = {
      status,
      approved_by: approvedBy ?? null,
      approved_at: approvedAt ?? null,
      notes: notes ?? null,
    }
    return candidate
  })
}

function recordRollbackPlan(releaseId, summary, owner, triggerSignals, customStatePath) {
  return mutateReleaseCandidate(releaseId, customStatePath, (candidate) => {
    candidate.rollback_plan = {
      summary,
      owner,
      trigger_signals: triggerSignals,
      recorded_at: timestamp(),
    }
    return candidate
  })
}

function draftReleaseNotes(releaseId, customStatePath) {
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const candidate = readReleaseCandidate(projectRoot, releaseId)
  validateReleaseCandidate(candidate)

  const notesPath = path.join(projectRoot, candidate.notes_path)
  const bullets = candidate.included_work_items.map((workItemId) => {
    const state = readWorkItemState(projectRoot, workItemId)
    return `- ${state.feature_id ?? workItemId}: ${state.feature_slug ?? "work item"} (${state.mode})`
  })
  const content = [
    "## What's changed",
    "",
    ...(bullets.length > 0 ? bullets : ["- pending release summary"]),
    "",
    "## Validation",
    "",
    "- release gates reviewed",
    "- runtime verification and quality gates passed",
    "",
    "## Published package",
    "",
    "- npm: `@duypham93/openkit@<candidate-version>`",
    "",
    "## Notes",
    "",
    `- Release candidate: ${releaseId}`,
    "",
  ].join("\n")
  fs.mkdirSync(path.dirname(notesPath), { recursive: true })
  fs.writeFileSync(notesPath, content, "utf8")
  return { projectRoot, releaseId, notesPath }
}

function validateReleaseNotes(releaseId, customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const candidate = readReleaseCandidate(projectRoot, releaseId)
  validateReleaseCandidate(candidate)
  const notesPath = path.join(projectRoot, candidate.notes_path)
  const exists = fs.existsSync(notesPath)
  const blockers = []
  if (!exists) {
    blockers.push("release notes file missing")
  } else {
    const content = fs.readFileSync(notesPath, "utf8")
    if (!content.includes("## What's changed")) {
      blockers.push("release notes missing What's changed section")
    }
    if (!content.includes("## Validation")) {
      blockers.push("release notes missing Validation section")
    }
  }
  return { releaseId, notesPath, ready: blockers.length === 0, blockers }
}

function getReleaseCandidateReadiness(releaseId, customStatePath) {
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const candidate = readReleaseCandidate(projectRoot, releaseId)
  validateReleaseCandidate(candidate)
  const blockers = []
  const warnings = []
  const workItems = candidate.included_work_items.map((workItemId) => getWorkItemCloseoutSummary(workItemId, customStatePath))
  const notReadyItems = workItems.filter((item) => item.readyToClose !== true)
  const severeIssues = workItems.flatMap((item) => item.unresolvedIssues).filter((issue) => issue.severity === "critical" || issue.severity === "high")
  const notes = validateReleaseNotes(releaseId, customStatePath)

  if (candidate.included_work_items.length === 0) {
    blockers.push("release candidate has no included work items")
  }
  if (notReadyItems.length > 0) {
    blockers.push(`included work items not ready: ${notReadyItems.map((item) => item.workItemId).join(", ")}`)
  }
  if (severeIssues.length > 0) {
    blockers.push(`high-severity or critical issues remain: ${severeIssues.map((issue) => issue.issue_id).join(", ")}`)
  }
  if (!notes.ready) {
    blockers.push(...notes.blockers)
  }
  if (candidate.risk_level === "high" && candidate.rollback_plan === null) {
    blockers.push("high-risk release candidate requires a rollback plan")
  }
  for (const gate of RELEASE_APPROVAL_GATES) {
    if (candidate.approvals[gate].status !== "approved") {
      warnings.push(`approval '${gate}' is not approved`)
    }
  }

  return {
    releaseId,
    candidate,
    workItems,
    blockers,
    warnings,
    ready: blockers.length === 0,
  }
}

function getReleaseDashboard(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const index = bootstrapReleaseStore(projectRoot)
  const dashboard = {
    total: index.releases.length,
    byStatus: {},
    ready: 0,
    blocked: 0,
    rollbackCovered: 0,
    notesReady: 0,
  }

  for (const entry of index.releases) {
    dashboard.byStatus[entry.status] = (dashboard.byStatus[entry.status] ?? 0) + 1
    const readiness = getReleaseCandidateReadiness(entry.release_id, customStatePath)
    if (readiness.ready) {
      dashboard.ready += 1
    } else {
      dashboard.blocked += 1
    }
    if (readiness.candidate.rollback_plan) {
      dashboard.rollbackCovered += 1
    }
    if (validateReleaseNotes(entry.release_id, customStatePath).ready) {
      dashboard.notesReady += 1
    }
  }

  return { projectRoot, dashboard, index }
}

function startHotfix(releaseId, mode, featureId, featureSlug, reason, customStatePath) {
  const workItemResult = startTask(mode, featureId, featureSlug, reason, customStatePath)
  const hotfixWorkItemId = workItemResult.state.work_item_id
  mutateReleaseCandidate(releaseId, customStatePath, (candidate) => {
    if (!candidate.hotfix_work_items.includes(hotfixWorkItemId)) {
      candidate.hotfix_work_items.push(hotfixWorkItemId)
    }
    if (!candidate.included_work_items.includes(hotfixWorkItemId)) {
      candidate.included_work_items.push(hotfixWorkItemId)
    }
    return candidate
  })
  return {
    releaseId,
    workItemId: hotfixWorkItemId,
    state: workItemResult.state,
  }
}

function validateHotfix(workItemId, customStatePath) {
  const closeout = getWorkItemCloseoutSummary(workItemId, customStatePath)
  return {
    workItemId,
    ready: closeout.readyToClose,
    closeout,
  }
}

function reconcileCompletedWorkItems(customStatePath, workItemIds = []) {
  if (!Array.isArray(workItemIds) || workItemIds.length === 0) {
    fail("reconcile-work-items requires at least one work_item_id")
  }

  const workItems = workItemIds.map((workItemId) => getWorkItemCloseoutSummary(workItemId, customStatePath))
  const ownership = new Map()
  const conflicts = []

  for (const item of workItems) {
    for (const artifact of item.linkedArtifacts) {
      const existing = ownership.get(artifact.path)
      if (existing && existing.workItemId !== item.workItemId) {
        conflicts.push({
          path: artifact.path,
          first: existing.workItemId,
          second: item.workItemId,
        })
      } else if (!existing) {
        ownership.set(artifact.path, {
          workItemId: item.workItemId,
          artifact: artifact.artifact,
        })
      }
    }
  }

  return {
    workItems,
    conflicts,
    allReadyToClose: conflicts.length === 0 && workItems.every((item) => item.readyToClose),
  }
}

function listTasks(workItemId, customStatePath) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  requireFullModeWorkItem(state, workItemId)
  requireTaskBoardStage(state, workItemId, "view a task board")

  const board = buildBoardView(state, readTaskBoardIfExists(projectRoot, workItemId))
  return {
    ...context,
    board,
    tasks: board.tasks,
  }
}

function listMigrationSlices(workItemId, customStatePath) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  requireMigrationModeWorkItem(state, workItemId)
  requireMigrationSliceBoardStage(state, workItemId, "view migration slices")

  const board = buildMigrationSliceBoardView(state, readMigrationSliceBoardIfExists(projectRoot, workItemId))
  return {
    ...context,
    board,
    slices: board.slices,
  }
}

function createTask(workItemId, taskInput, customStatePath) {
  return withTaskBoard(workItemId, customStatePath, (board) => {
    const task = buildTaskRecord(taskInput)

    if (board.tasks.some((entry) => entry.task_id === task.task_id)) {
      fail(`Duplicate task_id '${task.task_id}' in task board`)
    }

    board.tasks.push(task)
    return board
  })
}

function createMigrationSlice(workItemId, sliceInput, customStatePath) {
  return withMigrationSliceBoard(workItemId, customStatePath, (board) => {
    const slice = buildMigrationSliceRecord(sliceInput)

    if (board.slices.some((entry) => entry.slice_id === slice.slice_id)) {
      fail(`Duplicate migration slice id '${slice.slice_id}' in migration slice board`)
    }

    board.slices.push(slice)
    return board
  })
}

function claimTask(workItemId, taskId, owner, customStatePath, options = {}) {
  ensureString(owner, "owner")

  return withTaskBoard(workItemId, customStatePath, (board) => {
    const task = findTask(board, taskId)

    if (task.primary_owner && task.primary_owner !== owner) {
      fail("Implicit reassignment is not allowed; use reassignTask")
    }

    validateReassignmentAuthority({
      task,
      ownerField: "primary_owner",
      requestedBy: options.requestedBy,
      nextOwner: owner,
    })

    validateTaskTransition(task, "claimed")
    task.primary_owner = owner
    task.status = "claimed"
    task.updated_at = timestamp()
    return board
  })
}

function assignQaOwner(workItemId, taskId, qaOwner, customStatePath, options = {}) {
  ensureString(qaOwner, "qa_owner")

  return withTaskBoard(workItemId, customStatePath, (board) => {
    const task = findTask(board, taskId)

    validateReassignmentAuthority({
      task,
      ownerField: "qa_owner",
      requestedBy: options.requestedBy,
      nextOwner: qaOwner,
    })

    task.qa_owner = qaOwner
    task.updated_at = timestamp()
    return board
  })
}

function reassignTask(workItemId, taskId, owner, customStatePath, options = {}) {
  ensureString(owner, "owner")

  return withTaskBoard(workItemId, customStatePath, (board) => {
    const task = findTask(board, taskId)

    validateReassignmentAuthority({
      task,
      ownerField: "primary_owner",
      requestedBy: options.requestedBy,
      nextOwner: owner,
    })

    task.primary_owner = owner
    if (task.status === "ready") {
      task.status = "claimed"
    }
    task.updated_at = timestamp()
    return board
  })
}

function releaseTask(workItemId, taskId, customStatePath, options = {}) {
  ensureString(options.requestedBy, "requestedBy")

  return withTaskBoard(workItemId, customStatePath, (board) => {
    const task = findTask(board, taskId)
    const allowedAuthorities = VALID_ASSIGNMENT_AUTHORITIES.primary_owner
    const isCurrentOwner = task.primary_owner === options.requestedBy

    if (!allowedAuthorities.includes(options.requestedBy) && !isCurrentOwner) {
      fail(`Only ${allowedAuthorities.join(" or ")} can release primary_owner`)
    }

    task.primary_owner = null
    if (task.status === "claimed") {
      task.status = "ready"
    }
    task.updated_at = timestamp()
    return board
  })
}

function claimMigrationSlice(workItemId, sliceId, owner, customStatePath, options = {}) {
  ensureString(owner, "owner")

  return withMigrationSliceBoard(workItemId, customStatePath, (board) => {
    const slice = board.slices.find((entry) => entry.slice_id === sliceId)
    if (!slice) {
      fail(`Unknown migration slice '${sliceId}'`)
    }

    if (slice.primary_owner && slice.primary_owner !== owner) {
      fail("Implicit reassignment is not allowed; define a new migration owner explicitly through strategy coordination")
    }

    validateReassignmentAuthority({
      task: { task_id: slice.slice_id, primary_owner: slice.primary_owner },
      ownerField: "primary_owner",
      requestedBy: options.requestedBy,
      nextOwner: owner,
    })

    validateMigrationSliceTransition(slice, "claimed")
    slice.primary_owner = owner
    slice.status = "claimed"
    slice.updated_at = timestamp()
    return board
  })
}

function assignMigrationQaOwner(workItemId, sliceId, qaOwner, customStatePath, options = {}) {
  ensureString(qaOwner, "qa_owner")

  return withMigrationSliceBoard(workItemId, customStatePath, (board) => {
    const slice = board.slices.find((entry) => entry.slice_id === sliceId)
    if (!slice) {
      fail(`Unknown migration slice '${sliceId}'`)
    }

    validateReassignmentAuthority({
      task: { task_id: slice.slice_id, qa_owner: slice.qa_owner },
      ownerField: "qa_owner",
      requestedBy: options.requestedBy,
      nextOwner: qaOwner,
    })

    slice.qa_owner = qaOwner
    slice.updated_at = timestamp()
    return board
  })
}

function setMigrationSliceStatus(workItemId, sliceId, nextStatus, customStatePath) {
  validateMigrationSliceStatus(nextStatus)

  return withMigrationSliceBoard(workItemId, customStatePath, (board) => {
    const slice = board.slices.find((entry) => entry.slice_id === sliceId)
    if (!slice) {
      fail(`Unknown migration slice '${sliceId}'`)
    }

    validateMigrationSliceTransition(slice, nextStatus)
    slice.status = nextStatus
    slice.updated_at = timestamp()
    return board
  })
}

function setTaskStatus(workItemId, taskId, nextStatus, customStatePath, options = {}) {
  validateTaskStatus(nextStatus)

  const targetContext = readWorkItemContext(workItemId, customStatePath)
  const { state: targetState, projectRoot } = targetContext
  validateManagedState(targetState, projectRoot, workItemId)
  const targetBoard = buildBoardView(targetState, readTaskBoardIfExists(projectRoot, workItemId))
  const targetTask = findTask(targetBoard, taskId)

  if (targetTask.status === "qa_in_progress" && (nextStatus === "claimed" || nextStatus === "in_progress")) {
    decideQaFailLocalRework({
      mode: "full",
      task: targetTask,
      finding: options.finding,
      rerouteDecision: options.rerouteDecision,
    })
  }

  const shouldApplyQaFailReroute = nextStatus === "claimed" || nextStatus === "in_progress"
  let rerouteDecision = null

  const result = withTaskBoard(workItemId, customStatePath, (board) => {
    const task = findTask(board, taskId)

    if (task.status === "qa_in_progress" && (nextStatus === "claimed" || nextStatus === "in_progress")) {
      const decision = decideQaFailLocalRework({
        mode: "full",
        task,
        finding: options.finding,
        rerouteDecision: options.rerouteDecision,
      })
      rerouteDecision = decision.route

      validateTaskTransition(task, nextStatus, {
        allowQaFailRework: true,
        finding: options.finding,
      })
    } else {
      validateTaskTransition(task, nextStatus)
    }

    task.status = nextStatus
    task.updated_at = timestamp()
    return board
  })

  if (shouldApplyQaFailReroute && rerouteDecision) {
    const rerouted = mutateWorkItem(workItemId, customStatePath, (state) => {
      state.current_stage = rerouteDecision.stage
      state.current_owner = rerouteDecision.owner
      state.status = "in_progress"
      return state
    })

    return {
      ...rerouted,
      board: result.board,
    }
  }

  return result
}

function validateWorkItemBoard(workItemId, customStatePath) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  requireFullModeWorkItem(state, workItemId)
  const board = readTaskBoardIfExists(projectRoot, workItemId)

  if (!board) {
    fail(`Task board missing for work item '${workItemId}'`)
  }

  return {
    ...context,
    board: validateTaskBoard(buildBoardForValidation(state, board)),
  }
}

function validateMigrationSliceBoardForWorkItem(workItemId, customStatePath) {
  const context = readWorkItemContext(workItemId, customStatePath)
  const { state, projectRoot } = context
  requireMigrationModeWorkItem(state, workItemId)
  const board = readMigrationSliceBoardIfExists(projectRoot, workItemId)

  if (!board) {
    fail(`Migration slice board missing for work item '${workItemId}'`)
  }

  return {
    ...context,
    board: validateMigrationSliceBoard(buildMigrationBoardForValidation(state, board)),
  }
}

function validateTaskAllocation(workItemId, customStatePath) {
  const context = validateWorkItemBoard(workItemId, customStatePath)
  const { state, board } = context
  const activeTasks = board.tasks.filter((task) => ["claimed", "in_progress", "qa_ready", "qa_in_progress"].includes(task.status))
  const parallelMode = state.parallelization.parallel_mode
  const maxTracks = state.parallelization.max_active_execution_tracks
  const exclusiveActive = activeTasks.filter((task) => task.concurrency_class === "exclusive")

  if (parallelMode === "none" && activeTasks.length > 1) {
    fail("parallel_mode 'none' allows only one active execution task at a time")
  }

  if (exclusiveActive.length > 1 || (exclusiveActive.length === 1 && activeTasks.length > 1)) {
    fail("exclusive tasks cannot run alongside any other active task")
  }

  if (typeof maxTracks === "number" && activeTasks.length > maxTracks) {
    fail(`active execution tracks (${activeTasks.length}) exceed max_active_execution_tracks (${maxTracks})`)
  }

  const artifactUsage = new Map()
  for (const task of activeTasks) {
    for (const artifactPath of task.artifact_refs) {
      const existing = artifactUsage.get(artifactPath)
      if (existing && existing !== task.task_id) {
        fail(`active tasks '${existing}' and '${task.task_id}' both claim artifact '${artifactPath}'`)
      }
      artifactUsage.set(artifactPath, task.task_id)
    }
  }

  return {
    ...context,
    activeTasks,
  }
}

function integrationCheck(workItemId, customStatePath) {
  const context = validateTaskAllocation(workItemId, customStatePath)
  const { board, state } = context
  const incompleteTasks = board.tasks.filter((task) => !["done", "cancelled", "qa_in_progress", "qa_ready", "dev_done"].includes(task.status))

  return {
    ...context,
    incompleteTasks,
    integrationReady:
      incompleteTasks.length === 0 &&
      (state.parallelization.integration_checkpoint === null || typeof state.parallelization.integration_checkpoint === "string"),
  }
}

function setParallelization(parallelMode, why, integrationCheckpoint, maxTracks, customStatePath) {
  ensureKnown(parallelMode, PARALLEL_MODES, "parallelization.parallel_mode")

  return mutate(customStatePath, (state) => {
    if (state.mode === "quick") {
      fail("Quick mode does not support parallel execution")
    }

    state.parallelization = {
      ...state.parallelization,
      parallel_mode: parallelMode,
      why: why ?? null,
      integration_checkpoint: integrationCheckpoint ?? null,
      max_active_execution_tracks:
        maxTracks === null || maxTracks === undefined || maxTracks === ""
          ? null
          : Number(maxTracks),
    }

    return state
  })
}

function selectActiveWorkItem(workItemId, customStatePath) {
  ensureString(workItemId, "work_item_id")
  const statePath = resolveStatePath(customStatePath)
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const previousIndex = readWorkItemIndex(projectRoot)
  const previousActiveWorkItemId = previousIndex.active_work_item_id

  try {
    setActiveWorkItem(projectRoot, workItemId)
    const nextActiveState = readWorkItemState(projectRoot, workItemId)
    const mirrorRefreshPlan = planGuardedMirrorRefresh({
      activeWorkItemId: workItemId,
      targetWorkItemId: workItemId,
      nextState: nextActiveState,
    })
    const preflightMirrorState = fs.existsSync(statePath) ? readState(statePath).state : null

    if (preflightMirrorState) {
      guardWrite({
        currentState: preflightMirrorState,
        expectedRevision: captureRevision(preflightMirrorState),
        nextState: nextActiveState,
      })
    }

    writeCompatibilityMirror(projectRoot, nextActiveState)
    const state = readState(statePath).state
    const mirrorRevision = captureRevision(state)

    if (mirrorRevision !== mirrorRefreshPlan.mirrorRevision) {
      fail(
        `Compatibility mirror refresh revision conflict for active work item '${workItemId}'; expected ${mirrorRefreshPlan.mirrorRevision} but found ${mirrorRevision}`,
      )
    }

    validateStateObject(state)
    validateManagedState(state, projectRoot, workItemId)

    return {
      statePath,
      state,
    }
  } catch (error) {
    if (previousActiveWorkItemId !== null && previousActiveWorkItemId !== workItemId) {
      setActiveWorkItem(projectRoot, previousActiveWorkItemId)
    }
    throw error
  }
}

function getRuntimeStatus(customStatePath) {
  const { statePath, state } = showState(customStatePath)

  const projectRoot = resolveProjectRoot(customStatePath)
  const runtimeRoot = resolveRuntimeRoot(customStatePath)
  const kitRoot = resolveKitRoot(projectRoot)
  const manifestPath = path.join(kitRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)
  const { registryPath, installManifestPath } = getManifestPaths(kitRoot, manifest)
  const installManifest = readJsonIfExists(installManifestPath)
  const hooksConfigPath = path.join(kitRoot, "hooks", "hooks.json")
  const sessionStartPath = path.join(kitRoot, "hooks", "session-start")
  const metaSkillPath = path.join(kitRoot, "skills", "using-skills", "SKILL.md")
  const kit = manifest?.kit ?? {}

  return {
    projectRoot,
    runtimeRoot,
    kitRoot,
    statePath,
    manifestPath,
    registryPath,
    installManifestPath,
    hooksConfigPath,
    sessionStartPath,
    metaSkillPath,
    kitName: kit.name ?? "Unknown kit",
    kitVersion: kit.version ?? "unknown",
    entryAgent: kit.entryAgent ?? "unknown",
    activeProfile: installManifest?.installation?.activeProfile ?? kit.activeProfile ?? "unknown",
    installManifest,
    state,
    parallelization: state.parallelization,
  }
}

function getVersionInfo(customStatePath) {
  const runtime = getRuntimeStatus(customStatePath)
  return {
    kitName: runtime.kitName,
    kitVersion: runtime.kitVersion,
    activeProfile: runtime.activeProfile,
  }
}

function runDoctor(customStatePath) {
  const statePath = resolveStatePath(customStatePath)
  const projectRoot = resolveProjectRoot(customStatePath)
  const runtimeRoot = resolveRuntimeRoot(customStatePath)
  const kitRoot = resolveKitRoot(projectRoot)
  const manifestPath = path.join(kitRoot, ".opencode", "opencode.json")
  const manifestInfo = tryReadJson(manifestPath)
  const manifest = manifestInfo.data
  const { registryPath, installManifestPath } = getManifestPaths(kitRoot, manifest)
  const registryInfo = tryReadJson(registryPath)
  const installManifestInfo = tryReadJson(installManifestPath)
  const installManifest = installManifestInfo.data
  const hooksConfigPath = path.join(kitRoot, "hooks", "hooks.json")
  const sessionStartPath = path.join(kitRoot, "hooks", "session-start")
  const metaSkillPath = path.join(kitRoot, "skills", "using-skills", "SKILL.md")
  const workflowStateCliPath = path.join(kitRoot, ".opencode", "workflow-state.js")

  let stateValid = false
  let state = null
  let kitName = "Unknown kit"
  let kitVersion = "unknown"
  let entryAgent = "unknown"

  if (manifest?.kit) {
    kitName = manifest.kit.name ?? kitName
    kitVersion = manifest.kit.version ?? kitVersion
    entryAgent = manifest.kit.entryAgent ?? entryAgent
  }

  if (fs.existsSync(statePath)) {
    try {
      const result = showState(customStatePath)
      state = result.state
      stateValid = true
    } catch (_error) {
      stateValid = false
    }
  }

  const runtime = {
    projectRoot,
    runtimeRoot,
    kitRoot,
    statePath,
    manifestPath,
    registryPath,
    installManifestPath,
    workflowStateCliPath,
    hooksConfigPath,
    sessionStartPath,
    metaSkillPath,
    kitName,
    kitVersion,
    entryAgent,
    activeProfile: installManifest?.installation?.activeProfile ?? manifest?.kit?.activeProfile ?? "unknown",
    installManifest,
    state,
  }

  const checks = [
    { label: "manifest file found", ok: fs.existsSync(manifestPath) },
    { label: "workflow state file found", ok: fs.existsSync(statePath) },
    { label: "workflow state is valid", ok: stateValid },
    { label: "registry file found", ok: fs.existsSync(registryPath) },
    { label: "registry metadata is readable", ok: !registryInfo.exists || registryInfo.readable },
    { label: "install manifest found", ok: fs.existsSync(installManifestPath) },
    {
      label: "install manifest is readable",
      ok: !installManifestInfo.exists || installManifestInfo.readable,
    },
    { label: "workflow state CLI found", ok: fs.existsSync(workflowStateCliPath) },
    { label: "hooks config found", ok: fs.existsSync(hooksConfigPath) },
    { label: "session-start hook found", ok: fs.existsSync(sessionStartPath) },
    { label: "meta-skill found", ok: fs.existsSync(metaSkillPath) },
    {
      label: "active profile exists in registry",
      ok:
        !installManifestInfo.readable ||
        !registryInfo.readable ||
        (registryInfo.data?.profiles ?? []).some(
          (profile) => profile.name === (installManifest?.installation?.activeProfile ?? manifest?.kit?.activeProfile),
        ),
    },
    {
      label: "manifest and install manifest profiles agree",
      ok:
        !installManifestInfo.readable ||
        !manifest?.kit?.activeProfile ||
        manifest.kit.activeProfile === installManifest?.installation?.activeProfile,
    },
  ]

  const contractReport = buildContractConsistencyReport({ projectRoot: kitRoot, manifest })
  checks.push(...contractReport.checks)

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
    runtime,
    checks,
    summary,
  }
}

function getContractConsistencyReport(customStatePath) {
  const projectRoot = resolveProjectRoot(customStatePath)
  const kitRoot = resolveKitRoot(projectRoot)
  const manifestPath = path.join(kitRoot, ".opencode", "opencode.json")
  const manifest = readJsonIfExists(manifestPath)

  return buildContractConsistencyReport({ projectRoot: kitRoot, manifest })
}

function validateState(customStatePath) {
  const { statePath, state, projectRoot, workItemId } = readManagedState(customStatePath)
  validateStateObject(state)
  validateManagedState(state, projectRoot, workItemId)
  return { statePath, state }
}

function startTask(mode, featureId, featureSlug, modeReason, customStatePath) {
  ensureKnown(mode, MODE_VALUES, "mode")
  ensureString(featureId, "feature_id")
  ensureString(featureSlug, "feature_slug")
  ensureString(modeReason, "mode_reason")

  const workItemId = deriveWorkItemId({ feature_id: featureId })
  const projectRoot = ensureWorkItemStoreReady(customStatePath)
  const workItemPaths = resolveWorkItemPaths(projectRoot, workItemId)
  const index = readWorkItemIndex(projectRoot)
  const existingState = fs.existsSync(workItemPaths.statePath) ? readWorkItemState(projectRoot, workItemId) : null
  const expectedRevision = existingState ? captureRevision(existingState) : null
  const expectedMirrorRevision = index.active_work_item_id === workItemId && existingState ? expectedRevision : null
  const nextState = createFreshState({
    workItemId,
    mode,
    featureId,
    featureSlug,
    modeReason,
    updatedAt: timestamp(),
  })

  validateStateObject(nextState)
  return persistManagedState(customStatePath, nextState, {
    expectedRevision,
    expectedMirrorRevision,
    workItemId,
    activateWorkItemId: workItemId,
  })
}

function startFeature(featureId, featureSlug, customStatePath) {
  return startTask(
    "full",
    featureId,
    featureSlug,
    "Started with legacy start-feature command; defaulting to Full Delivery mode",
    customStatePath,
  )
}

function setApproval(gate, status, approvedBy, approvedAt, notes, customStatePath) {
  ensureKnown(status, ["pending", "approved", "rejected"], "status")

  return mutate(customStatePath, (state, context) => {
    const allowedGates = getApprovalGatesForMode(state.mode)
    ensureKnown(gate, allowedGates, `gate for mode '${state.mode}'`)

    const { projectRoot, workItemId } = context
    if (status === "approved" && gate === "solution_to_fullstack" && state.current_stage === "full_solution") {
      requireValidTaskBoard(
        state,
        projectRoot,
        workItemId,
        "full_solution",
        "A valid task board is required before approving 'solution_to_fullstack' or entering 'full_implementation'",
      )
    }

    state.approvals[gate] = {
      status,
      approved_by: approvedBy ?? null,
      approved_at: approvedAt ?? null,
      notes: notes ?? null,
    }
    return state
  })
}

function advanceStage(targetStage, customStatePath) {
  ensureKnown(targetStage, STAGE_SEQUENCE, "target stage")

  return mutate(customStatePath, (state, context) => {
    const { projectRoot, workItemId } = context
    if (getModeForStage(targetStage) !== state.mode) {
      fail(`target stage '${targetStage}' does not belong to mode '${state.mode}'`)
    }

    const nextStage = getNextStage(state.mode, state.current_stage)
    if (!nextStage) {
      fail(`Stage '${state.current_stage}' cannot advance further`)
    }

    if (targetStage !== nextStage) {
      fail(`advance-stage only allows the immediate next stage '${nextStage}', not '${targetStage}'`)
    }

    if (targetStage === "full_implementation") {
      requireValidTaskBoard(
        state,
        projectRoot,
        workItemId,
        "full_implementation",
        "A valid task board is required before entering 'full_implementation'",
      )
    }

    if (targetStage === "full_qa") {
      requireValidTaskBoard(
        state,
        projectRoot,
        workItemId,
        "full_qa",
        "A valid task board is required before entering 'full_qa'",
      )
    }

    const requiredGate = getTransitionGate(state.mode, state.current_stage, targetStage)
    if (requiredGate && state.approvals[requiredGate].status !== "approved") {
      fail(`Cannot advance from '${state.current_stage}' to '${targetStage}' until gate '${requiredGate}' is approved`)
    }

    if (targetStage === "quick_done") {
      assertStageExitReadiness(state)
    }

    if (targetStage === "migration_done") {
      assertStageExitReadiness(state)
    }

    if (targetStage === "full_done") {
      assertStageExitReadiness(state, {
        requireTaskBoard: state.mode === "full",
        taskBoardValid: true,
      })
    }

    state.current_stage = targetStage
    state.current_owner = STAGE_OWNERS[targetStage]
    state.status = targetStage.endsWith("_done") ? "done" : "in_progress"
    return state
  })
}

function linkArtifact(kind, artifactPath, customStatePath) {
  ensureKnown(kind, ARTIFACT_KINDS, "artifact kind")
  ensureString(artifactPath, "artifact path")

  const projectRoot = resolveProjectRoot(customStatePath)
  const resolvedArtifactPath = path.isAbsolute(artifactPath)
    ? artifactPath
    : path.resolve(projectRoot, artifactPath)
  if (!fs.existsSync(resolvedArtifactPath)) {
    fail(`Artifact path does not exist: '${artifactPath}'`)
  }

  return mutate(customStatePath, (state) => {
    if (kind === "adr") {
      if (!state.artifacts.adr.includes(artifactPath)) {
        state.artifacts.adr.push(artifactPath)
      }
      return state
    }

    state.artifacts[kind] = artifactPath
    return state
  })
}

function scaffoldAndLinkArtifact(kind, slug, customStatePath, options = {}) {
  ensureString(kind, "artifact kind")
  ensureString(slug, "artifact slug")

  if (!SUPPORTED_SCAFFOLDS[kind]) {
    fail(`Unsupported scaffold kind '${kind}'`)
  }

  const { statePath, state } = readState(customStatePath)
  validateStateObject(state)

  if (kind !== "adr" && state.artifacts[kind] !== null) {
    fail(`Artifact already linked for artifact kind '${kind}'`)
  }

  if (kind === "task_card" && state.mode !== "quick") {
    fail(`Artifact scaffold kind 'task_card' requires quick mode`)
  }

  if (kind === "scope_package") {
    if (state.mode !== "full") {
      fail(`Artifact scaffold kind 'scope_package' requires full mode`)
    }

    if (state.current_stage !== "full_product") {
      fail(`Artifact scaffold kind 'scope_package' requires current stage 'full_product'`)
    }
  }

  if (kind === "solution_package") {
    if (state.mode !== "full" && state.mode !== "migration") {
      fail(`Artifact scaffold kind 'solution_package' requires full or migration mode`)
    }

    if (state.mode === "full" && state.current_stage !== "full_solution") {
      fail(`Artifact scaffold kind 'solution_package' requires current stage 'full_solution'`)
    }

    if (state.mode === "migration" && state.current_stage !== "migration_strategy") {
      fail(`Artifact scaffold kind 'solution_package' requires current stage 'migration_strategy'`)
    }
  }

  if (kind === "migration_report") {
    if (state.mode !== "migration") {
      fail(`Artifact scaffold kind 'migration_report' requires migration mode`)
    }

    if (state.current_stage !== "migration_baseline" && state.current_stage !== "migration_strategy") {
      fail(`Artifact scaffold kind 'migration_report' requires current stage 'migration_baseline' or 'migration_strategy'`)
    }
  }

  const projectRoot = resolveProjectRoot(customStatePath)
  const featureId = state.feature_id
  const featureSlug = state.feature_slug

  if (typeof featureId !== "string" || featureId.length === 0) {
    fail("feature_id must be set before scaffolding an artifact")
  }

  if (typeof featureSlug !== "string" || featureSlug.length === 0) {
    fail("feature_slug must be set before scaffolding an artifact")
  }

  const scaffoldResult = scaffoldArtifact({
    projectRoot,
    kind,
    mode: state.mode,
    slug,
    featureId,
    featureSlug,
    sourceArchitecture: kind === "migration_report" ? state.artifacts.solution_package : null,
    sourcePlan: kind === "migration_report" ? state.artifacts.solution_package : null,
  })

  try {
    if (typeof options.beforeLink === "function") {
      options.beforeLink(scaffoldResult)
    }

    const next = linkArtifact(kind, scaffoldResult.artifactPath, statePath)

    return {
      ...next,
      artifactPath: scaffoldResult.artifactPath,
    }
  } catch (error) {
    const createdPath = path.join(projectRoot, scaffoldResult.artifactPath)
    if (fs.existsSync(createdPath)) {
      fs.rmSync(createdPath)
    }
    throw error
  }
}

function recordIssue(issue, customStatePath) {
  return mutate(customStatePath, (state) => {
    const nextIssue = { ...issue }
    if (typeof nextIssue.artifact_refs === "string") {
      nextIssue.artifact_refs = [nextIssue.artifact_refs]
    }
    nextIssue.current_status = nextIssue.current_status ?? "open"
    nextIssue.opened_at = nextIssue.opened_at ?? timestamp()
    nextIssue.last_updated_at = nextIssue.last_updated_at ?? nextIssue.opened_at
    nextIssue.reopen_count = nextIssue.reopen_count ?? 0
    nextIssue.repeat_count = nextIssue.repeat_count ?? 0
    nextIssue.blocked_since = nextIssue.blocked_since ?? nextIssue.opened_at
    ensureIssueShape(nextIssue, state.issues.length)
    state.issues.push(nextIssue)
    state.status = "blocked"
    return state
  })
}

function clearIssues(customStatePath) {
  return mutate(customStatePath, (state) => {
    state.issues = []
    if (!state.current_stage.endsWith("_done")) {
      state.status = "in_progress"
    }
    return state
  })
}

function routeRework(issueType, repeatFailedFix, customStatePath) {
  ensureKnown(issueType, ISSUE_TYPES, "issue_type")

  return mutate(customStatePath, (state) => {
    const previousMode = state.mode
    const route = getReworkRoute(state.mode, issueType)
    if (!route) {
      fail(`No rework route exists for issue type '${issueType}' in mode '${state.mode}'`)
    }

    if (route.escalate) {
      state.mode = route.mode
      state.mode_reason = `Promoted from ${previousMode} mode after '${issueType}' QA finding`
      state.routing_profile = createDefaultRoutingProfile(route.mode, state.mode_reason)
      state.current_stage = route.stage
      state.current_owner = route.owner
      state.status = "in_progress"
      state.approvals = createEmptyApprovals(route.mode)
      state.escalated_from = previousMode
      state.escalation_reason = `${previousMode} work escalated to ${route.mode === "full" ? "Full Delivery" : route.mode} because QA reported '${issueType}'`
    } else {
      state.current_stage = route.stage
      state.current_owner = route.owner
      state.status = "in_progress"
    }

    if (repeatFailedFix) {
      state.retry_count += 1
      const mostRecentIssue = Array.isArray(state.issues) && state.issues.length > 0 ? state.issues[state.issues.length - 1] : null
      if (mostRecentIssue) {
        mostRecentIssue.repeat_count += 1
        mostRecentIssue.last_updated_at = timestamp()
      }
      if (state.retry_count >= ESCALATION_RETRY_THRESHOLD) {
        state.status = "blocked"
        if (state.mode === "quick") {
          state.mode = "full"
          state.mode_reason = `Promoted from quick mode after repeated '${issueType}' failures`
          state.routing_profile = createDefaultRoutingProfile("full", state.mode_reason)
          state.current_stage = "full_intake"
          state.current_owner = STAGE_OWNERS.full_intake
          state.approvals = createEmptyApprovals("full")
          state.escalated_from = "quick"
          state.escalation_reason = `quick work escalated to Full Delivery after repeated '${issueType}' failures`
          state.status = "in_progress"
        } else if (state.mode === "migration") {
          state.current_stage = "migration_strategy"
          state.current_owner = STAGE_OWNERS.migration_strategy
          state.status = "blocked"
        }
      }
    }

    return state
  })
}

module.exports = {
  advanceStage,
  addReleaseWorkItem,
  assignMigrationQaOwner,
  assignQaOwner,
  clearIssues,
  clearVerificationEvidence,
  claimTask,
  claimMigrationSlice,
  createTask,
  createMigrationSlice,
  createReleaseCandidate,
  createWorkItem,
  ESCALATION_RETRY_THRESHOLD,
  getContractConsistencyReport,
  getInstallManifest,
  getIssueAgingReport,
  getProfile,
  getRegistry,
  getApprovalBottlenecks,
  getDefinitionOfDone,
  getQaFailureSummary,
  getPolicyExecutionTrace,
  getReleaseCandidateReadiness,
  getReleaseDashboard,
  getReleaseReadiness,
  getRuntimeShortSummary,
  getWorkItemCloseoutSummary,
  getTaskAgingReport,
  getRuntimeStatus,
  getWorkflowAnalytics,
  getWorkflowMetrics,
  getOpsSummary,
  getVersionInfo,
  integrationCheck,
  linkArtifact,
  listMigrationSlices,
  listReleaseCandidates,
  listStaleIssues,
  listTasks,
  listWorkItems,
  listProfiles,
  readState,
  recordRollbackPlan,
  recordIssue,
  recordVerificationEvidence,
  reconcileCompletedWorkItems,
  removeReleaseWorkItem,
  reassignTask,
  releaseTask,
  resolveStatePath,
  routeRework,
  runDoctor,
  scaffoldAndLinkArtifact,
  selectActiveWorkItem,
  setParallelization,
  setMigrationSliceStatus,
  setReleaseApproval,
  setReleaseStatus,
  setRoutingProfile,
  setTaskStatus,
  setApproval,
  updateIssueStatus,
  showState,
  showReleaseCandidate,
  showWorkItemState,
  startHotfix,
  syncInstallManifest,
  startFeature,
  startTask,
  draftReleaseNotes,
  validateMigrationSliceBoardForWorkItem,
  validateReleaseNotes,
  validateTaskAllocation,
  validateHotfix,
  validateWorkItemBoard,
  validateState,
  validateStateObject,
  writeState,
}
