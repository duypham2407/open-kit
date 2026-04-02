# Project Configuration & Tooling Standards

This file defines the current execution reality for the repository. Agents must use documented commands when they exist and explicitly report when they do not.

For the canonical workflow contract, including lane semantics, stage order, escalation policy, approvals, and artifact expectations, use `context/core/workflow.md`.

## Current State

- There is no repo-native build command for generated application code yet.
- There is no repo-native lint command for generated application code yet.
- There is no repo-native test command for generated application code yet.
- OpenKit does have repo-native validation for its own runtime, CLI, install, and launch surfaces through `tests/` and `.opencode/tests/`.
- There is no single canonical package manager or language toolchain for future applications yet.
- OpenKit uses the mode-aware workflow documented in `context/core/workflow.md`; keep tooling and command guidance here aligned with that live contract instead of re-stating lane policy in full.
- The active compatibility mirror uses a mode-aware schema and `.opencode/workflow-state.js` supports that workflow model.
- The preferred operator install path is now global: `npm install -g @duypham93/openkit`, then `openkit run` and `openkit doctor`.
- The checked-in repository-local runtime still exists as the authoring and compatibility surface under `.opencode/`.
- The capability-runtime foundation now starts under `src/runtime/` and is additive over the existing workflow kernel.
- `registry.json` and `.opencode/install-manifest.json` are additive local metadata surfaces; they do not imply destructive install or plugin-only packaging.
- Repository-internal runtime surfaces still include workflow state, workflow-state CLI, hooks, agents, skills, commands, context, and maintained docs.
- Global-facing metadata surface is currently limited to documentation and metadata that explain the global install and compatibility contract.

## Commands That Do Exist

- Session hook configuration lives in `hooks/hooks.json`.
- The session-start hook script lives in `hooks/session-start`.
- The global OpenKit CLI entrypoint lives at `bin/openkit.js`.
- The runtime bootstrap entrypoint lives at `src/runtime/index.js`.
- Runtime config loading starts at `src/runtime/runtime-config-loader.js`.
- Runtime capability metadata starts at `src/runtime/capability-registry.js`.
- Runtime managers, tools, hooks, MCPs, categories, specialists, and model helpers now live under `src/runtime/` subdirectories.
- The repository-local OpenCode project config lives in `.opencode/opencode.json`.
- The global install writes its own profile manifest under the OpenCode home directory.
- The active compatibility mirror lives in `.opencode/workflow-state.json`.
- The managed work-item backing store lives in `.opencode/work-items/`.
- The workflow-state CLI lives at `.opencode/workflow-state.js`.
- Workflow command contracts live under `commands/`.
- Registry metadata lives in `registry.json`.
- Install metadata lives in `.opencode/install-manifest.json`.
- The repository does not contain a root `opencode.json` entrypoint.
- The project graph database lives at `<runtimeRoot>/.opencode/project-graph.db` (SQLite via better-sqlite3). It stores the import graph, symbol index, and file nodes for cross-file dependency analysis. It is created automatically by `ProjectGraphManager` on first use and is not created in read-only mode. The database uses WAL journal mode. The schema includes `nodes`, `edges`, and `symbols` tables. Run `openkit doctor` to check whether better-sqlite3 is available.

## Permission Policy

- The checked-in runtime manifest at `.opencode/opencode.json` now carries the default OpenKit permission policy.
- Non-destructive commands should run without asking for user confirmation.
- This includes commands and tools such as `read`, `glob`, `grep`, `list`, `skill`, `task`, `bash`, `npm`, `edit`, `write`, `todowrite`, `webfetch`, `websearch`, `codesearch`, `git log`, and `git diff`.
- Commands that delete repository state must still require explicit user confirmation before execution.
- This includes removals, directory deletion, and other clearly destructive delete-style commands.
- `rm` is explicitly `ask` by policy.
- Treat clearly destructive git operations as confirmation-required even when a specific git subcommand is not listed in the permission map.
- If OpenCode offers an `Always Allow` choice at permission prompt time, treat that persistence as an OpenCode-owned behavior. OpenKit does not currently add a separate permission-memory layer on top of OpenCode.

### Workflow-State Utility Commands

These are repository workflow commands, not application build/lint/test commands:

- `npm install -g @duypham93/openkit`
- `openkit install-global`
- `openkit doctor`
- `openkit run [args]`
- `openkit upgrade`
- `openkit uninstall [--remove-workspaces]`

- `node .opencode/workflow-state.js status`
- `node .opencode/workflow-state.js status --short`
- `node .opencode/workflow-state.js resume-summary`
- `node .opencode/workflow-state.js resume-summary --short`
- `node .opencode/workflow-state.js doctor`
- `node .opencode/workflow-state.js doctor --short`
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
- `node .opencode/workflow-state.js task-aging-report`
- `node .opencode/workflow-state.js workflow-analytics`
- `node .opencode/workflow-state.js ops-summary`
- `node .opencode/workflow-state.js create-release-candidate <release_id> <title>`
- `node .opencode/workflow-state.js list-release-candidates`
- `node .opencode/workflow-state.js show-release-candidate <release_id>`
- `node .opencode/workflow-state.js add-release-work-item <release_id> <work_item_id>`
- `node .opencode/workflow-state.js remove-release-work-item <release_id> <work_item_id>`
- `node .opencode/workflow-state.js set-release-status <release_id> <status>`
- `node .opencode/workflow-state.js set-release-approval <release_id> <gate> <status> [approved_by] [approved_at] [notes]`
- `node .opencode/workflow-state.js record-rollback-plan <release_id> <summary> <owner> <trigger_signals_csv>`
- `node .opencode/workflow-state.js draft-release-notes <release_id>`
- `node .opencode/workflow-state.js validate-release-notes <release_id>`
- `node .opencode/workflow-state.js check-release-gates <release_id>`
- `node .opencode/workflow-state.js release-dashboard`
- `node .opencode/workflow-state.js start-hotfix <release_id> <mode> <feature_id> <feature_slug> <reason>`
- `node .opencode/workflow-state.js validate-hotfix <work_item_id>`
- `node .opencode/workflow-state.js show-work-item <work_item_id>`
- `node .opencode/workflow-state.js closeout-summary <work_item_id>`
- `node .opencode/workflow-state.js release-readiness`
- `node .opencode/workflow-state.js show-dod`
- `node .opencode/workflow-state.js validate-dod`
- `node .opencode/workflow-state.js activate-work-item <work_item_id>`
- `node .opencode/workflow-state.js advance-stage <stage>`
- `node .opencode/workflow-state.js check-stage-readiness`
- `node .opencode/workflow-state.js set-approval <gate> <status> [approved_by] [approved_at] [notes]`
- `node .opencode/workflow-state.js set-routing-profile <work_intent> <behavior_delta> <dominant_uncertainty> <scope_shape> <selection_reason>`
- `node .opencode/workflow-state.js link-artifact <kind> <path>`
- `node .opencode/workflow-state.js scaffold-artifact <task_card|scope_package|solution_package|migration_report> <slug>`
- `node .opencode/workflow-state.js list-tasks <work_item_id>`
- `node .opencode/workflow-state.js create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]`
- `node .opencode/workflow-state.js validate-task-allocation <work_item_id>`
- `node .opencode/workflow-state.js integration-check <work_item_id>`
- `node .opencode/workflow-state.js workflow-metrics`
- `node .opencode/workflow-state.js approval-bottlenecks`
- `node .opencode/workflow-state.js qa-failure-summary`
- `node .opencode/workflow-state.js policy-trace`
- `node .opencode/workflow-state.js claim-task <work_item_id> <task_id> <owner> <requested_by>`
- `node .opencode/workflow-state.js release-task <work_item_id> <task_id> <requested_by>`
- `node .opencode/workflow-state.js reassign-task <work_item_id> <task_id> <owner> <requested_by>`
- `node .opencode/workflow-state.js assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>`
- `node .opencode/workflow-state.js set-task-status <work_item_id> <task_id> <status>`
- `node .opencode/workflow-state.js validate-work-item-board <work_item_id>`
- `node .opencode/workflow-state.js create-migration-slice <work_item_id> <slice_id> <title> <kind>`
- `node .opencode/workflow-state.js list-migration-slices <work_item_id>`
- `node .opencode/workflow-state.js claim-migration-slice <work_item_id> <slice_id> <owner> <requested_by>`
- `node .opencode/workflow-state.js assign-migration-qa-owner <work_item_id> <slice_id> <qa_owner> <requested_by>`
- `node .opencode/workflow-state.js set-migration-slice-status <work_item_id> <slice_id> <status>`
- `node .opencode/workflow-state.js validate-migration-slice-board <work_item_id>`
- `node .opencode/workflow-state.js record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>`
- `node .opencode/workflow-state.js update-issue-status <issue_id> <status>`
- `node .opencode/workflow-state.js list-stale-issues`
- `node .opencode/workflow-state.js issue-aging-report`
- `node .opencode/workflow-state.js record-verification-evidence <id> <kind> <scope> <summary> <source> [command] [exit_status] [artifact_refs]`
- `node .opencode/workflow-state.js clear-verification-evidence`
- `node .opencode/workflow-state.js clear-issues`
- `node .opencode/workflow-state.js route-rework <issue_type> [repeat_failed_fix]`

