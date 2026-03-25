const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-cli-"))
}

function setupTempRuntime(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const hooksDir = path.join(projectRoot, "hooks")
  const skillsDir = path.join(projectRoot, "skills", "using-skills")
  const contextCoreDir = path.join(projectRoot, "context", "core")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(hooksDir, { recursive: true })
  fs.mkdirSync(skillsDir, { recursive: true })
  fs.mkdirSync(contextCoreDir, { recursive: true })

  const fixtureState = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../workflow-state.json"), "utf8"),
  )

  fs.writeFileSync(path.join(opencodeDir, "workflow-state.json"), `${JSON.stringify(fixtureState, null, 2)}\n`, "utf8")
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify({
      kit: {
        name: "OpenKit AI Software Factory",
        version: "0.2.10",
        entryAgent: "MasterOrchestrator",
        registry: {
          path: "registry.json",
          schema: "openkit/component-registry@1",
        },
        installManifest: {
          path: ".opencode/install-manifest.json",
          schema: "openkit/install-manifest@1",
        },
        activeProfile: "openkit-core",
      },
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(projectRoot, "registry.json"),
    `${JSON.stringify({
      schema: "openkit/component-registry@1",
      registryVersion: 1,
      profiles: [
        {
          id: "profile.openkit-core",
          name: "openkit-core",
          description: "Core profile",
          componentRefs: ["agents", "runtime", "docs"],
          defaultForRepository: true,
        },
        {
          id: "profile.runtime-docs-surface",
          name: "runtime-docs-surface",
          description: "Runtime and docs surface",
          componentRefs: ["runtime", "hooks", "docs"],
          defaultForRepository: false,
        },
      ],
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(
    path.join(opencodeDir, "install-manifest.json"),
    `${JSON.stringify({
      schema: "openkit/install-manifest@1",
      manifestVersion: 1,
      installation: {
        activeProfile: "openkit-core",
      },
    }, null, 2)}\n`,
    "utf8",
  )
  fs.writeFileSync(path.join(hooksDir, "hooks.json"), '{"hooks":{}}\n', "utf8")
  fs.writeFileSync(path.join(hooksDir, "session-start"), "#!/usr/bin/env bash\n", "utf8")
  fs.writeFileSync(path.join(skillsDir, "SKILL.md"), "# using-skills\n", "utf8")
  fs.writeFileSync(path.join(opencodeDir, "workflow-state.js"), "#!/usr/bin/env node\n", "utf8")
  fs.writeFileSync(
    path.join(contextCoreDir, "workflow.md"),
    [
      "# Workflow",
      "",
      "Quick Task+ is the live semantics of the quick lane, not a third lane.",
      "Mode enums remain `quick`, `migration`, and `full`.",
      "Commands remain `/task`, `/quick-task`, `/migrate`, `/delivery`, `/write-plan`, and `/configure-agent-models`.",
      "Migration is the dedicated upgrade and modernization lane.",
      "Migration work must stay free of task boards.",
      "Migration must preserve behavior first and decouple blockers before broad upgrade work.",
      "Lane tie breaker: product uncertainty chooses full, compatibility uncertainty chooses migration, low local uncertainty chooses quick.",
      "Lane Decision Matrix: use examples to choose the lane when wording alone is not enough.",
      "Do not invent a quick task board; quick work stays task-board free.",
      "Full Delivery owns the execution task board when one exists.",
      "Quick stages: `quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`.",
      "Migration stages: `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_verify -> migration_done`.",
      "Full stages: `full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`.",
      "Quick approvals: `quick_verified`.",
      "Migration approvals: `baseline_to_strategy`, `strategy_to_upgrade`, `upgrade_to_verify`, `migration_verified`.",
      "Full approvals: `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, `fullstack_to_qa`, `qa_to_done`.",
      "Quick artifacts: `task_card`; migration artifacts may include `architecture`, `plan`, `migration_report`; full artifacts: `brief`, `spec`, `architecture`, `plan`, `qa_report`, `adr`.",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(contextCoreDir, "workflow-state-schema.md"),
    [
      "# Workflow State Schema",
      "",
      "Modes: `quick`, `migration`, `full`.",
      "Quick stages: `quick_intake`, `quick_plan`, `quick_build`, `quick_verify`, `quick_done`.",
      "Migration stages: `migration_intake`, `migration_baseline`, `migration_strategy`, `migration_upgrade`, `migration_verify`, `migration_done`.",
      "Full stages: `full_intake`, `full_brief`, `full_spec`, `full_architecture`, `full_plan`, `full_implementation`, `full_qa`, `full_done`.",
      "Artifact keys: `task_card`, `brief`, `spec`, `architecture`, `plan`, `migration_report`, `qa_report`, `adr`.",
      "Routing profile keys: `work_intent`, `behavior_delta`, `dominant_uncertainty`, `scope_shape`, `selection_reason`.",
      "Quick approvals: `quick_verified`.",
      "Migration approvals: `baseline_to_strategy`, `strategy_to_upgrade`, `upgrade_to_verify`, `migration_verified`.",
      "Full approvals: `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, `fullstack_to_qa`, `qa_to_done`.",
      "Compatibility mirror behavior remains active for the current work item.",
      "",
    ].join("\n"),
    "utf8",
  )
}

