const ALLOWED_WORKTREE_PREFIX = ".worktrees/"
const PROTECTED_BRANCHES = new Set(["main", "master"])
const VALID_QA_REWORK_STAGES = new Set(["full_qa", "full_implementation"])
const VALID_QA_REWORK_DECIDERS = new Set(["MasterOrchestrator", "SolutionLead"])
const VALID_QA_REWORK_OWNERS = new Set(["QAAgent", "FullstackAgent"])

const VALID_ASSIGNMENT_AUTHORITIES = {
  primary_owner: ["MasterOrchestrator", "SolutionLead"],
  qa_owner: ["MasterOrchestrator", "SolutionLead"],
}

function fail(message) {
  throw new Error(message)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function validateTaskReference(task, contextLabel = "Parallel execution") {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    fail(`${contextLabel} requires task objects`)
  }

  if (!isNonEmptyString(task.task_id)) {
    fail(`${contextLabel} requires each task to have a non-empty task_id`)
  }

  return task
}

function validateTaskReferenceList(tasks) {
  if (!Array.isArray(tasks)) {
    fail("Parallel assignment validation requires a tasks array")
  }

  return tasks.map((task) => validateTaskReference(task, "Parallel assignment validation"))
}

function validatePerTaskOwnerField(tasks, ownerField) {
  for (const task of validateTaskReferenceList(tasks)) {
    const owner = task[ownerField]
    if (owner === null || owner === undefined) {
      continue
    }

    if (!isNonEmptyString(owner)) {
      fail(`Parallel ${ownerField} for task '${task.task_id}' must be a non-empty string when set`)
    }
  }
}

function validateParallelAssignments(tasks) {
  validatePerTaskOwnerField(tasks, "primary_owner")
  validatePerTaskOwnerField(tasks, "qa_owner")
  return tasks
}

function validateReassignmentAuthority({ task, ownerField, requestedBy, nextOwner }) {
  validateTaskReference(task, "Reassignment validation")

  if (!Object.prototype.hasOwnProperty.call(VALID_ASSIGNMENT_AUTHORITIES, ownerField)) {
    fail(`Unknown assignment field '${ownerField}'`)
  }

  if (!isNonEmptyString(requestedBy)) {
    fail("Reassignment validation requires requestedBy")
  }

  if (!isNonEmptyString(nextOwner)) {
    fail(`Reassignment validation requires a non-empty next owner for '${ownerField}'`)
  }

  const currentOwner = task[ownerField]
  const allowedAuthorities = VALID_ASSIGNMENT_AUTHORITIES[ownerField]
  const isInitialAssignment = !isNonEmptyString(currentOwner)

  if (isInitialAssignment) {
    if (!allowedAuthorities.includes(requestedBy)) {
      fail(`Only ${allowedAuthorities.join(" or ")} can assign ${ownerField}`)
    }

    return {
      ownerField,
      requestedBy,
      nextOwner,
      reassignment: false,
    }
  }

  if (currentOwner === nextOwner) {
    return {
      ownerField,
      requestedBy,
      nextOwner,
      reassignment: false,
    }
  }

  if (!allowedAuthorities.includes(requestedBy)) {
    fail(`Only ${allowedAuthorities.join(" or ")} can reassign ${ownerField}`)
  }

  return {
    ownerField,
    requestedBy,
    nextOwner,
    reassignment: true,
  }
}

function validateTaskScopedFinding(finding, task) {
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
    fail("A task-scoped finding must be an object")
  }

  validateTaskReference(task, "Task-scoped finding validation")

  const requiredFields = [
    "issue_id",
    "task_id",
    "title",
    "summary",
    "type",
    "severity",
    "rooted_in",
    "recommended_owner",
    "evidence",
  ]

  for (const field of requiredFields) {
    if (!isNonEmptyString(finding[field])) {
      fail(`Task-scoped finding requires '${field}'`)
    }
  }

  if (finding.task_id !== task.task_id) {
    fail(`A task-scoped finding for '${task.task_id}' must reference the same task_id`)
  }

  if (!Array.isArray(finding.artifact_refs) || finding.artifact_refs.length === 0 || !finding.artifact_refs.every(isNonEmptyString)) {
    fail("Task-scoped finding requires non-empty artifact_refs")
  }

  if (!Array.isArray(finding.affects_tasks) || finding.affects_tasks.length !== 1 || finding.affects_tasks[0] !== task.task_id) {
    fail(`Task-scoped finding affects_tasks must be isolated to exactly one task: '${task.task_id}'`)
  }

  return finding
}

