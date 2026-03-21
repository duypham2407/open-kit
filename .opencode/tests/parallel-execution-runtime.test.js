const test = require("node:test")
const assert = require("node:assert/strict")

const {
  VALID_ASSIGNMENT_AUTHORITIES,
  decideQaFailLocalRework,
  validateFailureIsolation,
  validateParallelAssignments,
  validateReassignmentAuthority,
  validateTaskScopedFinding,
  validateWorktreeMetadata,
} = require("../lib/parallel-execution-rules")

function makeTask(overrides = {}) {
  return {
    task_id: "TASK-11",
    title: "Parallel execution rules",
    status: "in_progress",
    primary_owner: "Dev-A",
    qa_owner: null,
    ...overrides,
  }
}

function makeFinding(overrides = {}) {
  return {
    issue_id: "ISSUE-11",
    task_id: "TASK-11",
    title: "Regression found during QA",
    summary: "Fix task-local implementation bug",
    type: "bug",
    severity: "medium",
    rooted_in: "implementation",
    recommended_owner: "FullstackAgent",
    evidence: "Targeted regression reproduced in QA.",
    artifact_refs: ["docs/plans/2026-03-21-parallel-rollout.md"],
    affects_tasks: ["TASK-11"],
    blocks_parallel_work: false,
    ...overrides,
  }
}

test("primary-owner assignment validation is per task, not global across tasks", () => {
  assert.doesNotThrow(() => validateParallelAssignments([
    makeTask({ task_id: "TASK-11", primary_owner: "Dev-A", status: "in_progress" }),
    makeTask({ task_id: "TASK-12", primary_owner: "Dev-B", status: "claimed" }),
    makeTask({ task_id: "TASK-13", primary_owner: "Dev-A", status: "done" }),
  ]))

  assert.doesNotThrow(() => validateParallelAssignments([
    makeTask({ task_id: "TASK-11", primary_owner: "Dev-A", status: "in_progress" }),
    makeTask({ task_id: "TASK-12", primary_owner: "Dev-A", status: "claimed" }),
  ]))

  assert.throws(() => validateParallelAssignments([
    makeTask({ task_id: "TASK-11", primary_owner: ["Dev-A"] }),
  ]), /primary_owner.*non-empty string/)
})

test("qa-owner assignment validation is per task, not global across tasks", () => {
  assert.doesNotThrow(() => validateParallelAssignments([
    makeTask({ task_id: "TASK-11", status: "qa_in_progress", qa_owner: "QA-Agent" }),
    makeTask({ task_id: "TASK-12", status: "done", qa_owner: "QA-Agent" }),
  ]))

  assert.doesNotThrow(() => validateParallelAssignments([
    makeTask({ task_id: "TASK-11", status: "qa_ready", qa_owner: "QA-Agent" }),
    makeTask({ task_id: "TASK-12", status: "qa_in_progress", qa_owner: "QA-Agent" }),
  ]))

  assert.throws(() => validateParallelAssignments([
    makeTask({ task_id: "TASK-11", status: "qa_ready", qa_owner: ["QA-Agent"] }),
  ]), /qa_owner.*non-empty string/)
})

test("reassignment authority allows initial assignment but restricts reassignment", () => {
  assert.deepEqual(VALID_ASSIGNMENT_AUTHORITIES.primary_owner, ["MasterOrchestrator", "TechLeadAgent"])
  assert.deepEqual(VALID_ASSIGNMENT_AUTHORITIES.qa_owner, ["MasterOrchestrator", "TechLeadAgent"])

  assert.doesNotThrow(() => validateReassignmentAuthority({
    task: makeTask({ primary_owner: null, status: "ready" }),
    ownerField: "primary_owner",
    requestedBy: "TechLeadAgent",
    nextOwner: "Dev-A",
  }))

  assert.doesNotThrow(() => validateReassignmentAuthority({
    task: makeTask({ primary_owner: "Dev-A", status: "in_progress" }),
    ownerField: "primary_owner",
    requestedBy: "TechLeadAgent",
    nextOwner: "Dev-B",
  }))

  assert.doesNotThrow(() => validateReassignmentAuthority({
    task: makeTask({ primary_owner: "Dev-A", status: "in_progress" }),
    ownerField: "primary_owner",
    requestedBy: "MasterOrchestrator",
    nextOwner: "Dev-B",
  }))

  assert.doesNotThrow(() => validateReassignmentAuthority({
    task: makeTask({ qa_owner: "QA-Agent", status: "qa_ready" }),
    ownerField: "qa_owner",
    requestedBy: "TechLeadAgent",
    nextOwner: "QA-Agent-2",
  }))

  assert.throws(() => validateReassignmentAuthority({
    task: makeTask({ qa_owner: null, status: "dev_done" }),
    ownerField: "qa_owner",
    requestedBy: "QAAgent",
    nextOwner: "QA-Agent",
  }), /MasterOrchestrator or TechLeadAgent.*qa_owner/)
})