function runCli(projectRoot, args) {
  return spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  })
}

function moveFullWorkItemToPlan(projectRoot, workItemId) {
  let result = runCli(projectRoot, ["activate-work-item", workItemId])
  assert.equal(result.status, 0)

  const stageApprovals = new Map([
    ["full_brief", ["pm_to_ba", "approved", "user", "2026-03-21", "Approved"]],
    ["full_spec", ["ba_to_architect", "approved", "user", "2026-03-21", "Approved"]],
    ["full_architecture", ["architect_to_tech_lead", "approved", "user", "2026-03-21", "Approved"]],
  ])

  for (const stage of ["full_brief", "full_spec", "full_architecture"]) {
    result = runCli(projectRoot, ["advance-stage", stage])
    assert.equal(result.status, 0)

    result = runCli(projectRoot, ["set-approval", ...stageApprovals.get(stage)])
    assert.equal(result.status, 0)
  }

  result = runCli(projectRoot, ["advance-stage", "full_plan"])
  assert.equal(result.status, 0)
}

function writeTaskBoard(projectRoot, workItemId, board) {
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "tasks.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
}

function makeFullTaskBoard(overrides = {}) {
  return {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-BOARD-1",
        title: "Implement diagnostics",
        summary: "Add runtime task summaries",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-A",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ["docs/plans/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-1",
        created_by: "TechLeadAgent",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-BOARD-2",
        title: "Verify diagnostics",
        summary: "Exercise QA handoff",
        kind: "qa",
        status: "qa_in_progress",
        primary_owner: "Dev-B",
        qa_owner: "QA-Agent",
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ["docs/plans/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-2",
        created_by: "TechLeadAgent",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-BOARD-3",
        title: "Document drift checks",
        summary: "Leave one ready task for summary counts",
        kind: "documentation",
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
      },
    ],
    issues: [],
    ...overrides,
  }
}

test("status command prints workflow and runtime summary", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit runtime status:/)
  assert.match(result.stdout, /kit: OpenKit AI Software Factory v0\.2\.9/)
  assert.match(result.stdout, /entry agent: MasterOrchestrator/)
  assert.match(result.stdout, /active profile: openkit-core/)
  assert.match(result.stdout, /registry: .*registry\.json/)
  assert.match(result.stdout, /install manifest: .*\.opencode\/install-manifest\.json/)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_done/)
  assert.match(result.stdout, /status: done/)
  assert.match(result.stdout, /work item: FEATURE-001 \(task-intake-dashboard\)/)
})

test("status command reflects quick_plan as a live quick stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "TASK-600"
  state.feature_slug = "quick-plan-status"
  state.mode = "quick"
  state.mode_reason = "Bounded quick work"
  state.routing_profile = {
    work_intent: "maintenance",
    behavior_delta: "preserve",
    dominant_uncertainty: "low_local",
    scope_shape: "local",
    selection_reason: "Bounded quick work",
  }
  state.current_stage = "quick_plan"
  state.status = "in_progress"
  state.current_owner = "MasterOrchestrator"
  state.approvals = {
    quick_verified: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
  }
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = null
  state.artifacts.plan = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: quick/)
  assert.match(result.stdout, /stage: quick_plan/)
  assert.match(result.stdout, /owner: MasterOrchestrator/)
  assert.match(result.stdout, /work item: TASK-600 \(quick-plan-status\)/)
})

