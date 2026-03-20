# Issue Routing

This file defines how QA findings are classified and routed.

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

## Retry And Escalation

- Increment `retry_count` when the same issue cycles back after a failed fix.
- Escalate to the user after 3 failed loops on the same issue family.
