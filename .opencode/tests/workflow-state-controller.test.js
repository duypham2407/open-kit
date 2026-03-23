const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")

const {
  advanceStage,
  assignQaOwner,
  claimTask,
  createTask: createBoardTask,
  linkArtifact,
  reassignTask,
  releaseTask,
  routeRework,
  setRoutingProfile,
  setTaskStatus,
  showState,
  showWorkItemState,
  selectActiveWorkItem,
  setApproval,
  startFeature,
  startTask,
  validateState,
  validateWorkItemBoard,
} = require("../lib/workflow-state-controller")
const { readWorkItemIndex, readWorkItemState } = require("../lib/work-item-store")

function loadControllerWithWorkItemStoreMocks(mocks) {
  const controllerPath = require.resolve("../lib/workflow-state-controller")
  const workItemStorePath = require.resolve("../lib/work-item-store")
  const originalStore = require(workItemStorePath)
  const patchedStore = { ...originalStore, ...mocks }

  delete require.cache[controllerPath]
  require.cache[workItemStorePath] = {
    id: workItemStorePath,
    filename: workItemStorePath,
    loaded: true,
    exports: patchedStore,
  }

  try {
    return require(controllerPath)
  } finally {
    delete require.cache[controllerPath]
    require.cache[workItemStorePath] = {
      id: workItemStorePath,
      filename: workItemStorePath,
      loaded: true,
      exports: originalStore,
    }
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-state-"))
}

function loadFixtureState() {
  const fixturePath = path.resolve(__dirname, "../workflow-state.json")
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"))
}

function createTempStateFile() {
  const dir = makeTempDir()
  const opencodeDir = path.join(dir, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })
  const statePath = path.join(opencodeDir, "workflow-state.json")
  fs.writeFileSync(statePath, `${JSON.stringify(loadFixtureState(), null, 2)}\n`, "utf8")
  return statePath
}

