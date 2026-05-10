import fs from "node:fs"
import path from "node:path"

const WORKFLOW_MODES = new Set(["quick", "migration", "full"])

export const WORKTREE_SCHEMA_V1 = "openkit/worktree@1"
export const WORKTREE_SCHEMA_V2 = "openkit/worktree@2"

const DEFAULT_ENV_PROPAGATION = Object.freeze({
  mode: "none",
  applied_at: null,
  source_files: [],
})

function fail(message) {
  const error = new Error(message)
  error.isWorkItemStoreError = true
  throw error
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJson(filePath, missingMessage) {
  let raw
  try {
    raw = fs.readFileSync(filePath, "utf8")
  } catch (error) {
    if (error.code === "ENOENT" && missingMessage) {
      fail(missingMessage)
    }
    fail(`Unable to read JSON at '${filePath}': ${error.message}`)
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    fail(`Malformed JSON at '${filePath}': ${error.message}`)
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortJsonValue(value[key])
        return sorted
      }, {})
  }

  return value
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeWorkflowMode(value, fallback = "quick") {
  const candidate = normalizeString(value)
  if (candidate && WORKFLOW_MODES.has(candidate)) {
    return candidate
  }

  return fallback
}

function normalizeEnvPropagationMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_ENV_PROPAGATION,
    }
  }

  const mode = normalizeString(value.mode)
  const sourceFiles = Array.isArray(value.source_files)
    ? value.source_files.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : []

  return {
    mode: mode && ["none", "symlink", "copy"].includes(mode) ? mode : "none",
    applied_at: normalizeString(value.applied_at),
    source_files: sourceFiles,
  }
}

export function normalizeWorkItemWorktreeMetadata(metadata, workItemId) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const resolvedWorkItemId = normalizeString(metadata.work_item_id) ?? workItemId
  const workflowMode = normalizeWorkflowMode(metadata.workflow_mode ?? metadata.mode, "quick")
  const createdAt = normalizeString(metadata.created_at)

  return {
    schema: WORKTREE_SCHEMA_V2,
    work_item_id: resolvedWorkItemId,
    workflow_mode: workflowMode,
    lineage_key: normalizeString(metadata.lineage_key) ?? resolvedWorkItemId,
    repository_root: normalizeString(metadata.repository_root),
    target_branch: normalizeString(metadata.target_branch),
    branch: normalizeString(metadata.branch),
    worktree_path: normalizeString(metadata.worktree_path),
    created_at: createdAt,
    last_used_at: normalizeString(metadata.last_used_at) ?? createdAt,
    env_propagation: normalizeEnvPropagationMetadata(metadata.env_propagation),
  }
}

export function deriveWorkItemId(state) {
  if (state && typeof state.work_item_id === "string" && state.work_item_id.length > 0) {
    return state.work_item_id
  }

  if (!state || typeof state.feature_id !== "string" || state.feature_id.length === 0) {
    fail("work item state must include a non-empty feature_id")
  }

  return slugify(state.feature_id)
}

function resolvePaths(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const workItemsDir = path.join(opencodeDir, "work-items")

  return {
    opencodeDir,
    workflowStatePath: path.join(opencodeDir, "workflow-state.json"),
    workItemsDir,
    indexPath: path.join(workItemsDir, "index.json"),
  }
}

export function resolveWorkItemPaths(projectRoot, workItemId) {
  const paths = resolvePaths(projectRoot)
  const workItemDir = path.join(paths.workItemsDir, workItemId)

  return {
    ...paths,
    workItemDir,
    statePath: path.join(workItemDir, "state.json"),
    worktreePath: path.join(workItemDir, "worktree.json"),
    relativeStatePath: path.posix.join(".opencode", "work-items", workItemId, "state.json"),
  }
}

function createEmptyIndex() {
  return {
    active_work_item_id: null,
    work_items: [],
  }
}

export function bootstrapRuntimeStore(runtimeRoot) {
  const paths = resolvePaths(runtimeRoot)

  ensureDir(paths.workItemsDir)

  if (fs.existsSync(paths.indexPath)) {
    return readWorkItemIndex(runtimeRoot)
  }

  if (fs.existsSync(paths.workflowStatePath)) {
    bootstrapLegacyWorkflowState(runtimeRoot)
    return readWorkItemIndex(runtimeRoot)
  }

  const index = createEmptyIndex()
  writeWorkItemIndex(runtimeRoot, index)
  return index
}

export function readWorkItemIndex(projectRoot) {
  const { indexPath } = resolvePaths(projectRoot)
  return readJson(indexPath, `Work-item index missing at '${indexPath}'`)
}

export function writeWorkItemIndex(projectRoot, index) {
  const { indexPath } = resolvePaths(projectRoot)
  writeJson(indexPath, index)
  return index
}

