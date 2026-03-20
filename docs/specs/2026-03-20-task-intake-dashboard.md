---
artifact_type: specification
version: 1
status: approved
feature_id: FEATURE-001
feature_slug: task-intake-dashboard
source_brief: docs/briefs/2026-03-20-task-intake-dashboard.md
owner: BAAgent
approval_gate: ba_to_architect
---

# Spec: Task Intake Dashboard

## Summary

Operators need a simple dashboard to review incoming tasks, scan status, and identify blocked work quickly.

## User Stories

### US-001: Review intake list
As an operations coordinator, I want a single intake list so that I can triage work quickly.

**Acceptance Criteria**
- Given incoming tasks exist, when the dashboard loads, then each row shows title, queue, status, and owner.
- Given no incoming tasks exist, when the dashboard loads, then an empty state message is shown.

**Edge Cases**
- Empty queue
- Unknown status value normalized to a safe label

### US-002: Filter visible tasks
As a delivery lead, I want to filter the list so that I can focus on urgent or blocked work.

**Acceptance Criteria**
- Given filters are available, when the user selects a priority or queue, then only matching tasks remain visible.

**Edge Cases**
- Filter returns zero tasks

## Non-Functional Requirements

- Task state labels should remain explicit and readable.

## Out of Scope

- Auto-assignment logic

## Open Questions

- None for the golden path example
