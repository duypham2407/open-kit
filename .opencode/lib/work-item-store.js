const fs = require("fs")
const path = require("path")

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

function deriveWorkItemId(state) {
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

function resolveWorkItemPaths(projectRoot, workItemId) {
  const paths = resolvePaths(projectRoot)
  const workItemDir = path.join(paths.workItemsDir, workItemId)

  return {
    ...paths,
    workItemDir,
    statePath: path.join(workItemDir, "state.json"),
    relativeStatePath: path.posix.join(".opencode", "work-items", workItemId, "state.json"),
  }
}

function createEmptyIndex() {
  return {
    active_work_item_id: null,
    work_items: [],
  }
}

function bootstrapRuntimeStore(runtimeRoot) {
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

function readWorkItemIndex(projectRoot) {
  const { indexPath } = resolvePaths(projectRoot)
  return readJson(indexPath, `Work-item index missing at '${indexPath}'`)
}

function writeWorkItemIndex(projectRoot, index) {
  const { indexPath } = resolvePaths(projectRoot)
  writeJson(indexPath, index)
  return index
}

function readWorkItemState(projectRoot, workItemId) {
  const { statePath } = resolveWorkItemPaths(projectRoot, workItemId)
  return readJson(statePath, `Work-item state missing at '${statePath}'`)
}

function writeWorkItemState(projectRoot, workItemId, state) {
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

function refreshCompatibilityMirror(projectRoot) {
  const { workflowStatePath } = resolvePaths(projectRoot)
  const index = readWorkItemIndex(projectRoot)

  if (!index.active_work_item_id) {
    fail("Cannot refresh compatibility mirror without an active work item")
  }

  const activeState = readWorkItemState(projectRoot, index.active_work_item_id)
  writeJson(workflowStatePath, activeState)

  return activeState
}

function writeCompatibilityMirror(projectRoot, state) {
  const { workflowStatePath } = resolvePaths(projectRoot)
  writeJson(workflowStatePath, state)
  return state
}

function bootstrapLegacyWorkflowState(projectRoot) {
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

function setActiveWorkItem(projectRoot, workItemId) {
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

function validateActiveMirror(projectRoot) {
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

module.exports = {
  bootstrapRuntimeStore,
  bootstrapLegacyWorkflowState,
  deriveWorkItemId,
  readWorkItemIndex,
  readWorkItemState,
  refreshCompatibilityMirror,
  resolveWorkItemPaths,
  setActiveWorkItem,
  validateActiveMirror,
  writeCompatibilityMirror,
  writeWorkItemIndex,
  writeWorkItemState,
}
