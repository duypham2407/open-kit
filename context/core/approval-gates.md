# Approval Gates

This file defines how stage transitions are recorded and approved.

For the canonical workflow contract, including lane semantics, stage order, and artifact expectations, use `context/core/workflow.md`.

Approval behavior is mode-aware. `Quick Task`, `Migration`, and `Full Delivery` do not share the same gate set.

## Gate States

- `pending`: work exists but approval has not been granted
- `approved`: transition may proceed
- `rejected`: transition is blocked until feedback is addressed

## Required Fields Per Gate

Each gate entry mirrored in `.opencode/workflow-state.json` for the active work item must contain:

- `status`
- `approved_by`
- `approved_at`
- `notes`

## Quick Task Gates

Quick mode uses one required gate:

- `quick_verified`

Meaning:

- the user request is treated as implicit approval to start quick work
- `quick_verified` becomes `approved` only after `quick_test` passes with real verification evidence
- `Quick Agent` is the approval authority for `quick_verified`
- the Quick Agent self-approves after providing real evidence via the `verification-before-completion` skill

Transition rule:

- `quick_test -> quick_done` requires `quick_verified = approved`

Quick mode has no inter-agent approval gates. The Quick Agent owns every stage and approves `quick_verified` based on test evidence.

## Migration Gates