test("status command reflects migration_strategy as a live migration stage", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "MIGRATE-600"
  state.feature_slug = "react-19-migration"
  state.mode = "migration"
  state.mode_reason = "Framework upgrade"
  state.routing_profile = {
    work_intent: "modernization",
    behavior_delta: "preserve",
    dominant_uncertainty: "compatibility",
    scope_shape: "adjacent",
    selection_reason: "Framework upgrade",
  }
  state.current_stage = "migration_strategy"
  state.status = "in_progress"
  state.current_owner = "TechLeadAgent"
  state.approvals = {
    baseline_to_strategy: {
      status: "approved",
      approved_by: "TechLeadAgent",
      approved_at: "2026-03-21",
      notes: null,
    },
    strategy_to_upgrade: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
    upgrade_to_verify: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
    migration_verified: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
  }
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = "docs/architecture/2026-03-21-react-19-migration.md"
  state.artifacts.plan = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: migration/)
  assert.match(result.stdout, /stage: migration_strategy/)
  assert.match(result.stdout, /owner: TechLeadAgent/)
  assert.match(result.stdout, /work item: MIGRATE-600 \(react-19-migration\)/)
})

test("status command fails when the active managed work item is invalid", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.feature_id = "TASK-601"
  state.feature_slug = "quick-invalid-board"
  state.work_item_id = "task-601"
  state.mode = "quick"
  state.mode_reason = "Invalid quick item for status path"
  state.routing_profile = {
    work_intent: "maintenance",
    behavior_delta: "preserve",
    dominant_uncertainty: "low_local",
    scope_shape: "local",
    selection_reason: "Invalid quick item for status path",
  }
  state.current_stage = "quick_plan"
  state.status = "in_progress"
  state.current_owner = "MasterOrchestrator"
  state.artifacts.task_card = null
  state.artifacts.brief = null
  state.artifacts.spec = null
  state.artifacts.architecture = null
  state.artifacts.plan = null
  state.artifacts.migration_report = null
  state.artifacts.qa_report = null
  state.artifacts.adr = []
  state.approvals = {
    quick_verified: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  writeTaskBoard(projectRoot, "task-601", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [
      {
        task_id: "TASK-1",
        title: "Invalid quick board",
        summary: "Should make status fail through managed validation",
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
      },
    ],
    issues: [],
  })

  const result = runCli(projectRoot, ["status"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Quick mode cannot carry a task board/)
})

test("doctor command reports runtime diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit doctor:/)
  assert.match(result.stdout, /active profile: openkit-core/)
  assert.match(result.stdout, /registry: .*registry\.json/)
  assert.match(result.stdout, /install manifest: .*\.opencode\/install-manifest\.json/)
  assert.match(result.stdout, /\[ok\] manifest file found/)
  assert.match(result.stdout, /\[ok\] workflow state file found/)
  assert.match(result.stdout, /\[ok\] workflow state is valid/)
  assert.match(result.stdout, /\[ok\] registry file found/)
  assert.match(result.stdout, /\[ok\] install manifest found/)
  assert.match(result.stdout, /\[ok\] workflow state CLI found/)
  assert.match(result.stdout, /\[ok\] hooks config found/)
  assert.match(result.stdout, /\[ok\] session-start hook found/)
  assert.match(result.stdout, /\[ok\] meta-skill found/)
  assert.match(result.stdout, /\[ok\] active profile exists in registry/)
  assert.match(result.stdout, /\[ok\] workflow contract doc found/)
  assert.match(result.stdout, /\[ok\] workflow schema matches runtime stage sequences/)
  assert.doesNotMatch(result.stdout, /\[error\]/)
})

test("doctor command reports missing state as diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  fs.rmSync(path.join(projectRoot, ".opencode", "workflow-state.json"))

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /OpenKit doctor:/)
  assert.match(result.stdout, /\[error\] workflow state file found/)
  assert.match(result.stdout, /\[error\] workflow state is valid/)
  assert.match(result.stdout, /Summary: .* [1-9][0-9]* error/)
})

test("doctor reports malformed registry as diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  fs.writeFileSync(path.join(projectRoot, "registry.json"), "{not-valid-json}\n", "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /OpenKit doctor:/)
  assert.match(result.stdout, /\[error\] registry metadata is readable/)
  assert.match(result.stdout, /Summary: .* [1-9][0-9]* error/)
})

