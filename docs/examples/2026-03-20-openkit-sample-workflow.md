# OpenKit Sample Workflow

This golden path shows the expected artifact chain for a single feature.

## Feature

- Feature ID: `FEATURE-001`
- Slug: `task-intake-dashboard`
- Current stage progression: `intake -> brief -> spec -> architecture -> plan -> implementation -> qa -> done`

## Artifact Chain

1. PM creates `docs/briefs/2026-03-20-task-intake-dashboard.md`
2. BA creates `docs/specs/2026-03-20-task-intake-dashboard.md`
3. Architect creates `docs/architecture/2026-03-20-task-intake-dashboard.md`
4. Tech Lead creates `docs/plans/2026-03-20-task-intake-dashboard.md`
5. Fullstack implements code and tests
6. QA creates `docs/qa/2026-03-20-task-intake-dashboard.md`

## Approval Flow

- `pm_to_ba`: approved after the brief is accepted
- `ba_to_architect`: approved after acceptance criteria are stable
- `architect_to_tech_lead`: approved after architecture trade-offs are accepted
- `tech_lead_to_fullstack`: approved after the plan is accepted
- `fullstack_to_qa`: approved when implementation is ready for QA
- `qa_to_done`: approved when QA reports PASS

## QA Routing Example

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

## Resume Example

If a new session opens while `current_stage` is `qa`, the agent should read `.opencode/workflow-state.json`, then the current QA report, then the current plan, and only then decide whether to route the issue or close the feature.
