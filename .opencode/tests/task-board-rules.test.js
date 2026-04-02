import test from "node:test"
import assert from "node:assert/strict"

import {
  TASK_STATUS_VALUES,
  validateTaskBoard,
  validateTaskShape,
  validateTaskStatus,
  validateTaskTransition,
} from "../lib/task-board-rules.js"

function makeTask(overrides = {}) {
  return {
    task_id: "TASK-1",
    title: "Implement task board helper",
    summary: "Add isolated validation rules",
    kind: "implementation",
    status: "ready",
    primary_owner: null,
    qa_owner: null,
    depends_on: [],
    blocked_by: [],
    artifact_refs: [],
    plan_refs: ["docs/solution/2026-03-21-feature.md"],
    branch_or_worktree: null,
    created_by: "SolutionLead",
    created_at: "2026-03-21T00:00:00.000Z",
    updated_at: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

function makeBoard(overrides = {}) {
  return {
    mode: "full",
    current_stage: "full_solution",
    tasks: [makeTask()],
    issues: [],
    ...overrides,
  }
}

test("validateTaskShape accepts the minimum full-delivery task record", () => {
  const task = makeTask()

  assert.doesNotThrow(() => validateTaskShape(task))
})

test("validateTaskShape rejects records with missing required fields", () => {
  const task = makeTask({ summary: undefined })

  assert.throws(() => validateTaskShape(task), /summary/)
})

test("validateTaskShape rejects malformed array contents", () => {
  assert.throws(() => validateTaskShape(makeTask({ depends_on: ["TASK-2", ""] })), /depends_on/)
  assert.throws(() => validateTaskShape(makeTask({ blocked_by: [null] })), /blocked_by/)
  assert.throws(() => validateTaskShape(makeTask({ artifact_refs: [42] })), /artifact_refs/)
  assert.throws(() => validateTaskShape(makeTask({ plan_refs: [""] })), /plan_refs/)
})

test("validateTaskShape requires branch_or_worktree in the task contract", () => {
  const task = makeTask()
  delete task.branch_or_worktree

  assert.throws(() => validateTaskShape(task), /branch_or_worktree/)
})

test("validateTaskStatus allows only documented task-board statuses", () => {
  const expected = [
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

  assert.deepEqual(TASK_STATUS_VALUES, expected)

  for (const status of expected) {
    assert.equal(validateTaskStatus(status), status)
  }

  assert.throws(() => validateTaskStatus("idle"), /Unknown task status/)
})

test("validateTaskTransition allows documented happy-path transitions", () => {
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "queued" }), "ready"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "ready" }), "claimed"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "claimed", primary_owner: "DevA" }), "in_progress"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "in_progress", primary_owner: "DevA" }), "dev_done"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "dev_done", qa_owner: "QAAgent" }), "qa_ready"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "dev_done", qa_owner: null }), "qa_ready", {
    allowQaAssignment: true,
  }))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "qa_ready", qa_owner: "QAAgent" }), "qa_in_progress"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "qa_ready", qa_owner: null }), "qa_in_progress", {
    allowQaClaim: true,
  }))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "qa_in_progress", qa_owner: "QAAgent" }), "done"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "qa_in_progress", qa_owner: "QAAgent" }), "blocked"))
  assert.doesNotThrow(() => validateTaskTransition(makeTask({ status: "qa_in_progress", qa_owner: "QAAgent" }), "in_progress", {
    allowQaFailRework: true,
    finding: { task_id: "TASK-1", summary: "Needs rework" },
  }))
})

