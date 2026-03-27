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
  const scopeDir = path.join(projectRoot, "docs", "scope")
  const solutionDir = path.join(projectRoot, "docs", "solution")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })
  fs.mkdirSync(tasksDir, { recursive: true })
  fs.mkdirSync(scopeDir, { recursive: true })
  fs.mkdirSync(solutionDir, { recursive: true })

  const fixtureState = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../workflow-state.json"), "utf8"))
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
  fixtureState.artifacts.scope_package = null
  fixtureState.artifacts.solution_package = null
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

  fs.writeFileSync(path.join(opencodeDir, "workflow-state.json"), `${JSON.stringify(fixtureState, null, 2)}\n`, "utf8")
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
    path.join(templatesDir, "scope-package-template.md"),
    [
      "---",
      "artifact_type: scope_package",
      "feature_id: FEATURE-000",
      "feature_slug: example-feature",
      "---",
      "",
      "# Scope Package: <Feature Name>",
      "",
      "## Goal",
      "",
      "## In Scope",
      "",
      "## Out of Scope",
      "",
      "## Acceptance Criteria Matrix",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(templatesDir, "solution-package-template.md"),
    [
      "---",
      "artifact_type: solution_package",
      "feature_id: FEATURE-000",
      "feature_slug: example-feature",
      "source_scope_package: docs/scope/YYYY-MM-DD-example-feature.md",
      "---",
      "",
      "# Solution Package: <Feature Name>",
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
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(templatesDir, "migration-solution-package-template.md"),
    [
      "---",
      "artifact_type: solution_package",
      "feature_id: FEATURE-000",
      "feature_slug: example-migration",
      "---",
      "",
      "# Solution Package: <Migration Name>",
      "",
      "## Goal",
      "",
      "## Preserved Invariants",
      "",
      "## Upgrade Sequence",
      "",
      "## Parity Verification",
      "",
      "## Rollback Notes",
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
      "source_solution_package: docs/solution/YYYY-MM-DD-example-migration.md",
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

  const realTemplates = [
    "quick-task-template.md",
    "scope-package-template.md",
    "solution-package-template.md",
    "migration-solution-package-template.md",
    "migration-report-template.md",
  ]

  for (const template of realTemplates) {
    const source = fs.readFileSync(path.resolve(__dirname, "../../docs/templates", template), "utf8")
    fs.writeFileSync(path.join(projectRoot, "docs", "templates", template), source, "utf8")
  }
}

test("scaffold-artifact creates a quick task card and links it into state", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "task_card", "copy-fix"],
    { cwd: projectRoot, encoding: "utf8" },
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

  let state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-705"
  state.feature_slug = "real-template-scope"
  state.mode = "full"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "Real template scope scaffold",
  }
  state.current_stage = "full_product"
  state.current_owner = "ProductLead"
  state.approvals = {
    product_to_solution: { status: "pending", approved_by: null, approved_at: null, notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  let result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "scope_package", "real-template-scope"],
    { cwd: projectRoot, encoding: "utf8" },
  )
  assert.equal(result.status, 0)

  state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const scopeContent = fs.readFileSync(path.join(projectRoot, state.artifacts.scope_package), "utf8")
  assert.match(scopeContent, /feature_id: FEATURE-705/)
  assert.match(scopeContent, /feature_slug: real-template-scope/)
  assert.match(scopeContent, /# Scope Package: Real Template Scope/)

  state.feature_slug = "real-template-solution"
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.artifacts.solution_package = null
  fs.rmSync(path.join(projectRoot, ".opencode", "work-items"), { recursive: true, force: true })
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "solution_package", "real-template-solution"],
    { cwd: projectRoot, encoding: "utf8" },
  )
  assert.equal(result.status, 0)

  state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const solutionContent = fs.readFileSync(path.join(projectRoot, state.artifacts.solution_package), "utf8")
  assert.match(solutionContent, /feature_id: FEATURE-705/)
  assert.match(solutionContent, /feature_slug: real-template-solution/)
  assert.match(solutionContent, /source_scope_package: docs\/scope\//)
  assert.match(solutionContent, /# Solution Package: Real Template Solution/)
})

test("scaffold-artifact creates a full scope package and links it into state", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-701"
  state.feature_slug = "scaffold-scope"
  state.mode = "full"
  state.mode_reason = "Scope scaffold testing"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "Scope scaffold testing",
  }
  state.current_stage = "full_product"
  state.current_owner = "ProductLead"
  state.approvals = {
    product_to_solution: { status: "pending", approved_by: null, approved_at: null, notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "scope_package", "scaffold-scope"],
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 0)
  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  assert.match(nextState.artifacts.scope_package, /docs\/scope\/\d{4}-\d{2}-\d{2}-scaffold-scope\.md$/)
})