export function readWorkItemState(projectRoot, workItemId) {
  const { statePath } = resolveWorkItemPaths(projectRoot, workItemId)
  return readJson(statePath, `Work-item state missing at '${statePath}'`)
}

export function writeWorkItemState(projectRoot, workItemId, state) {
  const { statePath } = resolveWorkItemPaths(projectRoot, workItemId)
  const nextState = {
    ...state,
    work_item_id: deriveWorkItemId({
      ...state,
      work_item_id: workItemId,
    }),
  }

  writeJson(statePath, nextState)
  return nextState
}

export function readWorkItemWorktree(projectRoot, workItemId) {
  const { worktreePath } = resolveWorkItemPaths(projectRoot, workItemId)
  if (!fs.existsSync(worktreePath)) {
    return null
  }

  const metadata = readJson(worktreePath, `Work-item worktree metadata missing at '${worktreePath}'`)
  return normalizeWorkItemWorktreeMetadata(metadata, workItemId)
}

export function writeWorkItemWorktree(projectRoot, workItemId, metadata) {
  const { worktreePath } = resolveWorkItemPaths(projectRoot, workItemId)
  const normalizedMetadata = normalizeWorkItemWorktreeMetadata(metadata, workItemId)
  if (!normalizedMetadata) {
    fail(`Work-item worktree metadata must be an object for '${workItemId}'`)
  }

  writeJson(worktreePath, normalizedMetadata)
  return normalizedMetadata
}

export function removeWorkItemWorktree(projectRoot, workItemId) {
  const { worktreePath } = resolveWorkItemPaths(projectRoot, workItemId)
  fs.rmSync(worktreePath, { force: true })
}

function upsertIndexEntry(index, state, workItemId, relativeStatePath) {
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

function readLegacyWorkflowState(projectRoot) {
  const { workflowStatePath } = resolvePaths(projectRoot)
  return readJson(workflowStatePath, `Compatibility workflow state missing at '${workflowStatePath}'`)
}

export function refreshCompatibilityMirror(projectRoot) {
  const { workflowStatePath } = resolvePaths(projectRoot)
  const index = readWorkItemIndex(projectRoot)

  if (!index.active_work_item_id) {
    fail("Cannot refresh compatibility mirror without an active work item")
  }

  const activeState = readWorkItemState(projectRoot, index.active_work_item_id)
  writeJson(workflowStatePath, activeState)

  return activeState
}

export function writeCompatibilityMirror(projectRoot, state) {
  const { workflowStatePath } = resolvePaths(projectRoot)
  writeJson(workflowStatePath, state)
  return state
}

export function bootstrapLegacyWorkflowState(projectRoot) {
  const legacyState = readLegacyWorkflowState(projectRoot)
  const workItemId = deriveWorkItemId(legacyState)
  const workItemPaths = resolveWorkItemPaths(projectRoot, workItemId)

  const index = fs.existsSync(workItemPaths.indexPath)
    ? readWorkItemIndex(projectRoot)
    : createEmptyIndex()

  const nextState = {
    ...legacyState,
    work_item_id: workItemId,
  }

  writeWorkItemState(projectRoot, workItemId, nextState)
  upsertIndexEntry(index, nextState, workItemId, workItemPaths.relativeStatePath)
  index.active_work_item_id = workItemId
  writeWorkItemIndex(projectRoot, index)
  refreshCompatibilityMirror(projectRoot)

  return {
    workItemId,
    index,
    state: nextState,
  }
}

export function setActiveWorkItem(projectRoot, workItemId) {
  const index = readWorkItemIndex(projectRoot)
  const entry = index.work_items.find((item) => item.work_item_id === workItemId)

  if (!entry) {
    fail(`Unknown work item '${workItemId}'`)
  }

  readWorkItemState(projectRoot, workItemId)

  index.active_work_item_id = workItemId
  writeWorkItemIndex(projectRoot, index)

  return index
}

export function validateActiveMirror(projectRoot) {
  const { workflowStatePath } = resolvePaths(projectRoot)
  const index = readWorkItemIndex(projectRoot)

  if (!index.active_work_item_id) {
    fail("Active work item pointer missing")
  }

  if (!fs.existsSync(workflowStatePath)) {
    fail("Compatibility mirror missing")
  }

  const mirrorState = readJson(workflowStatePath)
  const activeState = readWorkItemState(projectRoot, index.active_work_item_id)

  if (JSON.stringify(sortJsonValue(mirrorState)) !== JSON.stringify(sortJsonValue(activeState))) {
    fail("Compatibility mirror diverged from active work item state")
  }

  return {
    active_work_item_id: index.active_work_item_id,
    mirror_state_path: workflowStatePath,
  }
}
