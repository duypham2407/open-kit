---
artifact_type: architecture
version: 1
status: approved
feature_id: FEATURE-001
feature_slug: task-intake-dashboard
source_spec: docs/scope/2026-03-20-task-intake-dashboard.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Architecture: Task Intake Dashboard

## Summary

Use a read-only dashboard that renders normalized task data from a single query source. Keep filtering local to the dashboard so the architecture stays small and predictable.

## System Diagram

`Task Query -> Status Normalizer -> TaskListView -> Filter Controls`

## Components

### TaskQueryService
- Responsibility: fetch raw task records
- Interface: returns intake task collection
- Dependencies: data source

### StatusNormalizer
- Responsibility: convert unknown statuses into safe labels
- Interface: normalized task objects
- Dependencies: task query output

### TaskListView
- Responsibility: render rows and empty state
- Interface: normalized tasks plus active filters
- Dependencies: normalizer output

## Data Contracts

- Task: `title`, `queue`, `status`, `owner`, `priority`

## Technology Choices

- Keep the example stack-agnostic because the root repository has no canonical app stack yet.

## Risks and Mitigations

- Risk: status values drift over time
- Mitigation: normalize before render

## ADR References

- None required for the golden path example
