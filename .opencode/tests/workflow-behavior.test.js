const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const {
  advanceStage,
  routeRework,
  startTask,
  validateState,
} = require("../lib/workflow-state-controller")

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-behavior-"))
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

function writeManifest(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify({
      kit: {
        name: "OpenKit AI Software Factory",
        version: "0.3.12",
        entryAgent: "MasterOrchestrator",
      },
    }, null, 2)}\n`,
    "utf8",
  )
}

test("quick requirement gaps stay in quick mode and report to user", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-300", "needs-clarification", "Started as a bounded quick task", statePath)
  const result = routeRework("requirement_gap", false, statePath)

  // Quick Agent does not auto-escalate requirement gaps; it reports to user and stays in quick_test
  assert.equal(result.state.mode, "quick")
  assert.equal(result.state.current_stage, "quick_test")
  assert.equal(result.state.current_owner, "QuickAgent")
  assert.equal(result.state.escalated_from, null)
  assert.equal(Object.hasOwn(result.state.approvals, "quick_verified"), true)
})

test("quick stage advancement preserves the canonical owner chain", () => {
  const statePath = createTempStateFile()

  startTask("quick", "TASK-301", "owner-chain", "Follow quick-stage ownership", statePath)
  let result = validateState(statePath)
  assert.equal(result.state.current_stage, "quick_intake")
  assert.equal(result.state.current_owner, "QuickAgent")

  result = advanceStage("quick_brainstorm", statePath)
  assert.equal(result.state.current_stage, "quick_brainstorm")
  assert.equal(result.state.current_owner, "QuickAgent")

  result = advanceStage("quick_plan", statePath)
  assert.equal(result.state.current_stage, "quick_plan")
  assert.equal(result.state.current_owner, "QuickAgent")

  result = advanceStage("quick_implement", statePath)
  assert.equal(result.state.current_stage, "quick_implement")
  assert.equal(result.state.current_owner, "QuickAgent")

  result = advanceStage("quick_test", statePath)
  assert.equal(result.state.current_stage, "quick_test")
  assert.equal(result.state.current_owner, "QuickAgent")
})

test("full workflows start in full_intake with full-mode state", () => {
  const statePath = createTempStateFile()

  startTask("full", "FEATURE-301", "full-workflow", "Feature-sized workflow", statePath)
  const result = validateState(statePath)

  assert.equal(result.state.mode, "full")
  assert.equal(result.state.current_stage, "full_intake")
  assert.notEqual(result.state.current_stage, "quick_intake")
  assert.equal(result.state.escalated_from, null)
})

test("migration workflows start in migration_intake with migration-mode state", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-301", "react-refresh", "Framework upgrade workflow", statePath)
  const result = validateState(statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_intake")
  assert.notEqual(result.state.current_stage, "quick_intake")
  assert.notEqual(result.state.current_stage, "full_intake")
  assert.equal(result.state.escalated_from, null)
  assert.equal(result.state.lane_source, "orchestrator_routed")
  assert.deepEqual(result.state.migration_context, {
    baseline_summary: null,
    target_outcome: null,
    preserved_invariants: [],
    allowed_behavior_changes: [],
    compatibility_hotspots: [],
    baseline_evidence_refs: [],
    rollback_checkpoints: [],
  })
})

test("migration requirement gaps stay in migration when lane_source is user_explicit", () => {
  const statePath = createTempStateFile()

  startTask("migration", "MIGRATE-302", "explicit-migrate", "User-selected migration lane", statePath)
  const opencodeDir = path.dirname(statePath)
  const workItemStatePath = path.join(opencodeDir, "work-items", "migrate-302", "state.json")
  const state = JSON.parse(fs.readFileSync(workItemStatePath, "utf8"))
  state.lane_source = "user_explicit"
  state.current_stage = "migration_verify"
  state.current_owner = "QAAgent"
  state.verification_evidence.push({
    id: "migration-review-proof",
    kind: "review",
    scope: "migration_code_review",
    summary: "Migration review completed before requirement gap surfaced",
    source: "migration-review",
    command: null,
    exit_status: null,
    artifact_refs: [],
    recorded_at: "2026-03-21T00:00:00.000Z",
  })
  fs.writeFileSync(workItemStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = routeRework("requirement_gap", false, statePath)

  assert.equal(result.state.mode, "migration")
  assert.equal(result.state.current_stage, "migration_verify")
  assert.equal(result.state.current_owner, "QAAgent")
  assert.equal(result.state.status, "blocked")
  assert.equal(result.state.escalated_from, null)
})

test("session-start resume hints stay aligned with full stage names", () => {
  const projectRoot = makeTempDir()
  const opencodeDir = path.join(projectRoot, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })
  writeManifest(projectRoot)

  const state = loadFixtureState()
  state.feature_id = "FEATURE-302"
  state.feature_slug = "full-qa-resume"
  state.mode = "full"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "full qa resume",
  }
  state.current_stage = "full_qa"
  state.current_owner = "QAAgent"
  state.status = "in_progress"
  fs.writeFileSync(path.join(opencodeDir, "workflow-state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENKIT_PROJECT_ROOT: projectRoot,
      OPENKIT_SESSION_START_NO_SKILL: "1",
      OPENKIT_WORKFLOW_STATE: path.join(projectRoot, ".opencode", "workflow-state.json"),
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_qa/)
  assert.match(result.stdout, /owner: QAAgent/)
  assert.match(result.stdout, /work item: FEATURE-302 \(full-qa-resume\)/)
})
