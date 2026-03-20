# Issue Routing

This file defines how QA findings are classified and routed.

Classification is shared across both workflow modes, but routing behavior depends on the active mode in `.opencode/workflow-state.json`.

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
| `design_flaw` | `ArchitectAgent` or `TechLeadAgent` |
| `requirement_gap` | `BAAgent` |

## Routing By Mode

### Quick Task routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `quick_build` / `FullstackAgent` | Fix in quick mode and re-verify |
| `design_flaw` | `full_intake` / `MasterOrchestrator` | Escalate to full delivery |
| `requirement_gap` | `full_intake` / `MasterOrchestrator` | Escalate to full delivery |

Quick mode must not absorb design or requirements work. When either appears, quick execution stops and the work is promoted to the full lane.

### Full Delivery routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `full_implementation` / `FullstackAgent` | Fix implementation and return to QA |
| `design_flaw` | `full_architecture` or `full_plan` / `ArchitectAgent` or `TechLeadAgent` | Repair design or implementation approach |
| `requirement_gap` | `full_spec` / `BAAgent` | Clarify or repair requirements |

## Retry And Escalation

- Increment `retry_count` when the same issue cycles back after a failed fix
- In quick mode, repeated `bug` failures still stay in quick mode unless a design or requirement problem is uncovered
- In quick mode, `design_flaw` and `requirement_gap` escalate immediately rather than retrying inside quick mode
- Escalate to the user after 3 failed loops on the same issue family
