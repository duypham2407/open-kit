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

## Migration Gates

Migration mode uses five required gates:

- `baseline_to_strategy`
- `strategy_to_upgrade`
- `upgrade_to_code_review`
- `code_review_to_verify`
- `migration_verified`

Approval authorities:

- `baseline_to_strategy`: `SolutionLead`
- `strategy_to_upgrade`: `FullstackAgent`
- `upgrade_to_code_review`: `CodeReviewer`
- `code_review_to_verify`: `QAAgent`
- `migration_verified`: `QAAgent`

Transition rules:

- `migration_baseline -> migration_strategy` uses `baseline_to_strategy`
- `migration_strategy -> migration_upgrade` uses `strategy_to_upgrade`
- `migration_upgrade -> migration_code_review` uses `upgrade_to_code_review`
- `migration_code_review -> migration_verify` uses `code_review_to_verify`
- `migration_verify -> migration_done` uses `migration_verified`

Readiness rule before migration approvals:

- current baseline and target upgrade intent are inspectable
- staged execution notes and rollback checkpoints are inspectable
- review or validation evidence uses real project commands or honest manual evidence
- requirement ambiguity is escalated to full delivery instead of being approved through migration

## Full Delivery Gates

Full mode uses the active handoff chain:

- `product_to_solution`
- `solution_to_fullstack`
- `fullstack_to_code_review`
- `code_review_to_qa`
- `qa_to_done`

Approval authorities:

- `product_to_solution`: `SolutionLead`
- `solution_to_fullstack`: `FullstackAgent`
- `fullstack_to_code_review`: `CodeReviewer`
- `code_review_to_qa`: `QAAgent`
- `qa_to_done`: `MasterOrchestrator`

Transition rules:

- `full_product -> full_solution` uses `product_to_solution`
- `full_solution -> full_implementation` uses `solution_to_fullstack`
- `full_implementation -> full_code_review` uses `fullstack_to_code_review`
- `full_code_review -> full_qa` uses `code_review_to_qa`
- `full_qa -> full_done` uses `qa_to_done`

Readiness checklist for every full-delivery gate:

- the outgoing stage artifact or evidence exists and is inspectable
- unresolved assumptions, risks, and open questions are called out in notes
- the receiving role has enough detail to begin without reconstructing missing intent
- the approver records approval notes or rejection notes in workflow state

Boundary-specific handoff focus:

- `product_to_solution`: problem statement, scope, business rules, acceptance criteria, and edge cases are clear
- `solution_to_fullstack`: technical approach, slices, dependencies, and validation expectations are clear
- `fullstack_to_code_review`: changed surfaces and implementation evidence are clear
- `code_review_to_qa`: scope compliance passed, important code-quality concerns are resolved or recorded, and QA has enough context to verify behavior
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
