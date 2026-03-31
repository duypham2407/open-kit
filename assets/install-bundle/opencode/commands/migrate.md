---
description: "Starts the Migration lane for upgrades, framework migrations, and dependency modernization."
---

# Command: `/migrate`

Use `/migrate` when work is primarily a project migration or upgrade effort such as framework version jumps, dependency replacement, legacy API removal, or compatibility remediation.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.

Core migration principle:

- preserve behavior first, decouple blockers where necessary, and migrate incrementally instead of rewriting the product

## Preconditions

- The request is centered on upgrading or migrating an existing codebase rather than delivering a net-new feature
- The work needs discovery of the current baseline, compatibility risks, and staged upgrade execution
- The migration is expected to preserve existing layout, flows, contracts, and core logic unless an explicit exception is documented
- If work is resuming, the current migration state must be readable before continuing
- Product requirements are mostly known already, even if the technical upgrade path is still uncertain

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/docs/templates/migration-baseline-checklist.md`
- `.opencode/openkit/docs/templates/migration-verify-checklist.md`
- `.opencode/openkit/workflow-state.json` when resuming
- `.opencode/work-items/` when managed work-item backing state is relevant; treat `.opencode/openkit/work-items/` as compatibility-only when present

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The user chose this lane explicitly; record `lane_source = user_explicit`, `mode = migration`, and `mode_reason` in workflow state
- Tell the user the next action in migration language: freeze preserved invariants, capture the baseline, and then define staged upgrade slices
- Initialize `migration_intake`
- Route to `Solution Lead` for the migration baseline and strategy stages defined in `context/core/workflow.md`
- Freeze the preserved invariants before major edits, then identify only the framework-coupled blockers that must be decoupled
- Use adapters, seams, or compatibility shims when they make the migration safer
- Route upgraded code through `migration_code_review` before final verification
- Use `docs/templates/migration-baseline-checklist.md` during `migration_baseline` and `docs/templates/migration-verify-checklist.md` during `migration_verify`
- Entering `migration_strategy` should create or refresh the primary migration solution package in `docs/solution/`
- If the team wants one living migration artifact, scaffold `migration_report` during `migration_baseline` or `migration_strategy`
- Keep validation focused on baseline capture, compatibility evidence, staged execution, and regression checks rather than defaulting to TDD-first execution

## Lane authority

The user selected `/migrate` explicitly. This is a **lane lock**: the Master Orchestrator must honor the user's lane choice.

- Do **not** reject, reroute, or override the lane to `quick` or `full`
- If the Master Orchestrator sees risk factors that suggest a different lane would be safer (e.g. the work looks like net-new feature delivery or bounded low-risk work), it must issue a **single advisory warning** explaining the concern and the recommended alternative
- After the warning, if the user does not change their mind, proceed in migration mode without further objection
- During execution, if the team encounters a hard blocker (product requirements are genuinely undefined, proposed approach is effectively a rewrite), report the blocker to the user and let the user decide whether to change lanes -- do not auto-escalate

## Validation guidance

- Prefer real build, test, codemod, type-check, smoke-test, and manual regression evidence from the target project
- Prefer parity checks against the preserved baseline: screenshots, behavior notes, contracts, smoke paths, and targeted regression evidence
- Prefer `migration_report` when baseline notes, execution log, and verification evidence need to stay in one continuously updated file
- For small, well-understood upgrades, keep the migration artifact set lightweight: baseline notes, a migration solution package, and parity evidence are enough unless the change reveals broader compatibility risk
- If repository-native validation commands do not exist, record the missing validation path and the baseline evidence honestly
- Do not claim TDD-first validation for migration work unless the migration solution package explicitly identifies a safe test-first sub-slice with working tooling

## Example transcript

```text
User: /migrate move the app from React 18 to React 19 while preserving screens and flows
OpenKit: This is migration work because compatibility risk dominates while the target behavior should stay the same.
OpenKit: Next action: capture preserved invariants and baseline evidence before planning the upgrade slices.
```
