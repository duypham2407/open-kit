const TASK_STATUS_VALUES = [
  "queued",
  "ready",
  "claimed",
  "in_progress",
  "dev_done",
  "qa_ready",
  "qa_in_progress",
  "done",
  "blocked",
  "cancelled",
]

const REQUIRED_TASK_FIELDS = {
  task_id: "string",
  title: "string",
  summary: "string",
  kind: "string",
  status: "string",
  depends_on: "array",
  blocked_by: "array",
  artifact_refs: "array",
  plan_refs: "array",
  branch_or_worktree: "nullable_string",
  created_by: "string",
  created_at: "string",
  updated_at: "string",
}

const IMPLEMENTATION_READY_STATUSES = new Set([
  "ready",
  "claimed",
  "in_progress",
  "dev_done",
  "qa_ready",
  "qa_in_progress",
])

const DEPENDENCY_SATISFIED_STATUSES = new Set([
  "dev_done",
  "qa_ready",
  "qa_in_progress",
  "done",
  "cancelled",
])

const FULL_QA_ALLOWED_STATUSES = new Set([
  "dev_done",
  "qa_ready",
  "qa_in_progress",
  "done",
  "cancelled",
])

const TRANSITIONS = new Map([
  ["queued", new Set(["ready", "cancelled"])],
  ["ready", new Set(["claimed", "cancelled"])],
  ["claimed", new Set(["in_progress", "cancelled"])],
  ["in_progress", new Set(["dev_done", "cancelled"])],
  ["dev_done", new Set(["qa_ready", "cancelled"])],
  ["qa_ready", new Set(["qa_in_progress", "cancelled"])],
  ["qa_in_progress", new Set(["done", "blocked", "claimed", "in_progress", "cancelled"])],
  ["blocked", new Set(["claimed", "in_progress", "cancelled"])],
  ["done", new Set(["cancelled"])],
  ["cancelled", new Set()],
])

function fail(message) {
  throw new Error(message)
}

function formatModeLabel(mode) {
  return typeof mode === "string" && mode.length > 0 ? `${mode.charAt(0).toUpperCase()}${mode.slice(1)}` : "Unknown"
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function validateStringArrayEntries(field, values) {
  for (const value of values) {
    if (!isNonEmptyString(value)) {
      fail(`Task field '${field}' must contain only non-empty strings`)
    }
  }
}

function validateTaskStatus(status) {
  if (!TASK_STATUS_VALUES.includes(status)) {
    fail(`Unknown task status '${status}'`)
  }

  return status
}

function validateTaskShape(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    fail("Task must be an object")
  }

  for (const [field, kind] of Object.entries(REQUIRED_TASK_FIELDS)) {
    if (!(field in task) || task[field] === undefined) {
      fail(`Task is missing required field '${field}'`)
    }

    if (kind === "string" && !isNonEmptyString(task[field])) {
      fail(`Task field '${field}' must be a non-empty string`)
    }

    if (kind === "array" && !Array.isArray(task[field])) {
      fail(`Task field '${field}' must be an array`)
    }

    if (kind === "array" && Array.isArray(task[field])) {
      validateStringArrayEntries(field, task[field])
    }

    if (
      kind === "nullable_string" &&
      task[field] !== null &&
      task[field] !== undefined &&
      !isNonEmptyString(task[field])
    ) {
      fail(`Task field '${field}' must be null or a non-empty string`)
    }
  }

  if (task.primary_owner !== null && task.primary_owner !== undefined && !isNonEmptyString(task.primary_owner)) {
    fail("Task field 'primary_owner' must be null or a non-empty string")
  }

  if (task.qa_owner !== null && task.qa_owner !== undefined && !isNonEmptyString(task.qa_owner)) {
    fail("Task field 'qa_owner' must be null or a non-empty string")
  }

  validateTaskStatus(task.status)
  return task
}

function hasBlockedDependencies(task) {
  return Array.isArray(task.blocked_by) && task.blocked_by.length > 0
}