Current workflow-state behavior:

- The CLI understands the current mode-aware workflow model.
- `npm install -g @duypham93/openkit` installs the OpenKit CLI globally.
- `openkit run` materializes the globally managed kit into the OpenCode home directory on first use when needed.
- `openkit doctor` checks the global install and the current workspace bootstrap.
- `openkit install-global` remains available as a manual or compatibility setup path.
- The global OpenKit install now provisions `ast-grep` into the managed tooling path and doctor verifies that tooling path is available.
- `openkit run` launches OpenCode with the OpenKit-managed config directory and workspace-specific environment.
- `openkit run` now also injects runtime foundation metadata through environment variables for capability bootstrap.
- `openkit upgrade` refreshes the global managed kit bundle in place.
- `openkit uninstall` removes the global managed kit and profile, with optional workspace cleanup.
- `status`, `resume-summary`, `doctor`, `version`, `profiles`, `show-profile`, and `sync-install-manifest` are part of the current runtime inspection surface.
- `status --short`, `resume-summary --short`, and `doctor --short` provide compact runtime views for fast operational decisions.
- `start-feature` remains available as a compatibility shortcut and initializes `Full Delivery` mode.
- `start-task` is the preferred explicit entrypoint for new mode-aware state.
- `create-work-item`, `list-work-items`, `show-work-item`, and `activate-work-item` are the live work-item coordination commands.
- `list-tasks`, `create-task`, `claim-task`, `release-task`, `reassign-task`, `assign-qa-owner`, `set-task-status`, and `validate-work-item-board` are the live full-delivery task-board commands.
- `validate-task-allocation` and `integration-check` are the bounded full-delivery parallel-safety helpers for implementation and QA coordination.
- `scaffold-artifact` is a narrow helper for creating and linking `task_card`, `scope_package`, `solution_package`, and `migration_report` artifacts from checked-in templates.
- `set-routing-profile` updates the explicit routing metadata used to justify and validate lane selection.
- `task_card` scaffolding requires `quick` mode and is intentionally allowed as optional traceability in the quick lane.
- `scope_package` scaffolding requires `full` mode at `full_product`.
- `solution_package` scaffolding requires `full` mode at `full_solution` or `migration` mode at `migration_strategy`.
- `migration_report` scaffolding requires `migration` mode at `migration_baseline` or `migration_strategy` and is intended for one-file migration tracking.
- `advance-stage` auto-scaffolds missing primary artifacts when entering `full_product`, `full_solution`, or `migration_strategy`.
- `doctor` now checks active-work-item pointer integrity, compatibility-mirror alignment, and task-board validity when the active full-delivery stage depends on a task board.
- `check-stage-readiness` and `workflow-metrics` expose whether the current stage is blocked by missing artifacts, missing evidence, unresolved issues, or task-board prerequisites.
- `status`, `status --short`, and `resume-summary` surface the most recent runtime auto-scaffold event when stage entry created a primary scope or solution package.
- `show-dod`, `validate-dod`, and `release-readiness` expose closure criteria and ship-readiness criteria as explicit runtime surfaces.
- `workflow-analytics` and `ops-summary` compress multi-work-item and daily operator insights into inspectable reports.
- release candidate commands add release-level governance over multiple work items, release notes, approvals, rollback planning, and hotfix linkage.
- `record-verification-evidence` and `clear-verification-evidence` keep verification claims inspectable and machine-readable.
- `update-issue-status`, `list-stale-issues`, and `issue-aging-report` support issue lifecycle tracking instead of one-shot issue snapshots.
- Task-board support is bounded: only full-delivery work items may use it, and it does not imply unrestricted parallel safety outside the validated command surface.
- Migration remains sequential by default; migration slice execution, when enabled, is strategy-driven and parity-oriented rather than a copy of the full-delivery task board.
- Runtime foundation phase 1 currently exposes config, capability, manager, tool, and hook metadata rather than a full MCP or background execution layer.
- The checked-in runtime now also includes thin foundation implementations for background execution, MCP loading, categories, specialists, skills, commands, context injection, and recovery. These surfaces are intentionally lightweight but real and testable.
- Runtime config now supports category and specialist overrides for `model`, `fallback_models`, prompt append data, related model-shaping fields, automatic fallback policy, and dual quick-switch profiles through `.opencode/openkit.runtime.jsonc`.
- `file://` prompt references are supported in runtime config for agent `prompt`, agent `prompt_append`, and category `prompt_append` values.
- Runtime doctor now exposes model-resolution trace data so maintainers can inspect where a resolved model came from and which fallback entries are available.

