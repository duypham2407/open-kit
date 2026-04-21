import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    routing_profile: {
      work_intent: "maintenance",
      behavior_delta: "preserve",
      dominant_uncertainty: "low_local",
      scope_shape: "local",
      selection_reason: "Scoped task",
    },
    current_stage: "quick_test",
    status: "in_progress",
    current_owner: "QuickAgent",
    artifacts: {
      task_card: null,
      scope_package: null,
      solution_package: null,
      migration_report: null,
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

function writeManifest(projectRoot, version = "0.3.12") {
  const opencodeDir = path.join(projectRoot, ".opencode")
  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify({
      kit: {
        name: "OpenKit AI Software Factory",
        version,
        entryAgent: "MasterOrchestrator",
      },
    }, null, 2)}\n`,
    "utf8",
  )
}

function writeWorkItemBoard(projectRoot, workItemId, board) {
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "tasks.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
}

function makeFullState(overrides = {}) {
  return {
    feature_id: "FEATURE-700",
    feature_slug: "parallel-runtime-rollout",
    mode: "full",
    mode_reason: "Feature-sized task board rollout",
    routing_profile: {
      work_intent: "feature",
      behavior_delta: "extend",
      dominant_uncertainty: "product",
      scope_shape: "cross_boundary",
      selection_reason: "Feature-sized task board rollout",
    },
    current_stage: "full_implementation",
    status: "in_progress",
    current_owner: "FullstackAgent",
    artifacts: {
      task_card: null,
      scope_package: "docs/scope/2026-03-21-parallel-runtime-rollout.md",
      solution_package: "docs/solution/2026-03-21-parallel-runtime-rollout.md",
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: "approved", approved_by: "ProductLead", approved_at: "2026-03-21", notes: "ok" },
      solution_to_fullstack: { status: "approved", approved_by: "SolutionLead", approved_at: "2026-03-21", notes: "ok" },
      fullstack_to_code_review: { status: "approved", approved_by: "CodeReviewer", approved_at: "2026-03-21", notes: "ok" },
      code_review_to_qa: { status: "approved", approved_by: "QAAgent", approved_at: "2026-03-21", notes: "ok" },
      qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    updated_at: "2026-03-21T00:00:00.000Z",
    work_item_id: "feature-700",
    ...overrides,
  }
}

function writeMetaSkill(projectRoot) {
  const skillDir = path.join(projectRoot, "skills", "using-skills")
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# using-skills\n", "utf8")
}

function makeHookEnv(projectRoot, overrides = {}) {
  const env = { ...process.env }
  delete env.OPENKIT_GLOBAL_MODE
  delete env.OPENKIT_PROJECT_ROOT
  delete env.OPENKIT_REPOSITORY_ROOT
  delete env.OPENKIT_WORKFLOW_STATE
  delete env.OPENKIT_KIT_ROOT
  delete env.OPENCODE_HOME

  return {
    ...env,
    OPENKIT_PROJECT_ROOT: projectRoot,
    OPENKIT_WORKFLOW_STATE: path.join(projectRoot, ".opencode", "workflow-state.json"),
    ...overrides,
  }
}

test("session-start emits mode-aware resume hint for quick tasks", () => {
  const projectRoot = makeTempProject()

  writeManifest(projectRoot)
  writeState(projectRoot, makeQuickState())

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: makeHookEnv(projectRoot, {
      OPENKIT_SESSION_START_NO_SKILL: "1",
    }),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /<openkit_runtime_status>/)
  assert.match(result.stdout, /kit: OpenKit AI Software Factory v0\.3\.12/)
  assert.match(result.stdout, new RegExp(`project root: ${projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
  assert.match(result.stdout, /global kit root: /)
  assert.match(result.stdout, /workspace root: /)
  assert.match(result.stdout, new RegExp(`compatibility shim root: ${path.join(projectRoot, ".opencode").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
  assert.match(result.stdout, new RegExp(`workspace shim root: ${path.join(projectRoot, ".opencode", "openkit").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
  assert.match(result.stdout, /startup skill: skipped/)
  assert.match(result.stdout, /path model: config loads from the global kit root, runtime state lives under the workspace root, and project \.opencode paths are compatibility shims\./)
  assert.match(result.stdout, /node \.opencode\/workflow-state\.js status/)
  assert.match(result.stdout, /node \.opencode\/workflow-state\.js doctor/)
  assert.match(result.stdout, /<workflow_resume_hint>/)
  assert.match(result.stdout, /mode: quick/)
  assert.match(result.stdout, /stage: quick_test/)
  assert.match(result.stdout, /work item: TASK-500 \(quick-copy-fix\)/)
})

test("session-start reports quick_plan as a resumable quick stage", () => {
  const projectRoot = makeTempProject()

  writeManifest(projectRoot)
  writeState(
    projectRoot,
    makeQuickState({
      feature_id: "TASK-502",
      feature_slug: "quick-plan-resume",
      current_stage: "quick_plan",
      current_owner: "QuickAgent",
    }),
  )

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: makeHookEnv(projectRoot, {
      OPENKIT_SESSION_START_NO_SKILL: "1",
    }),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /<workflow_resume_hint>/)
  assert.match(result.stdout, /mode: quick/)
  assert.match(result.stdout, /stage: quick_plan/)
  assert.match(result.stdout, /owner: QuickAgent/)
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
    env: makeHookEnv(projectRoot),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /startup skill: loaded/)
  assert.match(result.stdout, /<skill_system_instruction>/)
})

test("session-start prints canonical resume guidance and inspection commands", () => {
  const projectRoot = makeTempProject()

  writeManifest(projectRoot)
  writeState(
    projectRoot,
    makeQuickState({
      feature_id: "TASK-503",
      feature_slug: "canonical-resume-guidance",
      current_stage: "quick_implement",
      current_owner: "QuickAgent",
    }),
  )

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: makeHookEnv(projectRoot, {
      OPENKIT_SESSION_START_NO_SKILL: "1",
    }),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /help: node \.opencode\/workflow-state\.js status/)
  assert.match(result.stdout, /doctor: node \.opencode\/workflow-state\.js doctor/)
  assert.match(result.stdout, /show: node \.opencode\/workflow-state\.js show/)
  assert.match(result.stdout, /resume: node \.opencode\/workflow-state\.js resume-summary/)
  assert.match(result.stdout, /Read first: AGENTS\.md -> context\/navigation\.md -> context\/core\/workflow\.md -> \.opencode\/workflow-state\.json/)
  assert.match(result.stdout, /Then run `node \.opencode\/workflow-state\.js resume-summary` or load resume guidance from context\/core\/session-resume\.md\./)
})

