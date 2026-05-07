# Planning Dispatch Enforcement

Date: 2026-05-02

This note explains the runtime hardening added for planning-stage ownership in full and migration lanes.

Use it when you need to debug why a planning gate is blocked, why `Master Orchestrator` can no longer silently substitute for `Product Lead` or `Solution Lead`, or how operator surfaces now expose planning handoff readiness.

## What Changed

- planning-stage handoff is no longer documentation-only
- full and migration planning gates now require runtime proof that the correct role was dispatched
- command-level `/delivery` and `/migrate` routing can emit planning dispatch telemetry automatically
- operator-facing status and doctor surfaces now render planning dispatch readiness and blockers explicitly

## Enforced Planning Stages

- `full_product` requires `ProductLead` planning handoff for `scope_package`
- `full_solution` requires `SolutionLead` planning handoff for `solution_package`
- `migration_strategy` requires `SolutionLead` planning handoff for `solution_package`

These gates are enforced before downstream approvals can succeed:

- `product_to_solution`
- `solution_to_fullstack`
- `strategy_to_upgrade`

## Runtime Proof Model

Planning-stage ownership is now proven by three separate checks.

### 1. Approval authority

The approving actor must match the canonical gate authority.

- rule source: `.opencode/lib/workflow-state-rules.js`
- enforcement: `.opencode/lib/workflow-state-controller.js#setApproval`

### 2. Role handoff evidence

The workflow state must contain `verification_evidence.details.role_handoff` with:

- `role`
- `stage`
- `artifact_kind`

This proves that the role-specific handoff artifact was recorded in workflow evidence.

### 3. Dispatch telemetry

The runtime must also have a completed background run whose payload includes:

- `dispatch.kind = planning_handoff`
- the expected `role`
- the expected `stage`
- the expected `artifact_kind`

This prevents fake handoffs where state labels changed but no delegated planning action was ever recorded.

## Command-Level Auto-Dispatch

The runtime command orchestration layer can now emit planning dispatch telemetry automatically.

- helper: `src/runtime/commands/orchestration-helpers.js`
- runtime entrypoint exposure: `src/runtime/index.js`
- delegation execution path: `src/runtime/managers/delegation-supervisor.js`
- tool surface: `src/runtime/tools/delegation/task.js`

Current behavior:

- `/delivery` can emit `ProductLead` planning dispatch at `full_product`
- `/delivery` can emit `SolutionLead` planning dispatch at `full_solution`
- `/migrate` can emit `SolutionLead` planning dispatch at `migration_strategy`

This is best-effort orchestration support. It does not replace stage rules; it feeds them.

## Minimal Auto-Scaffold Contract

When command-level orchestration successfully emits a planning dispatch, the runtime now attempts a minimal follow-up contract:

- scaffold and link the expected artifact if the stage is correct and the artifact is still missing
- record a minimal `verification_evidence` entry with `source: command-orchestrator`
- attach `details.role_handoff` so the later planning gate has inspectable ownership evidence

This behavior is intentionally conservative:

- it is not a substitute for real Product Lead or Solution Lead artifacts
- it exists to keep operator routing and gate-debugging honest instead of leaving state half-routed and opaque

## Operator Visibility

Planning dispatch readiness now appears in multiple surfaces.

### Runtime summary

- tool: `tool.runtime-summary`
- file: `src/runtime/tools/workflow/runtime-summary.js`

The tool now returns:

- `runtimeContext.planningDispatchSummary`
- `renderedLines`

Example rendered lines:

- `planning dispatches: 1 total | ready no`
- `planning blocker: missing planning dispatch: ProductLead @ full_product`
- `planning readiness: ProductLead @ full_product -> missing`

### Workflow doctor

- file: `src/runtime/doctor/workflow-doctor.js`

The workflow doctor now returns:

- `planningDispatchSummary`
- `planningDispatchLines`

### Global CLI doctor

- file: `src/global/doctor.js`

`openkit doctor` now renders planning dispatch lines in human-readable output. When no planning dispatches are active it still prints:

- `Planning dispatch: none active`

This makes operator output stable and easier to scan.

## Maintainer Debugging Heuristic

If a planning gate is blocked, check in this order:

1. is the stage correct for the lane?
2. does the gate approver match the canonical approval authority?
3. does `verification_evidence` contain the expected `role_handoff` entry?
4. does the runtime show a completed `planning_handoff` dispatch for the same role, stage, and artifact kind?
5. if command-level routing was expected, does status or doctor show planning dispatch lines and blockers?

## Common Failure Modes

- `requires dispatch telemetry` means a role handoff may exist in evidence, but the delegated planning run was never recorded or never completed
- `requires role handoff evidence` means dispatch happened, but no matching evidence entry was recorded in workflow state
- `must be approved by ...` means the wrong role attempted to approve the gate
- `Planning dispatch: none active` in doctor output usually means the operator is outside a planning stage or no planning telemetry has been emitted yet

## Files To Keep In Sync

- `context/core/workflow.md`
- `context/core/approval-gates.md`
- `docs/maintainer/2026-03-26-role-operating-policy.md`
- `.opencode/lib/workflow-state-rules.js`
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/lib/runtime-summary.js`
- `src/runtime/commands/orchestration-helpers.js`
- `src/runtime/workflow-kernel.js`
- `src/runtime/managers/delegation-supervisor.js`
- `src/runtime/tools/delegation/task.js`
- `src/runtime/tools/workflow/runtime-summary.js`
- `src/runtime/doctor/workflow-doctor.js`
- `src/global/doctor.js`

## Validation Paths

Relevant regression coverage currently lives in:

- `.opencode/tests/workflow-state-controller.test.js`
- `tests/runtime/runtime-platform.test.js`
- `tests/runtime/doctor.test.js`
- `tests/runtime/capability-tools.test.js`
- `tests/cli/openkit-cli.test.js`

Recommended maintainer verification after touching this area:

1. `node --test ".opencode/tests/workflow-state-controller.test.js"`
2. `node --test "tests/runtime/runtime-platform.test.js" "tests/runtime/doctor.test.js"`
3. `node --test "tests/cli/openkit-cli.test.js"`