function validateFailureIsolation(finding, task) {
  validateTaskScopedFinding(finding, task)

  if (finding.blocks_parallel_work === true) {
    fail("Task-scoped local rework cannot proceed when the finding blocks parallel work")
  }

  if (finding.affects_tasks.length !== 1) {
    fail("Failure isolation requires a finding isolated to exactly one task")
  }

  if (finding.severity === "critical") {
    fail("critical failures require orchestrator escalation")
  }

  return finding
}

function validateQaFailRerouteDecision(rerouteDecision) {
  if (!rerouteDecision || typeof rerouteDecision !== "object" || Array.isArray(rerouteDecision)) {
    fail("QA fail local rework routing requires a rerouteDecision")
  }

  if (!VALID_QA_REWORK_STAGES.has(rerouteDecision.stage)) {
    fail(`QA fail local rework reroute field 'stage' must be 'full_qa' or 'full_implementation'; received '${String(rerouteDecision.stage)}'`)
  }

  if (!VALID_QA_REWORK_OWNERS.has(rerouteDecision.owner)) {
    fail(`QA fail local rework reroute field 'owner' must be 'QAAgent' or 'FullstackAgent'; received '${String(rerouteDecision.owner)}'`)
  }

  if (!VALID_QA_REWORK_DECIDERS.has(rerouteDecision.decided_by)) {
    fail(`QA fail local rework reroute field 'decided_by' must be 'MasterOrchestrator' or 'SolutionLead'; received '${String(rerouteDecision.decided_by)}'`)
  }

  if (!isNonEmptyString(rerouteDecision.reason)) {
    fail("QA fail local rework reroute field 'reason' must be a non-empty string")
  }

  return rerouteDecision
}

function decideQaFailLocalRework({ mode, task, finding, rerouteDecision }) {
  if (mode !== "full") {
    fail("QA fail local rework routing is only allowed in full mode")
  }

  validateTaskReference(task, "QA fail local rework routing")

  if (task.status !== "qa_in_progress") {
    fail("QA fail local rework routing requires task status 'qa_in_progress'")
  }

  validateFailureIsolation(finding, task)

  if (finding.type !== "bug" || finding.rooted_in !== "implementation" || finding.recommended_owner !== "FullstackAgent") {
    fail("QA design or requirements findings must not stay in local rework")
  }

  const route = validateQaFailRerouteDecision(rerouteDecision)

  return {
    allowed: true,
    route,
  }
}

function validateWorktreeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    fail("Worktree metadata must be an object")
  }

  const { task_id: taskId, branch, worktree_path: worktreePath } = metadata

  if (!isNonEmptyString(taskId)) {
    fail("Worktree metadata requires task_id")
  }

  if (!isNonEmptyString(branch)) {
    fail("Worktree metadata requires branch")
  }

  if (!isNonEmptyString(worktreePath)) {
    fail("Worktree metadata requires worktree_path")
  }

  if (PROTECTED_BRANCHES.has(branch)) {
    fail("Parallel worktree branch must not target main or master")
  }

  if (!branch.includes(taskId)) {
    fail(`Parallel worktree branch must include task id '${taskId}'`)
  }

  if (!worktreePath.startsWith(ALLOWED_WORKTREE_PREFIX)) {
    fail(`Parallel worktree_path must start with '${ALLOWED_WORKTREE_PREFIX}'`)
  }

  return metadata
}

module.exports = {
  VALID_ASSIGNMENT_AUTHORITIES,
  decideQaFailLocalRework,
  validateFailureIsolation,
  validateParallelAssignments,
  validateReassignmentAuthority,
  validateTaskScopedFinding,
  validateWorktreeMetadata,
}