test("session-start degrades gracefully when the JSON helper fails", () => {
  const projectRoot = makeTempProject()

  const manifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  writeManifest(projectRoot)
  writeState(projectRoot, makeQuickState())
  fs.writeFileSync(manifestPath, '{"kit":', 'utf8')

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: makeHookEnv(projectRoot, {
      OPENKIT_SESSION_START_NO_SKILL: "1",
    }),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /<openkit_runtime_status>/)
  assert.match(result.stdout, /json helper: degraded/)
  assert.doesNotMatch(result.stdout, /<workflow_resume_hint>/)
})

test("session-start emits task-aware resume hint for active full-delivery work", () => {
  const projectRoot = makeTempProject()

  writeManifest(projectRoot)
  writeState(projectRoot, makeFullState())
  writeWorkItemBoard(projectRoot, "feature-700", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-700-A",
        title: "Implement diagnostics",
        summary: "Task-aware summaries",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-A",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ["docs/solution/2026-03-21-parallel-runtime-rollout.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-700-a",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-700-B",
        title: "QA diagnostics",
        summary: "QA active task",
        kind: "qa",
        status: "qa_in_progress",
        primary_owner: "Dev-B",
        qa_owner: "QA-Agent",
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ["docs/solution/2026-03-21-parallel-runtime-rollout.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-700-b",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  const result = spawnSync(path.resolve(__dirname, "../../hooks/session-start"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: makeHookEnv(projectRoot, {
      OPENKIT_SESSION_START_NO_SKILL: "1",
    }),
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /<workflow_resume_hint>/)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_implementation/)
  assert.match(result.stdout, /work item: FEATURE-700 \(parallel-runtime-rollout\)/)
  assert.match(result.stdout, /active work item id: feature-700/)
  assert.match(result.stdout, /task board: 2 tasks \| ready 0 \| active 2/)
  assert.match(result.stdout, /active tasks: TASK-700-A \(in_progress, primary: Dev-A\); TASK-700-B \(qa_in_progress, qa: QA-Agent\)/)
  assert.match(result.stdout, /Parallel task support is not yet assumed safe by this hook; confirm with `node \.opencode\/workflow-state\.js doctor` before relying on it\./)
})
