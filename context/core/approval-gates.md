# Approval Gates

This file defines how stage transitions are recorded and approved.

## Gate States

- `pending`: work exists but approval has not been granted
- `approved`: transition may proceed
- `rejected`: transition is blocked until feedback is addressed

## Required Fields Per Gate

Each gate entry in `.opencode/workflow-state.json` should contain:

- `status`
- `approved_by`
- `approved_at`
- `notes`

## Transition Rules

- PM -> BA uses `pm_to_ba`
- BA -> Architect uses `ba_to_architect`
- Architect -> Tech Lead uses `architect_to_tech_lead`
- Tech Lead -> Fullstack uses `tech_lead_to_fullstack`
- Fullstack -> QA uses `fullstack_to_qa`
- QA -> Done uses `qa_to_done`

## Operational Rule

Do not advance `current_stage` in `.opencode/workflow-state.json` until the matching gate is `approved`.
