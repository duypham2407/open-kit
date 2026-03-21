# Project Configuration & Tooling Standards

This file defines the current execution reality for the repository. Agents must use documented commands when they exist and explicitly report when they do not.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and artifact expectations, use `context/core/workflow.md`.

## Current State

- There is no repo-native build command for generated application code yet.
- There is no repo-native lint command for generated application code yet.
- There is no repo-native test command for generated application code yet.
- There is no single canonical package manager or language toolchain for future applications yet.
- OpenKit uses the hard-split workflow documented in `context/core/workflow.md`; keep tooling and command guidance here aligned with that live contract instead of re-stating lane policy in full.
- The persisted workflow state file uses a mode-aware schema and `.opencode/workflow-state.js` supports that hard-split workflow model.

## Commands That Do Exist

- Session hook configuration lives in `hooks/hooks.json`.
- The session-start hook script lives in `hooks/session-start`.
- The OpenCode kit manifest lives in `.opencode/opencode.json`.
- The persisted workflow state lives in `.opencode/workflow-state.json`.
- The workflow-state CLI lives at `.opencode/workflow-state.js`.
- Workflow command contracts live under `commands/`.

### Workflow-State Utility Commands

These are repository workflow commands, not application build/lint/test commands:

- `node .opencode/workflow-state.js status`
- `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js version`
- `node .opencode/workflow-state.js profiles`
- `node .opencode/workflow-state.js show-profile <name>`
- `node .opencode/workflow-state.js sync-install-manifest <name>`
- `node .opencode/workflow-state.js show`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js start-feature <feature_id> <feature_slug>`
- `node .opencode/workflow-state.js start-task <mode> <feature_id> <feature_slug> <mode_reason>`
- `node .opencode/workflow-state.js advance-stage <stage>`
- `node .opencode/workflow-state.js set-approval <gate> <status> [approved_by] [approved_at] [notes]`
- `node .opencode/workflow-state.js link-artifact <kind> <path>`
- `node .opencode/workflow-state.js scaffold-artifact <task_card|plan> <slug>`
- `node .opencode/workflow-state.js record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>`
- `node .opencode/workflow-state.js clear-issues`
- `node .opencode/workflow-state.js route-rework <issue_type> [repeat_failed_fix]`

Current workflow-state behavior:

- The CLI understands the hard-split workflow model.
- `status`, `doctor`, `version`, `profiles`, `show-profile`, and `sync-install-manifest` are part of the current runtime inspection surface.
- `start-feature` remains available as a compatibility shortcut and initializes `Full Delivery` mode.
- `start-task` is the preferred explicit entrypoint for new mode-aware state.
- `scaffold-artifact` is a narrow helper for creating and linking `task_card` and `plan` artifacts from checked-in templates.
- `task_card` scaffolding requires `quick` mode and is intentionally allowed as optional traceability in the quick lane.
- `plan` scaffolding requires `full` mode, `full_plan`, and a linked architecture artifact.

## Validation Reality By Mode

### Quick Task

- Use the closest real verification path available.
- If no test framework exists, manual verification is acceptable when reported clearly.
- Do not invent commands that the repository has not adopted.

### Full Delivery

- Prefer the strongest real validation path available.
- If no test or build tooling exists, explicitly record that the validation path is unavailable.
- Do not claim TDD or automated QA evidence unless the supporting commands actually exist.

## Future Update Rule

When this repository adopts a real application stack, update both this file and `AGENTS.md` with the exact commands before expecting agents to run them.

When the workflow-state CLI gains new hard-split capabilities, update this file at the same time so the documented command behavior matches reality.

## Execution Rules For Agents

1. Use documented commands only.
2. If a command is missing or stale, say so explicitly in the report.
3. Do not substitute guessed commands from a preferred stack.
4. Prefer `.opencode/workflow-state.js` over manual JSON edits when an operation is supported.
5. Do not run destructive commands unless the user explicitly requests them.
