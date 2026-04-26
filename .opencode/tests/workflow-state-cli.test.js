import test, { afterEach, beforeEach } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OPENKIT_ENV_KEYS = [
  "OPENKIT_PROJECT_ROOT",
  "OPENKIT_KIT_ROOT",
  "OPENKIT_WORKFLOW_STATE",
  "OPENKIT_GLOBAL_MODE",
  "OPENKIT_ENFORCEMENT_LEVEL",
  "OPENCODE_HOME",
]

let savedEnv = {}

beforeEach(() => {
  savedEnv = {}
  for (const key of OPENKIT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  }
})

afterEach(() => {
  for (const key of OPENKIT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(savedEnv, key)) {
      process.env[key] = savedEnv[key]
    } else {
      delete process.env[key]
    }
  }
  savedEnv = {}
})

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
  const env = { ...process.env }
  delete env.OPENKIT_GLOBAL_MODE
  delete env.OPENKIT_PROJECT_ROOT
  delete env.OPENKIT_REPOSITORY_ROOT
  delete env.OPENKIT_WORKFLOW_STATE
  delete env.OPENKIT_KIT_ROOT
  delete env.OPENCODE_HOME

  return spawnSync("node", [path.resolve(__dirname, "../workflow-state.js"), ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env,
  })
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
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

