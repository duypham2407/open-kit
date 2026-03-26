const fs = require("fs")
const path = require("path")

const { readWorkItemIndex, resolveWorkItemPaths } = require("./work-item-store")
const {
  getArtifactReadiness,
  getIssueTelemetry,
  getNextAction,
  getParallelizationSummary,
  getVerificationReadiness,
  summarizeArtifactReadinessLines,
  summarizeVerificationEvidence,
  summarizeVerificationReadinessLine,
} = require("./runtime-guidance")

const ACTIVE_TASK_STATUSES = new Set(["claimed", "in_progress", "qa_in_progress"])

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"))
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

function getTaskBoardDetails(projectRoot, state) {
  if (!state || state.mode !== "full" || !state.work_item_id) {
    return {
      present: false,
      summary: null,
    }
  }

  const boardPath = path.join(resolveWorkItemPaths(projectRoot, state.work_item_id).workItemDir, "tasks.json")
  const board = readJsonIfExists(boardPath)
  if (!board) {
    return {
      present: false,
      summary: null,
    }
  }

  const tasks = Array.isArray(board.tasks) ? board.tasks : []
  const activeTasks = tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status))

  return {
    present: true,
    summary: {
      total: tasks.length,
      ready: tasks.filter((task) => task.status === "ready").length,
      active: activeTasks.length,
      activeTasks: activeTasks.map(formatActiveTask),
    },
  }
}

function getRuntimeContext(projectRoot, state) {
  const index = getWorkItemIndexIfExists(projectRoot)
  const taskBoard = getTaskBoardDetails(projectRoot, state)
  const artifactReadiness = getArtifactReadiness(state)
  const verificationReadiness = getVerificationReadiness(state)
  const issueTelemetry = getIssueTelemetry(state)

  return {
    activeWorkItemId: index?.active_work_item_id ?? state?.work_item_id ?? null,
    workItemCount: index?.work_items?.length ?? null,
    taskBoardPresent: taskBoard.present,
    taskBoardSummary: taskBoard.summary,
    nextAction: getNextAction(state),
    artifactReadiness,
    artifactReadinessLines: summarizeArtifactReadinessLines(state),
    verificationReadiness,
    verificationReadinessLine: summarizeVerificationReadinessLine(state),
    verificationEvidenceLines: summarizeVerificationEvidence(state),
    issueTelemetry,
    parallelization: getParallelizationSummary(state),
  }
}

module.exports = {
  getRuntimeContext,
}