## Global Kit Contract

- The preferred product surface is now the globally installed OpenKit kit inside the OpenCode home directory.
- Repository-internal runtime surfaces remain `.opencode/opencode.json`, workflow-state files, the workflow-state CLI, hooks, agents, skills, commands, context, and maintained docs.
- `registry.json` documents available components and metadata for the global-kit compatibility direction.
- `.opencode/install-manifest.json` records which local profile is active and keeps install semantics explicit and non-destructive.
- Global install writes its own managed kit bundle, profile manifest, and workspace state under the OpenCode home directory.
- The checked-in repository runtime remains important for authoring, tests, and compatibility, not as the preferred end-user install shape.

## Validation Reality By Mode

Validation split to keep explicit:

- OpenKit runtime and CLI validation: yes, through runtime checks and automated tests in this repository
- target-project app validation: only when the target project actually defines the relevant commands

### Quick Task

- Use the closest real verification path available.
- If no test framework exists, manual verification is acceptable when reported clearly.
- Do not invent commands that the repository has not adopted.
- Record Quick Agent verification evidence before `quick_done`; approval alone is not enough.

### Full Delivery

- Prefer the strongest real validation path available.
- If no test or build tooling exists, explicitly record that the validation path is unavailable.
- Do not claim TDD or automated QA evidence unless the supporting commands actually exist.
- Before `full_done`, keep verification evidence and unresolved issue state inspectable in workflow state.

### Migration

- Prefer baseline capture, preserved-invariant tracking, compatibility evidence, build/test/typecheck results, codemod evidence, smoke checks, and targeted regression checks over default TDD-first execution.
- Refactor only to create seams, adapters, or compatibility boundaries that make the migration safer; do not treat migration as an excuse for a rewrite.
- If suitable test tooling exists, add focused tests only where they clarify behavior during the migration; do not force greenfield TDD semantics onto broad upgrades by default.
- If no repo-native validation commands exist, state the missing validation path and record manual before/after evidence honestly.
- Before `migration_done`, keep parity or compatibility evidence inspectable in workflow state.
- If a migration slice board is in use, keep it aligned with stage readiness: unresolved or active slices block `migration_code_review`, and slices must be `verified` or `cancelled` before `migration_done`.

## Future Update Rule

When this repository adopts a real application stack, update both this file and `AGENTS.md` with the exact commands before expecting agents to run them.

When the workflow-state CLI gains new mode-aware capabilities, update this file at the same time so the documented command behavior matches reality.

## Execution Rules For Agents

1. Use documented commands only.
2. If a command is missing or stale, say so explicitly in the report.
3. Do not substitute guessed commands from a preferred stack.
4. Prefer `.opencode/workflow-state.js` over manual JSON edits when an operation is supported.
5. Do not run destructive commands unless the user explicitly requests them.
