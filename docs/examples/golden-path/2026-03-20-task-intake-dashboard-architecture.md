---
artifact_type: architecture
version: 1
status: approved
feature_id: FEATURE-001
feature_slug: task-intake-dashboard
source_spec: docs/examples/golden-path/2026-03-20-task-intake-dashboard-spec.md
owner: ArchitectAgent
approval_gate: architect_to_tech_lead
---

# Architecture: Task Intake Dashboard

## Summary

Use a read-only dashboard page backed by a task-list query. Keep filtering local to the page and keep task shape explicit.

## Components

### TaskListView
- Responsibility: Render rows and empty state.
- Interface: `tasks`, `filters`
- Dependencies: task query service

## Risks and Mitigations

- Risk: ambiguous status labels
- Mitigation: normalize statuses before render