function createTask(overrides = {}) {
  return {
    task_id: "TASK-1",
    title: "Implement controller integration",
    summary: "Add board-aware runtime enforcement",
    kind: "implementation",
    status: "ready",
    primary_owner: null,
    qa_owner: null,
    depends_on: [],
    blocked_by: [],
    artifact_refs: [],
    plan_refs: ["docs/plans/2026-03-21-feature.md"],
    branch_or_worktree: null,
    created_by: "TechLeadAgent",
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
  return boardPath
}

function advanceFullWorkItemToPlan(statePath) {
  advanceStage("full_brief", statePath)
  setApproval("pm_to_ba", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_spec", statePath)
  setApproval("ba_to_architect", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_architecture", statePath)
  setApproval("architect_to_tech_lead", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_plan", statePath)
}

test("validateState accepts the shipped hard-split example state", () => {
  const statePath = path.resolve(__dirname, "../workflow-state.json")
  const result = validateState(statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_done")
})

test("startTask initializes quick mode with quick-only approvals", () => {
  const statePath = createTempStateFile()
  const result = startTask("quick", "TASK-123", "update-copy", "Scoped text change", statePath)

  assert.equal(result.state.mode, "quick")
  assert.equal(result.state.mode_reason, "Scoped text change")
  assert.equal(result.state.current_stage, "quick_intake")
  assert.equal(result.state.current_owner, "MasterOrchestrator")
  assert.deepEqual(result.state.routing_profile, {
    work_intent: "maintenance",
    behavior_delta: "preserve",
    dominant_uncertainty: "low_local",
    scope_shape: "local",
    selection_reason: "Scoped text change",
  })
  assert.deepEqual(Object.keys(result.state.approvals), ["quick_verified"])
  assert.equal(result.state.artifacts.task_card, null)
  assert.equal(result.state.escalated_from, null)
  assert.equal(result.state.escalation_reason, null)
})

test("quick mode requires quick_plan before quick_build", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-129", "needs-plan", "Bounded quick work", statePath)

  assert.throws(() => advanceStage("quick_build", statePath), /immediate next stage 'quick_plan'/)
})

test("quick_plan becomes the next stage after quick_intake", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-130", "plan-stage", "Live quick plan stage", statePath)
  const result = advanceStage("quick_plan", statePath)

  assert.equal(result.state.current_stage, "quick_plan")
  assert.equal(result.state.current_owner, "MasterOrchestrator")
})

test("quick_done requires quick_verified approval", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-124", "verify-copy", "Copy verification task", statePath)
  advanceStage("quick_plan", statePath)
  advanceStage("quick_build", statePath)
  advanceStage("quick_verify", statePath)

  assert.throws(() => advanceStage("quick_done", statePath), /quick_verified/)

  setApproval("quick_verified", "approved", "system", "2026-03-21", "QA Lite passed", statePath)
  const result = advanceStage("quick_done", statePath)

  assert.equal(result.state.current_stage, "quick_done")
  assert.equal(result.state.status, "done")
})

test("linkArtifact supports quick task cards", () => {
  const statePath = createTempStateFile()
  const dir = makeTempDir()
  const taskCardPath = path.join(dir, "2026-03-21-update-copy.md")

  fs.writeFileSync(taskCardPath, "# Quick Task\n", "utf8")
  startTask("quick", "TASK-125", "task-card", "Quick task artifact link", statePath)

  const result = linkArtifact("task_card", taskCardPath, statePath)

  assert.equal(result.state.artifacts.task_card, taskCardPath)
})

test("routeRework escalates quick design flaws into full delivery", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-126", "needs-spec", "Started as a quick task", statePath)
  const result = routeRework("design_flaw", false, statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.equal(result.state.current_owner, "MasterOrchestrator")
  assert.equal(result.state.escalated_from, "quick")
  assert.match(result.state.escalation_reason, /design_flaw/)
  assert.deepEqual(Object.keys(result.state.approvals), [
    "pm_to_ba",
    "ba_to_architect",
    "architect_to_tech_lead",
    "tech_lead_to_fullstack",
    "fullstack_to_qa",
    "qa_to_done",
  ])
})

test("routeRework keeps full-mode bugs in full implementation", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-200", "dashboard-v2", "Feature-sized workflow", statePath)
  const result = routeRework("bug", true, statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_implementation")
  assert.equal(result.state.current_owner, "FullstackAgent")
  assert.equal(result.state.retry_count, 1)
})

test("startTask initializes migration mode with migration approvals", () => {
  const statePath = createTempStateFile()
  const result = startTask("migration", "MIGRATE-100", "react-19-upgrade", "Upgrade React stack safely", statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_intake")
  assert.equal(result.state.current_owner, "MasterOrchestrator")
  assert.deepEqual(result.state.routing_profile, {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "Upgrade React stack safely",
  })
  assert.deepEqual(Object.keys(result.state.approvals), [
    "baseline_to_strategy",
    "strategy_to_upgrade",
    "upgrade_to_verify",
    "migration_verified",
  ])
})

test("migration mode advances through its canonical stage chain", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-101", "legacy-refresh", "Legacy stack refresh", statePath)

  let result = advanceStage("migration_baseline", statePath)
  assert.equal(result.state.current_owner, "ArchitectAgent")

  setApproval("baseline_to_strategy", "approved", "TechLeadAgent", "2026-03-21", "Baseline approved", statePath)
  result = advanceStage("migration_strategy", statePath)
  assert.equal(result.state.current_owner, "TechLeadAgent")

  setApproval("strategy_to_upgrade", "approved", "FullstackAgent", "2026-03-21", "Strategy approved", statePath)
  result = advanceStage("migration_upgrade", statePath)
  assert.equal(result.state.current_owner, "FullstackAgent")

  setApproval("upgrade_to_verify", "approved", "QAAgent", "2026-03-21", "Upgrade ready for QA", statePath)
  result = advanceStage("migration_verify", statePath)
  assert.equal(result.state.current_owner, "QAAgent")

  setApproval("migration_verified", "approved", "QAAgent", "2026-03-21", "Migration verified", statePath)
  result = advanceStage("migration_done", statePath)
  assert.equal(result.state.current_stage, "migration_done")
  assert.equal(result.state.status, "done")
})

test("migration design flaws reroute within migration strategy", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-102", "upgrade-routing", "Upgrade routing", statePath)
  const result = routeRework("design_flaw", false, statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_strategy")
  assert.equal(result.state.current_owner, "TechLeadAgent")
})

test("migration requirement gaps escalate into full delivery", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-103", "upgrade-requirements", "Upgrade with requirement ambiguity", statePath)
  const result = routeRework("requirement_gap", false, statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.equal(result.state.escalated_from, "migration")
  assert.match(result.state.mode_reason, /Promoted from migration mode/)
  assert.match(result.state.escalation_reason, /migration work escalated/i)
  assert.equal(result.state.routing_profile.dominant_uncertainty, "product")
})

test("routeRework blocks after reaching the retry threshold", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-203", "retry-threshold", "Feature workflow with repeated bug", statePath)
  routeRework("bug", true, statePath)
  routeRework("bug", true, statePath)
  const result = routeRework("bug", true, statePath)

  assert.equal(result.state.retry_count, 3)
  assert.equal(result.state.status, "blocked")
  assert.equal(result.state.current_stage, "full_implementation")
})

test("quick mode rejects full-delivery approvals", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-127", "bad-gate", "Quick workflow gate validation", statePath)

  assert.throws(
    () => setApproval("pm_to_ba", "approved", "user", "2026-03-21", "Wrong gate", statePath),
    /mode 'quick'/,
  )
})

