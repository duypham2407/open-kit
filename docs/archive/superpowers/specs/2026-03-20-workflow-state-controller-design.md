# Workflow State Controller Design

> Historical background note: this controller design predates the current hard-split workflow. The current runtime contract now supports the hard-split model, but this document remains useful as controller-design background.

## Goal

Provide a small, explicit control surface for reading, validating, and updating OpenKit workflow state without introducing a background service or hidden automation.

## Why This Exists

OpenKit uses a documented workflow state contract, and the controller exists to make that file-backed operating system practical instead of purely descriptive.

The controller reduces drift between:

- `.opencode/workflow-state.json`
- artifact files under `docs/`
- approval gate rules
- stage ownership rules
- issue routing rules

## Current Direction

The runtime now follows the hard-split workflow contract:

- `Quick Task` lane
- `Full Delivery` lane
- mode-aware stages
- mode-aware approvals
- explicit quick-to-full escalation

This document preserves the original intent of the controller while updating the command surface examples to match the current runtime behavior.

## Non-Goals

- Building a daemon, watcher, or background scheduler
- Auto-discovering arbitrary repo structure beyond documented artifact paths
- Replacing human approval with automatic approval
- Introducing application-specific build or test assumptions

## CLI Surface

The workflow-state controller supports these commands:

### `show`

Print the current workflow state in a readable form.

### `validate`

Check that the current state file satisfies the documented hard-split schema:

- required top-level fields
- valid `mode`
- valid mode-specific `current_stage`
- valid stage-owner alignment
- valid mode-specific approvals
- valid artifact shape including `task_card`
- valid issue objects
- retry and escalation metadata shape

### `start-task`

Initialize work in the chosen mode.

Expected inputs:

- `mode`
- `feature_id`
- `feature_slug`
- `mode_reason`

Expected effects:

- set `mode`
- set `mode_reason`
- set `current_stage` to `quick_intake` or `full_intake`
- set `status` to `in_progress`
- set `current_owner` to `MasterOrchestrator`
- clear artifacts and issues
- initialize mode-appropriate approvals
- reset `retry_count`
- clear escalation metadata

### `start-feature`

Compatibility shortcut retained for older flows.

Expected behavior:

- initialize a `Full Delivery` task
- set `mode = full`
- set `current_stage = full_intake`
- provide a compatibility `mode_reason`

### `advance-stage`

Move to the next stage within the active mode.

Rules:

- transition must be forward-only within the active lane
- if a gate protects the transition, that gate must already be `approved`
- `current_owner` must change to the default owner of the new stage
- `status` becomes `done` only when the new stage is `quick_done` or `full_done`

### `set-approval`

Set one approval gate for the active mode.

Rules:

- quick mode accepts `quick_verified`
- full mode accepts the full approval chain only

### `link-artifact`

Attach one artifact path to state.

Supported kinds:

- `task_card`
- `brief`
- `spec`
- `architecture`
- `plan`
- `qa_report`
- `adr`

### `record-issue`

Append an issue to the `issues` array using the documented issue schema.

### `clear-issues`

Clear recorded issues after explicit resolution or rerouting.

### `route-rework`

Route failed QA or workflow findings based on active mode.

Quick mode:

- `bug` -> `quick_build`
- `design_flaw` -> escalate to `full_intake`
- `requirement_gap` -> escalate to `full_intake`

Full mode:

- `bug` -> `full_implementation`
- `design_flaw` -> `full_architecture`
- `requirement_gap` -> `full_spec`

## Source Of Truth For Validation

The controller should validate against repository docs rather than inventing behavior:

- `context/core/workflow-state-schema.md`
- `context/core/approval-gates.md`
- `context/core/issue-routing.md`
- `context/core/workflow.md`

## Example Usage

```bash
node .opencode/workflow-state.js validate
node .opencode/workflow-state.js start-task quick TASK-002 copy-fix "Scoped copy-only change"
node .opencode/workflow-state.js link-artifact task_card docs/tasks/2026-03-21-copy-fix.md
node .opencode/workflow-state.js advance-stage quick_build
node .opencode/workflow-state.js advance-stage quick_verify
node .opencode/workflow-state.js set-approval quick_verified approved system 2026-03-21 "QA Lite passed"
node .opencode/workflow-state.js advance-stage quick_done
```

```bash
node .opencode/workflow-state.js start-task full FEATURE-002 login-flow "Feature-sized workflow with multiple handoffs"
node .opencode/workflow-state.js set-approval pm_to_ba approved user 2026-03-21 "Brief approved"
node .opencode/workflow-state.js advance-stage full_brief
node .opencode/workflow-state.js route-rework requirement_gap
```

## Testing Strategy

This repository still does not define a repo-native test runner for application code, so controller verification should stay lightweight and explicit.

Current verification path:

- run controller unit tests for mode-aware state behavior
- validate the checked-in `.opencode/workflow-state.json`
- smoke-test CLI commands on temporary state files

## Decision

Keep the workflow-state controller small, file-backed, and explicit, while aligning its command surface with OpenKit's hard-split workflow model.
