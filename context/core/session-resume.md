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
- run `node .opencode/workflow-state.js resume-summary --json` when tooling or automation needs the resumable context in machine-readable form, including explicit `validation_surfaces` labels and diagnostic surface labels for `global_cli` and `compatibility_runtime`

## Mode-Aware Resume Rules

### Quick Task

If `mode` is `quick`:

- the Quick Agent is the sole owner of all quick stages — no other agent is involved
- read the quick task card if `artifacts.task_card` is present
- if there is no task card, treat missing recorded quick context as a repair need; resume only from inspectable repository state and recorded workflow evidence
- if `current_stage` is `quick_brainstorm`, inspect any brainstorm notes or option analysis before resuming
- if `current_stage` is `quick_plan`, inspect the execution plan, chosen option, and test strategy before resuming implementation
- if `current_stage` is `quick_implement`, inspect the recorded plan and any partial implementation evidence before continuing
- if `current_stage` is `quick_test`, inspect the latest test and verification evidence before continuing
- if `current_stage` is `quick_done`, confirm `quick_verified` is approved and the closing evidence remains inspectable on resume

Quick-lane reminder:

- Quick mode is a single-agent lane owned entirely by the Quick Agent
- Master Orchestrator, QA Agent, and other agents do not participate in quick mode
- do not invent a quick task board, extra lane, or extra artifact requirement while resuming quick work

### Full Delivery

If `mode` is `full`:

- read the artifact referenced by the current stage when it exists
- if `work_item_id` is present, inspect `.opencode/work-items/index.json` and the active work-item state before trusting task-aware full-delivery context
- if the current full-delivery stage is `full_solution`, `full_implementation`, `full_code_review`, `full_qa`, or `full_done`, inspect the task board when it exists and confirm it belongs only to this full work item
- restore both feature-level and task-level context: current stage owner, active work item id, ready/active task summary, and any task-specific evidence tied to the next decision
- when task-level coordination is in use, confirm task owner, task status, artifact refs, dependencies or sequential constraints, safe parallel zones, QA owner, integration readiness, unresolved issues, and verification evidence are inspectable before continuing
- if `parallel_mode` is `none`, treat the board as sequential even when multiple task rows are ready or dispatchable
- if `current_stage` is `full_code_review`, inspect the latest implementation evidence and review findings before rerouting or advancing
- if `current_stage` is `full_qa`, read the current QA report and related solution package first
- if `current_stage` is `full_done`, confirm the QA report, verification evidence, and issue state are all inspectable before trusting closure
- preserve the approval-gate context before advancing or rerouting
- if resuming at a handoff boundary, inspect the latest approved gate notes before starting new work

### Migration

If `mode` is `migration`:

- read the linked architecture artifact when present because it carries the baseline and compatibility model for the upgrade
- read the migration solution package in `docs/solution/` when it exists
- if `current_stage` is `migration_baseline`, inspect `docs/templates/migration-baseline-checklist.md` and the recorded current versions, preserved invariants, compatibility hotspots, and likely breakpoints before planning
- inspect `migration_context` for baseline summary, target outcome, preserved invariants, baseline evidence refs, compatibility hotspots, and rollback checkpoints before trusting migration continuity
- if `current_stage` is `migration_strategy`, inspect the staged upgrade sequence, seam or adapter decisions, rollback notes, and validation path before resuming implementation
- if `current_stage` is `migration_upgrade`, inspect the migration strategy and latest execution evidence before continuing
- if `current_stage` is `migration_code_review`, inspect preserved invariants, migration strategy, and latest execution evidence before rerouting or advancing
- if `current_stage` is `migration_verify`, inspect `docs/templates/migration-verify-checklist.md` and the latest regression, smoke, compatibility, and parity evidence before deciding closure or reroute
- if `current_stage` is `migration_done`, confirm `migration_verified` is approved and the closing evidence remains inspectable on resume
- migration mode has no general task board; only strategy-enabled migration slice boards may exist
- if a migration slice board exists, resume from migration semantics: preserved invariants, baseline evidence, compatibility risk, staged sequencing, rollback checkpoints, parity evidence, and slice verification
- do not treat migration slice coordination as full-delivery task ownership by default

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
- Treat pending approvals, unresolved open issues, invalid task or slice boards, missing required artifacts, and missing required evidence as blocking state.
- Treat active work item id, linked artifact paths, artifact-readiness lines, read-next guidance, and command pointers as informational state unless the runtime marks them as blockers.

Task-aware full-delivery reminder:

- `.opencode/workflow-state.json` is the active compatibility mirror, not the sole managed backing file
- do not assume every full-delivery item has parallel work; only rely on task-board state when the runtime actually recorded it
- quick and migration modes still have no task board

Evidence labeling reminder:

- record whether resume or verification evidence applies to `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, or `target_project_app`
- if target-project app build/lint/test commands are absent, preserve that as an explicit unavailable validation path instead of substituting OpenKit runtime health checks

The current one-way escalation behavior remains unchanged in the live contract.

## Status Values

- `idle`: no active feature is currently being executed
- `in_progress`: work is active in the current stage
- `blocked`: work cannot continue without input or repair
- `done`: the feature has completed the active workflow
