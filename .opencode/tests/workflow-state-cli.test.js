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
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-workflow-cli-"))
}

function setupTempRuntime(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const hooksDir = path.join(projectRoot, "hooks")
  const skillsDir = path.join(projectRoot, "skills", "using-skills")
  const contextCoreDir = path.join(projectRoot, "context", "core")
  const templatesDir = path.join(projectRoot, "docs", "templates")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(path.join(projectRoot, "docs", "scope"), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, "docs", "solution"), { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })
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
        version: "0.3.12",
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
  for (const template of ["scope-package-template.md", "solution-package-template.md", "migration-solution-package-template.md", "migration-report-template.md"]) {
    fs.copyFileSync(path.resolve(__dirname, "../../docs/templates", template), path.join(templatesDir, template))
  }
  fs.writeFileSync(
    path.join(contextCoreDir, "workflow.md"),
    [
      "# Workflow",
      "",
      "Quick Task+ is the live semantics of the quick lane, not a third lane.",
      "Mode enums remain `quick`, `migration`, and `full`.",
      "Commands remain `/task`, `/quick-task`, `/migrate`, `/delivery`, `/write-solution`, and `/configure-agent-models`.",
      "Migration is the dedicated upgrade and modernization lane.",
      "Migration work must stay free of task boards.",
      "Migration must preserve behavior first and decouple blockers before broad upgrade work.",
      "Lane tie breaker: product uncertainty chooses full, compatibility uncertainty chooses migration, low local uncertainty chooses quick.",
      "Lane Decision Matrix: use examples to choose the lane when wording alone is not enough.",
      "Do not invent a quick task board; quick work stays task-board free.",
      "Full Delivery owns the execution task board when one exists.",
      "Quick stages: `quick_intake -> quick_brainstorm -> quick_plan -> quick_implement -> quick_test -> quick_done`.",
      "Migration stages: `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_code_review -> migration_verify -> migration_done`.",
      "Full stages: `full_intake -> full_product -> full_solution -> full_implementation -> full_code_review -> full_qa -> full_done`.",
      "Quick approvals: `quick_verified`.",
      "Migration approvals: `baseline_to_strategy`, `strategy_to_upgrade`, `upgrade_to_code_review`, `code_review_to_verify`, `migration_verified`.",
      "Full approvals: `product_to_solution`, `solution_to_fullstack`, `fullstack_to_code_review`, `code_review_to_qa`, `qa_to_done`.",
      "Quick artifacts: `task_card`; migration artifacts: `solution_package`, optional `migration_report`; full artifacts: `scope_package`, `solution_package`, `qa_report`, `adr`.",
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
      "Quick stages: `quick_intake`, `quick_brainstorm`, `quick_plan`, `quick_implement`, `quick_test`, `quick_done`.",
      "Migration stages: `migration_intake`, `migration_baseline`, `migration_strategy`, `migration_upgrade`, `migration_code_review`, `migration_verify`, `migration_done`.",
      "Full stages: `full_intake`, `full_product`, `full_solution`, `full_implementation`, `full_code_review`, `full_qa`, `full_done`.",
      "Artifact keys: `task_card`, `scope_package`, `solution_package`, `migration_report`, `qa_report`, `adr`.",
      "Resume summary JSON includes verification_readiness, verification_evidence, and issue_telemetry.",
      "Routing profile keys: `work_intent`, `behavior_delta`, `dominant_uncertainty`, `scope_shape`, `selection_reason`.",
      "Quick approvals: `quick_verified`.",
      "Migration approvals: `baseline_to_strategy`, `strategy_to_upgrade`, `upgrade_to_code_review`, `code_review_to_verify`, `migration_verified`.",
      "Full approvals: `product_to_solution`, `solution_to_fullstack`, `fullstack_to_code_review`, `code_review_to_qa`, `qa_to_done`.",
      "Compatibility mirror behavior remains active for the current work item.",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(contextCoreDir, "runtime-surfaces.md"),
    [
      "# Runtime Surfaces",
      "",
      "Use `openkit doctor` for product and workspace readiness.",
      "Use `node .opencode/workflow-state.js doctor` for workflow runtime integrity.",
      "Use `node .opencode/workflow-state.js resume-summary` for resumable context.",
      "",
    ].join("\n"),
    "utf8",
  )
  fs.writeFileSync(
    path.join(contextCoreDir, "session-resume.md"),
    [
      "# Session Resume Protocol",
      "",
      "Run `node .opencode/workflow-state.js resume-summary` when you need the next safe action before reading raw state.",
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

function writeArtifact(projectRoot, relativePath, content) {
  const absolutePath = path.join(projectRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${content}\n`, "utf8")
}

function moveFullWorkItemToPlan(projectRoot, workItemId) {
  let result = runCli(projectRoot, ["activate-work-item", workItemId])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "full_product"])
  assert.equal(result.status, 0)
  result = runCli(projectRoot, ["set-approval", "product_to_solution", "approved", "user", "2026-03-21", "Approved"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "full_solution"])
  assert.equal(result.status, 0)
}

function writeTaskBoard(projectRoot, workItemId, board) {
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "tasks.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
}

function writeInvocationLog(projectRoot, workItemId, entries) {
  const logPath = workItemId
    ? path.join(projectRoot, ".opencode", "work-items", workItemId, "tool-invocations.json")
    : path.join(projectRoot, ".opencode", "tool-invocations.json")
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8")
}

function writeMigrationSliceBoard(projectRoot, workItemId, board) {
  const boardPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "migration-slices.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
}

function writeBackgroundRuns(projectRoot, runs) {
  const dir = path.join(projectRoot, ".opencode", "background-runs")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "index.json"), `${JSON.stringify({ runs }, null, 2)}\n`, "utf8")
  for (const run of runs) {
    fs.writeFileSync(path.join(dir, `${run.run_id}.json`), `${JSON.stringify({ ...run, output: null }, null, 2)}\n`, "utf8")
  }
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-1",
        created_by: "SolutionLead",
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-2",
        created_by: "SolutionLead",
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: null,
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
    ...overrides,
  }
}

function makeMigrationSliceBoard(overrides = {}) {
  return {
    mode: "migration",
    current_stage: "migration_strategy",
    parallel_mode: "limited",
    slices: [
      {
        slice_id: "SLICE-BOARD-1",
        title: "Create compatibility seam",
        summary: "Active migration slice for summary coverage",
        kind: "compatibility",
        status: "in_progress",
        primary_owner: "FullstackAgent",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/adapters/seam.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["seam drift"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert seam changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        slice_id: "SLICE-BOARD-2",
        title: "Adopt compatibility seam",
        summary: "Independent ready migration slice for summary coverage",
        kind: "compatibility",
        status: "ready",
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/consumers/seam-user.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["consumer mismatch"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert consumer changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        slice_id: "SLICE-BOARD-3",
        title: "Verify seam parity",
        summary: "Blocked migration slice for summary coverage",
        kind: "verification",
        status: "blocked",
        primary_owner: null,
        qa_owner: null,
        depends_on: ["SLICE-BOARD-1"],
        blocked_by: ["SLICE-BOARD-2"],
        artifact_refs: ["docs/qa/migration-parity.md"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["parity gap"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["hold verification rollout"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        slice_id: "SLICE-BOARD-4",
        title: "Finalize parity evidence",
        summary: "Verified migration slice for summary coverage",
        kind: "verification",
        status: "verified",
        primary_owner: "FullstackAgent",
        qa_owner: "QAAgent",
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["docs/qa/migration-parity-complete.md"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["none"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["no rollback needed"],
        created_by: "SolutionLead",
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
  assert.match(result.stdout, /kit: OpenKit AI Software Factory v0\.3\.12/)
  assert.match(result.stdout, /entry agent: MasterOrchestrator/)
  assert.match(result.stdout, /active profile: openkit-core/)
  assert.match(result.stdout, /registry: .*registry\.json/)
  assert.match(result.stdout, /install manifest: .*\.opencode\/install-manifest\.json/)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_done/)
  assert.match(result.stdout, /status: done/)
  assert.match(result.stdout, /work item: FEATURE-001 \(task-intake-dashboard\)/)
})

test("resume-summary prints resumable context and next safe action", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), "resume-summary"], {
    cwd: projectRoot,
    encoding: "utf8",
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit resume summary:/)
  assert.match(result.stdout, /mode: full/)
  assert.match(result.stdout, /stage: full_done/)
  assert.match(result.stdout, /next safe action:/)
  assert.match(result.stdout, /pending approvals: none/)
  assert.match(result.stdout, /linked artifacts:/)
  assert.match(result.stdout, /read next: AGENTS\.md -> context\/navigation\.md -> context\/core\/workflow\.md -> context\/core\/session-resume\.md/)
})

test("background run commands persist and surface runtime execution context", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "start-background-run",
    "Index codebase",
    JSON.stringify({ type: "explore" }),
    "feature-001",
    "TASK-BOARD-1",
  ])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Started background run 'bg_/)

  result = runCli(projectRoot, ["list-background-runs"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenKit background runs:/)
  assert.match(result.stdout, /Index codebase/)

  const runId = result.stdout.split("\n").find((line) => line.includes("bg_"))?.split(" | ")[0]
  assert.equal(typeof runId, "string")

  result = runCli(projectRoot, ["show-background-run", runId])
  assert.equal(result.status, 0)
  const run = JSON.parse(result.stdout)
  assert.equal(run.status, "running")
  assert.equal(run.work_item_id, "feature-001")

  result = runCli(projectRoot, ["complete-background-run", runId, JSON.stringify({ summary: "done" })])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Completed background run/)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /background runs: 1 total \| running 0 \| completed 1 \| cancelled 0/)

  result = runCli(projectRoot, ["doctor"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /background runs tracked: 1/)
  assert.match(result.stdout, /background run summaries are readable/)
})

test("resume-summary supports machine-readable JSON output", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = spawnSync(
    "node",
    [path.resolve(__dirname, "../workflow-state.js"), "resume-summary", "--json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  )

  assert.equal(result.status, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.mode, "full")
  assert.equal(payload.stage, "full_done")
  assert.equal(payload.status, "done")
  assert.equal(payload.feature_id, "FEATURE-001")
  assert.equal(payload.feature_slug, "task-intake-dashboard")
  assert.equal(payload.active_work_item_id, "feature-001")
  assert.equal(typeof payload.next_safe_action, "string")
  assert.ok(Array.isArray(payload.linked_artifacts))
  assert.ok(Array.isArray(payload.read_next))
  assert.equal(payload.diagnostics.global, "openkit doctor")
  assert.equal(typeof payload.verification_readiness, "object")
  assert.ok(Array.isArray(payload.verification_evidence))
  assert.equal(typeof payload.issue_telemetry, "object")
})

test("status --short prints compact runtime summary", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = runCli(projectRoot, ["status", "--short"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /full \| full_done \| MasterOrchestrator/)
  assert.match(result.stdout, /next:/)
})

test("doctor --short prints compact doctor summary", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = runCli(projectRoot, ["doctor", "--short"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /doctor \| ok [0-9]+ \| error 0/)
})

test("workflow-metrics reports readiness and issue telemetry", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const result = runCli(projectRoot, ["workflow-metrics"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /work item: feature-001/)
  assert.match(result.stdout, /verification: ready|verification: not-required-yet/)
})

test("show-dod, validate-dod, and release-readiness expose closure contracts", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["show-dod"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /required approvals:/)

  result = runCli(projectRoot, ["validate-dod"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /ready: yes/)

  result = runCli(projectRoot, ["release-readiness"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /release ready: yes/)
})

test("workflow-analytics, ops-summary, and policy-trace print management views", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["workflow-analytics"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /total work items:/)

  result = runCli(projectRoot, ["ops-summary"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /pending approvals:/)

  result = runCli(projectRoot, ["policy-trace"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /verification-before-completion/)
})

test("release candidate CLI commands support creation, readiness checks, and dashboard output", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-release-candidate", "rc-001", "Spring-candidate"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["add-release-work-item", "rc-001", "feature-001"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["draft-release-notes", "rc-001"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["validate-release-notes", "rc-001"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /release notes ready: yes/)

  result = runCli(projectRoot, ["set-release-approval", "rc-001", "qa_to_release", "approved", "QAAgent", "2026-03-22", "QA passed"])
  assert.equal(result.status, 0)
  result = runCli(projectRoot, ["set-release-approval", "rc-001", "release_to_ship", "approved", "ReleaseManager", "2026-03-22", "Approved"])
  assert.equal(result.status, 0)
  result = runCli(projectRoot, ["record-rollback-plan", "rc-001", "Rollback-to-previous-tag", "ReleaseManager", "critical-regression"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["check-release-gates", "rc-001"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /ready: yes/)

  result = runCli(projectRoot, ["release-dashboard"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /release candidates:/)
})

test("start-hotfix and validate-hotfix commands work with a release candidate", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["create-release-candidate", "rc-003", "Hotfix-release"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["start-hotfix", "rc-003", "quick", "TASK-901", "hotfix-login", "Hotfix-login-issue"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Started hotfix work item/)

  result = runCli(projectRoot, ["show-release-candidate", "rc-003"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /hotfix work items:/)

  result = runCli(projectRoot, ["validate-hotfix", "task-901"])
  assert.ok([0, 1].includes(result.status))
  assert.match(result.stdout, /hotfix ready:/)
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
  state.current_owner = "QuickAgent"
  state.approvals = {
    quick_verified: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
  }
  state.artifacts.task_card = null
  state.artifacts.scope_package = null
  state.artifacts.solution_package = null
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
  assert.match(result.stdout, /owner: QuickAgent/)
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
  state.current_owner = "SolutionLead"
  state.approvals = {
    baseline_to_strategy: {
      status: "approved",
      approved_by: "SolutionLead",
      approved_at: "2026-03-21",
      notes: null,
    },
    strategy_to_upgrade: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
    upgrade_to_code_review: {
      status: "pending",
      approved_by: null,
      approved_at: null,
      notes: null,
    },
    code_review_to_verify: {
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
  state.artifacts.scope_package = null
  state.artifacts.solution_package = null
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
  assert.match(result.stdout, /owner: SolutionLead/)
  assert.match(result.stdout, /work item: MIGRATE-600 \(react-19-migration\)/)
})

test("status and resume-summary surface the latest auto-scaffolded artifact", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-feature", "FEATURE-610", "status-auto-scaffold"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "full_product"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /last auto-scaffold: scope_package -> docs\/scope\//)

  result = runCli(projectRoot, ["resume-summary", "--json"])
  assert.equal(result.status, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.last_auto_scaffold.artifact, "scope_package")
  assert.match(payload.last_auto_scaffold.path, /docs\/scope\//)
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
  state.current_owner = "QuickAgent"
  state.artifacts.task_card = null
  state.artifacts.scope_package = null
  state.artifacts.solution_package = null
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
    current_stage: "full_solution",
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: null,
        created_by: "SolutionLead",
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
  assert.match(result.stdout, /OpenKit version: 0\.3\.12/)
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
  assert.match(result.stdout, /closeout-summary <work_item_id>/)
  assert.match(result.stdout, /release-readiness/)
  assert.match(result.stdout, /show-dod/)
  assert.match(result.stdout, /validate-dod/)
  assert.match(result.stdout, /reconcile-work-items <work_item_id>/)
  assert.match(result.stdout, /activate-work-item <work_item_id>/)
  assert.match(result.stdout, /workflow-analytics/)
  assert.match(result.stdout, /ops-summary/)
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

test("status reports missing migration evidence kinds until all required kinds are present", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "migration", "MIGRATE-951", "evidence-gap", "Compatibility verification"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["record-verification-evidence", "migration-strategy-report", "review", "migration_strategy", "Strategy artifact reviewed", "solution-lead"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "strategy_to_upgrade", "approved", "FullstackAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_upgrade"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "upgrade_to_code_review", "approved", "CodeReviewer"])
  assert.equal(result.status, 0)

  // Seed invocation log entries required by Tier 3 policy for migration_code_review
  writeInvocationLog(projectRoot, "migrate-951", [
    { tool_id: "tool.rule-scan", status: "success", recorded_at: "2026-03-21T00:00:00Z" },
  ])

  // Record Tier 2 tool evidence required for migration_code_review
  result = runCli(projectRoot, ["record-verification-evidence", "rule-scan-evidence", "automated", "migration_upgrade", "Rule scan complete", "tool.rule-scan"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_code_review"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["record-verification-evidence", "migration-review", "review", "migration_code_review", "Review complete", "migration-review"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "code_review_to_verify", "approved", "QAAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_verify"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["record-verification-evidence", "migration-manual", "manual", "migration_verify", "Manual parity check", "migration-qa"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /verification: missing-evidence \(runtime\)/)
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

test("status and doctor surface migration slice summary for active migration work", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-960",
    "migration-summary",
    "Migration summary fixture",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "strategy_to_upgrade", "approved", "FullstackAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_upgrade"])
  assert.equal(result.status, 0)

  writeMigrationSliceBoard(projectRoot, "migrate-960", makeMigrationSliceBoard({ current_stage: "migration_upgrade" }))

  result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /active work item id: migrate-960/)
  assert.match(result.stdout, /migration slices: 4 total \| ready 1 \| active 1 \| blocked 1 \| verified 1 \| incomplete 3/)
  assert.match(result.stdout, /active migration slices: SLICE-BOARD-1/)
  assert.match(result.stdout, /migration slice readiness: review-blocked \| next gate migration_code_review \| blocked yes/)
  assert.match(result.stdout, /migration slice blocker: active migration slices remain before migration_code_review: SLICE-BOARD-1/)

  result = runCli(projectRoot, ["doctor"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /migration slices: 4 total \| ready 1 \| active 1 \| blocked 1 \| verified 1 \| incomplete 3/)
  assert.match(result.stdout, /blocked migration slices: SLICE-BOARD-3/)
  assert.match(result.stdout, /migration slice readiness: review-blocked \| next gate migration_code_review \| blocked yes/)
})

test("resume-summary JSON includes migration slice readiness when a migration board is active", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-963",
    "migration-resume-readiness",
    "Migration resume readiness fixture",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "strategy_to_upgrade", "approved", "FullstackAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_upgrade"])
  assert.equal(result.status, 0)

  writeMigrationSliceBoard(projectRoot, "migrate-963", makeMigrationSliceBoard({ current_stage: "migration_upgrade" }))

  result = runCli(projectRoot, ["resume-summary", "--json"])
  assert.equal(result.status, 0)

  const payload = JSON.parse(result.stdout)
  assert.equal(payload.migration_slice_board.incomplete, 3)
  assert.equal(payload.migration_slice_readiness.status, "review-blocked")
  assert.equal(payload.migration_slice_readiness.nextGate, "migration_code_review")
  assert.equal(payload.migration_slice_readiness.nextGateBlocked, true)
  assert.ok(payload.migration_slice_readiness.blockers.some((blocker) => blocker.includes("SLICE-BOARD-1")))
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

test("doctor command surfaces shared-artifact waits and long-running runs in task-aware diagnostics", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  state.parallelization = {
    parallel_mode: "limited",
    why: "fixture",
    safe_parallel_zones: ["src/contracts/"],
    sequential_constraints: [],
    integration_checkpoint: null,
    max_active_execution_tracks: 2,
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-BOARD-ACTIVE",
        title: "Own shared artifact surface",
        summary: "Active task owns the shared artifact surface",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-A",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/contracts/api.ts"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-active",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-BOARD-LIMITED",
        title: "Wait on shared artifact surface",
        summary: "Ready task should wait for the shared artifact surface",
        kind: "implementation",
        status: "ready",
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/contracts/api.ts"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-limited",
        concurrency_class: "parallel_limited",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })
  writeBackgroundRuns(projectRoot, [
    {
      run_id: "bg_cli_long",
      title: "CLI long running fixture run",
      status: "running",
      work_item_id: "feature-001",
      task_id: "TASK-BOARD-ACTIVE",
      created_at: "2026-03-20T00:00:00.000Z",
      updated_at: "2026-03-20T00:00:00.000Z",
    },
  ])

  const result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /shared-artifact waits: TASK-BOARD-LIMITED <- TASK-BOARD-ACTIVE \| refs=src\/contracts\/api.ts/)
  assert.match(result.stdout, /orchestration: waiting \| task board has stage-ready work waiting on shared artifact ownership/)
  assert.match(result.stdout, /workflow recommendation: Let active task 'TASK-BOARD-ACTIVE' release the shared artifact surface before dispatching 'TASK-BOARD-LIMITED'\./)
  assert.match(result.stdout, /long-running runs: bg_cli_long/)
})

test("doctor --short surfaces orchestration reason and long-running runs", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  state.parallelization = {
    parallel_mode: "limited",
    why: "fixture",
    safe_parallel_zones: ["src/contracts/"],
    sequential_constraints: [],
    integration_checkpoint: null,
    max_active_execution_tracks: 2,
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-BOARD-ACTIVE",
        title: "Own shared artifact surface",
        summary: "Active task owns the shared artifact surface",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-A",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/contracts/api.ts"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-active",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-BOARD-LIMITED",
        title: "Wait on shared artifact surface",
        summary: "Ready task should wait for the shared artifact surface",
        kind: "implementation",
        status: "ready",
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/contracts/api.ts"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-limited",
        concurrency_class: "parallel_limited",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })
  writeBackgroundRuns(projectRoot, [
    {
      run_id: "bg_cli_long",
      title: "CLI long running fixture run",
      status: "running",
      work_item_id: "feature-001",
      task_id: "TASK-BOARD-ACTIVE",
      created_at: "2026-03-20T00:00:00.000Z",
      updated_at: "2026-03-20T00:00:00.000Z",
    },
  ])

  const result = runCli(projectRoot, ["doctor", "--short"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /doctor \| ok [0-9]+ \| error 0/)
  assert.match(result.stdout, /orchestration: waiting \| task board has stage-ready work waiting on shared artifact ownership/)
  assert.match(result.stdout, /long-running runs: bg_cli_long/)
})

test("validate-task-allocation rejects active parallel-limited overlap outside safe parallel zones", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  state.parallelization = {
    parallel_mode: "limited",
    why: "fixture",
    safe_parallel_zones: ["src/ui/"],
    sequential_constraints: [],
    integration_checkpoint: null,
    max_active_execution_tracks: 2,
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-ZONE-ACTIVE-1",
        title: "UI task already active",
        summary: "Runs inside the declared safe zone",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-A",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/ui/button.tsx"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-zone-active-1",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-ZONE-ACTIVE-2",
        title: "API task outside safe zone",
        summary: "Should be rejected when active alongside other work",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-B",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/server/api.ts"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-zone-active-2",
        concurrency_class: "parallel_limited",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  const result = runCli(projectRoot, ["validate-task-allocation", "feature-001"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /parallel_limited task 'TASK-ZONE-ACTIVE-2' cannot run in parallel outside safe_parallel_zones: src\/server\/api.ts/)
})

test("validate-work-item-board rejects sequential_constraints that reference unknown tasks", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  state.parallelization = {
    parallel_mode: "enabled",
    why: "fixture",
    safe_parallel_zones: [],
    sequential_constraints: ["TASK-REAL -> TASK-MISSING"],
    integration_checkpoint: null,
    max_active_execution_tracks: 2,
  }
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-REAL",
        title: "Real task",
        summary: "Only declared task on the board",
        kind: "implementation",
        status: "in_progress",
        primary_owner: "Dev-A",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/server/real.ts"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-real",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  const result = runCli(projectRoot, ["validate-work-item-board", "feature-001"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /parallelization\.sequential_constraints references unknown task 'TASK-MISSING'/)
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/parallel-agent-rollout/task-board-1",
        created_by: "SolutionLead",
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

test("doctor reports invalid active migration slice board as an explicit error", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-961",
    "invalid-migration-board",
    "Invalid migration board fixture",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  writeMigrationSliceBoard(projectRoot, "migrate-961", {
    mode: "migration",
    current_stage: "migration_strategy",
    parallel_mode: "limited",
    slices: [
      {
        slice_id: "SLICE-BROKEN",
        title: "Broken migration slice",
        summary: "Missing primary owner makes the board invalid",
        kind: "compatibility",
        status: "in_progress",
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/adapters/seam.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["seam drift"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert seam changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 1)
  assert.match(result.stdout, /\[error\] workflow state is valid/)
  assert.match(result.stdout, /\[error\] active work item migration slice board is valid/)
  assert.doesNotMatch(result.stdout, /\[ok\] active work item migration slice board is valid/)
})

test("doctor does not require a migration slice board when migration slices are not in use", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-962",
    "no-migration-board",
    "Migration board remains optional",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["doctor"])

  assert.equal(result.status, 0)
  assert.doesNotMatch(result.stdout, /active work item migration slice board is valid/)
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
  const workItemState = { ...mirrorState, current_stage: "full_solution", current_owner: "SolutionLead", status: "in_progress", work_item_id: "feature-001" }
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

  result = runCli(projectRoot, ["set-parallelization", "limited", "Parallel implementation approved", "integration smoke", "2"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated parallelization for mode 'full' to 'limited'/)

  result = runCli(projectRoot, ["list-work-items"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Active work item: feature-900/)
  assert.match(result.stdout, /\* feature-900 \| FEATURE-900 \| full \| in_progress/)

  result = runCli(projectRoot, ["show-work-item", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Work item: feature-900/)
  assert.match(result.stdout, /feature: FEATURE-900 \(parallel-rollout\)/)
  assert.match(result.stdout, /next action:/)
  assert.match(result.stdout, /artifact readiness:/)

  result = runCli(projectRoot, [
    "create-task",
    "feature-900",
    "TASK-900",
    "Wire CLI",
    "implementation",
  ])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Created task 'TASK-900' on work item 'feature-900'/)

  result = runCli(projectRoot, ["validate-task-allocation", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Task allocation is valid for work item 'feature-900'/)

  result = runCli(projectRoot, ["list-tasks", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Tasks for feature-900:/)
  assert.match(result.stdout, /TASK-900 \| ready \| implementation \| Wire CLI/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "FullstackAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "FullstackAgent", "SolutionLead"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Claimed task 'TASK-900' for 'FullstackAgent'/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "AnotherDev", "SolutionLead"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Implicit reassignment is not allowed; use reassignTask/)

  result = runCli(projectRoot, ["reassign-task", "feature-900", "TASK-900", "AnotherDev"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["reassign-task", "feature-900", "TASK-900", "AnotherDev", "SolutionLead"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Reassigned task 'TASK-900' to 'AnotherDev'/)

  result = runCli(projectRoot, ["release-task", "feature-900", "TASK-900"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires <requested_by>/)

  result = runCli(projectRoot, ["release-task", "feature-900", "TASK-900", "SolutionLead"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Released task 'TASK-900'/)

  result = runCli(projectRoot, ["claim-task", "feature-900", "TASK-900", "FullstackAgent", "SolutionLead"])
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

  result = runCli(projectRoot, ["assign-qa-owner", "feature-900", "TASK-900", "QAAgent", "SolutionLead"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Assigned QA owner 'QAAgent' to task 'TASK-900'/)

  result = runCli(projectRoot, ["set-task-status", "feature-900", "TASK-900", "qa_ready"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Updated task 'TASK-900' to 'qa_ready'/)

  result = runCli(projectRoot, ["validate-work-item-board", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Task board is valid for work item 'feature-900'/)

  result = runCli(projectRoot, ["integration-check", "feature-900"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Integration ready: yes/)

  result = runCli(projectRoot, ["closeout-summary", "feature-900"])
  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /ready to close: no/)

  result = runCli(projectRoot, ["reconcile-work-items", "feature-900"])
  assert.equal(result.status, 1)
  assert.match(result.stdout, /Work items checked: 1/)
  assert.match(result.stdout, /all ready to close: no/)
})

test("CLI migration slice commands require explicit strategy blessing", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-950",
    "parallel-migration",
    "Parallel migration setup",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["create-migration-slice", "migrate-950", "SLICE-1", "Adapter seam", "compatibility"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Created migration slice 'SLICE-1'/)

  result = runCli(projectRoot, ["list-migration-slices", "migrate-950"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Migration slices for migrate-950/)
  assert.match(result.stdout, /SLICE-1 \| ready \| compatibility \| Adapter seam/)

  result = runCli(projectRoot, ["claim-migration-slice", "migrate-950", "SLICE-1", "FullstackAgent", "SolutionLead"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Claimed migration slice 'SLICE-1'/)

  result = runCli(projectRoot, ["assign-migration-qa-owner", "migrate-950", "SLICE-1", "QAAgent", "SolutionLead"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-migration-slice-status", "migrate-950", "SLICE-1", "in_progress"])
  assert.equal(result.status, 0)
  result = runCli(projectRoot, ["set-migration-slice-status", "migrate-950", "SLICE-1", "parity_ready"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["validate-migration-slice-board", "migrate-950"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Migration slice board is valid for work item 'migrate-950'/)
})

test("CLI rejects claiming a migration slice blocked by unresolved dependencies", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-951",
    "blocked-migration",
    "Blocked migration setup",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  const boardPath = path.join(projectRoot, ".opencode", "work-items", "migrate-951", "migration-slices.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify({
    mode: "migration",
    current_stage: "migration_strategy",
    parallel_mode: "limited",
    slices: [
      {
        slice_id: "SLICE-BASE",
        title: "Create compatibility seam",
        summary: "Must finish before dependent migration slice starts",
        kind: "compatibility",
        status: "in_progress",
        primary_owner: "FullstackAgent",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/adapters/seam.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["shared seam drift"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert seam changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        slice_id: "SLICE-DEP",
        title: "Consume compatibility seam",
        summary: "Should stay blocked until seam slice is done",
        kind: "compatibility",
        status: "ready",
        primary_owner: null,
        qa_owner: null,
        depends_on: ["SLICE-BASE"],
        blocked_by: ["SLICE-BASE"],
        artifact_refs: ["src/consumers/seam-user.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["consumer mismatch"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert consumer changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  }, null, 2)}\n`, "utf8")

  result = runCli(projectRoot, ["claim-migration-slice", "migrate-951", "SLICE-DEP", "FullstackAgent", "SolutionLead"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Migration slice 'SLICE-DEP' cannot be 'ready' while blocked by unresolved dependencies: SLICE-BASE/)
})

test("validate-migration-slice-board rejects active slices with unresolved dependencies", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-952",
    "invalid-migration-deps",
    "Invalid migration dependency setup",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  const boardPath = path.join(projectRoot, ".opencode", "work-items", "migrate-952", "migration-slices.json")
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify({
    mode: "migration",
    current_stage: "migration_strategy",
    parallel_mode: "limited",
    slices: [
      {
        slice_id: "SLICE-BASE",
        title: "Create compatibility seam",
        summary: "Base migration slice",
        kind: "compatibility",
        status: "in_progress",
        primary_owner: "FullstackAgent",
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["src/adapters/seam.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["shared seam drift"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert seam changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        slice_id: "SLICE-DEP",
        title: "Consume compatibility seam",
        summary: "Invalidly marked active while its dependency is unresolved",
        kind: "compatibility",
        status: "in_progress",
        primary_owner: "FullstackAgent",
        qa_owner: null,
        depends_on: ["SLICE-BASE"],
        blocked_by: ["SLICE-BASE"],
        artifact_refs: ["src/consumers/seam-user.ts"],
        preserved_invariants: ["existing runtime behavior"],
        compatibility_risks: ["consumer mismatch"],
        verification_targets: ["parity smoke"],
        rollback_notes: ["revert consumer changes"],
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  }, null, 2)}\n`, "utf8")

  result = runCli(projectRoot, ["validate-migration-slice-board", "migrate-952"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Migration slice 'SLICE-DEP' cannot be 'in_progress' while blocked by unresolved dependencies: SLICE-BASE/)
})

test("CLI advance-stage blocks migration review when slice board is still incomplete", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, [
    "create-work-item",
    "migration",
    "MIGRATE-953",
    "migration-review-gate",
    "Migration review gating fixture",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_baseline"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "baseline_to_strategy", "approved", "MasterOrchestrator"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_strategy"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-parallelization", "limited", "Safe migration slices", "parity smoke", "2"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["create-migration-slice", "migrate-953", "SLICE-953", "Adapter seam", "compatibility"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["claim-migration-slice", "migrate-953", "SLICE-953", "FullstackAgent", "SolutionLead"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-migration-slice-status", "migrate-953", "SLICE-953", "in_progress"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "strategy_to_upgrade", "approved", "FullstackAgent"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_upgrade"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["set-approval", "upgrade_to_code_review", "approved", "CodeReviewer"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["advance-stage", "migration_code_review"])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /active migration slices remain: SLICE-953/)
})

test("CLI rejects quick items carrying task data through managed validation", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "quick", "TASK-930", "quick-stale-board", "Quick item"])
  assert.equal(result.status, 0)

  writeTaskBoard(projectRoot, "task-930", {
    mode: "full",
    current_stage: "full_solution",
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: null,
        created_by: "SolutionLead",
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
    current_stage: "full_solution",
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: null,
        created_by: "SolutionLead",
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

  result = runCli(projectRoot, ["claim-task", "feature-931", "TASK-931", "Dev-A", "SolutionLead"])
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

  result = runCli(projectRoot, ["claim-task", "feature-934", "TASK-934", "Dev-A", "SolutionLead"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["reassign-task", "feature-934", "TASK-934", "Dev-B", "QAAgent"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Only MasterOrchestrator or SolutionLead can reassign primary_owner/)
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
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: null,
        created_by: "SolutionLead",
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

  result = runCli(projectRoot, ["claim-task", "feature-935", "TASK-935", "Dev-A", "SolutionLead"])
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
  assert.match(result.stdout, /policy-trace/)
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