test("doctor reports when active profile is missing from registry", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const manifestPath = path.join(projectRoot, ".opencode", "install-manifest.json")
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  manifest.installation.activeProfile = "missing-profile"
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] active profile exists in registry/)
})

test("doctor reports when manifest and install-manifest active profiles diverge", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const opencodePath = path.join(projectRoot, ".opencode", "opencode.json")
  const opencodeManifest = JSON.parse(fs.readFileSync(opencodePath, "utf8"))
  opencodeManifest.kit.activeProfile = "runtime-docs-surface"
  fs.writeFileSync(opencodePath, `${JSON.stringify(opencodeManifest, null, 2)}\n`, "utf8")

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "doctor"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] manifest and install manifest profiles agree/)
})

test("profiles command lists available registry profiles", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "profiles"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit profiles:/)
  assert.match(result.stdout, /\* openkit-core - Core profile/)
  assert.match(result.stdout, /  runtime-docs-surface - Runtime and docs surface/)
})

test("show-profile command prints profile details", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "show-profile", "runtime-docs-surface"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Profile: runtime-docs-surface/)
  assert.match(result.stdout, /default: no/)
  assert.match(result.stdout, /components: runtime, hooks, docs/)
})

test("version command prints kit metadata version", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "version"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit version: 0\.2\.9/)
  assert.match(result.stdout, /active profile: openkit-core/)
})

test("sync-install-manifest updates the active profile", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "sync-install-manifest", "runtime-docs-surface"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated install manifest profile to 'runtime-docs-surface'/)

  const manifest = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".opencode", "install-manifest.json"), "utf8"),
  )
  assert.equal(manifest.installation.activeProfile, "runtime-docs-surface")

  const statusResult = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "status"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(statusResult.status, 0)
  assert.match(statusResult.stdout, /active profile: runtime-docs-surface/)
})

test("help output includes multi-work-item and task-board commands", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = runCli(projectRoot, ["help"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /create-work-item/)
  assert.match(result.stdout, /list-work-items/)
  assert.match(result.stdout, /show-work-item <work_item_id>/)
  assert.match(result.stdout, /activate-work-item <work_item_id>/)
  assert.match(result.stdout, /list-tasks <work_item_id>/)
  assert.match(result.stdout, /create-task <work_item_id> <task_id> <title> <kind>/)
  assert.match(result.stdout, /claim-task <work_item_id> <task_id> <owner>/)
  assert.match(result.stdout, /assign-qa-owner <work_item_id> <task_id> <qa_owner>/)
  assert.match(result.stdout, /set-task-status <work_item_id> <task_id> <status>/)
  assert.match(result.stdout, /validate-work-item-board <work_item_id>/)
  assert.match(result.stdout, /status/)
  assert.match(result.stdout, /doctor/)
  assert.match(result.stdout, /show/)
  assert.match(result.stdout, /start-feature <feature_id> <feature_slug>/)
  assert.match(result.stdout, /start-task <mode> <feature_id> <feature_slug> <mode_reason>/)
  assert.match(result.stdout, /create-work-item <mode> <feature_id> <feature_slug> <mode_reason>/)
  assert.match(result.stdout, /set-routing-profile <work_intent> <behavior_delta> <dominant_uncertainty> <scope_shape> <selection_reason>/)
  assert.doesNotMatch(result.stdout, /show-task <work_item_id> <task_id>/)
})

test("set-routing-profile updates explicit lane routing metadata", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "migration", "MIGRATE-950", "routing-profile", "Compatibility upgrade"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, [
    "set-routing-profile",
    "modernization",
    "preserve",
    "compatibility",
    "adjacent",
    "Compatibility modernization with preserved behavior",
  ])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated routing profile for mode 'migration'/)

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /"routing_profile": \{/)
  assert.match(result.stdout, /"dominant_uncertainty": "compatibility"/)
  assert.match(result.stdout, /"selection_reason": "Compatibility modernization with preserved behavior"/)
})

test("status command shows task-aware runtime summary for active full-delivery work", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", makeFullTaskBoard())

  const result = runCli(projectRoot, ["status"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /active work item id: feature-001/)
  assert.match(result.stdout, /work items tracked: 1/)
  assert.match(result.stdout, /task board: 3 tasks \| ready 1 \| active 2/)
  assert.match(result.stdout, /active tasks: TASK-BOARD-1 \(in_progress, primary: Dev-A\); TASK-BOARD-2 \(qa_in_progress, qa: QA-Agent\)/)
})

