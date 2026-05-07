import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

export function resolveBackgroundRunPaths(projectRoot) {
  const root = path.join(projectRoot, ".opencode", "background-runs")
  return {
    root,
    indexPath: path.join(root, "index.json"),
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function createEmptyIndex() {
  return { runs: [] }
}

export function bootstrapBackgroundRunStore(projectRoot) {
  const paths = resolveBackgroundRunPaths(projectRoot)
  ensureDir(paths.root)
  if (!fs.existsSync(paths.indexPath)) {
    writeJson(paths.indexPath, createEmptyIndex())
  }
  return readBackgroundRunIndex(projectRoot)
}

function readBackgroundRunIndex(projectRoot) {
  const { indexPath } = resolveBackgroundRunPaths(projectRoot)
  return readJsonIfExists(indexPath) ?? createEmptyIndex()
}

function writeBackgroundRunIndex(projectRoot, index) {
  const { indexPath } = resolveBackgroundRunPaths(projectRoot)
  writeJson(indexPath, index)
  return index
}

function resolveBackgroundRunPath(projectRoot, runId) {
  return path.join(resolveBackgroundRunPaths(projectRoot).root, `${runId}.json`)
}

export function createBackgroundRun({
  runId = `bg_${crypto.randomBytes(4).toString("hex")}`,
  title,
  payload = {},
  workItemId = null,
  taskId = null,
  source = "runtime",
  createdAt = new Date().toISOString(),
}) {
  return {
    run_id: runId,
    title,
    payload,
    source,
    work_item_id: workItemId,
    task_id: taskId,
    status: "running",
    created_at: createdAt,
    updated_at: createdAt,
    output: null,
  }
}

export function recordBackgroundRun(projectRoot, run) {
  bootstrapBackgroundRunStore(projectRoot)
  const index = readBackgroundRunIndex(projectRoot)
  const existing = index.runs.findIndex((entry) => entry.run_id === run.run_id)
  const summary = {
    run_id: run.run_id,
    title: run.title,
    status: run.status,
    work_item_id: run.work_item_id,
    task_id: run.task_id,
    created_at: run.created_at,
    updated_at: run.updated_at,
  }

  if (existing === -1) {
    index.runs.push(summary)
  } else {
    index.runs[existing] = summary
  }

  writeJson(resolveBackgroundRunPath(projectRoot, run.run_id), run)
  writeBackgroundRunIndex(projectRoot, index)
  return run
}

export function readBackgroundRun(projectRoot, runId) {
  const run = readJsonIfExists(resolveBackgroundRunPath(projectRoot, runId))
  if (!run) {
    throw new Error(`Background run '${runId}' not found`)
  }
  return run
}

export function listBackgroundRuns(projectRoot) {
  return readBackgroundRunIndex(projectRoot).runs
}

export function updateBackgroundRun(projectRoot, runId, updates) {
  const current = readBackgroundRun(projectRoot, runId)
  return recordBackgroundRun(projectRoot, {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  })
}
