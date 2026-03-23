# Issue Routing

This file defines how QA findings are classified and routed.

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
| `design_flaw` | `ArchitectAgent` |
| `requirement_gap` | `BAAgent` |

## Routing By Mode

### Quick Task routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `quick_build` / `FullstackAgent` | Fix in quick mode and re-verify |
| `design_flaw` | `full_intake` / `MasterOrchestrator` | Escalate to full delivery |
| `requirement_gap` | `full_intake` / `MasterOrchestrator` | Escalate to full delivery |

Quick mode must not absorb design or requirements work. When either appears, quick execution stops and the work is promoted to the full lane.

With the stronger quick-lane semantics now live, quick work includes an explicit `quick_plan` stage, but that stronger quick lane does not relax the design/requirements guardrail.

Quick-mode guardrail:

- do not invent a quick task board, per-task owners, or QA-per-subtask routing

### Full Delivery routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `full_implementation` / `FullstackAgent` | Fix implementation and return to QA |
| `design_flaw` | `full_architecture` / `ArchitectAgent` | Repair the design or escalate implementation concerns through architecture review |
| `requirement_gap` | `full_spec` / `BAAgent` | Clarify or repair requirements |

Task-aware full-delivery note:

- full-delivery execution tasks may carry task-local owners and findings, but routing still resolves to the feature-level stage owner above
- task-local rework may stay within the task board only for implementation-rooted bugs that do not require a stage change
- when a QA finding reveals a design flaw or requirement gap, the feature returns to `full_architecture` or `full_spec` even if the finding started from one execution task
- preserve task ids and task evidence in issue notes so the orchestrator can reconnect feature routing with task-board state

### Migration routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `migration_upgrade` / `FullstackAgent` | Fix upgrade fallout and re-verify |
| `design_flaw` | `migration_strategy` / `TechLeadAgent` | Rework upgrade sequencing, compatibility assumptions, or rollback plan |
| `requirement_gap` | `full_intake` / `MasterOrchestrator` | Escalate into full delivery because the issue is no longer primarily technical migration work |

Migration mode treats compatibility or upgrade-path mistakes as migration-stage work, but it must not absorb product-definition ambiguity.

Migration-mode guardrail:

- do not invent a migration task board, per-task owners, or QA-per-subtask routing in the current live contract

## Retry And Escalation

- Increment `retry_count` when the same issue cycles back after a failed fix
- In quick mode, repeated `bug` failures still stay in quick mode unless a design or requirement problem is uncovered and the work is no longer safely bounded
- In quick mode, `design_flaw` and `requirement_gap` escalate immediately rather than retrying inside quick mode
- In migration mode, repeated `bug` failures still stay in migration mode unless product ambiguity is uncovered and the work no longer fits migration semantics
- In migration mode, `requirement_gap` escalates immediately to full delivery instead of retrying inside migration mode
- In full mode, repeated task-local failures may keep a task in local rework only while the issue remains implementation-rooted and stage ownership does not need to change
- Escalate to the user after 3 failed loops on the same issue family
