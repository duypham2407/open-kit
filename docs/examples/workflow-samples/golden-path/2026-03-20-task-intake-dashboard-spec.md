---
artifact_type: specification
version: 1
status: approved
feature_id: FEATURE-001
feature_slug: task-intake-dashboard
source_brief: docs/examples/workflow-samples/golden-path/2026-03-20-task-intake-dashboard-brief.md
owner: BAAgent
approval_gate: ba_to_architect
mode: full
example_type: full_delivery_golden_path
---

# Spec: Task Intake Dashboard

This file is part of the full-delivery golden-path example.

## User Stories

### US-001: View incoming tasks
As an operations coordinator, I want to see incoming tasks in one list so that I can triage work quickly.

**Acceptance Criteria**
- Given incoming tasks exist, when the dashboard loads, then the list shows task title, queue, status, and owner.
- Given no tasks exist, when the dashboard loads, then an empty state message is shown.

**Edge Cases**
- Empty queue
- Unknown status value