test("validateTaskTransition rejects invalid edges and missing handoff requirements", () => {
  assert.throws(() => validateTaskTransition(makeTask({ status: "dev_done" }), "done"), /Invalid task transition/)
  assert.throws(() => validateTaskTransition(makeTask({ status: "claimed" }), "dev_done"), /Invalid task transition/)
  assert.throws(() => validateTaskTransition(makeTask({ status: "dev_done", qa_owner: null }), "qa_ready"), /qa_owner|QA assignment/)
  assert.throws(() => validateTaskTransition(makeTask({ status: "qa_ready", qa_owner: null }), "qa_in_progress"), /qa_owner|QA claim/)
  assert.throws(() => validateTaskTransition(makeTask({ status: "qa_in_progress", qa_owner: "QAAgent" }), "claimed"), /QA fail rework/)
  assert.throws(() => validateTaskTransition(makeTask({ status: "qa_in_progress", qa_owner: "QAAgent" }), "claimed", {
    allowQaFailRework: true,
  }), /finding/)
})

test("validateTaskTransition rejects claiming tasks blocked by unresolved dependencies", () => {
  const task = makeTask({
    status: "ready",
    depends_on: ["TASK-0"],
    blocked_by: ["TASK-0"],
  })

  assert.throws(() => validateTaskTransition(task, "claimed"), /blocked dependency/)
})

test("validateTaskBoard rejects quick-mode task boards", () => {
  assert.throws(() => validateTaskBoard(makeBoard({ mode: "quick", current_stage: "quick_plan" })), /Quick mode/)
})

test("validateTaskBoard rejects migration-mode task boards", () => {
  assert.throws(
    () => validateTaskBoard(makeBoard({ mode: "migration", current_stage: "migration_strategy" })),
    /Migration mode/,
  )
})

test("validateTaskBoard rejects dependency cycles", () => {
  const tasks = [
    makeTask({ task_id: "TASK-1", depends_on: ["TASK-2"], blocked_by: ["TASK-2"] }),
    makeTask({ task_id: "TASK-2", depends_on: ["TASK-1"], blocked_by: ["TASK-1"] }),
  ]

  assert.throws(() => validateTaskBoard(makeBoard({ tasks })), /Dependency cycle/)
})

test("validateTaskBoard rejects duplicate task identifiers", () => {
  const tasks = [
    makeTask({ task_id: "TASK-1" }),
    makeTask({ task_id: "TASK-1", title: "Duplicate task id" }),
  ]

  assert.throws(() => validateTaskBoard(makeBoard({ tasks })), /Duplicate task_id/)
})

test("validateTaskBoard rejects unknown dependency and blocker references", () => {
  assert.throws(() => validateTaskBoard(makeBoard({
    tasks: [makeTask({ depends_on: ["TASK-404"] })],
  })), /depends on unknown task/)

  assert.throws(() => validateTaskBoard(makeBoard({
    tasks: [makeTask({ blocked_by: ["TASK-405"] })],
  })), /blocked by unknown task/)
})

test("validateTaskBoard enforces full-delivery aggregate completion rules", () => {
  const implementationBoard = makeBoard({
    current_stage: "full_implementation",
    tasks: [makeTask({ status: "queued" })],
  })
  assert.throws(() => validateTaskBoard(implementationBoard), /full_implementation/)

  const qaBoard = makeBoard({
    current_stage: "full_qa",
    tasks: [makeTask({ status: "in_progress", primary_owner: "DevA" })],
  })
  assert.throws(() => validateTaskBoard(qaBoard), /full_qa/)

  const doneBoard = makeBoard({
    current_stage: "full_done",
    tasks: [makeTask({ status: "qa_ready", qa_owner: "QAAgent" })],
  })
  assert.throws(() => validateTaskBoard(doneBoard), /full_done/)

  const blockedIssueBoard = makeBoard({
    current_stage: "full_done",
    tasks: [makeTask({ status: "done", qa_owner: "QAAgent" })],
    issues: [{ severity: "high", status: "open", blocks_completion: true }],
  })
  assert.throws(() => validateTaskBoard(blockedIssueBoard), /blocking issue/)

  assert.doesNotThrow(() => validateTaskBoard(makeBoard({
    current_stage: "full_done",
    tasks: [makeTask({ status: "done", qa_owner: "QAAgent" })],
    issues: [],
  })))
})