test("quick mode rejects skipping stages", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-128", "skip-stage", "Quick stage ordering", statePath)

  assert.throws(() => advanceStage("quick_verify", statePath), /immediate next stage 'quick_plan'/)
})

test("full mode rejects quick stages", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-201", "wrong-lane-stage", "Full workflow stage validation", statePath)

  assert.throws(() => advanceStage("quick_build", statePath), /does not belong to mode 'full'/)
})

test("setRoutingProfile rejects contradictory routing metadata for quick mode", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-777", "routing-conflict", "Quick routing profile", statePath)

  assert.throws(
    () => setRoutingProfile("modernization", "preserve", "compatibility", "adjacent", "Actually a migration", statePath),
    /routing_profile\.work_intent must be 'maintenance' for quick mode/,
  )
})

test("compatibility startFeature initializes full mode", () => {
  const statePath = createTempStateFile()

  const result = startFeature("FEATURE-202", "compat-start", statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.match(result.state.mode_reason, /legacy start-feature command/)
})

test("legacy startTask creates and selects the active work item through backing storage", () => {
  const statePath = createTempStateFile()

  const result = startTask("quick", "TASK-123", "update-copy", "Scoped text change", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const index = readWorkItemIndex(projectRoot)
  const persistedState = readWorkItemState(projectRoot, "task-123")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "task-123")
  assert.equal(index.active_work_item_id, "task-123")
  assert.equal(index.work_items.at(-1).work_item_id, "task-123")
  assert.equal(persistedState.work_item_id, "task-123")
  assert.equal(persistedState.feature_id, "TASK-123")
  assert.deepEqual(mirrorState, persistedState)
})

test("legacy startTask full creates and selects the active full-delivery work item through backing storage", () => {
  const statePath = createTempStateFile()

  const result = startTask("full", "FEATURE-303", "legacy-full", "Legacy full start-task command", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const index = readWorkItemIndex(projectRoot)
  const persistedState = readWorkItemState(projectRoot, "feature-303")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "feature-303")
  assert.equal(result.state.mode, "full")
  assert.equal(index.active_work_item_id, "feature-303")
  assert.equal(index.work_items.at(-1).work_item_id, "feature-303")
  assert.equal(persistedState.work_item_id, "feature-303")
  assert.equal(persistedState.feature_id, "FEATURE-303")
  assert.deepEqual(mirrorState, persistedState)
})

test("startTask builds a fresh work item state without leaking unrelated active-item metadata", () => {
  const statePath = createTempStateFile()
  const activeState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  activeState.unrelated_runtime_note = "should-not-leak"
  fs.writeFileSync(statePath, `${JSON.stringify(activeState, null, 2)}\n`, "utf8")

  startFeature("FEATURE-202", "compat-start", statePath)
  const result = startTask("quick", "TASK-124", "fresh-shape", "Fresh quick task", statePath)

  assert.equal(Object.hasOwn(result.state, "unrelated_runtime_note"), false)
  assert.equal(result.state.mode, "quick")
  assert.deepEqual(result.state.issues, [])
})

test("legacy startFeature creates and selects the active work item through backing storage", () => {
  const statePath = createTempStateFile()

  const result = startFeature("FEATURE-202", "compat-start", statePath)
  const projectRoot = path.dirname(path.dirname(statePath))
  const index = readWorkItemIndex(projectRoot)
  const persistedState = readWorkItemState(projectRoot, "feature-202")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "feature-202")
  assert.equal(index.active_work_item_id, "feature-202")
  assert.equal(index.work_items.at(-1).work_item_id, "feature-202")
  assert.equal(persistedState.work_item_id, "feature-202")
  assert.equal(persistedState.feature_id, "FEATURE-202")
  assert.deepEqual(mirrorState, persistedState)
})

