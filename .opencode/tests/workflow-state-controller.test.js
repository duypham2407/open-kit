const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")

const {
  advanceStage,
  linkArtifact,
  routeRework,
  setApproval,
  startFeature,
  startTask,
  validateState,
} = require("../lib/workflow-state-controller")

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-state-"))
}

function loadFixtureState() {
  const fixturePath = path.resolve(__dirname, "../workflow-state.json")
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"))
}

function createTempStateFile() {
  const dir = makeTempDir()
  const statePath = path.join(dir, "workflow-state.json")
  fs.writeFileSync(statePath, `${JSON.stringify(loadFixtureState(), null, 2)}\n`, "utf8")
  return statePath
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

test("compatibility startFeature initializes full mode", () => {
  const statePath = createTempStateFile()

  const result = startFeature("FEATURE-202", "compat-start", statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.match(result.state.mode_reason, /legacy start-feature command/)
})
