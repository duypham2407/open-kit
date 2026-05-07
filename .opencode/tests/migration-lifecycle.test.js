/**
 * Acceptance smoke tests for the full migration lifecycle.
 *
 * These tests exercise the end-to-end /migrate workflow:
 *   start-task migration
 *   → migration_baseline  (record evidence, set migration_context)
 *   → migration_strategy  (auto-scaffold solution package, approve gate)
 *   → migration_upgrade   (create slices, claim, complete slices)
 *   → migration_code_review (approve gate)
 *   → migration_verify    (record review+runtime+automated evidence, approve gate)
 *   → migration_done
 *
 * Secondary scenarios:
 *   - lane_source = user_explicit is persisted on start-task migration
 *   - requirement_gap with user_explicit lane stays blocked (no auto-escalate)
 *   - migration_context CLI commands (set, append-*, show)
 */

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CLI = path.resolve(__dirname, "../workflow-state.js")
const OPENKIT_ENV_KEYS = [
  "OPENKIT_PROJECT_ROOT",
  "OPENKIT_KIT_ROOT",
  "OPENKIT_WORKFLOW_STATE",
  "OPENKIT_GLOBAL_MODE",
  "OPENKIT_ENFORCEMENT_LEVEL",
  "OPENCODE_HOME",
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openkit-migration-lifecycle-"))
}