test("showState reads the active work item through backing storage", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const result = showState(statePath)

  assert.equal(result.state.work_item_id, "task-500")
  assert.equal(result.state.feature_id, "TASK-500")
  assert.equal(result.state.current_stage, "quick_intake")
})

test("showWorkItemState reads a non-active work item without changing selection", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const result = showWorkItemState("feature-202", statePath)
  const index = readWorkItemIndex(projectRoot)

  assert.equal(result.state.work_item_id, "feature-202")
  assert.equal(result.state.feature_id, "FEATURE-202")
  assert.equal(index.active_work_item_id, "task-500")
})

test("selectActiveWorkItem refreshes the compatibility mirror after changing the backing-store selection", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const result = selectActiveWorkItem("feature-202", statePath)
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(result.state.work_item_id, "feature-202")
  assert.equal(mirrorState.work_item_id, "feature-202")
  assert.equal(mirrorState.feature_id, "FEATURE-202")
})

test("selectActiveWorkItem restores the previous active pointer when mirror write fails", () => {
  const statePath = createTempStateFile()
  const projectRoot = path.dirname(path.dirname(statePath))

  startFeature("FEATURE-202", "compat-start", statePath)
  startTask("quick", "TASK-500", "selected-item", "Switch active item", statePath)

  const originalStore = require("../lib/work-item-store")
  const controller = loadControllerWithWorkItemStoreMocks({
    writeCompatibilityMirror() {
      throw new Error("Simulated selection mirror failure")
    },
  })

  assert.throws(() => controller.selectActiveWorkItem("feature-202", statePath), /mirror/i)

  const index = originalStore.readWorkItemIndex(projectRoot)
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(index.active_work_item_id, "task-500")
  assert.equal(mirrorState.work_item_id, "task-500")
})

test("approving tech_lead_to_fullstack without a valid task board fails", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-600", "board-gate", statePath)
  advanceFullWorkItemToPlan(statePath)

  assert.throws(
    () => setApproval("tech_lead_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath),
    /valid task board|tasks\.json/,
  )
})

test("approving tech_lead_to_fullstack succeeds with a valid initial full_plan task board", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-601", "board-gate-pass", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-601", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [createTask({ status: "queued" }), createTask({ task_id: "TASK-2", title: "Queued follow-up", status: "queued" })],
    issues: [],
  })

  const result = setApproval("tech_lead_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)

  assert.equal(result.state.approvals.tech_lead_to_fullstack.status, "approved")
})

test("advancing full_plan to full_implementation without a valid task board fails", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-602", "missing-board", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-602", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("tech_lead_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  writeTaskBoard(statePath, "feature-602", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [],
    issues: [],
  })

  assert.throws(() => advanceStage("full_implementation", statePath), /task board must include at least one task/)
})

test("advancing full_implementation to full_qa fails when task board has incomplete implementation work", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-603", "qa-handoff", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-603", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [createTask({ status: "in_progress", primary_owner: "DevA" })],
    issues: [],
  })
  setApproval("tech_lead_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)
  advanceStage("full_implementation", statePath)
  setApproval("fullstack_to_qa", "approved", "system", "2026-03-21", "Ready for QA", statePath)

  assert.throws(() => advanceStage("full_qa", statePath), /full_qa/)
})

test("quick mode state with tasks.json present is rejected at controller validation time", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-700", "stale-board", "Quick task should reject task boards", statePath)
  writeTaskBoard(statePath, "task-700", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [createTask()],
    issues: [],
  })

  assert.throws(() => validateState(statePath), /Quick mode cannot carry a task board/)
  assert.throws(() => showState(statePath), /Quick mode cannot carry a task board/)
})

test("migration mode state with tasks.json present is rejected at controller validation time", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-700", "stale-board", "Migration should reject task boards", statePath)
  writeTaskBoard(statePath, "migrate-700", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [createTask()],
    issues: [],
  })

  assert.throws(() => validateState(statePath), /Migration mode cannot carry a task board/)
  assert.throws(() => showState(statePath), /Migration mode cannot carry a task board/)
})

