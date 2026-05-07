import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import {
  advanceStage,
  claimTask,
  createTask as createBoardTask,
  linkArtifact,
  listTasks,
  reassignTask,
  releaseTask,
  selectActiveWorkItem,
  setApproval,
  setTaskStatus,
  showState,
  showWorkItemState,
  startFeature,
  startTask,
  validateWorkItemBoard,
} from "../lib/workflow-state-controller.js"
import { readWorkItemIndex, readWorkItemState } from "../lib/work-item-store.js"

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-multi-work-item-"))
}

function loadFixtureState() {
  const fixturePath = path.resolve(__dirname, "../workflow-state.json")
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"))
}

function createTempStateFile() {
  const dir = makeTempDir()
  const opencodeDir = path.join(dir, ".opencode")
  const templatesDir = path.join(dir, "docs", "templates")
  fs.mkdirSync(path.join(dir, "docs", "scope"), { recursive: true })
  fs.mkdirSync(path.join(dir, "docs", "solution"), { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })
  fs.mkdirSync(opencodeDir, { recursive: true })
  for (const template of ["scope-package-template.md", "solution-package-template.md", "migration-solution-package-template.md", "migration-report-template.md"]) {
    const src = path.resolve(__dirname, "../../docs/templates", template)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(templatesDir, template))
    }
  }
  const statePath = path.join(opencodeDir, "workflow-state.json")
  fs.writeFileSync(statePath, `${JSON.stringify(loadFixtureState(), null, 2)}\n`, "utf8")
  return statePath
}