test("task-scoped finding validation enforces routing-safe shape", () => {
  assert.doesNotThrow(() => validateTaskScopedFinding(makeFinding(), makeTask()))

  assert.throws(() => validateTaskScopedFinding(makeFinding({ task_id: "TASK-99" }), makeTask()), /task-scoped finding.*TASK-11/)
  assert.throws(() => validateTaskScopedFinding(makeFinding({ artifact_refs: [] }), makeTask()), /artifact_refs/)
  assert.throws(() => validateTaskScopedFinding(makeFinding({ affects_tasks: ["TASK-11", "TASK-12"] }), makeTask()), /affects_tasks/)
})

test("QA fail local rework routing allows only isolated implementation bugs", () => {
  const decision = decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress", primary_owner: "Dev-A", qa_owner: "QA-Agent" }),
    finding: makeFinding(),
    rerouteDecision: {
      stage: "full_qa",
      owner: "QAAgent",
      decided_by: "TechLeadAgent",
      reason: "Keep overall feature QA active while routing one task back for local rework",
    },
  })

  assert.deepEqual(decision, {
    allowed: true,
    route: {
      stage: "full_qa",
      owner: "QAAgent",
      decided_by: "TechLeadAgent",
      reason: "Keep overall feature QA active while routing one task back for local rework",
    },
  })

  const implementationDecision = decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress", primary_owner: "Dev-A", qa_owner: "QA-Agent" }),
    finding: makeFinding(),
    rerouteDecision: {
      stage: "full_implementation",
      owner: "FullstackAgent",
      decided_by: "MasterOrchestrator",
      reason: "Aggregate risk requires implementation-stage reroute",
    },
  })

  assert.deepEqual(implementationDecision.route, {
    stage: "full_implementation",
    owner: "FullstackAgent",
    decided_by: "MasterOrchestrator",
    reason: "Aggregate risk requires implementation-stage reroute",
  })

  assert.throws(() => decideQaFailLocalRework({
    mode: "quick",
    task: makeTask({ status: "qa_in_progress" }),
    finding: makeFinding(),
  }), /full mode/)

  assert.throws(() => decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress" }),
    finding: makeFinding({ type: "design_flaw", rooted_in: "architecture", recommended_owner: "ArchitectAgent" }),
  }), /design or requirements findings must not stay in local rework/)

  assert.throws(() => decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress" }),
    finding: makeFinding(),
    rerouteDecision: {
      stage: "full_implementation",
      owner: "FullstackAgent",
      decided_by: "QAAgent",
      reason: "QA should not self-authorize reroute decisions",
    },
  }), /field 'decided_by'.*MasterOrchestrator.*TechLeadAgent.*QAAgent/)

  assert.throws(() => decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress" }),
    finding: makeFinding(),
    rerouteDecision: {
      stage: "full_done",
      owner: "MasterOrchestrator",
      decided_by: "MasterOrchestrator",
      reason: "Invalid reroute target",
    },
  }), /field 'stage'.*full_qa.*full_implementation.*full_done/)

  assert.throws(() => decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress" }),
    finding: makeFinding(),
    rerouteDecision: {
      stage: "full_qa",
      owner: "MasterOrchestrator",
      decided_by: "MasterOrchestrator",
      reason: "Invalid reroute owner",
    },
  }), /field 'owner'.*QAAgent.*FullstackAgent.*MasterOrchestrator/)

  assert.throws(() => decideQaFailLocalRework({
    mode: "full",
    task: makeTask({ status: "qa_in_progress" }),
    finding: makeFinding(),
    rerouteDecision: {
      stage: "full_qa",
      owner: "QAAgent",
      decided_by: "MasterOrchestrator",
      reason: "",
    },
  }), /reason.*non-empty string/)
})

test("failure isolation rules reject shared or blocking failures", () => {
  assert.doesNotThrow(() => validateFailureIsolation(makeFinding(), makeTask()))

  assert.throws(() => validateFailureIsolation(makeFinding({ blocks_parallel_work: true }), makeTask()), /blocks parallel work/)
  assert.throws(() => validateFailureIsolation(makeFinding({ affects_tasks: ["TASK-11", "TASK-12"] }), makeTask()), /isolated to exactly one task/)
  assert.throws(() => validateFailureIsolation(makeFinding({ severity: "critical" }), makeTask()), /critical failures require orchestrator escalation/)
})

test("worktree and branch metadata validation requires task-specific isolation metadata", () => {
  assert.doesNotThrow(() => validateWorktreeMetadata({
    task_id: "TASK-11",
    branch: "task/TASK-11-parallel-execution",
    worktree_path: ".worktrees/task-11-parallel-execution",
  }))

  assert.throws(() => validateWorktreeMetadata({
    task_id: "TASK-11",
    branch: "main",
    worktree_path: ".worktrees/task-11-parallel-execution",
  }), /branch.*must not target main/)

  assert.throws(() => validateWorktreeMetadata({
    task_id: "TASK-11",
    branch: "task/TASK-99-other-work",
    worktree_path: ".worktrees/task-11-parallel-execution",
  }), /branch.*TASK-11/)

  assert.throws(() => validateWorktreeMetadata({
    task_id: "TASK-11",
    branch: "task/TASK-11-parallel-execution",
    worktree_path: "parallel-agent-rollout",
  }), /worktree_path/)
})