test("valid full-delivery task board passes implementation and QA stage enforcement", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-604", "valid-board", statePath)
  advanceFullWorkItemToPlan(statePath)
  writeTaskBoard(statePath, "feature-604", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [createTask({ status: "ready" })],
    issues: [],
  })
  setApproval("tech_lead_to_fullstack", "approved", "user", "2026-03-21", "Approved", statePath)

  let result = advanceStage("full_implementation", statePath)
  assert.equal(result.state.current_stage, "full_implementation")

  writeTaskBoard(statePath, "feature-604", {
    mode: "full",
    current_stage: "full_qa",
    tasks: [createTask({ status: "qa_ready", primary_owner: "DevA", qa_owner: "QAAgent" })],
    issues: [],
  })
  setApproval("fullstack_to_qa", "approved", "system", "2026-03-21", "Ready for QA", statePath)

  result = advanceStage("full_qa", statePath)
  assert.equal(result.state.current_stage, "full_qa")
})

test("claimTask rejects implicit reassignment and requires explicit reassignTask flow", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-605", "assignment-safety", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-605",
    {
      task_id: "TASK-605",
      title: "Safe assignment",
      summary: "Reject unauthorized reassignment",
      kind: "implementation",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  claimTask("feature-605", "TASK-605", "Dev-A", statePath, { requestedBy: "TechLeadAgent" })

  assert.throws(
    () => claimTask("feature-605", "TASK-605", "Dev-B", statePath, { requestedBy: "TechLeadAgent" }),
    /Implicit reassignment is not allowed; use reassignTask/,
  )
})

test("reassignTask enforces authority and updates the claimed owner explicitly", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-609", "explicit-reassign", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-609",
    {
      task_id: "TASK-609",
      title: "Explicit reassignment",
      summary: "Use explicit reassignment flow",
      kind: "implementation",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  claimTask("feature-609", "TASK-609", "Dev-A", statePath, { requestedBy: "TechLeadAgent" })

  assert.throws(
    () => reassignTask("feature-609", "TASK-609", "Dev-B", statePath, { requestedBy: "QAAgent" }),
    /Only MasterOrchestrator or TechLeadAgent can reassign primary_owner/,
  )

  const result = reassignTask("feature-609", "TASK-609", "Dev-B", statePath, { requestedBy: "TechLeadAgent" })

  assert.equal(result.board.tasks[0].primary_owner, "Dev-B")
  assert.equal(result.board.tasks[0].status, "claimed")
})

test("releaseTask enforces authority and clears claimed ownership explicitly", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-610", "explicit-release", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-610",
    {
      task_id: "TASK-610",
      title: "Explicit release",
      summary: "Use explicit release flow",
      kind: "implementation",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  claimTask("feature-610", "TASK-610", "Dev-A", statePath, { requestedBy: "TechLeadAgent" })

  assert.throws(
    () => releaseTask("feature-610", "TASK-610", statePath, { requestedBy: "QAAgent" }),
    /Only MasterOrchestrator or TechLeadAgent can release primary_owner/,
  )

  const result = releaseTask("feature-610", "TASK-610", statePath, { requestedBy: "TechLeadAgent" })

  assert.equal(result.board.tasks[0].primary_owner, null)
  assert.equal(result.board.tasks[0].status, "ready")
})

test("releaseTask allows the current task owner to release their claimed task", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-612", "owner-release", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-612",
    {
      task_id: "TASK-612",
      title: "Owner release",
      summary: "Current owner can explicitly release task",
      kind: "implementation",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  claimTask("feature-612", "TASK-612", "Dev-A", statePath, { requestedBy: "TechLeadAgent" })

  const result = releaseTask("feature-612", "TASK-612", statePath, { requestedBy: "Dev-A" })

  assert.equal(result.board.tasks[0].primary_owner, null)
  assert.equal(result.board.tasks[0].status, "ready")
})

test("assignQaOwner rejects reassignment from the wrong authority", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-606", "qa-assignment-safety", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-606",
    {
      task_id: "TASK-606",
      title: "Safe QA assignment",
      summary: "Reject unauthorized QA reassignment",
      kind: "implementation",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  claimTask("feature-606", "TASK-606", "Dev-A", statePath, { requestedBy: "TechLeadAgent" })
  setTaskStatus("feature-606", "TASK-606", "in_progress", statePath)
  setTaskStatus("feature-606", "TASK-606", "dev_done", statePath)
  assignQaOwner("feature-606", "TASK-606", "QA-Agent", statePath, { requestedBy: "TechLeadAgent" })

  assert.throws(
    () => assignQaOwner("feature-606", "TASK-606", "QA-Agent-2", statePath, { requestedBy: "QAAgent" }),
    /Only MasterOrchestrator or TechLeadAgent can reassign qa_owner/,
  )
})

