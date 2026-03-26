# Workflow State Schema

This file defines the canonical fields and enums exposed through `.opencode/workflow-state.json`, which now acts as the active external compatibility mirror for the active work item.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and quick-lane artifact expectations, use `context/core/workflow.md`.

The schema is mode-aware and uses separate stage names for `Quick Task`, `Migration`, and `Full Delivery`.

Internal runtime note:

- managed per-item state lives under `.opencode/work-items/<work_item_id>/state.json`
- the active work item is mirrored into `.opencode/workflow-state.json` for compatibility with existing docs, commands, and resume flow
- full-delivery task boards live beside the per-item state, not inside the mirrored top-level state object

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
- `retry_count`
- `escalated_from`
- `escalation_reason`
- `updated_at`
- `work_item_id`

## `mode` Values

- `quick`
- `migration`
- `full`

Guardrail:

- do not add a `quick_plus` or similar third mode without a separate explicit schema and runtime change
- references to `Quick Task+` describe the live successor semantics of `quick`, not a new enum

## `current_stage` Values

### Quick Task stages

- `quick_intake`: request accepted into quick mode and scoped by the Master Orchestrator
- `quick_plan`: the Master Orchestrator is recording the bounded quick checklist, acceptance confirmation, and verification path
- `quick_build`: Fullstack is implementing the quick task
- `quick_verify`: the QA Agent is performing QA Lite validation for the quick task
- `quick_done`: the quick task is complete

### Migration stages

- `migration_intake`: request accepted into migration mode and scoped by the Master Orchestrator
- `migration_baseline`: Architect is recording the current baseline, preserved invariants, compatibility map, and major breakpoints
- `migration_strategy`: Tech Lead is defining staged upgrade sequence, seam creation, rollback points, and validation approach
- `migration_upgrade`: Fullstack is executing the migration or upgrade work
- `migration_verify`: the QA Agent is performing regression, compatibility, and parity validation for the migration
- `migration_done`: the migration work is complete

### Full Delivery stages

- `full_intake`: request received and routed into full mode
- `full_brief`: PM is producing or revising the product brief
- `full_spec`: BA is producing or revising the specification
- `full_architecture`: Architect is producing or revising the design
- `full_plan`: Tech Lead is producing or revising the implementation plan
- `full_implementation`: Fullstack is executing approved work
- `full_qa`: QA is validating implementation or routing findings
- `full_done`: the feature completed the full-delivery workflow

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

Mode expectations:

- `Quick Task` must use `work_intent = maintenance`, `behavior_delta = preserve`, and `dominant_uncertainty = low_local`
- `Migration` must use `work_intent = modernization`, `behavior_delta = preserve`, and `dominant_uncertainty = compatibility`
- `Full Delivery` must reflect product-facing uncertainty, changed behavior, feature intent, or cross-boundary scope

## Stage Ownership Map

| Stage | Default Owner |
| --- | --- |
| `quick_intake` | `MasterOrchestrator` |
| `quick_plan` | `MasterOrchestrator` |
| `quick_build` | `FullstackAgent` |
| `quick_verify` | `QAAgent` |
| `quick_done` | `MasterOrchestrator` |
| `migration_intake` | `MasterOrchestrator` |
| `migration_baseline` | `ArchitectAgent` |
| `migration_strategy` | `TechLeadAgent` |
| `migration_upgrade` | `FullstackAgent` |
| `migration_verify` | `QAAgent` |
| `migration_done` | `MasterOrchestrator` |
| `full_intake` | `MasterOrchestrator` |
| `full_brief` | `PMAgent` |
| `full_spec` | `BAAgent` |
| `full_architecture` | `ArchitectAgent` |
| `full_plan` | `TechLeadAgent` |
| `full_implementation` | `FullstackAgent` |
| `full_qa` | `QAAgent` |
| `full_done` | `MasterOrchestrator` |

Feature-versus-task ownership rule:

- these owners are feature-stage owners
- a full-delivery task board may also track task-level `primary_owner` and `qa_owner` assignments without changing the feature-stage owner above

Approval authority map for live gates:

| Gate | Approval Authority |
| --- | --- |
| `quick_verified` | `QAAgent` |
| `baseline_to_strategy` | `TechLeadAgent` |
| `strategy_to_upgrade` | `FullstackAgent` |
| `upgrade_to_verify` | `QAAgent` |
| `migration_verified` | `QAAgent` |
| `pm_to_ba` | `BAAgent` |
| `ba_to_architect` | `ArchitectAgent` |
| `architect_to_tech_lead` | `TechLeadAgent` |
| `tech_lead_to_fullstack` | `FullstackAgent` |
| `fullstack_to_qa` | `QAAgent` |
| `qa_to_done` | `MasterOrchestrator` |

## Artifacts Shape

`artifacts` must always contain these keys:

- `task_card`
- `brief`
- `spec`
- `architecture`
- `plan`
- `migration_report`
- `qa_report`
- `adr`

Usage by mode:

- `Quick Task` may use `task_card`, leaves `brief`, `spec`, `architecture`, `plan`, and `qa_report` as `null`, and keeps `adr` as an empty array; the required `quick_plan` stage is workflow state, not a separate artifact slot
- `Migration` may use `architecture`, `plan`, and optional `migration_report`, leaves `task_card`, `brief`, `spec`, and `qa_report` as `null`, and keeps `adr` as optional decision records when needed
- `Full Delivery` uses `brief`, `spec`, `architecture`, `plan`, `qa_report`, and optional `adr`, while `task_card` stays `null`

Do not assume additional quick-lane artifact keys until they are explicitly added to the runtime schema and supporting code.

Task-board location and scope:

- quick mode has no task-board schema surface
- full-delivery task boards are stored in `.opencode/work-items/<work_item_id>/tasks.json`
- task-board fields are validated by runtime code and work-item-board commands rather than being embedded into `.opencode/workflow-state.json`

Planned bounded parallelism note in the live contract:

- full-delivery task boards are conditionally parallel and only after planning blesses them
- migration slice boards are strategy-driven and remain distinct from full-delivery task boards
- singleton role stages remain singleton even when worker pools are active later

## Parallelization Metadata

Work-item state may carry a `parallelization` object for migration and full modes. When absent, runtime behavior defaults to sequential execution.

Expected shape:

- `parallel_mode`: `none` | `limited` | `enabled`
- `why`: string
- `safe_parallel_zones`: array of strings
- `sequential_constraints`: array of strings
- `integration_checkpoint`: string or null
- `max_active_execution_tracks`: number or null

Rules:

- `quick` mode must always use `parallel_mode = none`
- `migration` and `full` may use `none`, `limited`, or `enabled`
- absence of the object means sequential execution

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
- `upgrade_to_verify`
- `migration_verified`

### Full Delivery

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Validation must be mode-aware. Do not require full-delivery gates for quick mode or quick gates for full mode.

Approval-entry expectations:

- `approved_by` should identify the live approval authority for the gate when status is `approved`
- `notes` should record handoff readiness, notable assumptions, or rejection reasons in inspectable form
- `quick_verified.notes` should capture QA Lite evidence or reference where that evidence is stored
- gate notes should be sufficient for session resume without relying on unstated memory

## Escalation Fields

- `escalated_from`: `null`, `quick`, or `migration`
- `escalation_reason`: `null` or a short explanation of why quick or migration work was promoted to full delivery

These fields allow the repository to preserve history when a quick or migration item becomes a full-delivery item.

That compatibility rule stays in place unless a later approved migration changes it deliberately.
