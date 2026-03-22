# Operations

This directory is the routing index for operational support docs.

Use it to decide whether you need an executable runbook, an internal record, operator-facing routing, or lower-level runtime command details.

This is an index layer for operations support, not a replacement for canonical workflow docs or audience routing.

The current operations surface includes the checked-in registry and install-manifest metadata layer. Treat that layer as local repository observability, not as a remote package-management system.

## Directory Routes

- `runbooks/README.md`: executable operator guidance and repeatable maintenance procedures
- `internal-records/README.md`: durable project memory and lightweight record-keeping guidance
- `docs/operator/README.md`: audience-facing operator routing before deeper operational detail
- `docs/maintainer/README.md`: audience-facing maintainer routing before lower-level runtime detail

## Key Docs

- `runbooks/workflow-state-smoke-tests.md`: smoke checks for both the wrapper path and the workflow-state/session-start internals
- `internal-records/README.md`: policy for when to keep a sparse durable operational record in-tree

## Primary Operator Path

If wrapper-owned files actually exist in the worktree, use the managed wrapper path first. Otherwise, the checked-in repository/runtime path is the concrete surface in this repository.

When a wrapper install exists, start with:

- `openkit init` for plain repositories
- `openkit install` for repositories that already have `.opencode/opencode.json`
- `openkit doctor` for wrapper readiness, drift, and missing-prerequisite checks
- `openkit run <args>` for the supported managed launcher path

When the wrapper layer is not installed, use the checked-in runtime directly through `node .opencode/workflow-state.js ...` and the canonical docs under `context/core/`.

## Lower-Level Runtime Command Surface

Current repository/runtime command surface under the wrapper:

- inspection and diagnostics: `show`, `status`, `doctor`, `version`, `profiles`, `show-profile <name>`, `validate`
- install-manifest metadata: `sync-install-manifest <name>`
- compatibility entrypoints: `start-feature <feature_id> <feature_slug>` and `start-task <mode> <feature_id> <feature_slug> <mode_reason>`
- work-item management: `create-work-item <mode> <feature_id> <feature_slug> <mode_reason>`, `list-work-items`, `show-work-item <work_item_id>`, `activate-work-item <work_item_id>`
- feature-state mutation: `advance-stage <stage>`, `set-approval <gate> <status> [approved_by] [approved_at] [notes]`, `link-artifact <kind> <path>`, `scaffold-artifact <task_card|plan> <slug>`
- task-board management: `list-tasks <work_item_id>`, `create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]`, `claim-task <work_item_id> <task_id> <owner> <requested_by>`, `release-task <work_item_id> <task_id> <requested_by>`, `reassign-task <work_item_id> <task_id> <owner> <requested_by>`, `assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>`, `set-task-status <work_item_id> <task_id> <status>`, `validate-work-item-board <work_item_id>`
- issue routing: `record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>`, `clear-issues`, `route-rework <issue_type> [repeat_failed_fix=true|false]`

## Wrapper Vs. Runtime Checks

Keep this distinction explicit:

- `openkit doctor` checks the supported wrapper installation path.
- `node .opencode/workflow-state.js doctor` checks the underlying repository/runtime state.
- Both are useful, but they answer different questions and should not be described as interchangeable.

## Route By Need

- audience-specific operator routing: `docs/operator/README.md`
- workflow and command reality: `context/core/project-config.md`
- workflow semantics and resume rules: `context/core/workflow.md` and `context/core/session-resume.md`
- status, diagnostics, and repeatable verification steps: `runbooks/workflow-state-smoke-tests.md`
- durable-record policy and any intentionally kept records: `internal-records/README.md`

## Index Guardrails

Current-state guardrails:

- These docs describe repository runtime support only. They do not imply application build, lint, or test tooling.
- Keep this file index-first; procedural verification belongs in `runbooks/` and durable project memory belongs in `internal-records/`.
- Keep wrapper language aligned with the current repository reality: wrapper-first only when wrapper-owned files actually exist.
- Keep lower-level command details concise here and route canonical command behavior to `context/core/project-config.md`.