test("setTaskStatus rejects QA-fail local rework without a task-scoped finding and reroute decision", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-607", "qa-fail-guardrails", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-607",
    {
      task_id: "TASK-607",
      title: "QA fail guardrails",
      summary: "Require local rework metadata",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  assert.throws(
    () => setTaskStatus("feature-607", "TASK-607", "claimed", statePath, { requestedBy: "QAAgent" }),
    /task-scoped finding/,
  )

  assert.throws(
    () =>
      setTaskStatus("feature-607", "TASK-607", "claimed", statePath, {
        requestedBy: "QAAgent",
        finding: {
          issue_id: "ISSUE-607",
          task_id: "TASK-607",
          title: "Regression found",
          summary: "Fix one task-local bug",
          type: "bug",
          severity: "medium",
          rooted_in: "implementation",
          recommended_owner: "FullstackAgent",
          evidence: "Targeted QA reproduction",
          artifact_refs: ["docs/qa/2026-03-21-feature-607.md"],
          affects_tasks: ["TASK-607"],
          blocks_parallel_work: false,
        },
      }),
    /rerouteDecision/,
  )
})

test("QA-fail local rework applies the reroute decision to work-item runtime state", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-611", "qa-reroute-applied", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-611",
    {
      task_id: "TASK-611",
      title: "Apply reroute decision",
      summary: "Persist QA local rework route",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  const result = setTaskStatus("feature-611", "TASK-611", "claimed", statePath, {
    requestedBy: "QAAgent",
    finding: {
      issue_id: "ISSUE-611",
      task_id: "TASK-611",
      title: "Regression found",
      summary: "Fix one task-local bug",
      type: "bug",
      severity: "medium",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "Targeted QA reproduction",
      artifact_refs: ["docs/qa/2026-03-21-feature-611.md"],
      affects_tasks: ["TASK-611"],
      blocks_parallel_work: false,
    },
    rerouteDecision: {
      stage: "full_implementation",
      owner: "FullstackAgent",
      decided_by: "TechLeadAgent",
      reason: "Return only the failing task to implementation",
    },
  })

  assert.equal(result.state.current_stage, "full_implementation")
  assert.equal(result.state.current_owner, "FullstackAgent")
  assert.equal(result.state.status, "in_progress")
  assert.equal(result.board.tasks[0].status, "claimed")
})

test("QA-fail local rework rejects invalid reroute decisions atomically before any task write", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-613", "atomic-qa-reroute", statePath)
  advanceFullWorkItemToPlan(statePath)
  createBoardTask(
    "feature-613",
    {
      task_id: "TASK-613",
      title: "Atomic QA reroute",
      summary: "Invalid reroute must not partially mutate task",
      kind: "implementation",
      status: "qa_in_progress",
      primary_owner: "Dev-A",
      qa_owner: "QA-Agent",
      created_by: "TechLeadAgent",
    },
    statePath,
  )

  assert.throws(
    () =>
      setTaskStatus("feature-613", "TASK-613", "claimed", statePath, {
        requestedBy: "QAAgent",
        finding: {
          issue_id: "ISSUE-613",
          task_id: "TASK-613",
          title: "Regression found",
          summary: "Fix one task-local bug",
          type: "bug",
          severity: "medium",
          rooted_in: "implementation",
          recommended_owner: "FullstackAgent",
          evidence: "Targeted QA reproduction",
          artifact_refs: ["docs/qa/2026-03-21-feature-613.md"],
          affects_tasks: ["TASK-613"],
          blocks_parallel_work: false,
        },
        rerouteDecision: {
          stage: "full_done",
          owner: "MasterOrchestrator",
          decided_by: "TechLeadAgent",
          reason: "Invalid reroute target",
        },
      }),
    /field 'stage'/,
  )

  const workItem = validateWorkItemBoard("feature-613", statePath)
  assert.equal(workItem.state.current_stage, "full_plan")
  assert.equal(workItem.state.current_owner, "TechLeadAgent")
  assert.equal(workItem.board.tasks[0].status, "qa_in_progress")
  assert.equal(workItem.board.tasks[0].primary_owner, "Dev-A")
})