function writeArtifact(statePath, relativePath, content) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const absolutePath = path.join(projectRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${content}\n`, "utf8")
}

function createTask(overrides = {}) {
  return {
    task_id: "TASK-1",
    title: "Implement feature slice",
    summary: "Controller-backed board validation",
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

function writeTaskBoard(statePath, workItemId, board) {
  const projectRoot = path.dirname(path.dirname(statePath))
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "tasks.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
}

function advanceFullWorkItemToPlan(statePath) {
  const state = showState(statePath).state
  writeArtifact(
    statePath,
    `docs/scope/2026-03-21-${state.feature_slug}.md`,
    ["# Scope Package", "", "## Goal", "", "## In Scope", "", "## Out of Scope", "", "## Acceptance Criteria Matrix"].join("\n"),
  )
  advanceStage("full_product", statePath)
  const scopePath = `docs/scope/2026-03-21-${state.feature_slug}.md`
  linkArtifact("scope_package", scopePath, statePath)
  setApproval("product_to_solution", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_solution", statePath)
  const solutionPath = `docs/solution/2026-03-21-${state.feature_slug}.md`
  writeArtifact(
    statePath,
    solutionPath,
    [
      "# Solution Package",
      "",
      "## Recommended Path",
      "",
      "## Impacted Surfaces",
      "",
      "## Implementation Slices",
      "",
      "## Validation Matrix",
      "",
      "## Integration Checkpoint",
    ].join("\n"),
  )
  linkArtifact("solution_package", solutionPath, statePath)
}

test("compatibility mirror refresh happens after the active work item pointer changes", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-300", "first-feature", statePath)
  startTask("quick", "TASK-300", "second-item", "Select a new quick task", statePath)

  const indexBeforeSelection = readWorkItemIndex(projectRoot)
  const mirrorBeforeSelection = JSON.parse(fs.readFileSync(statePath, "utf8"))
  assert.equal(indexBeforeSelection.active_work_item_id, "task-300")
  assert.equal(mirrorBeforeSelection.work_item_id, "task-300")

  const result = selectActiveWorkItem("feature-300", statePath)
  const indexAfterSelection = readWorkItemIndex(projectRoot)
  const mirrorAfterSelection = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const activePerItemState = readWorkItemState(projectRoot, "feature-300")

  assert.equal(result.state.work_item_id, "feature-300")
  assert.equal(indexAfterSelection.active_work_item_id, "feature-300")
  assert.deepEqual(mirrorAfterSelection, activePerItemState)
})

test("selectActiveWorkItem rewrites a stale compatibility mirror from the active per-item state", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-305", "mirror-refresh", statePath)
  startTask("quick", "TASK-305", "active-quick", "Use quick item as active selection", statePath)

  fs.writeFileSync(
    statePath,
    `${JSON.stringify({
      feature_id: "STALE-ITEM",
      feature_slug: "stale-mirror",
      mode: "full",
      mode_reason: "stale",
      routing_profile: {
        work_intent: "feature",
        behavior_delta: "extend",
        dominant_uncertainty: "product",
        scope_shape: "cross_boundary",
        selection_reason: "stale",
      },
      current_stage: "full_done",
      status: "done",
      current_owner: "MasterOrchestrator",
      artifacts: {
        task_card: null,
        scope_package: null,
        solution_package: null,
        migration_report: null,
        qa_report: null,
        adr: [],
      },
      approvals: {
        product_to_solution: { status: "approved", approved_by: null, approved_at: null, notes: null },
        solution_to_fullstack: { status: "approved", approved_by: null, approved_at: null, notes: null },
        fullstack_to_code_review: { status: "approved", approved_by: null, approved_at: null, notes: null },
        code_review_to_qa: { status: "approved", approved_by: null, approved_at: null, notes: null },
        qa_to_done: { status: "approved", approved_by: null, approved_at: null, notes: null },
      },
      issues: [],
      retry_count: 0,
      escalated_from: null,
      escalation_reason: null,
      updated_at: "2026-03-21T00:00:00.000Z",
      work_item_id: "stale-item",
    }, null, 2)}\n`,
    "utf8",
  )

  const result = selectActiveWorkItem("task-305", statePath)
  const mirrorAfterRefresh = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const activePerItemState = readWorkItemState(projectRoot, "task-305")

  assert.equal(result.state.work_item_id, "task-305")
  assert.equal(mirrorAfterRefresh.work_item_id, "task-305")
  assert.deepEqual(mirrorAfterRefresh, activePerItemState)
})

test("per-item reads remain stable while active selection changes", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-301", "feature-one", statePath)
  startTask("quick", "TASK-301", "task-two", "Second tracked item", statePath)

  const featureStateBefore = showWorkItemState("feature-301", statePath)
  assert.equal(featureStateBefore.state.feature_id, "FEATURE-301")

  selectActiveWorkItem("feature-301", statePath)

  const activeState = showState(statePath)
  const taskState = showWorkItemState("task-301", statePath)

  assert.equal(activeState.state.work_item_id, "feature-301")
  assert.equal(taskState.state.work_item_id, "task-301")
  assert.equal(taskState.state.feature_id, "TASK-301")
})

test("active selection fails validation when switched to a quick work item carrying tasks.json", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-302", "feature-valid", statePath)
  startTask("quick", "TASK-302", "quick-invalid", "Quick item with stale board", statePath)
  writeTaskBoard(statePath, "task-302", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask()],
    issues: [],
  })

  assert.throws(() => showState(statePath), /Quick mode cannot carry a task board/)

  const featureState = showWorkItemState("feature-302", statePath)
  assert.equal(featureState.state.work_item_id, "feature-302")
})

test("active selection fails validation when switched to a migration work item carrying tasks.json", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-303", "feature-valid", statePath)
  startTask("migration", "MIGRATE-302", "migration-invalid", "Migration item with stale board", statePath)
  writeTaskBoard(statePath, "migrate-302", {
    mode: "full",
    current_stage: "full_solution",
    tasks: [createTask()],
    issues: [],
  })

  assert.throws(() => showState(statePath), /Migration mode cannot carry a task board/)

  const featureState = showWorkItemState("feature-303", statePath)
  assert.equal(featureState.state.work_item_id, "feature-303")
})

test("task-board helpers operate on a specific full work item without changing active selection", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-400", "board-target", statePath)
  selectActiveWorkItem("feature-400", statePath)
  advanceFullWorkItemToPlan(statePath)
  startTask("quick", "TASK-400", "active-quick-item", "Keep quick item active", statePath)

  createBoardTask(
    "feature-400",
    {
      task_id: "TASK-401",
      title: "Controller board task",
      summary: "Keep board edits scoped to the selected work item",
      kind: "implementation",
      plan_refs: ["docs/solution/2026-03-21-feature.md"],
      created_by: "SolutionLead",
    },
    statePath,
  )

  const activeState = showState(statePath)
  const featureTasks = listTasks("feature-400", statePath)
  const validatedBoard = validateWorkItemBoard("feature-400", statePath)

  assert.equal(activeState.state.work_item_id, "task-400")
  assert.equal(featureTasks.tasks.length, 1)
  assert.equal(featureTasks.tasks[0].task_id, "TASK-401")
  assert.equal(validatedBoard.board.tasks[0].task_id, "TASK-401")
})

test("invalid worktree metadata does not persist partial task-board writes", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-401", "rollback-invalid-worktree", statePath)
  advanceFullWorkItemToPlan(statePath)

  assert.throws(
    () =>
      createBoardTask(
        "feature-401",
        {
          task_id: "TASK-401",
          title: "Unsafe worktree",
          summary: "Reject protected branch metadata",
          kind: "implementation",
          created_by: "SolutionLead",
          worktree_metadata: {
            task_id: "TASK-401",
            branch: "main",
            worktree_path: ".worktrees/task-401-parallel",
          },
        },
        statePath,
      ),
    /must not target main/,
  )

  assert.equal(fs.existsSync(path.join(path.dirname(path.dirname(statePath)), ".opencode", "work-items", "feature-401", "tasks.json")), false)
})

test("qa-fail local rework keeps mutations scoped to the targeted work item", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-402", "full-target", statePath)
  selectActiveWorkItem("feature-402", statePath)
  advanceFullWorkItemToPlan(statePath)
  startTask("quick", "TASK-402", "active-quick", "Keep quick item active", statePath)

  createBoardTask(
    "feature-402",
    {
      task_id: "TASK-402A",
      title: "Scoped local rework",
      summary: "Only mutate target work item",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "SolutionLead",
    },
    statePath,
  )

  const result = setTaskStatus("feature-402", "TASK-402A", "claimed", statePath, {
    requestedBy: "QAAgent",
    finding: {
      issue_id: "ISSUE-402",
      task_id: "TASK-402A",
      title: "Regression found during QA",
      summary: "Fix one task-local implementation bug",
      type: "bug",
      severity: "medium",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Targeted regression reproduced in QA.",
      artifact_refs: ["docs/qa/2026-03-21-feature-402.md"],
      affects_tasks: ["TASK-402A"],
      blocks_parallel_work: false,
    },
    rerouteDecision: {
      stage: "full_implementation",
      owner: "FullstackAgent",
      decided_by: "SolutionLead",
      reason: "Return only the failing task to implementation",
    },
  })

  const activeState = showState(statePath)
  const featureState = showWorkItemState("feature-402", statePath)
  const board = listTasks("feature-402", statePath)

  assert.equal(result.board.tasks[0].status, "claimed")
  assert.equal(activeState.state.work_item_id, "task-402")
  assert.equal(featureState.state.work_item_id, "feature-402")
  assert.equal(board.tasks[0].status, "claimed")
  assert.equal(featureState.state.current_stage, "full_implementation")
  assert.equal(featureState.state.current_owner, "FullstackAgent")
})

test("explicit release and reassign flows stay scoped to the targeted work item", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-403", "targeted-assignment", statePath)
  selectActiveWorkItem("feature-403", statePath)
  advanceFullWorkItemToPlan(statePath)
  startTask("quick", "TASK-403", "active-quick", "Keep quick item active", statePath)

  createBoardTask(
    "feature-403",
    {
      task_id: "TASK-403A",
      title: "Scoped reassignment",
      summary: "Only mutate target work item assignments",
      kind: "implementation",
      created_by: "SolutionLead",
    },
    statePath,
  )

  claimTask("feature-403", "TASK-403A", "Dev-A", statePath, { requestedBy: "SolutionLead" })
  reassignTask("feature-403", "TASK-403A", "Dev-B", statePath, { requestedBy: "SolutionLead" })
  const releaseResult = releaseTask("feature-403", "TASK-403A", statePath, { requestedBy: "SolutionLead" })

  const activeState = showState(statePath)
  const featureTasks = listTasks("feature-403", statePath)

  assert.equal(activeState.state.work_item_id, "task-403")
  assert.equal(releaseResult.board.tasks[0].status, "ready")
  assert.equal(featureTasks.tasks[0].primary_owner, null)
})