test("show command includes task-aware context before state JSON for active full-delivery work", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", makeFullTaskBoard())

  const result = runCli(projectRoot, ["show"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Workflow state:/)
  assert.match(result.stdout, /active work item id: feature-001/)
  assert.match(result.stdout, /task board: 3 tasks \| ready 1 \| active 2/)
  assert.match(result.stdout, /"current_stage": "full_implementation"/)
})

test("doctor command reports task-aware runtime diagnostics and mirror safety for active full-delivery work", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", makeFullTaskBoard())

  const result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /active work item id: feature-001/)
  assert.match(result.stdout, /work items tracked: 1/)
  assert.match(result.stdout, /task board: 3 tasks \| ready 1 \| active 2/)
  assert.match(result.stdout, /\[ok\] active work item pointer resolves to stored state/)
  assert.match(result.stdout, /\[ok\] compatibility mirror matches active work item state/)
  assert.match(result.stdout, /\[ok\] active work item task board is valid/)
})

test("doctor reports missing task board for active full work item as an error", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] active work item task board is valid/)
})

test("doctor reports invalid active full task board as an error even when runtime state is invalid", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-BOARD-1",
        title: "Broken diagnostics",
        summary: "Missing primary owner makes the board invalid",
        kind: "implementation",
        status: "in_progress",
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ["docs/plans/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-1",
        created_by: "TechLeadAgent",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  const result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] workflow state is valid/)
  assert.match(result.stdout, /\[error\] active work item task board is valid/)
  assert.doesNotMatch(result.stdout, /\[ok\] active work item task board is valid/)
})