function setupTempRuntime(projectRoot) {
  const opencodeDir = path.join(projectRoot, ".opencode")
  const contextCoreDir = path.join(projectRoot, "context", "core")
  const templatesDir = path.join(projectRoot, "docs", "templates")
  const hooksDir = path.join(projectRoot, "hooks")
  const skillsDir = path.join(projectRoot, "skills", "using-skills")

  fs.mkdirSync(opencodeDir, { recursive: true })
  fs.mkdirSync(path.join(projectRoot, "docs", "solution"), { recursive: true })
  fs.mkdirSync(templatesDir, { recursive: true })
  fs.mkdirSync(hooksDir, { recursive: true })
  fs.mkdirSync(skillsDir, { recursive: true })
  fs.mkdirSync(contextCoreDir, { recursive: true })

  // Seed the fixture workflow-state.json
  const fixtureState = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../workflow-state.json"), "utf8"),
  )
  fs.writeFileSync(
    path.join(opencodeDir, "workflow-state.json"),
    `${JSON.stringify(fixtureState, null, 2)}\n`,
    "utf8",
  )

  // Minimal opencode.json
  fs.writeFileSync(
    path.join(opencodeDir, "opencode.json"),
    `${JSON.stringify(
      {
        kit: {
          name: "OpenKit AI Software Factory",
          version: "0.3.12",
          entryAgent: "MasterOrchestrator",
          registry: { path: "registry.json", schema: "openkit/component-registry@1" },
          installManifest: {
            path: ".opencode/install-manifest.json",
            schema: "openkit/install-manifest@1",
          },
          activeProfile: "openkit-core",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  )

  // Minimal registry.json
  fs.writeFileSync(
    path.join(projectRoot, "registry.json"),
    `${JSON.stringify(
      {
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
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  )

  // Minimal install-manifest.json
  fs.writeFileSync(
    path.join(opencodeDir, "install-manifest.json"),
    `${JSON.stringify(
      { schema: "openkit/install-manifest@1", manifestVersion: 1, installation: { activeProfile: "openkit-core" } },
      null,
      2,
    )}\n`,
    "utf8",
  )

  // Hooks and skills stubs
  fs.writeFileSync(path.join(hooksDir, "hooks.json"), '{"hooks":{}}\n', "utf8")
  fs.writeFileSync(path.join(hooksDir, "session-start"), "#!/usr/bin/env bash\n", "utf8")
  fs.writeFileSync(path.join(skillsDir, "SKILL.md"), "# using-skills\n", "utf8")
  fs.writeFileSync(path.join(opencodeDir, "workflow-state.js"), "#!/usr/bin/env node\n", "utf8")

  // Copy real migration templates
  for (const template of [
    "migration-solution-package-template.md",
    "migration-report-template.md",
  ]) {
    fs.copyFileSync(
      path.resolve(__dirname, "../../docs/templates", template),
      path.join(templatesDir, template),
    )
  }

  // Minimal context docs that the runtime validation requires
  const workflowLines = [
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
  ]
  fs.writeFileSync(path.join(contextCoreDir, "workflow.md"), workflowLines.join("\n"), "utf8")
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
    "# Runtime Surfaces\n\nUse `openkit doctor` for product and workspace readiness.\n",
    "utf8",
  )
  fs.writeFileSync(
    path.join(contextCoreDir, "session-resume.md"),
    "# Session Resume Protocol\n\nRun `node .opencode/workflow-state.js resume-summary` when resuming.\n",
    "utf8",
  )
}

function run(projectRoot, args) {
  const env = { ...process.env }
  for (const key of OPENKIT_ENV_KEYS) {
    delete env[key]
  }

  return spawnSync("node", [CLI, ...args], { cwd: projectRoot, encoding: "utf8", env })
}

function assertOk(result, label) {
  if (result.status !== 0) {
    throw new Error(
      `[${label}] CLI exited with ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
  }
}

function readState(projectRoot) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"),
  )
}

function writeMigrationSliceBoard(projectRoot, workItemId, board) {
  const boardPath = path.join(
    projectRoot,
    ".opencode",
    "work-items",
    workItemId,
    "migration-slices.json",
  )
  fs.mkdirSync(path.dirname(boardPath), { recursive: true })
  fs.writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("full migration lifecycle: start-task to migration_done", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  // 1. Start a migration work item (user_explicit lane)
  let r = run(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-001",
    "upgrade-react-18",
    "Upgrade React 17 to React 18 across the app",
    "--lane-source",
    "user_explicit",
  ])
  assertOk(r, "start-task")
  assert.match(r.stdout, /Started migration task/)

  let state = readState(projectRoot)
  assert.equal(state.mode, "migration")
  assert.equal(state.lane_source, "user_explicit")
  assert.equal(state.current_stage, "migration_intake")
  assert.deepEqual(state.migration_context, {
    baseline_summary: null,
    target_outcome: null,
    preserved_invariants: [],
    allowed_behavior_changes: [],
    compatibility_hotspots: [],
    baseline_evidence_refs: [],
    rollback_checkpoints: [],
  })

  const workItemId = state.work_item_id

  // 2. Advance to migration_baseline
  r = run(projectRoot, ["advance-stage", "migration_baseline"])
  assertOk(r, "advance-stage migration_baseline")
  state = readState(projectRoot)
  assert.equal(state.current_stage, "migration_baseline")

  // 3. Record migration_context fields at baseline
  r = run(projectRoot, [
    "set-migration-context",
    "--baseline-summary",
    "React 17.0.2 currently in use; all tests passing on Node 18.",
    "--target-outcome",
    "React 18 with concurrent features enabled and no breaking render regressions.",
  ])
  assertOk(r, "set-migration-context")

  r = run(projectRoot, ["append-preserved-invariant", "All existing component render outputs must be identical"])
  assertOk(r, "append-preserved-invariant 1")

  r = run(projectRoot, ["append-preserved-invariant", "No changes to public API surface of shared components"])
  assertOk(r, "append-preserved-invariant 2")

  r = run(projectRoot, ["append-baseline-evidence", "docs/baseline/react17-test-run-2026-03-31.txt"])
  assertOk(r, "append-baseline-evidence 1")

  r = run(projectRoot, ["append-baseline-evidence", "docs/baseline/react17-bundle-size-2026-03-31.txt"])
  assertOk(r, "append-baseline-evidence 2")

  r = run(projectRoot, ["append-compatibility-hotspot", "ReactDOM.render -> createRoot migration in src/index.js"])
  assertOk(r, "append-compatibility-hotspot")

  // 4. show-migration-context returns the recorded fields
  r = run(projectRoot, ["show-migration-context"])
  assertOk(r, "show-migration-context")
  const mc = JSON.parse(r.stdout)
  assert.equal(mc.baseline_summary, "React 17.0.2 currently in use; all tests passing on Node 18.")
  assert.equal(mc.target_outcome, "React 18 with concurrent features enabled and no breaking render regressions.")
  assert.deepEqual(mc.preserved_invariants, [
    "All existing component render outputs must be identical",
    "No changes to public API surface of shared components",
  ])
  assert.deepEqual(mc.baseline_evidence_refs, [
    "docs/baseline/react17-test-run-2026-03-31.txt",
    "docs/baseline/react17-bundle-size-2026-03-31.txt",
  ])
  assert.deepEqual(mc.compatibility_hotspots, [
    "ReactDOM.render -> createRoot migration in src/index.js",
  ])

  // 5. Approve baseline_to_strategy gate → advance to migration_strategy
  r = run(projectRoot, [
    "set-approval",
    "baseline_to_strategy",
    "approved",
    "MasterOrchestrator",
    "2026-03-31",
    "Baseline captured and hotspots identified",
  ])
  assertOk(r, "set-approval baseline_to_strategy")

  r = run(projectRoot, ["advance-stage", "migration_strategy"])
  assertOk(r, "advance-stage migration_strategy")
  state = readState(projectRoot)
  assert.equal(state.current_stage, "migration_strategy")

  // 6. Verify the migration solution package was auto-scaffolded on advance to migration_strategy
  state = readState(projectRoot)
  assert.ok(state.artifacts.solution_package, "solution_package artifact should be auto-scaffolded at migration_strategy")
  assert.equal(fs.existsSync(path.join(projectRoot, state.artifacts.solution_package)), true)

  // 7. Add rollback checkpoint before upgrade
  r = run(projectRoot, ["append-rollback-checkpoint", "Git tag react17-baseline before upgrade commits"])
  assertOk(r, "append-rollback-checkpoint")

  // 8. Approve strategy_to_upgrade → advance to migration_upgrade
  r = run(projectRoot, [
    "set-approval",
    "strategy_to_upgrade",
    "approved",
    "FullstackAgent",
    "2026-03-31",
    "Rollback plan and slice strategy are solid",
  ])
  assertOk(r, "set-approval strategy_to_upgrade")

  r = run(projectRoot, ["advance-stage", "migration_upgrade"])
  assertOk(r, "advance-stage migration_upgrade")
  state = readState(projectRoot)
  assert.equal(state.current_stage, "migration_upgrade")

  // 9. Create migration slices
  r = run(projectRoot, ["create-migration-slice", workItemId, "SLICE-001", "Migrate ReactDOM.render usages", "upgrade"])
  assertOk(r, "create-migration-slice 1")

  r = run(projectRoot, ["create-migration-slice", workItemId, "SLICE-002", "Update act() imports in tests", "upgrade"])
  assertOk(r, "create-migration-slice 2")

  // 10. Complete slices (claim → in_progress → assign QA → parity_ready → verified)
  r = run(projectRoot, ["claim-migration-slice", workItemId, "SLICE-001", "FullstackAgent", "MasterOrchestrator"])
  assertOk(r, "claim SLICE-001")
  r = run(projectRoot, ["set-migration-slice-status", workItemId, "SLICE-001", "in_progress"])
  assertOk(r, "SLICE-001 in_progress")
  r = run(projectRoot, ["assign-migration-qa-owner", workItemId, "SLICE-001", "QAAgent", "MasterOrchestrator"])
  assertOk(r, "SLICE-001 assign qa")
  r = run(projectRoot, ["set-migration-slice-status", workItemId, "SLICE-001", "parity_ready"])
  assertOk(r, "SLICE-001 parity_ready")
  r = run(projectRoot, ["set-migration-slice-status", workItemId, "SLICE-001", "verified"])
  assertOk(r, "SLICE-001 verified")

  r = run(projectRoot, ["claim-migration-slice", workItemId, "SLICE-002", "FullstackAgent", "MasterOrchestrator"])
  assertOk(r, "claim SLICE-002")
  r = run(projectRoot, ["set-migration-slice-status", workItemId, "SLICE-002", "in_progress"])
  assertOk(r, "SLICE-002 in_progress")
  r = run(projectRoot, ["assign-migration-qa-owner", workItemId, "SLICE-002", "QAAgent", "MasterOrchestrator"])
  assertOk(r, "SLICE-002 assign qa")
  r = run(projectRoot, ["set-migration-slice-status", workItemId, "SLICE-002", "parity_ready"])
  assertOk(r, "SLICE-002 parity_ready")
  r = run(projectRoot, ["set-migration-slice-status", workItemId, "SLICE-002", "verified"])
  assertOk(r, "SLICE-002 verified")

  // 10b. Record tool evidence required by migration_code_review gates.
  //      Two gates must be satisfied:
  //      1. Tool evidence gate (Tier 2): needs rule-scan or codemod-preview source
  //      2. Runtime policy engine (Tier 3): needs tool invocation log entries or a manual override
  r = run(projectRoot, [
    "record-verification-evidence",
    "tool-rule-scan-001",
    "automated",
    "migration_upgrade",
    "Ran rule-scan on migrated sources; no violations detected",
    "rule-scan",
  ])
  assertOk(r, "record rule-scan tool evidence")

  // Override the runtime policy gate (no actual tool invocation log in test env)
  r = run(projectRoot, [
    "record-verification-evidence",
    "policy-override-migration-cr",
    "manual",
    "tool-evidence-override:migration_code_review",
    "Test environment override: rule-scan evidence recorded above",
    "manual",
  ])
  assertOk(r, "record policy override for migration_code_review")

  // 11. Approve upgrade_to_code_review → advance to migration_code_review
  r = run(projectRoot, [
    "set-approval",
    "upgrade_to_code_review",
    "approved",
    "CodeReviewer",
    "2026-03-31",
    "Upgrade evidence is satisfactory for review",
  ])
  assertOk(r, "set-approval upgrade_to_code_review")

  r = run(projectRoot, ["advance-stage", "migration_code_review"])
  assertOk(r, "advance-stage migration_code_review")
  state = readState(projectRoot)
  assert.equal(state.current_stage, "migration_code_review")

  // 12. Record review evidence
  r = run(projectRoot, [
    "record-verification-evidence",
    "review-001",
    "review",
    "migration_code_review",
    "Reviewed ReactDOM.render → createRoot changes; parity confirmed",
    "CodeReviewer",
  ])
  assertOk(r, "record review evidence")

  // 13. Approve code_review_to_verify → advance to migration_verify
  r = run(projectRoot, [
    "set-approval",
    "code_review_to_verify",
    "approved",
    "QAAgent",
    "2026-03-31",
    "Review findings resolved",
  ])
  assertOk(r, "set-approval code_review_to_verify")

  r = run(projectRoot, ["advance-stage", "migration_verify"])
  assertOk(r, "advance-stage migration_verify")
  state = readState(projectRoot)
  assert.equal(state.current_stage, "migration_verify")

  // 14. Record required evidence kinds for migration_verify (review, runtime, automated, manual)
  r = run(projectRoot, [
    "record-verification-evidence",
    "runtime-001",
    "runtime",
    "migration_verify",
    "Manual smoke test: app starts, renders correctly on React 18",
    "QAAgent",
  ])
  assertOk(r, "record runtime evidence")

  r = run(projectRoot, [
    "record-verification-evidence",
    "automated-001",
    "automated",
    "migration_verify",
    "Test suite: 342 tests passing, 0 failing after React 18 upgrade",
    "QAAgent",
    "npm test",
    "0",
  ])
  assertOk(r, "record automated evidence")

  r = run(projectRoot, [
    "record-verification-evidence",
    "manual-001",
    "manual",
    "migration_verify",
    "Manual parity checklist: output matches baseline on all critical paths",
    "QAAgent",
  ])
  assertOk(r, "record manual evidence")

  // 15. Approve migration_verified gate → advance to migration_done
  r = run(projectRoot, [
    "set-approval",
    "migration_verified",
    "approved",
    "QAAgent",
    "2026-03-31",
    "Parity confirmed; no regressions observed",
  ])
  assertOk(r, "set-approval migration_verified")

  r = run(projectRoot, ["advance-stage", "migration_done"])
  assertOk(r, "advance-stage migration_done")

  state = readState(projectRoot)
  assert.equal(state.current_stage, "migration_done")
  assert.equal(state.status, "done")

  // 16. Final state invariants
  assert.equal(state.lane_source, "user_explicit")
  assert.equal(state.mode, "migration")
  assert.ok(state.migration_context.baseline_summary)
  assert.ok(state.migration_context.target_outcome)
  assert.ok(state.migration_context.preserved_invariants.length > 0)
  assert.ok(state.migration_context.baseline_evidence_refs.length > 0)
  assert.ok(state.migration_context.rollback_checkpoints.length > 0)
  assert.ok(state.migration_context.compatibility_hotspots.length > 0)
})

test("lane_source = user_explicit is persisted when using --lane-source flag", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const r = run(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-002",
    "upgrade-jest-29",
    "Upgrade Jest 27 to 29",
    "--lane-source",
    "user_explicit",
  ])
  assertOk(r, "start-task with --lane-source user_explicit")

  const state = readState(projectRoot)
  assert.equal(state.lane_source, "user_explicit")
  assert.equal(state.mode, "migration")
})

test("lane_source defaults to orchestrator_routed when flag is omitted", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const r = run(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-003",
    "upgrade-node-20",
    "Upgrade Node 18 to 20",
  ])
  assertOk(r, "start-task without --lane-source")

  const state = readState(projectRoot)
  // Default lane_source for migration via start-task (no explicit flag) should be orchestrator_routed
  assert.equal(state.lane_source, "orchestrator_routed")
})

test("requirement_gap with user_explicit lane stays blocked and does not escalate to full", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  // Start migration with user_explicit
  let r = run(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-004",
    "upgrade-ts-5",
    "Upgrade TypeScript 4 to 5",
    "--lane-source",
    "user_explicit",
  ])
  assertOk(r, "start-task")

  r = run(projectRoot, ["advance-stage", "migration_baseline"])
  assertOk(r, "advance-stage migration_baseline")

  // Route rework for requirement_gap — with user_explicit this should stay in migration (blocked)
  r = run(projectRoot, ["route-rework", "requirement_gap"])
  // CLI should exit 0 but route to migration_verify and set blocked
  assertOk(r, "route-rework requirement_gap")

  const state = readState(projectRoot)
  // Must NOT have escalated to full mode
  assert.equal(state.mode, "migration")
  assert.equal(state.status, "blocked")
  assert.equal(state.current_stage, "migration_verify")
})

test("migration_context commands reject non-migration mode", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  // Default fixture is quick mode — all migration_context commands should fail
  let r = run(projectRoot, [
    "set-migration-context",
    "--baseline-summary",
    "Should fail",
  ])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /migration mode/)

  r = run(projectRoot, ["append-preserved-invariant", "Should fail"])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /migration mode/)

  r = run(projectRoot, ["append-baseline-evidence", "Should fail"])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /migration mode/)

  r = run(projectRoot, ["append-rollback-checkpoint", "Should fail"])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /migration mode/)

  r = run(projectRoot, ["append-compatibility-hotspot", "Should fail"])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /migration mode/)

  r = run(projectRoot, ["show-migration-context"])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /migration mode/)
})

test("migration_context append commands reject duplicate entries", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  run(projectRoot, [
    "start-task",
    "migration",
    "MIGRATE-005",
    "dedup-test",
    "Dedup test migration",
    "--lane-source",
    "user_explicit",
  ])

  run(projectRoot, ["advance-stage", "migration_baseline"])

  const invariant = "No public API changes"
  let r = run(projectRoot, ["append-preserved-invariant", invariant])
  assertOk(r, "first append-preserved-invariant")

  // Second append of the same value must fail
  r = run(projectRoot, ["append-preserved-invariant", invariant])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /already recorded/)

  const ref = "docs/baseline/run.txt"
  r = run(projectRoot, ["append-baseline-evidence", ref])
  assertOk(r, "first append-baseline-evidence")
  r = run(projectRoot, ["append-baseline-evidence", ref])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /already recorded/)

  const checkpoint = "tag v1.0.0"
  r = run(projectRoot, ["append-rollback-checkpoint", checkpoint])
  assertOk(r, "first append-rollback-checkpoint")
  r = run(projectRoot, ["append-rollback-checkpoint", checkpoint])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /already recorded/)

  const hotspot = "src/index.js render call"
  r = run(projectRoot, ["append-compatibility-hotspot", hotspot])
  assertOk(r, "first append-compatibility-hotspot")
  r = run(projectRoot, ["append-compatibility-hotspot", hotspot])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /already recorded/)
})
