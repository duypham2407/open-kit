# Parallel Execution Matrix

Use this matrix instead of reconstructing the parallel-execution rules from multiple docs.

## Matrix

| Mode | Default | Board type | When parallel work is allowed | What stays singleton |
| --- | --- | --- | --- | --- |
| `quick` | sequential | none | never in the live contract | `Quick Agent` is the single owner of all quick stages; no other agents participate |
| `migration` | sequential | migration slice board when strategy enables it | only after `migration_strategy` records a `Parallelization Assessment` that blesses safe slices | `Master Orchestrator` and `Solution Lead` remain singleton for baseline and strategy |
| `full` | sequential until approved otherwise | execution task board | only after `full_solution` records a `Parallelization Assessment` and runtime checks allow task allocation | `Product Lead` and `Solution Lead` remain singleton |

## Safety Rules

- more available workers do not automatically authorize parallel execution
- quick work remains task-board free
- migration parallelism is parity-oriented and slice-based, not a copy of the full-delivery task board
- full-delivery parallelism is bounded by task-board validation, allocation checks, and integration checkpoints
- in the live runtime, `safe_parallel_zones` are repo-relative artifact path-prefix allowlists used to gate `parallel_limited` overlap
- in the live runtime, `sequential_constraints` are ordered task-chain strings used to serialize work inside full-delivery task boards
- task-level ownership never overrides the feature-stage owner recorded in workflow state
- `parallel_mode: none` means sequential work, even if multiple task rows are ready or multiple workers are available
- full-delivery task boards should expose task owner, task status, artifact refs, dependency/sequential constraint state, safe zones when approved, QA owner, integration readiness, unresolved issues, and verification evidence
- migration slice coordination should expose baseline evidence, preserved behavior, compatibility risk, staged sequencing, rollback checkpoints, parity evidence, and slice verification
- Master Orchestrator remains route/state/gate control only; it does not own Product Lead, Solution Lead, implementation, review, or QA judgment

## Checks To Run

- `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js validate-work-item-board <work_item_id>` for full-delivery task boards
- `node .opencode/workflow-state.js validate-task-allocation <work_item_id>` when allocation safety matters
- `node .opencode/workflow-state.js integration-check <work_item_id>` before declaring integrated readiness
- `node .opencode/workflow-state.js validate-migration-slice-board <work_item_id>` when migration slices are in use

## Fast Summary

- quick: no parallel
- migration: sequential by default, optional slice parallelism after strategy approval
- full: sequential by default, optional task-board parallelism after solution approval