Migration mode uses five required gates:

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_code_review`
- `code_review_to_verify`
- `migration_verified`

Approval authorities:

- `baseline_to_strategy`: `MasterOrchestrator`
- `strategy_to_upgrade`: `FullstackAgent`
- `upgrade_to_code_review`: `CodeReviewer`
- `code_review_to_verify`: `QAAgent`
- `migration_verified`: `QAAgent`

Transition rules:

- `migration_baseline -> migration_strategy` uses `baseline_to_strategy`
- `migration_strategy -> migration_upgrade` uses `strategy_to_upgrade`
- `migration_upgrade -> migration_code_review` uses `upgrade_to_code_review`
- `migration_code_review -> migration_verify` uses `code_review_to_verify`
- `migration_verify -> migration_done` uses `migration_verified`

Readiness rule before migration approvals:

- current baseline and target upgrade intent are inspectable
- staged execution notes and rollback checkpoints are inspectable
- review or validation evidence uses real project commands or honest manual evidence
- requirement ambiguity is escalated to full delivery instead of being approved through migration

Boundary-specific handoff focus for migration:

- `baseline_to_strategy`: preserved invariants, baseline evidence, compatibility hotspots, and migration fit are inspectable enough for staged planning
- `strategy_to_upgrade`: the migration solution package, rollback checkpoints, and slice/parity plan are inspectable enough for execution
- `upgrade_to_code_review`: changed surfaces, seam or adapter work, and execution evidence are inspectable enough for parity review
- `code_review_to_verify`: review findings are resolved or recorded, and parity-risk focus points are inspectable for QA
- `migration_verified`: parity evidence, residual risks, rollback notes, and migration-slice completion state are inspectable enough for honest closure

## Full Delivery Gates

Full mode uses the active handoff chain:

- `product_to_solution`
- `solution_to_fullstack`
- `fullstack_to_code_review`
- `code_review_to_qa`
- `qa_to_done`

Approval authorities:

- `product_to_solution`: `SolutionLead`
- `solution_to_fullstack`: `FullstackAgent`
- `fullstack_to_code_review`: `CodeReviewer`
- `code_review_to_qa`: `QAAgent`
- `qa_to_done`: `MasterOrchestrator`

Transition rules:

- `full_product -> full_solution` uses `product_to_solution`
- `full_solution -> full_implementation` uses `solution_to_fullstack`
- `full_implementation -> full_code_review` uses `fullstack_to_code_review`
- `full_code_review -> full_qa` uses `code_review_to_qa`
- `full_qa -> full_done` uses `qa_to_done`

Readiness checklist for every full-delivery gate:

- the outgoing stage artifact or evidence exists and is inspectable
- unresolved assumptions, risks, and open questions are called out in notes
- the receiving role has enough detail to begin without reconstructing missing intent
- the approver records approval notes or rejection notes in workflow state

Boundary-specific handoff focus:

- `product_to_solution`: problem statement, scope, business rules, acceptance criteria, and edge cases are clear
- `solution_to_fullstack`: technical approach, slices, dependencies, and validation expectations are clear
- `fullstack_to_code_review`: changed surfaces and implementation evidence are clear
- `code_review_to_qa`: scope compliance passed, important code-quality concerns are resolved or recorded, and QA has enough context to verify behavior
- `qa_to_done`: verification outcome, remaining issue status, and closure recommendation are clear

## Operational Rule

Do not advance the active work item stage, and do not refresh `.opencode/workflow-state.json`, until the matching gate for the active mode is `approved`.

Do not mark a gate `approved` when the evidence is missing, not inspectable, or relies on unstated conversation context.

## Tool Evidence Gates (Tier 2)

In addition to approval gates, certain stage transitions require **tool-sourced verification evidence** recorded in `state.verification_evidence` before `advanceStage` allows the transition. These gates enforce the agent tool-usage contracts established in Tier 1.

### Active Tool Evidence Gates

| Mode | Target Stage | Required Evidence Sources | Notes |
|------|-------------|--------------------------|-------|
| full | `full_code_review` | `rule-scan` or `tool.rule-scan` | Fullstack must run rule-scan before code review |
| full | `full_qa` | `rule-scan` or `tool.rule-scan` AND `security-scan` or `tool.security-scan` | Code Reviewer must run both before QA |
| migration | `migration_code_review` | `rule-scan` or `tool.rule-scan` or `codemod-preview` or `tool.codemod-preview` | Migration upgrade must run one of these before code review |

### Manual Override

When a required tool is genuinely unavailable (e.g. semgrep not installed), operators can unblock the pipeline by recording a manual evidence entry with:
- `source: "manual"`
- `scope: "tool-evidence-override:<target_stage>"`

Example: `scope: "tool-evidence-override:full_code_review"`

### Quick Mode

Quick mode has no tool evidence gates on intermediate transitions. The existing `EVIDENCE_RULES` kind-based requirements still apply at `quick_done`.

### Diagnostics

- `node .opencode/workflow-state.js show-dod` includes `toolEvidenceGate` and `toolEvidenceBlockers` in its output
- When a tool evidence gate blocks `advance-stage`, the error message includes the missing source groups and a manual override hint

## Runtime Policy Engine (Tier 3)

Beyond Tier 2 evidence gates (which check agent-written `verification_evidence`), the runtime policy engine (Tier 3) checks the **runtime invocation log** for actual tool executions before allowing stage transitions. Agents cannot forge invocation log entries — they are recorded by the tool execution wrapper in `src/runtime/tools/wrap-tool-execution.js`.

### How It Works

1. Every tool execution in the runtime is recorded to a file-backed invocation log at `.opencode/work-items/<work_item_id>/tool-invocations.json` (or `.opencode/tool-invocations.json` as a fallback).
2. Before `advanceStage` allows a transition, the policy engine checks whether required tools were actually invoked with a `success` status in the invocation log.
3. Both Tier 2 and Tier 3 must pass for a transition to proceed.

### Active Invocation Policies

| Mode | Target Stage | Required Tool Invocations | Notes |
|------|-------------|---------------------------|-------|
| full | `full_code_review` | `tool.rule-scan` | Runtime must have recorded a successful rule-scan invocation |
| full | `full_qa` | `tool.rule-scan` AND `tool.security-scan` | Runtime must have recorded both invocations |
| migration | `migration_code_review` | `tool.rule-scan` OR `tool.codemod-preview` | Runtime must have recorded one of these |

Policy definitions are in `.opencode/lib/policy-engine.js` (`TOOL_INVOCATION_POLICIES`).

### Enforcement Modes

Set `state.policy_enforcement` to control behavior:

- `"enforce"` (default): block the transition when required tool invocations are missing
- `"warn"`: allow the transition but record policy warning issues in `state.issues`
- `"off"`: skip the policy check entirely

### Manual Override

The same manual override pattern from Tier 2 applies. If `state.verification_evidence` contains an entry with:
- `source: "manual"`
- `scope: "tool-evidence-override:<target_stage>"`

...then both Tier 2 and Tier 3 checks are bypassed for that target stage.

### Invocation Log Location

- Per-work-item: `.opencode/work-items/<work_item_id>/tool-invocations.json`
- Global fallback: `.opencode/tool-invocations.json`

### Diagnostics

- `node .opencode/workflow-state.js show-dod` includes `policyBlockers` in its output
- When the policy engine blocks `advance-stage`, the error message lists the missing tool invocations and a manual override hint
- `getPolicyExecutionTrace()` includes a `tool-invocation-policy-engine` entry with `level: "muc-3"`

### Inspecting Invocation Logs

Use the `show-invocations` CLI command to view what the runtime has recorded:

```
node .opencode/workflow-state.js show-invocations
node .opencode/workflow-state.js show-invocations <work_item_id>
```

The output shows all invocation entries (tool id, status, duration, stage, owner) along with summary counts. When no `work_item_id` is given, the command reads the log for the currently active work item.

### Checking Policy Readiness

Use the `show-policy-status` CLI command to see whether the next stage transition will pass or be blocked:

```
node .opencode/workflow-state.js show-policy-status
```

The output includes:
- Current mode, stage, and enforcement mode
- Whether a manual override exists for the next stage
- Tier 2 tool evidence gate status (passed or blocked with blockers)
- Tier 3 runtime policy status (passed or blocked with violation details)

The command exits with code 0 when all policies pass (or a manual override exists) and code 1 when blocked.

### Recording Manual Override Evidence

When a required tool is genuinely unavailable and you need to unblock the pipeline:

```
node .opencode/workflow-state.js record-verification-evidence \
  manual-override-<stage> manual "tool-evidence-override:<target_stage>" \
  "Reason for override" manual
```

Example for `full_code_review`:
```
node .opencode/workflow-state.js record-verification-evidence \
  override-cr manual "tool-evidence-override:full_code_review" \
  "semgrep not available in this environment" manual
```

This bypasses both Tier 2 and Tier 3 checks for the specified target stage.

### Setting Enforcement Mode

To change from blocking enforcement to warning or off:

```
# Set enforcement to warn mode (records issues but does not block)
# Edit the per-work-item state to set policy_enforcement: "warn"

# Set enforcement to off (skips policy checks entirely)
# Edit the per-work-item state to set policy_enforcement: "off"
```

The `policy_enforcement` field on the work item state accepts `"enforce"` (default), `"warn"`, or `"off"`.

### Dynamic Work-Item Scoping

The runtime invocation logger dynamically resolves the active work item at record time. When the active work item changes (e.g., via `activate-work-item`), subsequent tool invocations are automatically written to the new work item's log. This ensures the policy engine reads invocations from the correct per-work-item log during `advanceStage`.

## Escalation Rule

When quick or migration work escalates to full delivery:

- do not try to reuse quick or migration gates as full-delivery approvals
- record the escalation metadata in state
- initialize the full-delivery approval chain with pending values

This escalation behavior remains unchanged in the current live contract.
