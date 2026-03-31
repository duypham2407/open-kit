# Workflow State Schema

This file defines the canonical fields and enums exposed through `.opencode/workflow-state.json`, which acts as the active external compatibility mirror for the active work item.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and artifact expectations, use `context/core/workflow.md`.

## Required Top-Level Fields

- `feature_id`
- `feature_slug`
- `mode`
- `mode_reason`
- `lane_source`
- `routing_profile`
- `migration_context`
- `current_stage`
- `status`
- `current_owner`
- `artifacts`
- `approvals`
- `issues`
- `verification_evidence`
- `retry_count`
- `escalated_from`
- `escalation_reason`
- `last_auto_scaffold`
- `updated_at`
- `work_item_id`

## `mode` Values

- `quick`
- `migration`
- `full`

## `lane_source` Values

- `orchestrator_routed` — the Master Orchestrator chose the lane via `/task`
- `user_explicit` — the user chose the lane directly via `/quick-task`, `/migrate`, or `/delivery`

When `lane_source` is `user_explicit`, the Master Orchestrator must not reject, reroute, or auto-escalate the lane. It may issue a single advisory warning, but the user's choice is final unless the user explicitly requests a lane change.

## `current_stage` Values

### Quick Task stages

- `quick_intake`
- `quick_brainstorm`
- `quick_plan`
- `quick_implement`
- `quick_test`
- `quick_done`

### Migration stages

- `migration_intake`
- `migration_baseline`
- `migration_strategy`
- `migration_upgrade`
- `migration_code_review`
- `migration_verify`
- `migration_done`

### Full Delivery stages

- `full_intake`
- `full_product`
- `full_solution`
- `full_implementation`
- `full_code_review`
- `full_qa`
- `full_done`

## `status` Values

- `idle`
- `in_progress`
- `blocked`
- `done`

## `routing_profile` Shape

`routing_profile` must always contain these keys:

- `work_intent`
- `behavior_delta`
- `dominant_uncertainty`
- `scope_shape`
- `selection_reason`

## `migration_context` Shape

`migration_context` must always contain these keys:

- `baseline_summary`
- `target_outcome`
- `preserved_invariants`
- `allowed_behavior_changes`
- `compatibility_hotspots`
- `baseline_evidence_refs`
- `rollback_checkpoints`

Current live semantics:

- in `migration`, these fields hold the inspectable parity contract for the work item
- outside `migration`, these fields stay at their empty/default values
- `preserved_invariants`, `baseline_evidence_refs`, and `rollback_checkpoints` should be concrete enough to support review and verify decisions

CLI commands for `migration_context`:

- `set-migration-context [--baseline-summary <text>] [--target-outcome <text>]` — set the top-level string fields
- `append-preserved-invariant <invariant>` — add a new preserved invariant
- `append-baseline-evidence <ref>` — add a baseline evidence reference
- `append-rollback-checkpoint <checkpoint>` — add a rollback checkpoint
- `append-compatibility-hotspot <hotspot>` — add a compatibility hotspot
- `show-migration-context` — print the current migration_context as JSON

All `migration_context` commands reject non-migration mode. Append commands reject duplicate entries.

Allowed values:

- `work_intent`: `maintenance`, `modernization`, `feature`
- `behavior_delta`: `preserve`, `extend`, `redefine`
- `dominant_uncertainty`: `low_local`, `compatibility`, `product`
- `scope_shape`: `local`, `adjacent`, `cross_boundary`

## Stage Ownership Map