function validateTaskTransition(task, nextStatus, options = {}) {
  validateTaskShape(task)
  validateTaskStatus(nextStatus)

  const allowedTargets = TRANSITIONS.get(task.status)
  if (!allowedTargets || !allowedTargets.has(nextStatus)) {
    fail(`Invalid task transition '${task.status} -> ${nextStatus}'`)
  }

  if ((task.status === "queued" && nextStatus === "ready") || (task.status === "ready" && nextStatus === "claimed")) {
    if (hasBlockedDependencies(task)) {
      fail(`Task '${task.task_id}' cannot move to '${nextStatus}' with a blocked dependency`)
    }
  }

  if (task.status === "claimed" && nextStatus === "in_progress" && !isNonEmptyString(task.primary_owner)) {
    fail(`Task '${task.task_id}' requires a primary_owner before entering 'in_progress'`)
  }

  if (task.status === "in_progress" && nextStatus === "dev_done" && !isNonEmptyString(task.primary_owner)) {
    fail(`Task '${task.task_id}' requires a primary_owner before entering 'dev_done'`)
  }

  if (
    task.status === "dev_done" &&
    nextStatus === "qa_ready" &&
    !isNonEmptyString(task.qa_owner) &&
    options.allowQaAssignment !== true
  ) {
    fail(`Task '${task.task_id}' requires a qa_owner or explicit QA assignment availability before entering 'qa_ready'`)
  }

  if (
    task.status === "qa_ready" &&
    nextStatus === "qa_in_progress" &&
    !isNonEmptyString(task.qa_owner) &&
    options.allowQaClaim !== true
  ) {
    fail(`Task '${task.task_id}' requires a qa_owner or explicit QA claim availability before entering 'qa_in_progress'`)
  }

  if (
    task.status === "qa_in_progress" &&
    (nextStatus === "done" || nextStatus === "blocked") &&
    !isNonEmptyString(task.qa_owner)
  ) {
    fail(`Task '${task.task_id}' requires a qa_owner before entering '${nextStatus}'`)
  }

  if (task.status === "qa_in_progress" && (nextStatus === "claimed" || nextStatus === "in_progress")) {
    if (!options.allowQaFailRework) {
      fail(`QA fail rework transitions require explicit allowQaFailRework for task '${task.task_id}'`)
    }

    if (!options.finding || typeof options.finding !== "object") {
      fail(`QA fail rework transitions require a task-scoped finding for task '${task.task_id}'`)
    }

    if (options.finding.task_id !== task.task_id || !isNonEmptyString(options.finding.summary)) {
      fail(`QA fail rework transitions require a task-scoped finding for task '${task.task_id}'`)
    }
  }

  return nextStatus
}

function buildTaskIndex(tasks) {
  const index = new Map()

  for (const task of tasks) {
    if (index.has(task.task_id)) {
      fail(`Duplicate task_id '${task.task_id}' in task board`)
    }

    index.set(task.task_id, task)
  }

  return index
}

function validateDependencyReferences(tasks, taskIndex) {
  for (const task of tasks) {
    for (const dependencyId of task.depends_on) {
      if (!taskIndex.has(dependencyId)) {
        fail(`Task '${task.task_id}' depends on unknown task '${dependencyId}'`)
      }
    }

    for (const blockedId of task.blocked_by) {
      if (!taskIndex.has(blockedId)) {
        fail(`Task '${task.task_id}' is blocked by unknown task '${blockedId}'`)
      }
    }
  }
}

function detectDependencyCycle(tasks) {
  const visiting = new Set()
  const visited = new Set()
  const taskIndex = buildTaskIndex(tasks)

  function visit(taskId, trail) {
    if (visiting.has(taskId)) {
      fail(`Dependency cycle detected: ${[...trail, taskId].join(" -> ")}`)
    }

    if (visited.has(taskId)) {
      return
    }

    visiting.add(taskId)
    const task = taskIndex.get(taskId)
    for (const dependencyId of task.depends_on) {
      visit(dependencyId, [...trail, taskId])
    }
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const task of tasks) {
    visit(task.task_id, [])
  }
}

