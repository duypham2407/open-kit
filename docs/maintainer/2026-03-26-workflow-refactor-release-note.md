# Workflow Refactor Release Note

Date: 2026-03-26

## Summary

- replace the active full-delivery management chain with `Product Lead` and `Solution Lead`
- add `Code Reviewer` as an explicit stage before `QA Agent` in `full` and `migration` workflows
- keep `Master Orchestrator` procedural-only across docs, prompts, runtime rules, and tests
- keep legacy split-role assets available as compatibility-only surfaces

## Workflow Changes

### Full Delivery

- old: `full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`
- new: `full_intake -> full_product -> full_solution -> full_implementation -> full_code_review -> full_qa -> full_done`

### Migration

- old: `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_verify -> migration_done`
- new: `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_code_review -> migration_verify -> migration_done`

## Role Changes

- `PM Agent` + `BA Agent` -> `Product Lead`
- `Architect Agent` + `Tech Lead Agent` -> `Solution Lead`
- `Code Reviewer` remains separate and now owns an explicit workflow stage before QA
- `Master Orchestrator` is constrained to routing, dispatch, state tracking, gate control, and escalation only

## Runtime And Metadata Changes

- update workflow-state enums, stage owners, approvals, and reroute rules
- update global workspace bootstrap to initialize the new gates
- update registry and install metadata to distinguish active roles from compatibility-only split-role assets
- preserve legacy split-role assets in the bundle with explicit compatibility metadata

## Documentation Changes

- update canonical workflow docs under `context/core/`
- update runbooks and maintainer docs to the new role and stage model
- add scope and solution package templates for the intended future artifact direction
- add maintainer audit and migration notes for the refactor

## Validation

- `node --test ".opencode/tests/*.test.js"`
- `node --test "tests/install/install-state.test.js" ".opencode/tests/*.test.js"`

## Upgrade Guidance

- new prompts, examples, and runtime decisions should use `Product Lead` and `Solution Lead`
- treat `PM Agent`, `BA Agent`, `Architect Agent`, and `Tech Lead Agent` as compatibility-only surfaces
- update any local docs or scripts that still reference `full_brief`, `full_spec`, `full_architecture`, `full_plan`, `pm_to_ba`, `ba_to_architect`, `architect_to_tech_lead`, `tech_lead_to_fullstack`, or `fullstack_to_qa`
