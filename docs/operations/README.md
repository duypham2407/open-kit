# Operations

This directory is the routing index for operational support docs.

Use it to decide whether you need an executable runbook, an internal record, operator-facing routing, or lower-level runtime command details.

This is an index layer for operations support, not a replacement for canonical workflow docs or audience routing.

The current operations surface includes both the global OpenKit install path and the checked-in registry/install-manifest metadata used by this repository as an authoring and compatibility surface.

## Directory Routes

- `runbooks/README.md`: executable operator guidance and repeatable maintenance procedures
- `internal-records/README.md`: durable project memory and lightweight record-keeping guidance
- `docs/operator/README.md`: audience-facing operator routing before deeper operational detail
- `docs/maintainer/README.md`: audience-facing maintainer routing before lower-level runtime detail

## Key Docs

- `runbooks/openkit-daily-usage.md`: detailed day-to-day usage guidance for the global install path plus the checked-in compatibility runtime
- `runbooks/workflow-state-smoke-tests.md`: smoke checks for both the global install path and the workflow-state/session-start internals
- `runbooks/release-workflow-smoke-tests.md`: smoke checks for release candidates, release notes, rollback planning, and hotfix linkage
- `../maintainer/test-matrix.md`: fastest map from changed OpenKit surface to the right automated tests
- `internal-records/README.md`: policy for when to keep a sparse durable operational record in-tree

## Primary Operator Path

Prefer the global install path first for everyday use. Use the checked-in repository/runtime path when maintaining or validating the authoring source in this repository.

When OpenKit is installed globally, start with:

- `npm install -g @duypham93/openkit`
- `openkit run`
- `openkit doctor` for global install readiness, drift, and missing-prerequisite checks
- `openkit run <args>` for the supported global launcher path and first-time setup
- `openkit upgrade` to refresh the global kit bundle
- `openkit uninstall [--remove-workspaces]` to remove the global kit and optionally clear workspace state

When the global layer is not installed or when you are maintaining the checked-in runtime itself, use the compatibility surface directly through `node .opencode/workflow-state.js ...` and the canonical docs under `context/core/`.

## Lower-Level Runtime Command Surface

Current repository/runtime command surface under the checked-in compatibility runtime:

- inspection and diagnostics: `show`, `status`, `doctor`, `version`, `profiles`, `show-profile <name>`, `validate`
- resume support: `resume-summary`
- install-manifest metadata: `sync-install-manifest <name>`
- compatibility entrypoints: `start-feature <feature_id> <feature_slug>` and `start-task <mode> <feature_id> <feature_slug> <mode_reason>`
- work-item management: `create-work-item <mode> <feature_id> <feature_slug> <mode_reason>`, `list-work-items`, `show-work-item <work_item_id>`, `activate-work-item <work_item_id>`
- feature-state mutation: `advance-stage <stage>`, `set-approval <gate> <status> [approved_by] [approved_at] [notes]`, `link-artifact <kind> <path>`, `scaffold-artifact <task_card|plan|migration_report> <slug>`
- task-board management: `list-tasks <work_item_id>`, `create-task <work_item_id> <task_id> <title> <kind> [branch] [worktree_path]`, `claim-task <work_item_id> <task_id> <owner> <requested_by>`, `release-task <work_item_id> <task_id> <requested_by>`, `reassign-task <work_item_id> <task_id> <owner> <requested_by>`, `assign-qa-owner <work_item_id> <task_id> <qa_owner> <requested_by>`, `set-task-status <work_item_id> <task_id> <status>`, `validate-work-item-board <work_item_id>`
- issue routing: `record-issue <issue_id> <title> <type> <severity> <rooted_in> <recommended_owner> <evidence> <artifact_refs>`, `clear-issues`, `route-rework <issue_type> [repeat_failed_fix=true|false]`

Task-board guardrail:

- task-board commands remain full-delivery only; quick and migration work items stay task-board free in the current runtime

## Global Install Vs. Runtime Checks

Keep this distinction explicit:

- `openkit doctor` checks the supported global installation path.
- `node .opencode/workflow-state.js doctor` checks the underlying repository/runtime state.
- Both are useful, but they answer different questions and should not be described as interchangeable.

## Route By Need

- audience-specific operator routing: `docs/operator/README.md`
- workflow and command reality: `context/core/project-config.md`
- workflow semantics and resume rules: `context/core/workflow.md` and `context/core/session-resume.md`
- daily operator path and command usage: `runbooks/openkit-daily-usage.md`
- status, diagnostics, and repeatable verification steps: `runbooks/workflow-state-smoke-tests.md`
- durable-record policy and any intentionally kept records: `internal-records/README.md`

## Index Guardrails

Current-state guardrails:

- These docs describe repository runtime support only. They do not imply application build, lint, or test tooling.
- Keep this file index-first; procedural verification belongs in `runbooks/` and durable project memory belongs in `internal-records/`.
- Keep global-kit language aligned with the current repository reality: global install is the preferred user path, while the checked-in runtime remains the maintainer and compatibility surface.
- Keep lower-level command details concise here and route canonical command behavior to `context/core/project-config.md`.