function validateDependencyState(tasks, taskIndex) {
  for (const task of tasks) {
    const unresolvedDependencies = task.depends_on.filter((dependencyId) => {
      const dependency = taskIndex.get(dependencyId)
      return !DEPENDENCY_SATISFIED_STATUSES.has(dependency.status)
    })

    const activeWhileBlocked = ["ready", "claimed", "in_progress"].includes(task.status)
    if (activeWhileBlocked && unresolvedDependencies.length > 0) {
      fail(`Task '${task.task_id}' cannot be '${task.status}' while blocked by unresolved dependencies: ${unresolvedDependencies.join(", ")}`)
    }

    if (task.status === "claimed" && !isNonEmptyString(task.primary_owner)) {
      fail(`Task '${task.task_id}' in 'claimed' status requires a primary_owner`)
    }

    if (task.status === "in_progress" && !isNonEmptyString(task.primary_owner)) {
      fail(`Task '${task.task_id}' in 'in_progress' status requires a primary_owner`)
    }

    if (task.status === "dev_done" && !isNonEmptyString(task.primary_owner)) {
      fail(`Task '${task.task_id}' in 'dev_done' status requires a primary_owner`)
    }

    if ((task.status === "qa_in_progress" || task.status === "done" || task.status === "blocked") && !isNonEmptyString(task.qa_owner)) {
      fail(`Task '${task.task_id}' in '${task.status}' status requires a qa_owner`)
    }
  }
}

function validateBoardShape(board) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    fail("Task board must be an object")
  }

  if (board.mode !== "full") {
    fail(`${formatModeLabel(board.mode)} mode cannot carry a task board; task boards are full-delivery only`)
  }

  if (!Array.isArray(board.tasks)) {
    fail("Task board must include a tasks array")
  }

  if (board.tasks.length === 0) {
    fail("Full-delivery task board must include at least one task")
  }

  if (board.issues !== undefined && !Array.isArray(board.issues)) {
    fail("Task board issues must be an array when provided")
  }
}

function validateAggregateRules(board, tasks) {
  if (board.current_stage === "full_implementation") {
    const hasImplementationReadyTask = tasks.some((task) => IMPLEMENTATION_READY_STATUSES.has(task.status))
    if (!hasImplementationReadyTask) {
      fail("A full_implementation board must include at least one implementation-active task")
    }
  }

  if (board.current_stage === "full_qa") {
    const hasIncompleteImplementationTask = tasks.some((task) => !FULL_QA_ALLOWED_STATUSES.has(task.status))
    if (hasIncompleteImplementationTask) {
      fail("A full_qa board cannot include tasks with incomplete implementation work")
    }
  }

  if (board.current_stage === "full_done") {
    const hasRemainingTask = tasks.some((task) => !["done", "cancelled"].includes(task.status))
    if (hasRemainingTask) {
      fail("A full_done board requires every required task to be done or cancelled")
    }

    const hasBlockingIssue = (board.issues ?? []).some((issue) => {
      if (!issue || typeof issue !== "object") {
        return false
      }

      return issue.blocks_completion === true && issue.status !== "resolved" && issue.status !== "closed"
    })

    if (hasBlockingIssue) {
      fail("A full_done board cannot close with an open blocking issue")
    }
  }
}

function validateTaskBoard(board) {
  validateBoardShape(board)

  const tasks = board.tasks.map((task) => validateTaskShape(task))
  const taskIndex = buildTaskIndex(tasks)

  validateDependencyReferences(tasks, taskIndex)
  detectDependencyCycle(tasks)
  validateDependencyState(tasks, taskIndex)
  validateAggregateRules(board, tasks)

  return board
}

module.exports = {
  TASK_STATUS_VALUES,
  validateTaskBoard,
  validateTaskShape,
  validateTaskStatus,
  validateTaskTransition,
}