function writeSupervisorDialogueStore(projectRoot, workItemId, overrides = {}) {
  const storePath = path.join(projectRoot, ".opencode", "work-items", workItemId, "supervisor-dialogue.json")
  const store = {
    schema: "openkit/supervisor-dialogue-store@1",
    session: {
      schema: "openkit/supervisor-session@1",
      work_item_id: workItemId,
      session_id: `supervisor-${workItemId}`,
      session_sequence: 1,
      status: "attached",
      attached_work_item_id: workItemId,
      provider: "openclaw",
      transport_health: "degraded",
      delivery_mode: "watch",
      degraded_mode: true,
      attention_required: true,
      timestamps: {
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:05.000Z",
        attached_at: "2026-03-21T00:00:00.000Z",
        detached_at: null,
      },
      last_detach_reason: null,
    },
    checkpoint: {
      schema: "openkit/supervisor-checkpoint@1",
      last_outbound_event_seq: 4,
      last_delivered_outbound_seq: 2,
      last_inbound_message_seq: 6,
      last_processed_inbound_seq: 6,
      dedupe_message_ids: ["msg-1", "msg-2", "msg-3", "msg-4", "msg-concern", "msg-5"],
      dedupe_proposal_keys: ["proposal:repeat-runtime"],
      updated_at: "2026-03-21T00:00:05.000Z",
    },
    outbound_events: [
      {
        schema: "openkit/supervisor-event@1",
        event_id: "evt-pending",
        event_seq: 1,
        work_item_id: workItemId,
        origin: "openkit",
        event_type: "stage_changed",
        created_at: "2026-03-21T00:00:01.000Z",
        state_cursor: { stage: "full_implementation" },
        summary: "Implementation started.",
        details: {},
        delivery_status: "pending",
        delivered_at: null,
        last_delivery_attempt_at: null,
        last_delivery_error: null,
        delivery_attempts: [],
      },
      {
        schema: "openkit/supervisor-event@1",
        event_id: "evt-delivered",
        event_seq: 2,
        work_item_id: workItemId,
        origin: "openkit",
        event_type: "verification_signal",
        created_at: "2026-03-21T00:00:02.000Z",
        state_cursor: { stage: "full_implementation" },
        summary: "Verification recorded.",
        details: {},
        delivery_status: "delivered",
        delivered_at: "2026-03-21T00:00:03.000Z",
        last_delivery_attempt_at: "2026-03-21T00:00:03.000Z",
        last_delivery_error: null,
        delivery_attempts: [],
      },
      {
        schema: "openkit/supervisor-event@1",
        event_id: "evt-failed",
        event_seq: 3,
        work_item_id: workItemId,
        origin: "openkit",
        event_type: "issue_or_blocker_signal",
        created_at: "2026-03-21T00:00:03.000Z",
        state_cursor: { stage: "full_implementation" },
        summary: "Supervisor delivery failed.",
        details: {},
        delivery_status: "failed",
        delivered_at: null,
        last_delivery_attempt_at: "2026-03-21T00:00:04.000Z",
        last_delivery_error: "OpenClaw unavailable",
        delivery_attempts: [],
      },
      {
        schema: "openkit/supervisor-event@1",
        event_id: "evt-skipped",
        event_seq: 4,
        work_item_id: workItemId,
        origin: "openkit",
        event_type: "human_attention_needed",
        created_at: "2026-03-21T00:00:04.000Z",
        state_cursor: { stage: "full_implementation" },
        summary: "Supervisor delivery skipped while disabled.",
        details: {},
        delivery_status: "skipped",
        delivered_at: null,
        last_delivery_attempt_at: "2026-03-21T00:00:05.000Z",
        last_delivery_error: "Supervisor disabled",
        delivery_attempts: [],
      },
    ],
    inbound_messages: [
      { message_id: "msg-1", message_seq: 1, work_item_id: workItemId, type: "proposal", intent: "review", target: "TASK-1", body: "Consider adding context.", proposal_key: "proposal:review-task" },
      { message_id: "msg-2", message_seq: 2, work_item_id: workItemId, type: "request", intent: "approve", target: "fullstack_to_code_review", body: "Approve this gate.", proposal_key: "proposal:approve-gate" },
      { message_id: "msg-3", message_seq: 3, work_item_id: workItemId, type: "request", intent: "review", target: "TASK-1", body: "Repeat review pressure.", proposal_key: "proposal:repeat-runtime" },
      { message_id: "msg-4", message_seq: 4, work_item_id: workItemId, type: "attention", intent: "attention", target: "operator", body: "Needs human attention.", proposal_key: null },
      { message_id: "msg-concern", message_seq: 5, work_item_id: workItemId, type: "concern", intent: "concern", target: "feature-940", body: "Concern about authority coverage.", proposal_key: null },
      { message_id: "msg-5", message_seq: 6, work_item_id: workItemId, type: "message", intent: null, target: null, body: "Missing target.", proposal_key: null },
    ],
    adjudications: [
      { message_id: "msg-1", message_seq: 1, proposal_key: "proposal:review-task", disposition: "recorded_suggestion", actionable: false, reason: "advisory", authority_boundary: "openkit_only_mutates_state_and_executes_code", duplicate_of: null, created_at: "2026-03-21T00:00:01.000Z", details: {} },
      { message_id: "msg-2", message_seq: 2, proposal_key: "proposal:approve-gate", disposition: "rejected_authority_boundary", actionable: false, reason: "OpenClaw cannot mutate OpenKit workflow state.", authority_boundary: "openkit_only_mutates_state_and_executes_code", duplicate_of: null, created_at: "2026-03-21T00:00:02.000Z", details: {} },
      { message_id: "msg-3", message_seq: 3, proposal_key: "proposal:repeat-runtime", disposition: "duplicate_ignored", actionable: false, reason: "duplicate_proposal_key", authority_boundary: "openkit_only_mutates_state_and_executes_code", duplicate_of: "msg-1", created_at: "2026-03-21T00:00:03.000Z", details: {} },
      { message_id: "msg-4", message_seq: 4, proposal_key: null, disposition: "attention_required", actionable: false, reason: "OpenClaw requested operator attention.", authority_boundary: "openkit_only_mutates_state_and_executes_code", duplicate_of: null, created_at: "2026-03-21T00:00:04.000Z", details: {} },
      { message_id: "msg-concern", message_seq: 5, proposal_key: null, disposition: "concern_recorded", actionable: false, reason: "OpenClaw concern recorded for OpenKit operator review.", authority_boundary: "openkit_only_mutates_state_and_executes_code", duplicate_of: null, created_at: "2026-03-21T00:00:05.000Z", details: {} },
      { message_id: "msg-5", message_seq: 6, proposal_key: null, disposition: "invalid_rejected", actionable: false, reason: "missing_minimum_inbound_information", authority_boundary: "openkit_only_mutates_state_and_executes_code", duplicate_of: null, created_at: "2026-03-21T00:00:06.000Z", details: { missing_fields: ["intent", "target"] } },
    ],
    dedupe_records: [
      { schema: "openkit/supervisor-dedupe-record@1", work_item_id: workItemId, message_id: "msg-duplicate-message", message_seq: 6, proposal_key: null, duplicate_of: "msg-1", reason: "duplicate_message_id", created_at: "2026-03-21T00:00:06.000Z", actionable: false },
      { schema: "openkit/supervisor-dedupe-record@1", work_item_id: workItemId, message_id: "msg-duplicate-proposal", message_seq: 7, proposal_key: "proposal:repeat-runtime", duplicate_of: "msg-3", reason: "duplicate_proposal_key", created_at: "2026-03-21T00:00:07.000Z", actionable: false },
    ],
    delivery_records: [],
    ...overrides,
  }
  writeJson(storePath, store)
  return store
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

function makeScanEvidenceDetails(overrides = {}) {
  return {
    validation_surface: "runtime_tooling",
    scan_evidence: {
      evidence_type: "direct_tool",
      direct_tool: {
        tool_id: "tool.rule-scan",
        availability_state: "available",
        result_state: "succeeded",
        reason: null,
        invocation_ref: {
          work_item_id: "feature-001",
          entry_id: "invocation-1",
          log_path: ".opencode/work-items/feature-001/tool-invocations.json",
        },
        namespace_status: "callable",
        stale_process: {
          suspected: false,
          affected_surface: "in_session",
          caveat: "No stale role namespace observed in this evidence fixture.",
        },
      },
      substitute: null,
      scan_kind: "rule",
      target_scope_summary: "changed runtime workflow files",
      rule_config_source: "bundled",
      finding_counts: {
        total: 2301,
        blocking: 0,
        true_positive: 0,
        non_blocking_noise: 2298,
        false_positive: 3,
        unclassified: 0,
      },
      severity_summary: {
        WARNING: 2301,
      },
      triage_summary: {
        groupCount: 2,
        blockingCount: 0,
        truePositiveCount: 0,
        nonBlockingNoiseCount: 1,
        falsePositiveCount: 1,
        followUpCount: 0,
        unclassifiedCount: 0,
        groups: [
          {
            ruleId: "openkit.noisy-quality-rule",
            severity: "WARNING",
            classification: "non_blocking_noise",
            count: 2298,
            rationale: "Broad quality noise unrelated to the changed evidence read model.",
          },
          {
            ruleId: "openkit.fixture-token",
            severity: "WARNING",
            classification: "false_positive",
            count: 3,
            rationale: "Test-fixture placeholder only; no production runtime exposure.",
          },
        ],
      },
      false_positive_summary: {
        count: 3,
        items: [
          {
            rule_id: "openkit.fixture-token",
            file: "tests/fixtures/token.js",
            context: "test fixture placeholder",
            rationale: "Not a real secret and not loaded by runtime code.",
            impact: "No production or runtime security impact.",
            follow_up: "none",
          },
        ],
      },
      manual_override: null,
    },
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
  assert.match(result.stdout, /diagnostics: \[global_cli\] openkit doctor for global readiness \| \[compatibility_runtime\] node \.opencode\/workflow-state\.js doctor for runtime diagnostics/)
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
  assert.equal(payload.diagnostics.global_surface, "global_cli")
  assert.equal(payload.diagnostics.runtime_surface, "compatibility_runtime")
  assert.deepEqual(payload.validation_surfaces, {
    global_cli: "OpenKit product CLI install, launch, upgrade, uninstall, and doctor checks",
    in_session: "Slash-command lane routing, workflow stage ownership, and handoff behavior",
    compatibility_runtime: "Repository-local workflow-state inspection, resume, readiness, issue, and evidence diagnostics",
    runtime_tooling: "OpenKit runtime tools including graph, semantic search, AST, syntax, codemod, MCP, browser, and background execution",
    documentation: "Roadmap, operator, maintainer, governance, and runbook artifacts",
    target_project_app: "Target-project build, lint, and test commands only when the project defines them",
  })
  assert.equal(typeof payload.verification_readiness, "object")
  assert.ok(Array.isArray(payload.verification_evidence))
  assert.equal(typeof payload.issue_telemetry, "object")
})

test("record-verification-evidence preserves scan evidence details and compact resume/read models", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const details = makeScanEvidenceDetails()
  const result = runCli(projectRoot, [
    "record-verification-evidence",
    "scan-direct-quality",
    "automated",
    "full_code_review",
    "Rule scan completed with classified noisy findings",
    "tool.rule-scan",
    "semgrep --config bundled/rules --json src/runtime",
    "0",
    "artifacts/rule-scan.json",
    "--details-json",
    JSON.stringify(details),
  ])

  assert.equal(result.status, 0)

  const state = JSON.parse(fs.readFileSync(path.join(projectRoot, ".opencode", "workflow-state.json"), "utf8"))
  const evidence = state.verification_evidence.find((entry) => entry.id === "scan-direct-quality")
  assert.equal(evidence.details.validation_surface, "runtime_tooling")
  assert.equal(evidence.details.scan_evidence.evidence_type, "direct_tool")
  assert.equal(evidence.details.scan_evidence.finding_counts.total, 2301)

  const summaryResult = runCli(projectRoot, ["resume-summary", "--json"])
  assert.equal(summaryResult.status, 0)
  const payload = JSON.parse(summaryResult.stdout)
  const scanEvidence = payload.scan_evidence.find((entry) => entry.evidence_id === "scan-direct-quality")
  assert.equal(scanEvidence.validation_surface, "runtime_tooling")
  assert.notEqual(scanEvidence.validation_surface, "target_project_app")
  assert.equal(scanEvidence.evidence_type, "direct_tool")
  assert.equal(scanEvidence.direct_tool.tool_id, "tool.rule-scan")
  assert.equal(scanEvidence.direct_tool.availability_state, "available")
  assert.equal(scanEvidence.direct_tool.result_state, "succeeded")
  assert.equal(scanEvidence.direct_tool.namespace_status, "callable")
  assert.equal(scanEvidence.direct_tool.stale_process.suspected, false)
  assert.equal(scanEvidence.direct_tool.invocation_ref.work_item_id, "feature-001")
  assert.equal(scanEvidence.finding_counts.total, 2301)
  assert.equal(scanEvidence.finding_counts.true_positive, 0)
  assert.equal(scanEvidence.classification_summary.non_blocking_noise_count, 1)
  assert.equal(scanEvidence.classification_summary.true_positive_count, 0)
  assert.equal(scanEvidence.classification_summary.false_positive_count, 1)
  assert.equal(scanEvidence.classification_summary.group_count, 2)
  assert.equal(scanEvidence.false_positive_summary.count, 3)
  assert.deepEqual(scanEvidence.artifact_refs, ["artifacts/rule-scan.json"])
  assert.equal(Object.prototype.hasOwnProperty.call(scanEvidence, "findings"), false)
  assert.ok(payload.scan_evidence_lines.some((line) => (
    line.includes("scan-direct-quality") &&
    line.includes("direct tool.rule-scan available/succeeded") &&
    line.includes("surface runtime_tooling") &&
    line.includes("findings total=2301") &&
    line.includes("false-positive count=3") &&
    line.includes("artifacts artifacts/rule-scan.json")
  )))

  const showResult = runCli(projectRoot, ["show"])
  assert.equal(showResult.status, 0)
  assert.match(showResult.stdout, /scan evidence: scan-direct-quality \| direct tool\.rule-scan available\/succeeded \| surface runtime_tooling \| findings total=2301/)
})