test("createTask rejects invalid parallel worktree metadata", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-608", "invalid-worktree-metadata", statePath)
  advanceFullWorkItemToPlan(statePath)

  assert.throws(
    () =>
      createBoardTask(
        "feature-608",
        {
          task_id: "TASK-608",
          title: "Parallel worktree metadata",
          summary: "Reject invalid protected branch metadata",
          kind: "implementation",
          created_by: "TechLeadAgent",
          worktree_metadata: {
            task_id: "TASK-608",
            branch: "main",
            worktree_path: ".worktrees/task-608-parallel",
          },
        },
        statePath,
      ),
    /must not target main/,
  )
})

test("createTask rejects task-board creation before full_plan", () => {
  const statePath = createTempStateFile()

  startFeature("FEATURE-614", "board-stage-gate", statePath)

  assert.throws(
    () =>
      createBoardTask(
        "feature-614",
        {
          task_id: "TASK-614",
          title: "Too early task board",
          summary: "Task boards should wait until planning",
          kind: "implementation",
          created_by: "TechLeadAgent",
        },
        statePath,
      ),
    /full_plan/,
  )
})

test("startTask rejects stale overwrites when an existing work item changes between guarded reads", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-800", "stale-write", "Guard controller mutation paths", statePath)

  const originalStore = require("../lib/work-item-store")
  let readCount = 0
  const controller = loadControllerWithWorkItemStoreMocks({
    readWorkItemState(projectRoot, workItemId) {
      const state = originalStore.readWorkItemState(projectRoot, workItemId)
      if (workItemId === "task-800") {
        readCount += 1
        if (readCount === 2) {
          originalStore.writeWorkItemState(projectRoot, workItemId, {
            ...state,
            status: "blocked",
            updated_at: "2026-03-21T01:00:00.000Z",
          })
          return originalStore.readWorkItemState(projectRoot, workItemId)
        }
      }
      return state
    },
  })

  assert.throws(
    () => controller.startTask("quick", "TASK-800", "stale-write", "Guard controller mutation paths", statePath),
    (error) => error.code === "STALE_WRITE" && /expected revision/i.test(error.message),
  )

  const persistedState = showState(statePath).state
  assert.equal(persistedState.status, "blocked")
  assert.equal(persistedState.current_stage, "quick_intake")
})

test("controller rolls back active-item writes when mirror refresh fails after the primary state write", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-801", "mirror-stale", "Guard mirror refresh ordering", statePath)

  const originalStore = require("../lib/work-item-store")
  let observedPrimaryWriteBeforeMirrorFailure = false
  const controller = loadControllerWithWorkItemStoreMocks({
    writeCompatibilityMirror(projectRoot) {
      const activeState = originalStore.readWorkItemState(projectRoot, "task-801")
      observedPrimaryWriteBeforeMirrorFailure ||= activeState.current_stage === "quick_plan"
      throw new Error("Simulated mirror write failure")
    },
  })

  assert.throws(() => controller.advanceStage("quick_plan", statePath), /mirror/i)

  assert.equal(observedPrimaryWriteBeforeMirrorFailure, true)

  const persistedState = originalStore.readWorkItemState(path.dirname(path.dirname(statePath)), "task-801")
  assert.equal(persistedState.current_stage, "quick_intake")

  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  assert.equal(mirrorState.current_stage, "quick_intake")
})

test("controller restores primary and mirror state when index write fails late", () => {
  const statePath = createTempStateFile()
  startTask("quick", "TASK-802", "index-rollback", "Guard late index failures", statePath)

  const projectRoot = path.dirname(path.dirname(statePath))
  const originalStore = require("../lib/work-item-store")
  let observedMirrorWriteBeforeIndexFailure = false
  const controller = loadControllerWithWorkItemStoreMocks({
    writeWorkItemIndex(root, index) {
      observedMirrorWriteBeforeIndexFailure = Boolean(index.active_work_item_id)
      throw new Error("Simulated index write failure")
    },
  })

  assert.throws(() => controller.advanceStage("quick_plan", statePath), /index write failure/)

  assert.equal(observedMirrorWriteBeforeIndexFailure, true)

  const persistedState = originalStore.readWorkItemState(projectRoot, "task-802")
  const mirrorState = JSON.parse(fs.readFileSync(statePath, "utf8"))

  assert.equal(persistedState.current_stage, "quick_intake")
  assert.equal(mirrorState.current_stage, "quick_intake")
})
