# Workflow Migration Note

Date: 2026-03-26

This note explains how to move from the legacy split-role full-delivery workflow to the current Product Lead / Solution Lead workflow.

## What Changed

- `PM Agent` and `BA Agent` are no longer the active full-delivery chain. Their responsibilities now live under `Product Lead`.
- `Architect Agent` and `Tech Lead Agent` are no longer the active full-delivery or migration planning chain. Their responsibilities now live under `Solution Lead`.
- `Code Reviewer` is now an explicit stage before `QA Agent` in both `full` and `migration` work.
- `Master Orchestrator` remains the workflow controller only. It routes, dispatches, records state, and escalates. It does not own scope, solution, implementation, review, or QA content.

## New Stage Chains

### Full Delivery

`full_intake -> full_product -> full_solution -> full_implementation -> full_code_review -> full_qa -> full_done`

### Migration

`migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_code_review -> migration_verify -> migration_done`

## New Approval Chains

### Full Delivery

- `product_to_solution`
- `solution_to_fullstack`
- `fullstack_to_code_review`
- `code_review_to_qa`
- `qa_to_done`

### Migration

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_code_review`
- `code_review_to_verify`
- `migration_verified`

## Role Mapping

| Legacy role | Current active role |
| --- | --- |
| `PM Agent` | `Product Lead` |
| `BA Agent` | `Product Lead` |
| `Architect Agent` | `Solution Lead` |
| `Tech Lead Agent` | `Solution Lead` |

Legacy role files remain in the repository and bundle as compatibility surfaces only. They should not be treated as the primary active workflow chain.

## Artifact Semantics

- `brief` and `spec` remain as compatibility artifact slots, but active ownership is now under `Product Lead`.
- `architecture` and `plan` remain as compatibility artifact slots, but active ownership is now under `Solution Lead`.
- New templates `docs/templates/scope-package-template.md` and `docs/templates/solution-package-template.md` capture the intended direction for cleaner future artifacts.

## Parallel Execution Impact

- Full-delivery task boards are still the only execution task boards in the live runtime.
- Parallel implementation and task-level QA may start only after `full_solution` records a safe `Parallelization Assessment`.
- Migration remains sequential by default and may use slice-level parallelism only when `migration_strategy` explicitly blesses it.

## Migration Checklist For Maintainers

- update any local references to `full_brief`, `full_spec`, `full_architecture`, or `full_plan`
- update any local references to `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, or `fullstack_to_qa`
- treat legacy split-role docs as compatibility-only surfaces
- prefer `Product Lead` and `Solution Lead` in new prompts, docs, tests, and examples
- route review findings through `Code Reviewer` before `QA Agent` in full and migration flows

## Operator Guidance

- use the canonical workflow docs in `context/core/` as the source of truth
- use maintainer and operations docs only as supporting guidance layered on top of the canonical workflow contract
- if a local doc still describes the legacy split-role chain, treat it as stale until updated or explicitly marked historical