test("show-invocations prints compact scan metadata without raw findings", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)
  writeInvocationLog(projectRoot, "feature-001", [
    {
      tool_id: "tool.rule-scan",
      status: "success",
      stage: "full_implementation",
      owner: "FullstackAgent",
      duration_ms: 12,
      recorded_at: "2026-03-21T00:00:00Z",
      scan_kind: "rule",
      availability_state: "available",
      result_state: "succeeded",
      target_scope_summary: "project path: src/runtime/tools/audit/scan-evidence.js",
      finding_counts: { total: 0 },
      error_summary: null,
      artifact_refs: [".openkit/artifacts/rule-scan.json"],
      evidence_type: "direct_tool",
    },
  ])

  const result = runCli(projectRoot, ["show-invocations", "feature-001"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /tool\.rule-scan \| success/)
  assert.match(result.stdout, /scan=rule availability=available result=succeeded/)
  assert.match(result.stdout, /target=project path: src\/runtime\/tools\/audit\/scan-evidence\.js/)
  assert.match(result.stdout, /findings=0/)
  assert.match(result.stdout, /artifacts=\.openkit\/artifacts\/rule-scan\.json/)
  assert.doesNotMatch(result.stdout, /raw|findings":\[/i)
})

test("scan evidence read models distinguish substitute scans and manual override caveats", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const substituteDetails = makeScanEvidenceDetails({
    validation_surface: "compatibility_runtime",
    scan_evidence: {
      ...makeScanEvidenceDetails().scan_evidence,
      evidence_type: "substitute_scan",
      direct_tool: {
        tool_id: "tool.security-scan",
        availability_state: "unavailable",
        result_state: "unavailable",
        reason: "direct tool was unavailable in the role namespace",
      },
      substitute: {
        ran: true,
        command_or_tool: "semgrep --config bundled/security --json src/runtime",
        validation_surface: "runtime_tooling",
        limitations: "substitute command ran outside direct MCP tool invocation",
      },
      scan_kind: "security",
      finding_counts: {
        total: 1,
        blocking: 0,
        non_blocking_noise: 0,
        false_positive: 1,
        unclassified: 0,
      },
      severity_summary: {
        WARNING: 1,
      },
      triage_summary: {
        groupCount: 1,
        blockingCount: 0,
        nonBlockingNoiseCount: 0,
        falsePositiveCount: 1,
        followUpCount: 0,
        unclassifiedCount: 0,
        groups: [
          {
            ruleId: "openkit.fixture-token",
            severity: "WARNING",
            classification: "false_positive",
            count: 1,
            rationale: "Fixture-only token-looking placeholder.",
          },
        ],
      },
      false_positive_summary: {
        count: 1,
        items: [
          {
            rule_id: "openkit.fixture-token",
            file: "tests/fixtures/token.js",
            context: "test fixture placeholder",
            rationale: "Not a real secret and not loaded by runtime code.",
            impact: "No production or runtime security impact.",
            follow_up: "none",
          },
        ],
      },
      manual_override: null,
    },
  })
  const manualOverrideDetails = makeScanEvidenceDetails({
    validation_surface: "compatibility_runtime",
    scan_evidence: {
      ...makeScanEvidenceDetails().scan_evidence,
      evidence_type: "manual_override",
      direct_tool: {
        tool_id: "tool.rule-scan",
        availability_state: "unavailable",
        result_state: "unavailable",
        reason: "Semgrep executable unavailable in managed tooling path",
      },
      substitute: {
        ran: false,
        command_or_tool: null,
        validation_surface: "runtime_tooling",
        limitations: "no substitute scan output available",
      },
      finding_counts: {
        total: 0,
        blocking: 0,
        non_blocking_noise: 0,
        false_positive: 0,
        unclassified: 0,
      },
      severity_summary: {},
      triage_summary: {
        groupCount: 0,
        blockingCount: 0,
        nonBlockingNoiseCount: 0,
        falsePositiveCount: 0,
        followUpCount: 0,
        unclassifiedCount: 0,
        groups: [],
      },
      false_positive_summary: {
        count: 0,
        items: [],
      },
      manual_override: {
        target_stage: "full_code_review",
        unavailable_tool: "tool.rule-scan",
        reason: "managed Semgrep executable was unavailable",
        substitute_evidence_ids: ["scan-substitute-security"],
        substitute_limitations: "security substitute exists, quality direct evidence unavailable",
        actor: "FullstackAgent",
        caveat: "Manual override does not prove target-project build, lint, or test behavior.",
      },
    },
  })

  let result = runCli(projectRoot, [
    "record-verification-evidence",
    "scan-substitute-security",
    "automated",
    "full_qa",
    "Security scan substitute completed",
    "semgrep-substitute",
    "semgrep --config bundled/security --json src/runtime",
    "0",
    "artifacts/security-substitute.json",
    "--details-json",
    JSON.stringify(substituteDetails),
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, [
    "record-verification-evidence",
    "scan-manual-override",
    "manual",
    "tool-evidence-override:full_code_review",
    "Manual override recorded because direct rule scan was unavailable",
    "manual",
    "manual override",
    "0",
    "docs/qa/manual-scan-override.md",
    "--details-json",
    JSON.stringify(manualOverrideDetails),
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["resume-summary", "--json"])
  assert.equal(result.status, 0)
  const payload = JSON.parse(result.stdout)
  const substitute = payload.scan_evidence.find((entry) => entry.evidence_id === "scan-substitute-security")
  const override = payload.scan_evidence.find((entry) => entry.evidence_id === "scan-manual-override")
  assert.equal(substitute.validation_surface, "compatibility_runtime")
  assert.equal(substitute.evidence_type, "substitute_scan")
  assert.equal(substitute.direct_tool.availability_state, "unavailable")
  assert.equal(substitute.substitute.ran, true)
  assert.equal(substitute.substitute.command_or_tool, "semgrep --config bundled/security --json src/runtime")
  assert.equal(substitute.substitute.validation_surface, "runtime_tooling")
  assert.equal(override.validation_surface, "compatibility_runtime")
  assert.equal(override.evidence_type, "manual_override")
  assert.equal(override.manual_override.target_stage, "full_code_review")
  assert.equal(override.manual_override.unavailable_tool, "tool.rule-scan")
  assert.match(override.manual_override.caveat, /does not prove target-project build, lint, or test behavior/)
  assert.ok(payload.scan_evidence_lines.some((line) => (
    line.includes("scan-substitute-security") &&
    line.includes("substitute semgrep --config bundled/security --json src/runtime ran") &&
    line.includes("direct tool.security-scan unavailable/unavailable")
  )))
  assert.ok(payload.scan_evidence_lines.some((line) => (
    line.includes("scan-manual-override") &&
    line.includes("manual override for full_code_review: tool.rule-scan") &&
    line.includes("Manual override does not prove target-project build, lint, or test behavior")
  )))

  result = runCli(projectRoot, ["closeout-summary", "feature-001"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /scan evidence: scan-substitute-security \| substitute semgrep --config bundled\/security --json src\/runtime ran/)
  assert.match(result.stdout, /scan evidence: scan-manual-override \| manual override for full_code_review: tool\.rule-scan/)
})

test("show-policy-status reports classified scan evidence blockers", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.work_item_id = "feature-001"
  state.current_stage = "full_implementation"
  state.current_owner = "FullstackAgent"
  state.status = "in_progress"
  state.approvals.fullstack_to_code_review.status = "approved"
  state.verification_evidence = [
    {
      id: "scan-unclassified-cli",
      kind: "automated",
      scope: "full_implementation",
      summary: "Rule scan findings are not classified",
      source: "tool.rule-scan",
      command: "tool.rule-scan",
      exit_status: 0,
      artifact_refs: ["artifacts/rule-scan.json"],
      recorded_at: "2026-03-21T00:00:00.000Z",
      details: makeScanEvidenceDetails({
        scan_evidence: {
          ...makeScanEvidenceDetails().scan_evidence,
          finding_counts: {
            total: 1,
            blocking: 0,
            non_blocking_noise: 0,
            false_positive: 0,
            unclassified: 1,
          },
          triage_summary: {
            groupCount: 1,
            blockingCount: 0,
            nonBlockingNoiseCount: 0,
            falsePositiveCount: 0,
            followUpCount: 0,
            unclassifiedCount: 1,
            groups: [
              {
                ruleId: "openkit.quality.noisy-rule",
                severity: "WARNING",
                classification: "unclassified",
                count: 1,
              },
            ],
          },
        },
      }),
    },
  ]
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  const workItemStatePath = path.join(projectRoot, ".opencode", "work-items", "feature-001", "state.json")
  fs.mkdirSync(path.dirname(workItemStatePath), { recursive: true })
  fs.writeFileSync(workItemStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  const invocationLogPath = path.join(projectRoot, ".opencode", "work-items", "feature-001", "tool-invocations.json")
  fs.writeFileSync(invocationLogPath, `${JSON.stringify({
    entries: [
      { tool_id: "tool.rule-scan", status: "success", recorded_at: "2026-03-21T00:00:00Z" },
    ],
  }, null, 2)}\n`, "utf8")

  const result = runCli(projectRoot, ["show-policy-status"])
  assert.equal(result.status, 1)
  assert.match(result.stdout, /tool evidence gate \(Tier 2\): blocked/)
  assert.match(result.stdout, /unclassified scan findings remain/)
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
  result = runCli(projectRoot, [
    "record-verification-evidence",
    "rule-scan-evidence",
    "automated",
    "migration_upgrade",
    "Rule scan complete",
    "tool.rule-scan",
    "--details-json",
    JSON.stringify({
      validation_surface: "runtime_tooling",
      scan_evidence: {
        evidence_type: "direct_tool",
        direct_tool: {
          tool_id: "tool.rule-scan",
          availability_state: "available",
          result_state: "succeeded",
          reason: null,
          namespace_status: "callable",
        },
        substitute: null,
        scan_kind: "rule",
        target_scope_summary: "migration upgrade changes",
        rule_config_source: "bundled",
        finding_counts: { total: 0 },
        severity_summary: {},
        triage_summary: {
          groupCount: 0,
          blockingCount: 0,
          nonBlockingNoiseCount: 0,
          falsePositiveCount: 0,
          followUpCount: 0,
          unclassifiedCount: 0,
          groups: [],
        },
        false_positive_summary: { count: 0, items: [] },
        manual_override: null,
      },
    }),
  ])
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

test("status and resume-summary expose supervisor dialogue read model details", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  writeSupervisorDialogueStore(projectRoot, "feature-001")

  let result = runCli(projectRoot, ["status"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /supervisor dialogue: openclaw \| health degraded \| pending 1 \| delivered 1 \| failed 1 \| skipped 1 \| rejections 2 \| duplicates 2 \| attention required/)
  assert.match(result.stdout, /supervisor last adjudication: invalid_rejected \| message msg-5 \| reason missing_minimum_inbound_information/)

  result = runCli(projectRoot, ["resume-summary", "--json"])
  assert.equal(result.status, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.supervisor_dialogue.validation_surface, "compatibility_runtime")
  assert.equal(payload.supervisor_dialogue.present, true)
  assert.equal(payload.supervisor_dialogue.health.status, "degraded")
  assert.equal(payload.supervisor_dialogue.health.attention_state, "attention_required")
  assert.equal(payload.supervisor_dialogue.delivery_counts.pending, 1)
  assert.equal(payload.supervisor_dialogue.delivery_counts.delivered, 1)
  assert.equal(payload.supervisor_dialogue.delivery_counts.failed, 1)
  assert.equal(payload.supervisor_dialogue.delivery_counts.skipped, 1)
  assert.equal(payload.supervisor_dialogue.inbound_counts.rejected, 2)
  assert.equal(payload.supervisor_dialogue.inbound_counts.duplicates, 2)
  assert.equal(payload.supervisor_dialogue.inbound_counts.concerns, 1)
  assert.equal(payload.supervisor_dialogue.inbound_counts.suggestions, 1)
  assert.equal(payload.supervisor_dialogue.last_adjudication.disposition, "invalid_rejected")
  assert.equal(payload.supervisor_dialogue.last_adjudication.message_id, "msg-5")
  assert.equal(payload.validation_surfaces.compatibility_runtime.includes("workflow-state"), true)
  assert.notEqual(payload.supervisor_dialogue.validation_surface, "target_project_app")
})

test("resume-summary reports missing supervisor store as absent without throwing", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  const result = runCli(projectRoot, ["resume-summary", "--json"])
  assert.equal(result.status, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.supervisor_dialogue.present, false)
  assert.equal(payload.supervisor_dialogue.health.status, "absent")
  assert.equal(payload.supervisor_dialogue.health.availability, "unavailable")
  assert.equal(payload.supervisor_dialogue.health.attention_state, "none")
  assert.equal(payload.supervisor_dialogue.delivery_counts.pending, 0)
  assert.equal(payload.supervisor_dialogue.inbound_counts.rejected, 0)
  assert.equal(payload.supervisor_dialogue.validation_surface, "compatibility_runtime")
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

  result = runCli(projectRoot, [
    "set-migration-context",
    "--baseline-summary",
    "Legacy runtime baseline captured before slice execution",
    "--target-outcome",
    "Modernized runtime with parity preserved",
  ])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["append-preserved-invariant", "existing runtime behavior remains unchanged"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["append-baseline-evidence", "docs/baseline/runtime-before.txt"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["append-compatibility-hotspot", "runtime seam compatibility"])
  assert.equal(result.status, 0)

  result = runCli(projectRoot, ["append-rollback-checkpoint", "restore pre-migration runtime bundle"])
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
  assert.equal(payload.migration_slice_coordination.mode, "migration")
  assert.equal(payload.migration_slice_coordination.readiness.status, "review-blocked")
  assert.deepEqual(payload.migration_slice_coordination.migration_context.baseline_evidence_refs, [
    "docs/baseline/runtime-before.txt",
  ])
  assert.deepEqual(payload.migration_slice_coordination.migration_context.preserved_invariants, [
    "existing runtime behavior remains unchanged",
  ])
  assert.deepEqual(payload.migration_slice_coordination.migration_context.rollback_checkpoints, [
    "restore pre-migration runtime bundle",
  ])
  assert.deepEqual(payload.migration_slice_coordination.slices.map((slice) => slice.slice_id), [
    "SLICE-BOARD-1",
    "SLICE-BOARD-2",
    "SLICE-BOARD-3",
    "SLICE-BOARD-4",
  ])
  assert.deepEqual(payload.migration_slice_coordination.slices[0].preserved_invariants, ["existing runtime behavior"])
  assert.deepEqual(payload.migration_slice_coordination.slices[0].compatibility_risks, ["seam drift"])
  assert.deepEqual(payload.migration_slice_coordination.slices[0].verification_targets, ["parity smoke"])
  assert.deepEqual(payload.migration_slice_coordination.slices[0].rollback_notes, ["revert seam changes"])
})

test("resume-summary JSON includes full task coordination details", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  const statePath = path.join(projectRoot, ".opencode", "workflow-state.json")
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  state.current_stage = "full_implementation"
  state.status = "in_progress"
  state.current_owner = "FullstackAgent"
  state.parallelization = {
    parallel_mode: "limited",
    why: "Phase 3 task coordination fixture",
    safe_parallel_zones: ["docs/phase3/"],
    sequential_constraints: ["TASK-SEQ-A -> TASK-SEQ-B"],
    integration_checkpoint: "Phase 3 integration checkpoint",
    max_active_execution_tracks: 2,
  }
  state.issues = [
    {
      issue_id: "ISSUE-TASK-B",
      title: "Task B artifact still needs review",
      type: "bug",
      severity: "medium",
      rooted_in: "implementation",
      recommended_owner: "FullstackAgent",
      evidence: "docs/phase3/b.md still has a failing coordination note",
      artifact_refs: ["docs/phase3/b.md"],
      current_status: "open",
      opened_at: "2026-03-21T00:00:00.000Z",
      last_updated_at: "2026-03-21T00:00:00.000Z",
      reopen_count: 0,
      repeat_count: 0,
      blocked_since: "2026-03-21T00:00:00.000Z",
    },
  ]
  state.verification_evidence = [
    {
      id: "evidence-task-a",
      kind: "automated",
      scope: "TASK-SEQ-A",
      summary: "Task A targeted verification passed",
      source: "workflow-state-cli-test",
      command: "node --test task-a.test.js",
      exit_status: 0,
      artifact_refs: ["docs/phase3/a.md"],
      recorded_at: "2026-03-21T00:00:00.000Z",
    },
  ]
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")

  writeTaskBoard(projectRoot, "feature-001", {
    mode: "full",
    current_stage: "full_implementation",
    tasks: [
      {
        task_id: "TASK-SEQ-A",
        title: "Implement first orchestration detail",
        summary: "First task in the ordered chain",
        kind: "implementation",
        status: "dev_done",
        primary_owner: "Dev-A",
        qa_owner: "QA-A",
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["docs/phase3/a.md"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: ".worktrees/phase3/task-seq-a",
        concurrency_class: "parallel_limited",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
      {
        task_id: "TASK-SEQ-B",
        title: "Implement second orchestration detail",
        summary: "Second task should expose sequence and issue detail",
        kind: "implementation",
        status: "queued",
        primary_owner: null,
        qa_owner: null,
        depends_on: [],
        blocked_by: [],
        artifact_refs: ["docs/phase3/b.md"],
        plan_refs: ["docs/solution/2026-03-21-feature.md"],
        branch_or_worktree: null,
        concurrency_class: "parallel_limited",
        created_by: "SolutionLead",
        created_at: "2026-03-21T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
      },
    ],
    issues: [],
  })

  const result = runCli(projectRoot, ["resume-summary", "--json"])

  assert.equal(result.status, 0)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.task_coordination.mode, "full")
  assert.equal(payload.task_coordination.parallel_mode, "limited")
  assert.deepEqual(payload.task_coordination.safe_parallel_zones, ["docs/phase3/"])
  assert.deepEqual(payload.task_coordination.sequential_constraints, ["TASK-SEQ-A -> TASK-SEQ-B"])
  assert.equal(payload.task_coordination.integration_readiness.status, "blocked-incomplete-tasks")
  assert.deepEqual(payload.task_coordination.integration_readiness.incomplete_task_ids, ["TASK-SEQ-B"])
  assert.deepEqual(payload.task_coordination.unresolved_issues.map((issue) => issue.issue_id), ["ISSUE-TASK-B"])
  assert.deepEqual(payload.task_coordination.verification_evidence.map((entry) => entry.id), ["evidence-task-a"])
  const firstTask = payload.task_coordination.tasks.find((task) => task.task_id === "TASK-SEQ-A")
  const secondTask = payload.task_coordination.tasks.find((task) => task.task_id === "TASK-SEQ-B")
  assert.equal(firstTask.primary_owner, "Dev-A")
  assert.equal(firstTask.qa_owner, "QA-A")
  assert.deepEqual(firstTask.artifact_refs, ["docs/phase3/a.md"])
  assert.deepEqual(firstTask.linked_evidence.map((entry) => entry.id), ["evidence-task-a"])
  assert.deepEqual(secondTask.depends_on, ["TASK-SEQ-A"])
  assert.deepEqual(secondTask.blocked_by, ["TASK-SEQ-A"])
  assert.deepEqual(secondTask.sequential_constraint_dependencies, ["TASK-SEQ-A"])
  assert.deepEqual(secondTask.linked_issues.map((issue) => issue.issue_id), ["ISSUE-TASK-B"])
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

test("status surfaces retained managed worktree wording for active work item metadata", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "quick", "TASK-936", "retained-worktree-status", "Retained worktree status wording"])
  assert.equal(result.status, 0)

  const workItemId = "task-936"
  const retainedWorktreePath = path.join(projectRoot, ".worktrees", workItemId)
  fs.mkdirSync(retainedWorktreePath, { recursive: true })

  writeJson(path.join(projectRoot, ".opencode", "work-items", workItemId, "worktree.json"), {
    schema: "openkit/worktree@1",
    work_item_id: workItemId,
    mode: "quick",
    repository_root: projectRoot,
    target_branch: "main",
    branch: `openkit/quick/${workItemId}`,
    worktree_path: retainedWorktreePath,
    created_at: "2026-04-20T00:00:00.000Z",
  })

  result = runCli(projectRoot, ["status"])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /retained managed worktree: .*\.worktrees\/task-936/)
})

test("cleanup-worktree command reports skip and removes stale retained metadata when path is missing", () => {
  const projectRoot = makeTempProject()
  setupTempRuntime(projectRoot)

  let result = runCli(projectRoot, ["start-task", "quick", "TASK-937", "cleanup-worktree-cli", "Cleanup worktree CLI command"])
  assert.equal(result.status, 0)

  const workItemId = "task-937"
  const worktreeMetadataPath = path.join(projectRoot, ".opencode", "work-items", workItemId, "worktree.json")
  writeJson(worktreeMetadataPath, {
    schema: "openkit/worktree@2",
    work_item_id: workItemId,
    workflow_mode: "quick",
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: "main",
    branch: `openkit/quick/${workItemId}`,
    worktree_path: path.join(projectRoot, ".worktrees", workItemId),
    created_at: "2026-04-20T00:00:00.000Z",
    env_propagation: {
      mode: "none",
      applied_at: null,
      source_files: [],
    },
  })

  result = runCli(projectRoot, ["cleanup-worktree", workItemId])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Managed worktree cleanup skipped for 'task-937': .*already missing/)
  assert.equal(fs.existsSync(worktreeMetadataPath), false)
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