test("doctor reports compatibility mirror divergence as an error", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const indexPath = path.join(projectRoot, ".opencode", "work-items", "index.json")
  const workItemStatePath = path.join(projectRoot, ".opencode", "work-items", "feature-001", "state.json")
  fs.mkdirSync(path.dirname(workItemStatePath), { recursive: true })
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify({
      active_work_item_id: "feature-001",
      work_items: [
        {
          work_item_id: "feature-001",
          feature_id: "FEATURE-001",
          feature_slug: "task-intake-dashboard",
          mode: "full",
          status: "done",
          state_path: ".opencode/work-items/feature-001/state.json",
        },
      ],
    }, null, 2)}\n`,
    "utf8",
  )

  const mirrorState = JSON.parse(fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"))
  const workItemState = { ...mirrorState, current_stage: "full_plan", current_owner: "TechLeadAgent", status: "in_progress", work_item_id: "feature-001" }
  fs.writeFileSync(workItemStatePath, `${JSON.stringify(workItemState, null, 2)}\n`, "utf8")

  const result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] compatibility mirror matches active work item state/)
})

test("legacy start-feature command creates a full work item and repo-root inspection commands read it", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-feature", "FEATURE-920", "legacy-feature"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Started feature FEATURE-920 \(legacy-feature\)/)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_intake/)
  assert.match(result.stdout, /work item: FEATURE-920 \(legacy-feature\)/)

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /"feature_id": "FEATURE-920"/)
  assert.match(result.stdout, /"work_item_id": "feature-920"/)

  result = runCli(projectRoot, ["doctor"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /\[ok\] workflow state is valid/)
})

test("legacy start-task quick command creates a quick work item and repo-root inspection commands read it", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "quick", "TASK-920", "legacy-quick", "Legacy quick runtime"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Started quick task TASK-920 \(legacy-quick\)/)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: quick/)
  assert.match(result.stdout, /stage: quick_intake/)
  assert.match(result.stdout, /work item: TASK-920 \(legacy-quick\)/)

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /"feature_id": "TASK-920"/)
  assert.match(result.stdout, /"mode": "quick"/)
  assert.match(result.stdout, /"work_item_id": "task-920"/)

  result = runCli(projectRoot, ["doctor"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /\[ok\] workflow state is valid/)
})

test("legacy start-task full command creates a full work item and repo-root inspection commands read it", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "full", "FEATURE-921", "legacy-full", "Legacy full runtime"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Started full task FEATURE-921 \(legacy-full\)/)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_intake/)
  assert.match(result.stdout, /work item: FEATURE-921 \(legacy-full\)/)

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /"feature_id": "FEATURE-921"/)
  assert.match(result.stdout, /"mode": "full"/)
  assert.match(result.stdout, /"work_item_id": "feature-921"/)

  result = runCli(projectRoot, ["doctor"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /\[ok\] workflow state is valid/)
})

test("legacy start-task migration command creates a migration work item and repo-root inspection commands read it", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-921",
    "legacy-migration",
    "Legacy migration runtime",
  ])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Started migration task MIGRATE-921 \(legacy-migration\)/)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /mode: migration/)
  assert.match(result.stdout, /stage: migration_intake/)
  assert.match(result.stdout, /work item: MIGRATE-921 \(legacy-migration\)/)

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /"feature_id": "MIGRATE-921"/)
  assert.match(result.stdout, /"mode": "migration"/)
  assert.match(result.stdout, /"work_item_id": "migrate-921"/)

  result = runCli(projectRoot, ["doctor"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /\[ok\] workflow state is valid/)
})

test("CLI work-item and task-board commands manage a full-delivery board", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "full",
    "FEATURE-900",
    "parallel-rollout",
    "Parallel rollout board setup",
  ])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Created full work item FEATURE-900 \(parallel-rollout\)/)

  moveFullWorkItemToPlan(projectRoot, "feature-900")

  result = runCli(projectRoot, ["list-work-items"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Active work item: feature-900/)
  assert.match(result.stdout, /\* feature-900 \| FEATURE-900 \| full \| in_progress/)

  result = runCli(projectRoot, ["show-work-item", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Work item: feature-900/)
  assert.match(result.stdout, /feature: FEATURE-900 \(parallel-rollout\)/)

  result = runCli(projectRoot, [
    "create-task",
    "feature-900",
    "TASK-900",
    "Wire CLI",
    "implementation",
  ])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Created task 'TASK-900' on work item 'feature-900'/)

  result = runCli(projectRoot, ["list-tasks", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Tasks for feature-900:/)
  assert.match(result.stdout, /TASK-900 \| ready \| implementation \| Wire CLI/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "FullstackAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "FullstackAgent", "TechLeadAgent"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Claimed task 'TASK-900' for 'FullstackAgent'/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "AnotherDev", "TechLeadAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Implicit reassignment is not allowed; use reassignTask/)

  result = runCli(projectRoot, ["reassign-task", "feature-900", "TASK-900", "AnotherDev"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["reassign-task", "feature-900", "TASK-900", "AnotherDev", "TechLeadAgent"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Reassigned task 'TASK-900' to 'AnotherDev'/)

  result = runCli(projectRoot, ["release-task", "feature-900", "TASK-900"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["release-task", "feature-900", "TASK-900", "TechLeadAgent"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Released task 'TASK-900'/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "FullstackAgent", "TechLeadAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-task-status", "feature-900", "TASK-900", "in_progress"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated task 'TASK-900' to 'in_progress'/)

  result = runCli(projectRoot, ["set-task-status", "feature-900", "TASK-900", "dev_done"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated task 'TASK-900' to 'dev_done'/)

  result = runCli(projectRoot, ["assign-qa-owner", "feature-900", "TASK-900", "QAAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["assign-qa-owner", "feature-900", "TASK-900", "QAAgent", "TechLeadAgent"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Assigned QA owner 'QAAgent' to task 'TASK-900'/)

  result = runCli(projectRoot, ["set-task-status", "feature-900", "TASK-900", "qa_ready"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated task 'TASK-900' to 'qa_ready'/)

  result = runCli(projectRoot, ["validate-work-item-board", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Task board is valid for work item 'feature-900'/)
})

test("CLI rejects quick items carrying task data through managed validation", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "quick", "TASK-930", "quick-stale-board", "Quick item"])
  assert.equal(result.status, 0)

  writeTaskBoard(projectRoot, "task-930", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [
      {
        task_id: "TASK-930-A",
        title: "Invalid quick board",
        summary: "Should fail validation",
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
      },
    ],
    issues: [],
  })

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Quick mode cannot carry a task board/)
})

test("CLI rejects migration items carrying task data through managed validation", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-930",
    "migration-stale-board",
    "Migration item",
  ])
  assert.equal(result.status, 0)

  writeTaskBoard(projectRoot, "migrate-930", {
    mode: "full",
    current_stage: "full_plan",
    tasks: [
      {
        task_id: "TASK-930-A",
        title: "Invalid migration board",
        summary: "Should fail validation",
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
      },
    ],
    issues: [],
  })

  result = runCli(projectRoot, ["show"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Migration mode cannot carry a task board/)
})

test("CLI rejects claim-task reassignment from the wrong authority", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-work-item", "full", "FEATURE-931", "cli-reassign", "Assignment safety"])
  assert.equal(result.status, 0)

  moveFullWorkItemToPlan(projectRoot, "feature-931")

  result = runCli(projectRoot, ["create-task", "feature-931", "TASK-931", "Implement safety", "implementation"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["claim-task", "feature-931", "TASK-931", "Dev-A", "TechLeadAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["claim-task", "feature-931", "TASK-931", "Dev-B", "QAAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Implicit reassignment is not allowed; use reassignTask/)
})

test("CLI reassign-task enforces authority explicitly", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-work-item", "full", "FEATURE-934", "cli-reassign-explicit", "Assignment safety"])
  assert.equal(result.status, 0)

  moveFullWorkItemToPlan(projectRoot, "feature-934")

  result = runCli(projectRoot, ["create-task", "feature-934", "TASK-934", "Implement safety", "implementation"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["claim-task", "feature-934", "TASK-934", "Dev-A", "TechLeadAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["reassign-task", "feature-934", "TASK-934", "Dev-B", "QAAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Only MasterOrchestrator or TechLeadAgent can reassign primary_owner/)
})

test("CLI rejects QA-fail local rework without task-scoped finding metadata", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-work-item", "full", "FEATURE-932", "cli-qa-fail", "QA fail safety"])
  assert.equal(result.status, 0)

  moveFullWorkItemToPlan(projectRoot, "feature-932")

  writeTaskBoard(projectRoot, "feature-932", {
    mode: "full",
    current_stage: "full_qa",
    tasks: [
      {
        task_id: "TASK-932",
        title: "QA local rework",
        summary: "Require local rework metadata",
        kind: "implementation",
        status: "qa_in_progress",
        primary_owner: "Dev-A",
        qa_owner: "QA-Agent",
        depends_on: [],
        blocked_by: [],
        artifact_refs: [],
        plan_refs: ["docs/plans/2026-03-21-feature.md"],
        branch_or_worktree: null,
        created_by: "TechLeadAgent",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  result = runCli(projectRoot, ["set-task-status", "feature-932", "TASK-932", "claimed"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /task-scoped finding/)
})

test("CLI release-task allows the current owner to release explicitly", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-work-item", "full", "FEATURE-935", "cli-owner-release", "Owner release"])
  assert.equal(result.status, 0)

  moveFullWorkItemToPlan(projectRoot, "feature-935")

  result = runCli(projectRoot, ["create-task", "feature-935", "TASK-935", "Owner release", "implementation"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["claim-task", "feature-935", "TASK-935", "Dev-A", "TechLeadAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["release-task", "feature-935", "TASK-935", "Dev-A"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Released task 'TASK-935'/)
})

test("help output includes explicit release and reassign task commands", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = runCli(projectRoot, ["help"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /release-task <work_item_id> <task_id> <requested_by>/)
  assert.match(result.stdout, /reassign-task <work_item_id> <task_id> <owner> <requested_by>/)
})

test("CLI rejects invalid worktree metadata when creating a task", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-work-item", "full", "FEATURE-933", "cli-worktree", "Worktree safety"])
  assert.equal(result.status, 0)

  moveFullWorkItemToPlan(projectRoot, "feature-933")

  result = runCli(projectRoot, [
    "create-task",
    "feature-933",
    "TASK-933",
    "Task metadata",
    "implementation",
    "main",
    ".worktrees/task-933-parallel",
  ])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /must not target main/)
})

test("activate-work-item switches the active selection", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "full",
    "FEATURE-910",
    "alpha-item",
    "First full work item",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, [
    "create-work-item",
    "quick",
    "TASK-910",
    "beta-item",
    "Second quick work item",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["activate-work-item", "feature-910"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Activated work item 'feature-910'/)

  result = runCli(projectRoot, ["list-work-items"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Active work item: feature-910/)
  assert.match(result.stdout, /\* feature-910 \| FEATURE-910 \| full \| in_progress/)
})
