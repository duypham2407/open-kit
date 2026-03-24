---
description: "Starts the Migration lane for upgrades, framework migrations, and dependency modernization."
---

# Command: `/migrate`

Use `/migrate` when work is primarily a project migration or upgrade effort such as framework version jumps, dependency replacement, legacy API removal, or compatibility remediation.

## Global OpenKit path rule

- In globally installed OpenKit sessions, resolve OpenKit-owned docs from `OPENKIT_KIT_ROOT` instead of assuming the target repository contains `AGENTS.md`, `context/`, `docs/templates/`, or `.opencode/`.
- For example, `context/core/workflow.md` means `${OPENKIT_KIT_ROOT}/context/core/workflow.md`, and `docs/templates/migration-baseline-checklist.md` means `${OPENKIT_KIT_ROOT}/docs/templates/migration-baseline-checklist.md`.
- Resolve resumable workflow state from `OPENKIT_WORKFLOW_STATE`.
- Use `node "${OPENKIT_KIT_ROOT}/.opencode/workflow-state.js" --state "${OPENKIT_WORKFLOW_STATE}" <command>` for workflow-state checks in global mode.

Core migration principle:

- preserve behavior first, decouple blockers where necessary, and migrate incrementally instead of rewriting the product

## Preconditions

- The request is centered on upgrading or migrating an existing codebase rather than delivering a net-new feature
- The work needs discovery of the current baseline, compatibility risks, and staged upgrade execution
- The migration is expected to preserve existing layout, flows, contracts, and core logic unless an explicit exception is documented
- If work is resuming, the current migration state must be readable before continuing
- Product requirements are mostly known already, even if the technical upgrade path is still uncertain

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/lane-selection.md`
- `context/core/approval-gates.md`
- `context/core/project-config.md`
- `docs/templates/migration-baseline-checklist.md`
- `docs/templates/migration-verify-checklist.md`
- `.opencode/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator records `mode = migration` and `mode_reason`
- Initialize `migration_intake`
- Route to the migration baseline and strategy stages defined in `context/core/workflow.md`
- Freeze the preserved invariants before major edits, then identify only the framework-coupled blockers that must be decoupled
- Use adapters, seams, or compatibility shims when they make the migration safer
- Use `docs/templates/migration-baseline-checklist.md` during `migration_baseline` and `docs/templates/migration-verify-checklist.md` during `migration_verify`
- If the team wants one living migration artifact, scaffold `migration_report` during `migration_baseline` or `migration_strategy`
- Keep validation focused on baseline capture, compatibility evidence, staged execution, and regression checks rather than defaulting to TDD-first execution

## Rejection or escalation behavior

- If the request is actually bounded low-risk work, reject migration entry and reroute to the quick lane
- If the request is actually a net-new feature or requirement-definition problem, reject migration entry and reroute to `full_intake`
- If the command explicitly asks for migration but the routing profile points to `quick` or `full`, reject migration admission instead of preserving a contradictory lane
- If migration work uncovers product or requirements ambiguity, preserve escalation metadata while moving into `full_intake`
- If the proposed approach is effectively a rewrite instead of a behavior-preserving migration, stop and restate the migration slices before continuing
- If the main uncertainty is product behavior rather than compatibility or modernization, stop using migration and reroute to `full`

## Validation guidance

- Prefer real build, test, codemod, type-check, smoke-test, and manual regression evidence from the target project
- Prefer parity checks against the preserved baseline: screenshots, behavior notes, contracts, smoke paths, and targeted regression evidence
- Prefer `migration_report` when baseline notes, execution log, and verification evidence need to stay in one continuously updated file
- If repository-native validation commands do not exist, record the missing validation path and the baseline evidence honestly
- Do not claim TDD-first validation for migration work unless the migration plan explicitly identifies a safe test-first sub-slice with working tooling
