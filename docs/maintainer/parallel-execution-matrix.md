# Parallel Execution Matrix

Use this matrix instead of reconstructing the parallel-execution rules from multiple docs.

## Matrix

| Mode | Default | Board type | When parallel work is allowed | What stays singleton |
| --- | --- | --- | --- | --- |
| `quick` | sequential | none | never in the live contract | `Master Orchestrator`, `Fullstack Agent`, `QA Agent` stay in a single bounded loop |
| `migration` | sequential | migration slice board when strategy enables it | only after `migration_strategy` records a `Parallelization Assessment` that blesses safe slices | `Master Orchestrator` and `Solution Lead` remain singleton for baseline and strategy |
| `full` | sequential until approved otherwise | execution task board | only after `full_solution` records a `Parallelization Assessment` and runtime checks allow task allocation | `Product Lead` and `Solution Lead` remain singleton |

## Safety Rules

- more available workers do not automatically authorize parallel execution
- quick work remains task-board free
- migration parallelism is parity-oriented and slice-based, not a copy of the full-delivery task board
- full-delivery parallelism is bounded by task-board validation, allocation checks, and integration checkpoints
- task-level ownership never overrides the feature-stage owner recorded in workflow state

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
