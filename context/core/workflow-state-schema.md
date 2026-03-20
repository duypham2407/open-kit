# Workflow State Schema

This file defines the canonical fields and enums for `.opencode/workflow-state.json`.

## Required Top-Level Fields

- `feature_id`
- `feature_slug`
- `current_stage`
- `status`
- `current_owner`
- `artifacts`
- `approvals`
- `issues`
- `retry_count`
- `updated_at`

## `current_stage` Values

- `intake`: request received, routing not finalized
- `brief`: PM is producing or revising the product brief
- `spec`: BA is producing or revising the specification
- `architecture`: Architect is producing or revising the design
- `plan`: Tech Lead is producing or revising the implementation plan
- `implementation`: Fullstack is executing approved work
- `qa`: QA is validating implementation or routing findings
- `done`: the feature completed the active workflow

## `status` Values

- `idle`
- `in_progress`
- `blocked`
- `done`

## Stage Ownership Map

| Stage | Default Owner |
| --- | --- |
| `intake` | `MasterOrchestrator` |
| `brief` | `PMAgent` |
| `spec` | `BAAgent` |
| `architecture` | `ArchitectAgent` |
| `plan` | `TechLeadAgent` |
| `implementation` | `FullstackAgent` |
| `qa` | `QAAgent` |
| `done` | `MasterOrchestrator` |
