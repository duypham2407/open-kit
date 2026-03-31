# Issue Routing

This file defines how review and QA findings are classified and routed.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, and artifact expectations, use `context/core/workflow.md`.

Classification is shared across all workflow modes, but routing behavior depends on the active work item mirrored through `.opencode/workflow-state.json`.

## Required Issue Schema

Each issue should record:

- `issue_id`
- `title`
- `type`: `bug` | `design_flaw` | `requirement_gap`
- `severity`: `critical` | `high` | `medium` | `low`
- `rooted_in`: `implementation` | `architecture` | `requirements`
- `recommended_owner`
- `evidence`
- `artifact_refs`

## Ownership Rules

| Type | Default Owner |
| --- | --- |
| `bug` | `FullstackAgent` |
| `design_flaw` | `SolutionLead` |
| `requirement_gap` | `ProductLead` |

## Routing By Mode

### Quick Task routing

Quick mode is a single-agent lane. The Quick Agent handles all issues internally.

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `quick_test` / `QuickAgent` | Fix at the spot, re-test |
| `design_flaw` | report to user | Quick Agent explains the finding and presents options to the user |
| `requirement_gap` | report to user | Quick Agent explains the finding and presents options to the user |

Quick mode has no inter-agent routing. When the Quick Agent discovers a design flaw or requirement gap:

- explain the finding to the user with evidence
- present options: adjust scope and continue in quick mode, or switch to `/delivery` for full treatment
- the user decides — the Quick Agent does not auto-escalate

Quick-mode guardrail:

- do not invent a quick task board, per-task owners, or QA-per-subtask routing

### Full Delivery routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `full_implementation` / `FullstackAgent` | Fix implementation and return to review or QA |
| `design_flaw` | `full_solution` / `SolutionLead` | Repair the technical design, sequencing, or boundary decision |
| `requirement_gap` | `full_product` / `ProductLead` | Clarify or repair scope, rules, or acceptance |

Task-aware full-delivery note:

- full-delivery execution tasks may carry task-local owners and findings, but routing still resolves to the feature-level stage owner above
- task-local rework may stay within the task board only for implementation-rooted bugs that do not require a stage change
- when a review or QA finding reveals a design flaw or requirement gap, the feature returns to `full_solution` or `full_product` even if the finding started from one execution task
- preserve task ids and task evidence in issue notes so the orchestrator can reconnect feature routing with task-board state
- multiple Fullstack or QA owners are allowed only when the approved solution package marks the work item as parallel-capable and the task graph passes runtime validation

### Migration routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `migration_upgrade` / `FullstackAgent` | Fix upgrade fallout and re-review |
| `design_flaw` | `migration_strategy` / `SolutionLead` | Rework upgrade sequencing, compatibility assumptions, or rollback notes |
| `requirement_gap` | depends on `lane_source` | When `orchestrator_routed`, escalate into full delivery; when `user_explicit`, stay in `migration_verify`, report to user, and wait for their decision |

Migration mode treats compatibility or upgrade-path mistakes as migration-stage work, but it must not absorb product-definition ambiguity.

Migration-mode guardrail:

- do not invent a migration task board, per-task owners, or QA-per-subtask routing in the current live contract
- if migration slice execution is later enabled by the approved strategy, keep slice-level routing subordinate to the migration stage owner and do not absorb product ambiguity into migration-local rework

## Retry And Escalation

## Review-Specific Finding Classes

- `implementation_issue` -> route as `bug`
- `solution_issue` -> route as `design_flaw`
- `product_scope_issue` -> route as `requirement_gap`
- `migration_parity_issue` -> route as `design_flaw` in `migration`, unless the evidence shows a true implementation-only regression

- Increment `retry_count` when the same issue cycles back after a failed fix
- In quick mode, the Quick Agent fixes bugs internally; if repeated failures reveal a design or requirement problem, the Quick Agent reports the finding to the user and lets the user decide whether to switch lanes
- In migration mode, repeated `bug` failures still stay in migration mode unless product ambiguity is uncovered and the work no longer fits migration semantics
- In migration mode, `requirement_gap` escalates immediately to full delivery when `lane_source` is `orchestrator_routed`; when `lane_source` is `user_explicit`, keep the work item in `migration_verify`, report the mismatch, and wait for user decision
- In full mode, repeated task-local failures may keep a task in local rework only while the issue remains implementation-rooted and stage ownership does not need to change
- Escalate to the user after 3 failed loops on the same issue family
