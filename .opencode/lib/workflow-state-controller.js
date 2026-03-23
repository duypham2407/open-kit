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
  ARTIFACT_KINDS,
  ESCALATION_RETRY_THRESHOLD,
  ISSUE_SEVERITIES,
  ISSUE_TYPES,
  MODE_VALUES,
  RECOMMENDED_OWNERS,
  ROOTED_IN_VALUES,
  ROUTING_BEHAVIOR_DELTA_VALUES,
  ROUTING_DOMINANT_UNCERTAINTY_VALUES,
  ROUTING_SCOPE_SHAPE_VALUES,
  ROUTING_WORK_INTENT_VALUES,
  STAGE_OWNERS,
  STAGE_SEQUENCE,
  STATUS_VALUES,
  createDefaultRoutingProfile,
  createEmptyApprovals,
  createEmptyArtifacts,
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

function buildBoardView(state, board) {
  return {
    mode: state.mode,
    current_stage: state.current_stage,
    tasks: board?.tasks ?? [],
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

function isTaskBoardStageAllowed(stage) {
  return ["full_plan", "full_implementation", "full_qa", "full_done"].includes(stage)
}

function requireTaskBoardStage(state, workItemId, action = "use a task board") {
  if (!isTaskBoardStageAllowed(state.current_stage)) {
    fail(
      `Work item '${workItemId}' must reach 'full_plan' before it can ${action}; current stage is '${state.current_stage}'`,
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
    status: taskInput.status ?? "ready",
    primary_owner: taskInput.primary_owner ?? null,
    qa_owner: taskInput.qa_owner ?? null,
    depends_on: taskInput.depends_on ?? [],
    blocked_by: taskInput.blocked_by ?? [],
    artifact_refs: taskInput.artifact_refs ?? [],
    plan_refs: taskInput.plan_refs ?? [],
    branch_or_worktree: taskInput.branch_or_worktree ?? taskInput.worktree_metadata?.worktree_path ?? null,
    created_by: taskInput.created_by ?? "TechLeadAgent",
    created_at: taskInput.created_at ?? now,
    updated_at: taskInput.updated_at ?? now,
  })
}

function validateManagedState(state, projectRoot, workItemId, options = {}) {
  const taskBoard = readTaskBoardIfExists(projectRoot, workItemId)

  if (state.mode !== "full") {
    if (taskBoard !== null) {
      fail(`${formatModeLabel(state.mode)} mode cannot carry a task board; task boards are full-delivery only`)
    }
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

  const allowedOwners = RECOMMENDED_OWNERS[issue.type] ?? []
  if (!allowedOwners.includes(issue.recommended_owner)) {
    fail(`issues[${index}].recommended_owner must be one of: ${allowedOwners.join(", ")}`)
  }

  if (typeof issue.artifact_refs === "string") {
    issue.artifact_refs = [issue.artifact_refs]
  }

  ensureArray(issue.artifact_refs, `issues[${index}].artifact_refs`)
}

function validateArtifacts(artifacts) {
  ensureObject(artifacts, "artifacts")
  for (const key of ["task_card", "brief", "spec", "architecture", "plan", "migration_report", "qa_report", "adr"]) {
    if (!(key in artifacts)) {
      fail(`artifacts.${key} is required`)
    }
  }

  ensureNullableString(artifacts.task_card, "artifacts.task_card")
  ensureNullableString(artifacts.brief, "artifacts.brief")
  ensureNullableString(artifacts.spec, "artifacts.spec")
  ensureNullableString(artifacts.architecture, "artifacts.architecture")
  ensureNullableString(artifacts.plan, "artifacts.plan")
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
    for (const key of ["brief", "spec", "architecture", "plan", "migration_report", "qa_report"]) {
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
    for (const key of ["task_card", "brief", "spec", "qa_report"]) {
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
  validateRoutingProfile(state.routing_profile)
  validateRoutingProfileForMode(state.mode, state.routing_profile)
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
    current_stage: initialStage,
    status: "in_progress",
    current_owner: STAGE_OWNERS[initialStage],
    artifacts: createEmptyArtifacts(),
    approvals: createEmptyApprovals(mode),
    issues: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: updatedAt,
  }
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
    workItems: index.work_items,
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
    if (status === "approved" && gate === "tech_lead_to_fullstack") {
      requireValidTaskBoard(
        state,
        projectRoot,
        workItemId,
        "full_plan",
        "A valid task board is required before approving 'tech_lead_to_fullstack' or entering 'full_implementation'",
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

  if (kind === "plan") {
    if (state.mode !== "full" && state.mode !== "migration") {
      fail(`Artifact scaffold kind 'plan' requires full or migration mode`)
    }

    if (state.mode === "full" && state.current_stage !== "full_plan") {
      fail(`Artifact scaffold kind 'plan' requires current stage 'full_plan'`)
    }

    if (state.mode === "migration" && state.current_stage !== "migration_strategy") {
      fail(`Artifact scaffold kind 'plan' requires current stage 'migration_strategy'`)
    }

    if (typeof state.artifacts.architecture !== "string" || state.artifacts.architecture.length === 0) {
      fail(`Artifact scaffold kind 'plan' requires a linked architecture artifact`)
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
    sourceArchitecture:
      kind === "plan" || kind === "migration_report" ? state.artifacts.architecture : null,
    sourcePlan: kind === "migration_report" ? state.artifacts.plan : null,
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
      if (state.retry_count >= ESCALATION_RETRY_THRESHOLD) {
        state.status = "blocked"
      }
    }

    return state
  })
}

module.exports = {
  advanceStage,
  assignQaOwner,
  clearIssues,
  claimTask,
  createTask,
  createWorkItem,
  ESCALATION_RETRY_THRESHOLD,
  getContractConsistencyReport,
  getInstallManifest,
  getProfile,
  getRegistry,
  getRuntimeStatus,
  getVersionInfo,
  linkArtifact,
  listTasks,
  listWorkItems,
  listProfiles,
  readState,
  recordIssue,
  reassignTask,
  releaseTask,
  resolveStatePath,
  routeRework,
  runDoctor,
  scaffoldAndLinkArtifact,
  selectActiveWorkItem,
  setRoutingProfile,
  setTaskStatus,
  setApproval,
  showState,
  showWorkItemState,
  syncInstallManifest,
  startFeature,
  startTask,
  validateWorkItemBoard,
  validateState,
  validateStateObject,
  writeState,
}
