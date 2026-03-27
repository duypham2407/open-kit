const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const { scaffoldAndLinkArtifact } = require("../lib/workflow-state-controller")

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-artifact-scaffold-"))
}

function setupTempRuntime(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const templatesDir = path.join(projectRoot, "docs", "templates")
  const tasksDir = path.join(projectRoot, "docs", "tasks")
  const plansDir = path.join(projectRoot, "docs", "plans")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })
  fs.mkdirSync(tasksDir, { recursive: true })
  fs.mkdirSync(plansDir, { recursive: true })

  const fixtureState = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../workflow-state.json"), "utf8"),
  )
  fixtureState.feature_id = "TASK-700"
  fixtureState.feature_slug = "scaffold-target"
  fixtureState.mode = "quick"
  fixtureState.mode_reason = "Scaffold testing"
  fixtureState.routing_profile = {
    work_intent: "maintenance",
    behavior_delta: "preserve",
    dominant_uncertainty: "low_local",
    scope_shape: "local",
    selection_reason: "Scaffold testing",
  }
  fixtureState.current_stage = "quick_plan"
  fixtureState.status = "in_progress"
  fixtureState.current_owner = "MasterOrchestrator"
  fixtureState.artifacts.task_card = null
  fixtureState.artifacts.brief = null
  fixtureState.artifacts.spec = null
  fixtureState.artifacts.architecture = null
  fixtureState.artifacts.plan = null
  fixtureState.artifacts.migration_report = null
  fixtureState.artifacts.qa_report = null
  fixtureState.artifacts.adr = []
  fixtureState.approvals = {
    quick_verified: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
  }

  fs.writeFileSync(
    path.join(opencodeDir, "workflow-state.json"),
    `${JSON.stringify(fixtureState, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(templatesDir, "quick-task-template.md"),
    [
      "---",
      "artifact_type: quick_task_card",
      "feature_id: TASK-000",
      "feature_slug: example-task",
      "---",
      "",
      "# Quick Task: <Task Name>",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(templatesDir, "implementation-plan-template.md"),
    [
      "---",
      "artifact_type: implementation_plan",
      "feature_id: FEATURE-000",
      "feature_slug: example-feature",
      "source_architecture: docs/architecture/YYYY-MM-DD-example-feature.md",
      "---",
      "",
      "# Implementation Plan: <Feature Name>",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(templatesDir, "migration-plan-template.md"),
    [
      "---",
      "artifact_type: migration_plan",
      "feature_id: FEATURE-000",
      "feature_slug: example-migration",
      "source_architecture: docs/architecture/YYYY-MM-DD-example-migration.md",
      "---",
      "",
      "# Migration Plan: <Migration Name>",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(templatesDir, "migration-report-template.md"),
    [
      "---",
      "artifact_type: migration_report",
      "feature_id: FEATURE-000",
      "feature_slug: example-migration",
      "source_architecture: docs/architecture/YYYY-MM-DD-example-migration.md",
      "source_plan: docs/plans/YYYY-MM-DD-example-migration.md",
      "---",
      "",
      "# Migration Report: <Migration Name>",
      "",
    ].join("\n"),
    "utf8",
  )
}

function setupTempRuntimeWithRealTemplates(projectRoot) {
  setupTempRuntime(projectRoot)

  const quickTemplate = fs.readFileSync(
    path.resolve(__dirname, "../../docs/templates/quick-task-template.md"),
    "utf8",
  )
  const planTemplate = fs.readFileSync(
    path.resolve(__dirname, "../../docs/templates/implementation-plan-template.md"),
    "utf8",
  )
  const migrationPlanTemplate = fs.readFileSync(
    path.resolve(__dirname, "../../docs/templates/migration-plan-template.md"),
    "utf8",
  )
  const migrationReportTemplate = fs.readFileSync(
    path.resolve(__dirname, "../../docs/templates/migration-report-template.md"),
    "utf8",
  )

  fs.writeFileSync(path.join(projectRoot, "docs", "templates", "quick-task-template.md"), quickTemplate, "utf8")
  fs.writeFileSync(
    path.join(projectRoot, "docs", "templates", "implementation-plan-template.md"),
    planTemplate,
    "utf8",
  )
  fs.writeFileSync(
    path.join(projectRoot, "docs", "templates", "migration-plan-template.md"),
    migrationPlanTemplate,
    "utf8",
  )
  fs.writeFileSync(
    path.join(projectRoot, "docs", "templates", "migration-report-template.md"),
    migrationReportTemplate,
    "utf8",
  )
}

test("scaffold-artifact creates a quick task card and links it into state", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "task_card", "copy-fix"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Created artifact 'task_card'/)

  const state = JSON.parse(fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"))
  assert.match(state.artifacts.task_card, /docs\/tasks\/\d{4}-\d{2}-\d{2}-copy-fix\.md$/)
  assert.equal(fs.existsSync(path.join(projectRoot, state.artifacts.task_card)), true)
})

test("scaffold-artifact substitutes real checked-in templates correctly", () => {
  const projectRoot = makeTempProject()
  setupTempRuntimeWithRealTemplates(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")

  let result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "task_card", "real-template-task"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)

  let state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  let taskCardContent = fs.readFileSync(path.join(projectRoot, state.artifacts.task_card), "utf8")
  assert.match(taskCardContent, /feature_id: TASK-700/)
  assert.match(taskCardContent, /feature_slug: scaffold-target/)
  assert.match(taskCardContent, /# Quick Task: Real Template Task/)

  state.feature_id = "FEATURE-705"
  state.feature_slug = "real-template-plan"
  state.mode = "full"
  state.mode_reason = "Real template plan scaffold"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "Real template plan scaffold",
  }
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.artifacts.task_card = null
  state.artifacts.architecture = "docs/architecture/2026-03-21-real-template-plan.md"
  state.approvals = {
    product_to_solution: { status: "approved", approved_by: "user", approved_at: "2026-03-21", notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  fs.rmSync(path.join(projectRoot, ".opencode", "work-items"), { recursive: true, force: true })

  result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "real-template-plan"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)

  state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const planContent = fs.readFileSync(path.join(projectRoot, state.artifacts.plan), "utf8")
  assert.match(planContent, /feature_id: FEATURE-705/)
  assert.match(planContent, /feature_slug: real-template-plan/)
  assert.match(planContent, /source_architecture: docs\/architecture\/2026-03-21-real-template-plan\.md/)
  assert.match(planContent, /# Implementation Plan: Real Template Plan/)
})

test("scaffold-artifact creates an implementation plan and links it into state", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-701"
  state.feature_slug = "scaffold-plan"
  state.mode = "full"
  state.mode_reason = "Plan scaffold testing"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "Plan scaffold testing",
  }
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.artifacts.architecture = "docs/architecture/2026-03-21-scaffold-plan.md"
  state.approvals = {
    product_to_solution: { status: "approved", approved_by: "user", approved_at: "2026-03-21", notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "scaffold-plan"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  assert.match(nextState.artifacts.plan, /docs\/plans\/\d{4}-\d{2}-\d{2}-scaffold-plan\.md$/)
  assert.equal(fs.existsSync(path.join(projectRoot, nextState.artifacts.plan)), true)
  const planContent = fs.readFileSync(path.join(projectRoot, nextState.artifacts.plan), "utf8")
  assert.match(planContent, /source_architecture: docs\/architecture\/2026-03-21-scaffold-plan\.md/)
})

test("scaffold-artifact rejects unsupported kinds without mutating state", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const before = fs.readFileSync(statePath, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "brief", "new-brief"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unsupported scaffold kind 'brief'/)
  assert.equal(fs.readFileSync(statePath, "utf8"), before)
})

test("scaffold-artifact refuses to overwrite an already populated slot", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.artifacts.task_card = "docs/tasks/2026-03-21-existing.md"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  const before = fs.readFileSync(statePath, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "task_card", "copy-fix"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /already linked for artifact kind 'task_card'/)
  assert.equal(fs.readFileSync(statePath, "utf8"), before)
})

test("scaffold-artifact resolves repo-relative paths from the state project root", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const externalStatePath = path.join(projectRoot, ".opencode", "workflow-state.json")

  const result = spawnSync(
    "node",
    [
      path.resolve(__dirname, "../workflow-state.js"),
      "--state",
      externalStatePath,
      "scaffold-artifact",
      "task_card",
      "copy-fix-from-external-cwd",
    ],
    {
      cwd: os.tmpdir(),
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)

  const state = JSON.parse(fs.readFileSync(externalStatePath, "utf8"))
  assert.match(state.artifacts.task_card, /copy-fix-from-external-cwd\.md$/)
  assert.equal(fs.existsSync(path.join(projectRoot, state.artifacts.task_card)), true)
})

test("scaffold-artifact rejects invalid slugs without writing files", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "task_card", "../../escape"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /artifact slug must use lowercase kebab-case/)
  assert.equal(fs.readdirSync(path.join(projectRoot, "docs", "tasks")).length, 0)
})

test("scaffold-artifact removes created files if state linking fails", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")

  assert.throws(
    () =>
      scaffoldAndLinkArtifact("task_card", "cleanup-on-failure", statePath, {
        beforeLink: () => {
          throw new Error("simulated link failure")
        },
      }),
    /simulated link failure/,
  )

  assert.equal(fs.readdirSync(path.join(projectRoot, "docs", "tasks")).length, 0)
})

test("scaffold-artifact rejects task cards outside quick mode", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-702"
  state.feature_slug = "wrong-lane-task-card"
  state.mode = "full"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "wrong lane task card",
  }
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.approvals = {
    product_to_solution: { status: "approved", approved_by: "user", approved_at: "2026-03-21", notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "task_card", "wrong-lane-task-card"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'task_card' requires quick mode/) 
})

test("scaffold-artifact rejects plans without a linked architecture artifact", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-703"
  state.feature_slug = "missing-architecture"
  state.mode = "full"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "missing architecture",
  }
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.artifacts.architecture = null
  state.approvals = {
    product_to_solution: { status: "approved", approved_by: "user", approved_at: "2026-03-21", notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "missing-architecture"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'plan' requires a linked solution or architecture artifact/)
  assert.equal(fs.readdirSync(path.join(projectRoot, "docs", "plans")).length, 0)
})

test("scaffold-artifact rejects plans outside full_solution stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-704"
  state.feature_slug = "wrong-plan-stage"
  state.mode = "full"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "wrong plan stage",
  }
  state.current_stage = "full_product"
  state.current_owner = "ProductLead"
  state.artifacts.architecture = "docs/architecture/2026-03-21-wrong-plan-stage.md"
  state.approvals = {
    product_to_solution: { status: "approved", approved_by: "user", approved_at: "2026-03-21", notes: null },
    solution_to_fullstack: { status: "approved", approved_by: "user", approved_at: "2026-03-21", notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "wrong-plan-stage"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'plan' requires current stage 'full_solution'/)
  assert.equal(fs.readdirSync(path.join(projectRoot, "docs", "plans")).length, 0)
})

test("scaffold-artifact creates a migration plan in migration_strategy stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntimeWithRealTemplates(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))

  state.feature_id = "MIGRATE-705"
  state.feature_slug = "react-19-upgrade"
  state.mode = "migration"
  state.mode_reason = "Migration scaffold testing"
  state.routing_profile = {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "Migration scaffold testing",
  }
  state.current_stage = "migration_strategy"
  state.current_owner = "SolutionLead"
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = "docs/architecture/2026-03-21-react-19-upgrade.md"
  state.artifacts.migration_report = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  state.approvals = {
    baseline_to_strategy: { status: "approved", approved_by: "SolutionLead", approved_at: "2026-03-21", notes: null },
    strategy_to_upgrade: { status: "pending", approved_by: null, approved_at: null, notes: null },
    upgrade_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_verify: { status: "pending", approved_by: null, approved_at: null, notes: null },
    migration_verified: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "react-19-upgrade"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)

  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const planContent = fs.readFileSync(path.join(projectRoot, nextState.artifacts.plan), "utf8")
  assert.match(planContent, /artifact_type: migration_plan/)
  assert.match(planContent, /feature_id: MIGRATE-705/)
  assert.match(planContent, /feature_slug: react-19-upgrade/)
  assert.match(planContent, /# Migration Plan: React 19 Upgrade/)
})

test("scaffold-artifact rejects migration plans outside migration_strategy stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))

  state.feature_id = "MIGRATE-706"
  state.feature_slug = "wrong-migration-stage"
  state.mode = "migration"
  state.routing_profile = {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "wrong migration stage",
  }
  state.current_stage = "migration_baseline"
  state.current_owner = "SolutionLead"
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = "docs/architecture/2026-03-21-wrong-migration-stage.md"
  state.artifacts.plan = null
  state.artifacts.migration_report = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  state.approvals = {
    baseline_to_strategy: { status: "pending", approved_by: null, approved_at: null, notes: null },
    strategy_to_upgrade: { status: "pending", approved_by: null, approved_at: null, notes: null },
    upgrade_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_verify: { status: "pending", approved_by: null, approved_at: null, notes: null },
    migration_verified: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "wrong-migration-stage"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'plan' requires current stage 'migration_strategy'/)
})

test("scaffold-artifact creates a migration report in migration_baseline stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntimeWithRealTemplates(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))

  state.feature_id = "MIGRATE-707"
  state.feature_slug = "legacy-stack-refresh"
  state.mode = "migration"
  state.mode_reason = "Migration report scaffold testing"
  state.routing_profile = {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "Migration report scaffold testing",
  }
  state.current_stage = "migration_baseline"
  state.current_owner = "SolutionLead"
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = "docs/architecture/2026-03-21-legacy-stack-refresh.md"
  state.artifacts.plan = "docs/plans/2026-03-21-legacy-stack-refresh.md"
  state.artifacts.migration_report = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  state.approvals = {
    baseline_to_strategy: { status: "pending", approved_by: null, approved_at: null, notes: null },
    strategy_to_upgrade: { status: "pending", approved_by: null, approved_at: null, notes: null },
    upgrade_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_verify: { status: "pending", approved_by: null, approved_at: null, notes: null },
    migration_verified: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "migration_report", "legacy-stack-refresh-report"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)

  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const reportContent = fs.readFileSync(path.join(projectRoot, nextState.artifacts.migration_report), "utf8")
  assert.match(reportContent, /artifact_type: migration_report/)
  assert.match(reportContent, /feature_id: MIGRATE-707/)
  assert.match(reportContent, /feature_slug: legacy-stack-refresh/)
  assert.match(reportContent, /source_architecture: docs\/architecture\/2026-03-21-legacy-stack-refresh\.md/)
  assert.match(reportContent, /source_plan: docs\/plans\/2026-03-21-legacy-stack-refresh\.md/)
  assert.match(reportContent, /# Migration Report: Legacy Stack Refresh Report/)
})

test("scaffold-artifact rejects migration reports outside migration baseline or strategy", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))

  state.feature_id = "MIGRATE-708"
  state.feature_slug = "wrong-report-stage"
  state.mode = "migration"
  state.routing_profile = {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "wrong report stage",
  }
  state.current_stage = "migration_upgrade"
  state.current_owner = "FullstackAgent"
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = null
  state.artifacts.plan = null
  state.artifacts.migration_report = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  state.approvals = {
    baseline_to_strategy: { status: "approved", approved_by: "SolutionLead", approved_at: "2026-03-21", notes: null },
    strategy_to_upgrade: { status: "approved", approved_by: "FullstackAgent", approved_at: "2026-03-21", notes: null },
    upgrade_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_verify: { status: "pending", approved_by: null, approved_at: null, notes: null },
    migration_verified: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "migration_report", "wrong-report-stage"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /Artifact scaffold kind 'migration_report' requires current stage 'migration_baseline' or 'migration_strategy'/,
  )
})
