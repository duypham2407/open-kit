const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-session-hook-"))
}

function writeState(projectRoot, state) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.writeFileSync(path.join(opencodeDir, "workflow-state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

function makeQuickState(overrides = {}) {
  return {
    feature_id: "TASK-500",
    feature_slug: "quick-copy-fix",
    mode: "quick",
    mode_reason: "Scoped task",
    current_stage: "quick_verify",
    status: "in_progress",
    current_owner: "QAAgent",
    artifacts: {
      task_card: null,
      brief: null,
      spec: null,
      architecture: null,
      plan: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      quick_verified: {
        status: "pending",
        approved_by: null,
        approved_at: null,
        notes: null,
      },
    },
    issues: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: "2026-03-21T00:00:00.000Z",
    ...overrides,
  }
}

function writeManifest(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify({
      kit: {
        name: "OpenKit AI Software Factory",
        version: "0.1.0",
        entryAgent: "MasterOrchestrator",
      },
    }, null, 2)}\n`,
    "utf8",
  )
}

function writeMetaSkill(projectRoot) {
  const skillDir = path.join(projectRoot, "skills", "using-skills")
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# using-skills\n", "utf8")
}

test("session-start emits mode-aware resume hint for quick tasks", () => {
  const projectRoot = makeTempProject()

  writeManifest(projectRoot)
  writeState(projectRoot, makeQuickState())

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
  assert.match(result.stdout, /<openkit_runtime_status>/)
  assert.match(result.stdout, /kit: OpenKit AI Software Factory v0\.1\.0/)
  assert.match(result.stdout, /startup skill: skipped/)
  assert.match(result.stdout, /node \.opencode\/workflow-state\.js status/)
  assert.match(result.stdout, /node \.opencode\/workflow-state\.js doctor/)
  assert.match(result.stdout, /<workflow_resume_hint>/)
  assert.match(result.stdout, /mode: quick/)
  assert.match(result.stdout, /stage: quick_verify/)
  assert.match(result.stdout, /work item: TASK-500 \(quick-copy-fix\)/)
})

test("session-start reports loaded startup skill when meta-skill exists", () => {
  const projectRoot = makeTempProject()

  writeManifest(projectRoot)
  writeMetaSkill(projectRoot)
  writeState(
    projectRoot,
    makeQuickState({
      feature_id: "TASK-501",
      feature_slug: "loaded-skill",
      current_stage: "quick_intake",
      current_owner: "MasterOrchestrator",
    }),
  )

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENKIT_PROJECT_ROOT: projectRoot,
      OPENKIT_WORKFLOW_STATE: path.join(projectRoot, ".opencode", "workflow-state.json"),
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /startup skill: loaded/)
  assert.match(result.stdout, /<skill_system_instruction>/)
})