test("scaffold-artifact creates a full solution package and links it into state", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-702"
  state.feature_slug = "scaffold-solution"
  state.mode = "full"
  state.mode_reason = "Solution scaffold testing"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "Solution scaffold testing",
  }
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.artifacts.scope_package = "docs/scope/2026-03-21-scaffold-solution.md"
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
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "solution_package", "scaffold-solution"],
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 0)
  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  assert.match(nextState.artifacts.solution_package, /docs\/solution\/\d{4}-\d{2}-\d{2}-scaffold-solution\.md$/)
  const solutionContent = fs.readFileSync(path.join(projectRoot, nextState.artifacts.solution_package), "utf8")
  assert.match(solutionContent, /source_scope_package: docs\/scope\/2026-03-21-scaffold-solution\.md/)
})

test("scaffold-artifact creates a migration solution package in migration_strategy stage", () => {
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
  state.artifacts.scope_package = null
  state.artifacts.solution_package = null
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
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "solution_package", "react-19-upgrade"],
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 0)
  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const solutionContent = fs.readFileSync(path.join(projectRoot, nextState.artifacts.solution_package), "utf8")
  assert.match(solutionContent, /artifact_type: solution_package/)
  assert.match(solutionContent, /feature_id: MIGRATE-705/)
  assert.match(solutionContent, /feature_slug: react-19-upgrade/)
  assert.match(solutionContent, /# Solution Package: React 19 Upgrade/)
})

test("scaffold-artifact rejects unsupported old artifact kinds", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const before = fs.readFileSync(statePath, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "plan", "legacy-plan"],
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unsupported scaffold kind 'plan'/)
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
    { cwd: projectRoot, encoding: "utf8" },
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
    [path.resolve(__dirname, "../workflow-state.js"), "--state", externalStatePath, "scaffold-artifact", "task_card", "copy-fix-from-external-cwd"],
    { cwd: os.tmpdir(), encoding: "utf8" },
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
    { cwd: projectRoot, encoding: "utf8" },
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
  state.feature_id = "FEATURE-710"
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
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'task_card' requires quick mode/)
})

test("scaffold-artifact rejects scope packages outside full_product stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "FEATURE-711"
  state.feature_slug = "wrong-scope-stage"
  state.mode = "full"
  state.routing_profile = {
    work_intent: "feature",
    behavior_delta: "extend",
    dominant_uncertainty: "product",
    scope_shape: "cross_boundary",
    selection_reason: "wrong scope stage",
  }
  state.current_stage = "full_solution"
  state.current_owner = "SolutionLead"
  state.approvals = {
    product_to_solution: { status: "pending", approved_by: null, approved_at: null, notes: null },
    solution_to_fullstack: { status: "pending", approved_by: null, approved_at: null, notes: null },
    fullstack_to_code_review: { status: "pending", approved_by: null, approved_at: null, notes: null },
    code_review_to_qa: { status: "pending", approved_by: null, approved_at: null, notes: null },
    qa_to_done: { status: "pending", approved_by: null, approved_at: null, notes: null },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "scope_package", "wrong-scope-stage"],
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'scope_package' requires current stage 'full_product'/)
})

test("scaffold-artifact rejects migration solution packages outside migration_strategy stage", () => {
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
    [path.resolve(__dirname, "../workflow-state.js"), "scaffold-artifact", "solution_package", "wrong-migration-stage"],
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'solution_package' requires current stage 'migration_strategy'/)
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
  state.artifacts.solution_package = "docs/solution/2026-03-21-legacy-stack-refresh.md"
  state.artifacts.migration_report = null
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
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 0)
  const nextState = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const reportContent = fs.readFileSync(path.join(projectRoot, nextState.artifacts.migration_report), "utf8")
  assert.match(reportContent, /artifact_type: migration_report/)
  assert.match(reportContent, /feature_id: MIGRATE-707/)
  assert.match(reportContent, /feature_slug: legacy-stack-refresh/)
  assert.match(reportContent, /source_solution_package: docs\/solution\/2026-03-21-legacy-stack-refresh\.md/)
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
  state.artifacts.solution_package = null
  state.artifacts.migration_report = null
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
    { cwd: projectRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Artifact scaffold kind 'migration_report' requires current stage 'migration_baseline' or 'migration_strategy'/)
})
