# Workflow State Schema

This file defines the canonical fields and enums exposed through `.opencode/workflow-state.json`, which acts as the active external compatibility mirror for the active work item.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and artifact expectations, use `context/core/workflow.md`.

## Required Top-Level Fields

- `feature_id`
- `feature_slug`
- `mode`
- `mode_reason`
- `routing_profile`
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
- `updated_at`
- `work_item_id`

## `mode` Values

- `quick`
- `migration`
- `full`

## `current_stage` Values

### Quick Task stages

- `quick_intake`
- `quick_plan`
- `quick_build`
- `quick_verify`
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

Allowed values:

- `work_intent`: `maintenance`, `modernization`, `feature`
- `behavior_delta`: `preserve`, `extend`, `redefine`
- `dominant_uncertainty`: `low_local`, `compatibility`, `product`
- `scope_shape`: `local`, `adjacent`, `cross_boundary`

## Stage Ownership Map

| Stage | Default Owner |
| --- | --- |
| `quick_intake` | `MasterOrchestrator` |
| `quick_plan` | `MasterOrchestrator` |
| `quick_build` | `FullstackAgent` |
| `quick_verify` | `QAAgent` |
| `quick_done` | `MasterOrchestrator` |
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
| `quick_verified` | `QAAgent` |
| `baseline_to_strategy` | `SolutionLead` |
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
- `brief`
- `spec`
- `architecture`
- `plan`
- `migration_report`
- `qa_report`
- `adr`

Usage by mode:

- `Quick Task` may use `task_card`
- `Migration` may use `solution_package`, `architecture`, `plan`, and optional `migration_report`
- `Full Delivery` should prefer `scope_package` and `solution_package` as the primary artifacts
- `brief`, `spec`, `architecture`, and `plan` remain compatibility slots derived from or linked to the package-first workflow when needed

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
