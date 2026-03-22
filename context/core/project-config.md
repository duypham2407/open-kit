# Project Configuration & Tooling Standards

This file defines the current execution reality for the repository. Agents must use documented commands when they exist and explicitly report when they do not.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and artifact expectations, use `context/core/workflow.md`.

## Current State

- There is no repo-native build command for generated application code yet.
- There is no repo-native lint command for generated application code yet.
- There is no repo-native test command for generated application code yet.
- There is no single canonical package manager or language toolchain for future applications yet.
- OpenKit uses the hard-split workflow documented in `context/core/workflow.md`; keep tooling and command guidance here aligned with that live contract instead of re-stating lane policy in full.
- The active compatibility mirror uses a mode-aware schema and `.opencode/workflow-state.js` supports that hard-split workflow model.
- The repository-local runtime still uses `.opencode/opencode.json` as its live manifest.
- A future root `opencode.json` is an intended managed-wrapper entrypoint, but that migration is not complete in the checked-in repository state.
- `registry.json` and `.opencode/install-manifest.json` are additive local metadata surfaces; they do not imply destructive install or plugin-only packaging.
- Repository-internal runtime surfaces still include workflow state, workflow-state CLI, hooks, agents, skills, commands, context, and maintained docs.
- Wrapper-facing surface is currently limited to metadata and documentation that explain the staged migration contract.

## Commands That Do Exist

- Session hook configuration lives in `hooks/hooks.json`.
- The session-start hook script lives in `hooks/session-start`.
- The OpenCode kit manifest lives in `.opencode/opencode.json`.
- The root `opencode.json` wrapper entrypoint is planned direction only until a real file is added.
- The active compatibility mirror lives in `.opencode/workflow-state.json`.
- The managed work-item backing store lives in `.opencode/work-items/`.
- The workflow-state CLI lives at `.opencode/workflow-state.js`.
- Workflow command contracts live under `commands/`.
- Registry metadata lives in `registry.json`.
- Install metadata lives in `.opencode/install-manifest.json`.
- The repository does not yet contain a root `opencode.json` wrapper entrypoint.

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
- `node .opencode/workflow-state.js create-work-item <mode> <feature_id> <feature_slug> <mode_reason>`
- `node .opencode/workflow-state.js list-work-items`
- `node .opencode/workflow-state.js show-work-item <work_item_id>`
- `node .opencode/workflow-state.js activate-work-item <work_item_id>`
- `node .opencode/workflow-state.js advance-stage <stage>`
- `node .opencode/workflow-state.js set-approval <gate> <status> [approved_by] [approved_at] [notes]`
- `node .opencode/workflow-state.js link-artifact <kind> <path>`
- `node .opencode/workflow-state.js scaffold-artifact <task_card|plan> <slug>`
- `node .opencode/workflow-state.js list-tasks <work_item_id>`
- `node .opencode/workflow-state.js create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]`
- `node .opencode/workflow-state.js claim-task <work_item_id> <task_id> <owner> <requested_by>`
- `node .opencode/workflow-state.js release-task <work_item_id> <task_id> <requested_by>`
- `node .opencode/workflow-state.js reassign-task <work_item_id> <task_id> <owner> <requested_by>`
- `node .opencode/workflow-state.js assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>`
- `node .opencode/workflow-state.js set-task-status <work_item_id> <task_id> <status>`
- `node .opencode/workflow-state.js validate-work-item-board <work_item_id>`
- `node .opencode/workflow-state.js record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>`
- `node .opencode/workflow-state.js clear-issues`
- `node .opencode/workflow-state.js route-rework <issue_type> [repeat_failed_fix]`

Current workflow-state behavior:

- The CLI understands the hard-split workflow model.
- `status`, `doctor`, `version`, `profiles`, `show-profile`, and `sync-install-manifest` are part of the current runtime inspection surface.
- `start-feature` remains available as a compatibility shortcut and initializes `Full Delivery` mode.
- `start-task` is the preferred explicit entrypoint for new mode-aware state.
- `create-work-item`, `list-work-items`, `show-work-item`, and `activate-work-item` are the live work-item coordination commands.
- `list-tasks`, `create-task`, `claim-task`, `release-task`, `reassign-task`, `assign-qa-owner`, `set-task-status`, and `validate-work-item-board` are the live full-delivery task-board commands.
- `scaffold-artifact` is a narrow helper for creating and linking `task_card` and `plan` artifacts from checked-in templates.
- `task_card` scaffolding requires `quick` mode and is intentionally allowed as optional traceability in the quick lane.
- `plan` scaffolding requires `full` mode, `full_plan`, and a linked architecture artifact.
- `doctor` now checks active-work-item pointer integrity, compatibility-mirror alignment, and task-board validity when the active full-delivery stage depends on a task board.
- Task-board support is bounded: only full-delivery work items may use it, and it does not imply unrestricted parallel safety outside the validated command surface.

## Managed Wrapper Contract

- The current product surface is still repository-local and checked in.
- The managed wrapper is an emerging layer over that surface, not a replacement that has already landed.
- Repository-internal runtime surfaces remain `.opencode/opencode.json`, workflow-state files, the workflow-state CLI, hooks, agents, skills, commands, context, and maintained docs.
- `registry.json` documents available components and migration-facing metadata for the wrapper direction.
- `.opencode/install-manifest.json` records which local profile is active and keeps install semantics explicit and non-destructive.
- Wrapper-facing surface is presently metadata-first; it does not yet provide a separate checked-in runtime bootstrap file.
- Until a root `opencode.json` exists, agents should treat references to that file as roadmap language only.

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
