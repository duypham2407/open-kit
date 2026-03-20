# Approval Gates

This file defines how stage transitions are recorded and approved.

Approval behavior is mode-aware. `Quick Task` and `Full Delivery` do not share the same gate set.

## Gate States

- `pending`: work exists but approval has not been granted
- `approved`: transition may proceed
- `rejected`: transition is blocked until feedback is addressed

## Required Fields Per Gate

Each gate entry in `.opencode/workflow-state.json` must contain:

- `status`
- `approved_by`
- `approved_at`
- `notes`

## Quick Task Gates

Quick mode uses one required gate:

- `quick_verified`

Meaning:

- the user request is treated as implicit approval to start quick work unless the task is ambiguous or risky
- `quick_verified` becomes `approved` only after QA Lite passes

Transition rule:

- `quick_verify -> quick_done` requires `quick_verified = approved`

## Full Delivery Gates

Full mode keeps the explicit handoff chain:

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Transition rules:

- `full_brief -> full_spec` uses `pm_to_ba`
- `full_spec -> full_architecture` uses `ba_to_architect`
- `full_architecture -> full_plan` uses `architect_to_tech_lead`
- `full_plan -> full_implementation` uses `tech_lead_to_fullstack`
- `full_implementation -> full_qa` uses `fullstack_to_qa`
- `full_qa -> full_done` uses `qa_to_done`

## Operational Rule

Do not advance `current_stage` in `.opencode/workflow-state.json` until the matching gate for the active mode is `approved`.

## Escalation Rule

When quick work escalates to full delivery:

- do not try to reuse quick gates as full-delivery approvals
- record the escalation metadata in state
- initialize the full-delivery approval chain with pending values
