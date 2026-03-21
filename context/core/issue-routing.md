# Issue Routing

This file defines how QA findings are classified and routed.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, and artifact expectations, use `context/core/workflow.md`.

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

### Full Delivery routing

| Type | Route to | Expected action |
| --- | --- | --- |
| `bug` | `full_implementation` / `FullstackAgent` | Fix implementation and return to QA |
| `design_flaw` | `full_architecture` / `ArchitectAgent` | Repair the design or escalate implementation concerns through architecture review |
| `requirement_gap` | `full_spec` / `BAAgent` | Clarify or repair requirements |

## Retry And Escalation

- Increment `retry_count` when the same issue cycles back after a failed fix
- In quick mode, repeated `bug` failures still stay in quick mode unless a design or requirement problem is uncovered and the work is no longer safely bounded
- In quick mode, `design_flaw` and `requirement_gap` escalate immediately rather than retrying inside quick mode
- Escalate to the user after 3 failed loops on the same issue family
