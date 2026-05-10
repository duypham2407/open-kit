---
description: "Starts the Migration lane. Master Orchestrator bootstraps workflow state, then dispatches Solution Lead for migration brainstorm and plan."
---

# Command: `/migrate`

Use `/migrate` for upgrades, framework migrations, dependency replacement, or compatibility remediation. The defining feature is **preserve behavior, change the substrate**.

## What this command does

1. Dispatches **Master Orchestrator** with `lane=migration` and the user's request as `description`.
2. MO calls `tool.bootstrap-workflow` to write `workflow-state.json`.
3. MO calls `tool.advance-stage` to move from `migration_intake` toward the migration chain.
4. After `migration_baseline` evidence is captured, **Solution Lead** receives control in `migration_strategy` and runs migration brainstorm + plan authorship.

## Core migration principle

Preserve behavior first. Decouple blockers where necessary. Migrate incrementally instead of rewriting the product.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for shared runtime-path, verification, and tool-substitution rules.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching code. Prefer kit intelligence tools before basic built-in tools or OS commands.

## Preconditions

- The request is a migration: framework jump, dependency replacement, legacy API removal, or compatibility remediation.
- Behavior should mostly be preserved unless an exception is documented in the migration plan.

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
- `.opencode/openkit/workflow-state.json` after bootstrap

## Stage chain

```
migration_intake (MO) → migration_baseline (Solution Lead) → migration_strategy (Solution Lead: brainstorm + plan) → migration_upgrade → migration_code_review → migration_verify → migration_done
```

`migration_intake` is MO-only and ephemeral.

## Migration plan responsibility

Solution Lead writes the migration plan at `docs/solution/YYYY-MM-DD-<slug>.md` with main sections (target, preserved invariants, baseline evidence, slices, risks/rollback, verification approach) plus Appendix A (discovery) and Appendix B (decisions).

## Lane authority

User picked `/migrate`. Lane is locked unless brainstorm reveals significant new product behavior is needed, in which case Solution Lead escalates to MO for user confirmation.

## Validation guidance

- Prefer real build, test, codemod, type-check, smoke-test, and manual regression evidence from the target project.
- Prefer parity checks against the preserved baseline: screenshots, behavior notes, contracts, smoke paths.
- For small upgrades, keep the artifact set lightweight: baseline notes + plan + parity evidence.

## Example transcript

```text
User: /migrate upgrade React 18 to React 19 preserving all screens and flows
MO: Bootstrapping migration workflow. Dispatching to migration_baseline.
... (baseline evidence captured)
MO: Advancing to migration_strategy. Dispatching Solution Lead.
SolutionLead: Which screens are highest-risk if behavior changes?
User: Dashboard and checkout.
SolutionLead: Do you have visual regression coverage on those?
User: Only the checkout.
... (more discovery on slicing strategy)
SolutionLead: Migration plan written to docs/solution/2026-05-09-react-19.md. Confirm?
User: Confirmed.
MO: Advancing to migration_upgrade.
```
