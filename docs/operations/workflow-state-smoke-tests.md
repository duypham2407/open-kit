# Workflow-State Smoke Tests

Use this document to run lightweight verification for the hard-split workflow-state utility and the session-start resume hint.

## Purpose

These checks validate OpenKit's workflow operating system behavior without assuming any application build, lint, or test stack.

## Automated Checks

### Controller unit tests

Run:

```bash
node --test ".opencode/tests/workflow-state-controller.test.js"
```

This covers:

- quick-task initialization
- full-delivery initialization
- mode-aware approvals
- valid and invalid stage transitions
- quick-to-full escalation routing
- compatibility behavior for `start-feature`

### Session-start hook test

Run:

```bash
node --test ".opencode/tests/session-start-hook.test.js"
```

This verifies that the session-start hook emits a mode-aware `workflow_resume_hint` when state exists.

## Manual CLI Smoke Tests

### Quick Task happy path

```bash
node .opencode/workflow-state.js start-task quick TASK-900 copy-fix "Scoped text change"
node .opencode/workflow-state.js advance-stage quick_build
node .opencode/workflow-state.js advance-stage quick_verify
node .opencode/workflow-state.js set-approval quick_verified approved system 2026-03-21 "QA Lite passed"
node .opencode/workflow-state.js advance-stage quick_done
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = quick`
- `current_stage = quick_done`
- `status = done`

### Quick Task escalation path

```bash
node .opencode/workflow-state.js start-task quick TASK-901 needs-spec "Initially looked small"
node .opencode/workflow-state.js route-rework design_flaw
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = full`
- `current_stage = full_intake`
- `escalated_from = quick`
- non-null `escalation_reason`

### Full Delivery bug rework path

```bash
node .opencode/workflow-state.js start-task full FEATURE-900 dashboard-v2 "Feature workflow"
node .opencode/workflow-state.js route-rework bug true
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = full`
- `current_stage = full_implementation`
- `retry_count = 1`

## Notes

- Prefer using a temporary state file when running manual smoke tests so the checked-in `.opencode/workflow-state.json` remains stable.
- If workflow rules change, update this file alongside the tests and the workflow-state CLI docs.
