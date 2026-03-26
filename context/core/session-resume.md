# Session Resume Protocol

Use this file when continuing work that may have started in a previous session.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and artifact expectations, use `context/core/workflow.md`.

## Required Read Order

1. `AGENTS.md` for repository-wide rules and current-state guardrails
2. `context/navigation.md` for context discovery and current-vs-future wayfinding
3. `.opencode/workflow-state.json` as the active compatibility mirror for the current work item
4. Determine `mode` and `current_stage`
5. Read the mode-appropriate artifact or task context
6. Read any related QA issues, approval notes, or escalation metadata

Fast path:

- run `node .opencode/workflow-state.js resume-summary` when you need a human-readable snapshot before diving into raw state or linked artifacts
- run `node .opencode/workflow-state.js resume-summary --json` when tooling or automation needs the resumable context in machine-readable form

## Mode-Aware Resume Rules

### Quick Task

If `mode` is `quick`:

- read the quick task card if `artifacts.task_card` is present
- if there is no task card, treat missing recorded quick context as a repair need; resume only from inspectable repository state and recorded workflow evidence, and repair the missing quick context before advancing when the current stage requires it
- if `current_stage` is `quick_plan`, inspect the bounded checklist, acceptance confirmation, and verification path before resuming implementation
- if `current_stage` is `quick_build`, inspect the recorded `quick_plan` content first; do not treat the absence of a task card as missing workflow
- if `current_stage` is `quick_verify`, inspect the latest QA Lite evidence before continuing
- if `current_stage` is `quick_done`, confirm `quick_verified` is approved and the closing evidence remains inspectable on resume

Quick-lane reminder:

- `quick_plan` is already part of the live contract, even when no separate doc artifact exists
- QA Lite evidence is already part of the live contract, even when it is stored only in workflow state and session notes
- do not invent a quick task board, extra lane, or extra artifact requirement while resuming quick work

### Full Delivery

If `mode` is `full`:

- read the artifact referenced by the current stage when it exists
- if `work_item_id` is present, inspect `.opencode/work-items/index.json` and the active work-item state before trusting task-aware full-delivery context
- if the current full-delivery stage is `full_plan`, `full_implementation`, or `full_qa`, inspect the task board when it exists and confirm it belongs only to this full work item
- restore both feature-level and task-level context: current stage owner, active work item id, ready/active task summary, and any task-specific evidence tied to the next decision
- if `current_stage` is `full_qa`, read the current QA report and related plan first
- if `current_stage` is `full_done`, confirm the QA report, verification evidence, and issue state are all inspectable before trusting closure
- preserve the approval-gate context before advancing or rerouting
- if resuming at a handoff boundary, inspect the latest approved gate notes before starting new work

### Migration

If `mode` is `migration`:

- read the linked architecture artifact when present because it carries the baseline and compatibility model for the upgrade
- read the migration plan in `docs/plans/` when it exists
- if `current_stage` is `migration_baseline`, inspect `docs/templates/migration-baseline-checklist.md` and the recorded current versions, preserved invariants, compatibility hotspots, and likely breakpoints before planning
- if `current_stage` is `migration_strategy`, inspect the staged upgrade sequence, seam or adapter decisions, rollback notes, and validation path before resuming implementation
- if `current_stage` is `migration_upgrade`, inspect the migration strategy and latest execution evidence before continuing
- if `current_stage` is `migration_verify`, inspect `docs/templates/migration-verify-checklist.md` and the latest regression, smoke, compatibility, and parity evidence before deciding closure or reroute
- if `current_stage` is `migration_done`, confirm `migration_verified` is approved and the closing evidence remains inspectable on resume
- migration mode still has no task board in the live contract

## General Resume Rules

- Trust repository state over memory.
- If `status` is `blocked`, do not continue implementation until the blocker is understood.
- If an approval gate for the active mode is still `pending`, do not silently skip to the next stage.
- If the referenced artifact file is missing, report the mismatch and repair the docs/state before proceeding.
- If `escalated_from` is `quick` or `migration`, resume from the current full-delivery stage, not from the abandoned earlier stage.
- Use `.opencode/workflow-state.js show` or `.opencode/workflow-state.js validate` when explicit state inspection helps resume work.
- Use `.opencode/workflow-state.js resume-summary` when you need the next safe action, linked artifacts, pending approvals, and open issues in one place.
- Use `.opencode/workflow-state.js check-stage-readiness` when you need to know whether the current stage can honestly close.
- Use `.opencode/workflow-state.js issue-aging-report` or `list-stale-issues` when repeated findings or blocked issues may be driving the next action.
- Use `node .opencode/workflow-state.js list-work-items`, `show-work-item`, `list-tasks`, or `validate-work-item-board` when full-delivery resume depends on task-aware state.
- Inspect whether the recorded evidence is sufficient for the current stage before acting; if not, repair the handoff context first.
- Preserve explicit validation history when resuming; do not replace prior evidence with vague restatements.

Task-aware full-delivery reminder:

- `.opencode/workflow-state.json` is the active compatibility mirror, not the sole managed backing file
- do not assume every full-delivery item has parallel work; only rely on task-board state when the runtime actually recorded it
- quick and migration modes still have no task board

The current one-way escalation behavior remains unchanged in the live contract.

## Status Values

- `idle`: no active feature is currently being executed
- `in_progress`: work is active in the current stage
- `blocked`: work cannot continue without input or repair
- `done`: the feature has completed the active workflow