| Stage | Default Owner |
| --- | --- |
| `quick_intake` | `QuickAgent` |
| `quick_brainstorm` | `QuickAgent` |
| `quick_plan` | `QuickAgent` |
| `quick_implement` | `QuickAgent` |
| `quick_test` | `QuickAgent` |
| `quick_done` | `QuickAgent` |
| `migration_intake` | `MasterOrchestrator` |
| `migration_baseline` | `SolutionLead` |
| `migration_strategy` | `SolutionLead` |
| `migration_upgrade` | `FullstackAgent` |
| `migration_code_review` | `CodeReviewer` |
| `migration_verify` | `QAAgent` |
| `migration_done` | `MasterOrchestrator` |
| `full_intake` | `MasterOrchestrator` |
| `full_product` | `ProductLead` |
| `full_solution` | `SolutionLead` |
| `full_implementation` | `FullstackAgent` |
| `full_code_review` | `CodeReviewer` |
| `full_qa` | `QAAgent` |
| `full_done` | `MasterOrchestrator` |

## Approval Authority Map

| Gate | Approval Authority |
| --- | --- |
| `quick_verified` | `QuickAgent` |
| `baseline_to_strategy` | `MasterOrchestrator` |
| `strategy_to_upgrade` | `FullstackAgent` |
| `upgrade_to_code_review` | `CodeReviewer` |
| `code_review_to_verify` | `QAAgent` |
| `migration_verified` | `QAAgent` |
| `product_to_solution` | `SolutionLead` |
| `solution_to_fullstack` | `FullstackAgent` |
| `fullstack_to_code_review` | `CodeReviewer` |
| `code_review_to_qa` | `QAAgent` |
| `qa_to_done` | `MasterOrchestrator` |

## Artifacts Shape

`artifacts` must always contain these keys:

- `task_card`
- `scope_package`
- `solution_package`
- `migration_report`
- `qa_report`
- `adr`

Usage by mode:

- `Quick Task` may use `task_card`
- `Migration` should use `solution_package` and optional `migration_report`
- `Full Delivery` should prefer `scope_package` and `solution_package` as the primary artifacts

## Approvals Shape

Approval entries use the canonical shape:

- `status`
- `approved_by`
- `approved_at`
- `notes`

Mode-specific approval keys:

### Quick Task

- `quick_verified`

### Migration

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_code_review`
- `code_review_to_verify`
- `migration_verified`

### Full Delivery

- `product_to_solution`
- `solution_to_fullstack`
- `fullstack_to_code_review`
- `code_review_to_qa`
- `qa_to_done`

## Escalation Fields

- `escalated_from`: `null`, `quick`, or `migration`
- `escalation_reason`: `null` or a short explanation of why quick or migration work was promoted to full delivery

## Auto-Scaffold Tracking

- `last_auto_scaffold`: `null` or an object with `artifact`, `path`, `stage`, and `recorded_at`
- used to expose the most recent runtime-created primary scope or solution package in `status` and `resume-summary`

## Solution Package Parallelization Shape

When a full-delivery solution package or migration solution package records a `Parallelization Assessment`, use this shape:

- `parallel_mode`: `none`, `limited`, or `enabled`
- `why`: short explanation of why the chosen mode is safe
- `safe_parallel_zones`: array of non-empty strings
- `sequential_constraints`: array of non-empty strings
- `integration_checkpoint`: short description of the merge or parity checkpoint
- `max_active_execution_tracks`: positive integer when bounded worker-pool concurrency should be capped

Current live semantics:

- `safe_parallel_zones` are repo-relative artifact path-prefix allowlists
- they are evaluated against task `artifact_refs`, not against a separate per-task zone field
- they currently matter only for `parallel_limited` overlap control
- tasks outside declared zone coverage should remain queued instead of becoming overlapping active work
- zone approval is narrower than full safety; after zone checks pass, shared-artifact and dependency checks still apply
- `sequential_constraints` are ordered task-chain strings such as `TASK-A -> TASK-B -> TASK-C`
- on full-delivery task boards, they compile into effective `depends_on` and `blocked_by` overlays instead of a separate sequencing field
- tasks later in a chain should remain queued until the earlier task order is satisfied through the existing dependency model
- current runtime enforcement also applies to migration slice boards when a strategy enables them; migration slices remain migration-owned and never replace feature-stage ownership
