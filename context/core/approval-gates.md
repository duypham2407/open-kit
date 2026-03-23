# Approval Gates

This file defines how stage transitions are recorded and approved.

For the canonical workflow contract, including lane semantics, stage order, and artifact expectations, use `context/core/workflow.md`.

Approval behavior is mode-aware. `Quick Task`, `Migration`, and `Full Delivery` do not share the same gate set.

## Gate States

- `pending`: work exists but approval has not been granted
- `approved`: transition may proceed
- `rejected`: transition is blocked until feedback is addressed

## Required Fields Per Gate

Each gate entry mirrored in `.opencode/workflow-state.json` for the active work item must contain:

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
- `QA Agent` is the approval authority for `quick_verified`
- the builder may supply evidence and recommended disposition, but cannot self-approve the gate

Transition rule:

- `quick_verify -> quick_done` requires `quick_verified = approved`

`quick_plan` does not add a second quick approval gate. It is a required planning stage, but quick-mode completion still depends on `quick_verified` after QA Lite passes.

Readiness rule before `quick_verified` approval:

- quick checklist and acceptance bullets are inspectable
- intended verification path is inspectable
- QA Lite evidence is inspectable in workflow state or session artifacts
- unresolved design or requirement issues are escalated instead of approved through

## Migration Gates

Migration mode uses four required gates:

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_verify`
- `migration_verified`

Meaning:

- `baseline_to_strategy` confirms the baseline, compatibility map, and likely breakpoints are inspectable enough for staged planning
- `strategy_to_upgrade` confirms the staged upgrade sequence, rollback checkpoints, and validation path are ready for execution
- `upgrade_to_verify` confirms upgrade execution evidence is inspectable enough for regression and compatibility QA
- `migration_verified` becomes `approved` only after regression, smoke, and compatibility verification are judged sufficient

Approval authorities:

- `baseline_to_strategy`: `Tech Lead Agent`
- `strategy_to_upgrade`: `Fullstack Agent`
- `upgrade_to_verify`: `QA Agent`
- `migration_verified`: `QA Agent`

Transition rules:

- `migration_baseline -> migration_strategy` uses `baseline_to_strategy`
- `migration_strategy -> migration_upgrade` uses `strategy_to_upgrade`
- `migration_upgrade -> migration_verify` uses `upgrade_to_verify`
- `migration_verify -> migration_done` uses `migration_verified`

Readiness rule before migration approvals:

- current baseline and target upgrade intent are inspectable
- staged execution notes and rollback checkpoints are inspectable
- validation evidence uses real project commands or honest manual evidence
- requirement ambiguity is escalated to full delivery instead of being approved through migration

## Full Delivery Gates

Full mode keeps the explicit handoff chain:

- `pm_to_ba`
- `ba_to_architect`
- `architect_to_tech_lead`
- `tech_lead_to_fullstack`
- `fullstack_to_qa`
- `qa_to_done`

Approval authorities:

- `pm_to_ba`: `BA Agent`
- `ba_to_architect`: `Architect Agent`
- `architect_to_tech_lead`: `Tech Lead Agent`
- `tech_lead_to_fullstack`: `Fullstack Agent`
- `fullstack_to_qa`: `QA Agent`
- `qa_to_done`: `MasterOrchestrator`

Transition rules:

- `full_brief -> full_spec` uses `pm_to_ba`
- `full_spec -> full_architecture` uses `ba_to_architect`
- `full_architecture -> full_plan` uses `architect_to_tech_lead`
- `full_plan -> full_implementation` uses `tech_lead_to_fullstack`
- `full_implementation -> full_qa` uses `fullstack_to_qa`
- `full_qa -> full_done` uses `qa_to_done`

Readiness checklist for every full-delivery gate:

- the outgoing stage artifact or evidence exists and is inspectable
- unresolved assumptions, risks, and open questions are called out in notes
- the receiving role has enough detail to begin without reconstructing missing intent
- the approver records approval notes or rejection notes in workflow state

Boundary-specific handoff focus:

- `pm_to_ba`: problem statement, goals, constraints, and product unknowns are clear
- `ba_to_architect`: scope, behaviors, and acceptance expectations are clear
- `architect_to_tech_lead`: design decisions, boundaries, and dependencies are clear
- `tech_lead_to_fullstack`: execution steps, sequencing, and validation expectations are clear
- `fullstack_to_qa`: implementation evidence, changed surfaces, and known limitations are clear
- `qa_to_done`: verification outcome, remaining issue status, and closure recommendation are clear

## Operational Rule

Do not advance the active work item stage, and do not refresh `.opencode/workflow-state.json`, until the matching gate for the active mode is `approved`.

Do not mark a gate `approved` when the evidence is missing, not inspectable, or relies on unstated conversation context.

## Escalation Rule

When quick or migration work escalates to full delivery:

- do not try to reuse quick or migration gates as full-delivery approvals
- record the escalation metadata in state
- initialize the full-delivery approval chain with pending values

This escalation behavior remains unchanged in the current live contract.
