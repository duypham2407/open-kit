# Operations

This directory defines lightweight operational guidance for execution logs, decision logs, review history, wrapper verification, and lower-level runtime inspection.

Use these docs when you need to support OpenKit as an operating kit instead of only reading the workflow contract. For normal setup and launch, treat the managed wrapper path as primary. Use the raw repository/runtime commands here when you need maintainer-level detail.

The current operations surface includes the checked-in registry and install-manifest metadata layer. Treat that layer as local repository observability, not as a remote package-management system.

Operational references in this directory:

- `workflow-state-smoke-tests.md`: smoke checks for both the wrapper path and the workflow-state/session-start internals
- `execution-log.md`: how to record meaningful execution events for longer-running work
- `decision-log.md`: how to capture durable non-ADR decisions
- `review-history.md`: how to record review outcomes that change direction or require follow-up
- `reference-absorption-notes.md`: OpenKit-native capture of the last high-value ideas preserved from upstream reference repos

## Primary Operator Path

Use the managed wrapper commands first:

- `openkit init` for plain repositories
- `openkit install` for repositories that already have `.opencode/opencode.json`
- `openkit doctor` for wrapper readiness, drift, and missing-prerequisite checks
- `openkit run <args>` for the supported managed launcher path

Use `node .opencode/workflow-state.js ...` only when you intentionally need the lower-level repository/runtime internals that sit under the wrapper.

Current repository/runtime command surface under the wrapper:

- inspection and diagnostics: `show`, `status`, `doctor`, `version`, `profiles`, `show-profile <name>`, `validate`
- install-manifest metadata: `sync-install-manifest <name>`
- compatibility entrypoints: `start-feature <feature_id> <feature_slug>` and `start-task <mode> <feature_id> <feature_slug> <mode_reason>`
- work-item management: `create-work-item <mode> <feature_id> <feature_slug> <mode_reason>`, `list-work-items`, `show-work-item <work_item_id>`, `activate-work-item <work_item_id>`
- feature-state mutation: `advance-stage <stage>`, `set-approval <gate> <status> [approved_by] [approved_at] [notes]`, `link-artifact <kind> <path>`, `scaffold-artifact <task_card|plan> <slug>`
- task-board management: `list-tasks <work_item_id>`, `create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]`, `claim-task <work_item_id> <task_id> <owner> <requested_by>`, `release-task <work_item_id> <task_id> <requested_by>`, `reassign-task <work_item_id> <task_id> <owner> <requested_by>`, `assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>`, `set-task-status <work_item_id> <task_id> <status>`, `validate-work-item-board <work_item_id>`
- issue routing: `record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>`, `clear-issues`, `route-rework <issue_type> [repeat_failed_fix=true|false]`

Operational notes for that lower-level surface:

- `status` prints the current runtime summary for the checked-in state file or a supplied `--state` path.
- `doctor` checks whether the expected runtime files are present, readable, and still aligned with the checked-in workflow contract; it also checks active-work-item pointer resolution, compatibility-mirror alignment, and task-board validity when applicable.
- `validate` checks mirrored state-shape validity but does not replace the broader diagnostics from `doctor`.
- `start-feature` remains a compatibility shortcut into full-delivery state; `start-task` is the explicit mode-aware entrypoint.
- task-board commands are bounded coordination commands for the implemented full-delivery task runtime only.

Wrapper-vs-internals note:

- `openkit doctor` checks the supported wrapper installation path.
- `node .opencode/workflow-state.js doctor` checks the underlying repository/runtime state.
- Both are useful, but they answer different questions and should not be described as interchangeable.

## Operator Checklist

### 1. Inspect current runtime status

Run:

```bash
node .opencode/workflow-state.js status
```

Check:

- active profile
- registry and install-manifest paths
- current mode, stage, and owner
- active work item id and task-board summary when present

### 2. Run doctor before trusting the runtime

Run:

```bash
node .opencode/workflow-state.js doctor
```

Check:

- runtime files are present and readable
- contract-consistency checks pass
- active mirror and work-item integrity checks pass
- summary ends with `0 error`

### 3. Inspect managed work items when full-delivery resume is task-aware

Run:

```bash
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item feature-001
```

Check:

- the active work item is marked with `*`
- the selected work item reports the expected mode, stage, and status

### 4. Inspect profiles before changing local metadata

Run:

```bash
node .opencode/workflow-state.js profiles
node .opencode/workflow-state.js show-profile openkit-core
```

Check:

- the default profile is marked with `*`
- the component categories match what you expect to inspect or restore

### 5. Sync the install manifest only when needed

Run:

```bash
node .opencode/workflow-state.js sync-install-manifest openkit-core
```

Use this only to realign local metadata with a checked-in profile name. It does not fetch or install anything.

### 6. Inspect or validate the full-delivery task board only when one exists

Run:

```bash
node .opencode/workflow-state.js list-tasks feature-001
node .opencode/workflow-state.js validate-work-item-board feature-001
```

Check:

- use these only for full-delivery work items
- a missing task board is a real runtime condition, not a docs bug, unless the current full-delivery stage requires one
- quick mode remains task-board free

### 7. Scaffold a narrow artifact draft only when workflow state allows it

Run one of:

```bash
node .opencode/workflow-state.js scaffold-artifact task_card copy-fix
node .opencode/workflow-state.js scaffold-artifact plan runtime-hardening
```

Check:

- `task_card` only runs in `quick` mode
- `plan` only runs in `full` mode at `full_plan` with a linked architecture artifact
- the command links a repo-relative path into workflow state

Session-start behavior:

- `hooks/session-start` prints a runtime status block at session start so a maintainer can see the kit name, version, entry agent, state file, and help commands quickly.
- When resumable workflow context exists, the same hook prints a mode-aware resume hint that points maintainers back to `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, `.opencode/workflow-state.json`, and `context/core/session-resume.md`.
- For task-aware full-delivery work, the hook may also print the active work item id plus task-board summary so operators can see whether task-level coordination is already in progress.
- If the JSON helper used by the hook is unavailable, startup degrades gracefully: the runtime status block still prints, but manifest-derived details or resume hints may be reduced until the helper works again.

Current extension mechanics:

- The registry is the source of truth for what component categories and named profiles exist.
- The install manifest is the source of truth for which profile is currently recorded as installed in this repository.
- The active compatibility mirror is the operator-facing view of the active work item, while `.opencode/work-items/` is the managed per-item backing store.
- Adding a new agent, skill, command, or anchor doc is not operationally complete until the new surface is registered in `registry.json` and any relevant top-level manifest pointers stay accurate.
- Changing the install manifest alone does not create or remove files; it only updates the recorded local metadata.

Current-state guardrails:

- These docs describe repository runtime support only. They do not imply application build, lint, or test tooling.
- Keep examples and operational notes aligned with the live `Quick Task` + `Full Delivery` contract and the current `quick` / `full` workflow-state enums.
- Keep profile/install-manifest language aligned with the live CLI verbs: `profiles`, `show-profile`, and `sync-install-manifest`.
- Keep scaffold guidance aligned with the live CLI verb `scaffold-artifact` and its current narrow support for `task_card` and `plan` only.
- Keep task-runtime guidance aligned with the live CLI verbs for work-item and task-board management, and keep quick mode explicitly free of task boards.
