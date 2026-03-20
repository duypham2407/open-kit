# OpenKit Hard-Split Workflow Examples

This document shows the expected behavior of two separate operating lanes in the hard-split workflow. These are not optional shortcuts inside one universal pipeline; they are distinct contracts.

## Quick Task Example

- Feature ID: `TASK-001`
- Slug: `update-task-card-copy`
- Mode: `quick`
- Stage progression: `quick_intake -> quick_build -> quick_verify -> quick_done`

Quick-task example flow:

1. `MasterOrchestrator` accepts a narrow copy change into quick mode.
2. `MasterOrchestrator` records goal, scope, acceptance bullets, and verification path.
3. `FullstackAgent` implements the change.
4. `QAAgent` runs QA Lite.
5. If QA Lite reports a `bug`, work routes back to `quick_build`.
6. If QA Lite reports a `design_flaw` or `requirement_gap`, the task escalates to `full_intake`.

## Full Delivery Example

- Feature ID: `FEATURE-001`
- Slug: `task-intake-dashboard`
- Mode: `full`
- Stage progression: `full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`

Full-delivery artifact chain:

This artifact chain applies only to `mode: full`.

1. PM creates `docs/briefs/2026-03-20-task-intake-dashboard.md`
2. BA creates `docs/specs/2026-03-20-task-intake-dashboard.md`
3. Architect creates `docs/architecture/2026-03-20-task-intake-dashboard.md`
4. Tech Lead creates `docs/plans/2026-03-20-task-intake-dashboard.md`
5. Fullstack implements code and tests
6. QA creates `docs/qa/2026-03-20-task-intake-dashboard.md`

## Full Delivery Approval Flow

These approval gates are used only in `Full Delivery`. Quick mode does not use them.

- `pm_to_ba`: approved after the brief is accepted
- `ba_to_architect`: approved after acceptance criteria are stable
- `architect_to_tech_lead`: approved after architecture trade-offs are accepted
- `tech_lead_to_fullstack`: approved after the plan is accepted
- `fullstack_to_qa`: approved when implementation is ready for QA
- `qa_to_done`: approved when QA reports PASS

## QA Routing Examples

### Quick Task

If QA Lite reports a small implementation mistake:

- `type`: `bug`
- `severity`: `low`
- `rooted_in`: `implementation`
- `recommended_owner`: `FullstackAgent`
- route: `quick_build`

If QA Lite reports missing requirement detail:

- `type`: `requirement_gap`
- `severity`: `high`
- `rooted_in`: `requirements`
- route: escalate to `full_intake`

### Full Delivery

If QA reports a missing validation branch:

- `type`: `bug`
- `severity`: `medium`
- `rooted_in`: `implementation`
- `recommended_owner`: `FullstackAgent`

If QA reports a contradictory acceptance criterion:

- `type`: `requirement_gap`
- `severity`: `high`
- `rooted_in`: `requirements`
- `recommended_owner`: `BAAgent`

## Resume Examples

- If a new session opens while `mode` is `quick` and `current_stage` is `quick_verify`, read `.opencode/workflow-state.json`, then the quick task card if present, then the latest QA Lite evidence.
- If a new session opens while `mode` is `full` and `current_stage` is `full_qa`, read `.opencode/workflow-state.json`, then the current QA report, then the current plan, and only then decide whether to route the issue or close the full-delivery feature.
