# Workflow State Schema

This file defines the canonical fields and enums for `.opencode/workflow-state.json`.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and quick-lane artifact expectations, use `context/core/workflow.md`.

The schema is mode-aware and uses separate stage names for `Quick Task` and `Full Delivery`.

## Required Top-Level Fields

- `feature_id`
- `feature_slug`
- `mode`
- `mode_reason`
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

## `mode` Values

- `quick`
- `full`

Guardrail:

- do not add a `quick_plus` or similar third mode without a separate explicit schema and runtime change
- references to `Quick Task+` describe the live successor semantics of `quick`, not a new enum

## `current_stage` Values

### Quick Task stages

- `quick_intake`: request accepted into quick mode and scoped by `MasterOrchestrator`
- `quick_plan`: `MasterOrchestrator` is recording the bounded quick checklist, acceptance confirmation, and verification path
- `quick_build`: Fullstack is implementing the quick task
- `quick_verify`: `QAAgent` is performing QA Lite validation for the quick task
- `quick_done`: the quick task is complete

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

## Stage Ownership Map

| Stage | Default Owner |
| --- | --- |
| `quick_intake` | `MasterOrchestrator` |
| `quick_plan` | `MasterOrchestrator` |
| `quick_build` | `FullstackAgent` |
| `quick_verify` | `QAAgent` |
| `quick_done` | `MasterOrchestrator` |
| `full_intake` | `MasterOrchestrator` |
| `full_brief` | `PMAgent` |
| `full_spec` | `BAAgent` |
| `full_architecture` | `ArchitectAgent` |
| `full_plan` | `TechLeadAgent` |
| `full_implementation` | `FullstackAgent` |
| `full_qa` | `QAAgent` |
| `full_done` | `MasterOrchestrator` |

## Artifacts Shape

`artifacts` must always contain these keys:

- `task_card`
- `brief`
- `spec`
- `architecture`
- `plan`
- `qa_report`
- `adr`

Usage by mode:

- `Quick Task` may use `task_card`, leaves `brief`, `spec`, `architecture`, `plan`, and `qa_report` as `null`, and keeps `adr` as an empty array; the required `quick_plan` stage is workflow state, not a separate artifact slot
- `Full Delivery` uses `brief`, `spec`, `architecture`, `plan`, `qa_report`, and optional `adr`, while `task_card` stays `null`

Do not assume additional quick-lane artifact keys until they are explicitly added to the runtime schema and supporting code.

## Approvals Shape

Approval entries use the canonical shape:

- `status`
- `approved_by`
- `approved_at`
- `notes`

Mode-specific approval keys:

### Quick Task

- `quick_verified`

### Full Delivery

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Validation must be mode-aware. Do not require full-delivery gates for quick mode or quick gates for full mode.

## Escalation Fields

- `escalated_from`: `null` or `quick`
- `escalation_reason`: `null` or a short explanation of why quick work was promoted to full delivery

These fields allow the repository to preserve history when a quick task becomes a full-delivery item.

That compatibility rule stays in place unless a later approved migration changes it deliberately.
