# Workflow-State Smoke Tests

Use this document to run lightweight verification for the global OpenKit install path and for the lower-level workflow-state utility and session-start resume hint that still sit underneath it.

## Safety First

Many commands in this document mutate project state. Do not run the manual examples against the checked-in repository state unless you intentionally want to change it.

Use one of these safer approaches before running any mutating command shown later in this document:

- work in a temporary throwaway repository when validating first-run `openkit run`, manual `openkit install-global`, or workspace bootstrap handling
- use a temporary state file or temporary project copy when validating `node .opencode/workflow-state.js` mutation commands
- if you must point at this repository, restore any changed files immediately after the check

High-risk mutating commands called out in this document include:

- `openkit run`
- `openkit install-global`
- `node .opencode/workflow-state.js sync-install-manifest <name>`
- `node .opencode/workflow-state.js start-task ...`
- `node .opencode/workflow-state.js advance-stage ...`
- `node .opencode/workflow-state.js route-rework ...`
- `node .opencode/workflow-state.js create-task ...`

Read this safety section before copying any command block below.

## Purpose

These checks validate OpenKit's supported wrapper operator path plus the workflow operating system behavior underneath it, without assuming any application build, lint, or test stack.

## Supported Path Order

When you are validating operator-facing behavior, treat this order as primary:

1. `npm install -g openkit`
2. `openkit run`
3. `openkit doctor`
4. `node .opencode/workflow-state.js ...` only when you need raw repository/runtime inspection

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

This verifies that the session-start hook emits a mode-aware `workflow_resume_hint` when state exists, plus the canonical startup command hints used for status inspection.

If the JSON helper used by `session-start` is unavailable, expect a degraded runtime-status block instead of a hard failure. In that case, resume hints may be suppressed until the helper works again.

### Contract-consistency tests

Run:

```bash
node --test ".opencode/tests/workflow-contract-consistency.test.js"
```

This covers:

- declared command and agent surfaces exist where the manifest says they do
- workflow contract and workflow-state schema files are present
- schema/runtime parity checks for mode enums, stage names, artifact slots, and approval keys
- `doctor` surfacing contract-consistency failures when those invariants drift

### Runtime CLI tests

Run:

```bash
node --test ".opencode/tests/workflow-state-cli.test.js"
```

This covers:

- `status` output for runtime summary fields
- `doctor` output for runtime diagnostics
- `profiles` output for checked-in profile listing
- `show-profile` output for profile detail inspection
- `sync-install-manifest` behavior for local manifest updates
- non-zero `doctor` exit behavior when required runtime files are missing
- quick-lane stage behavior such as `quick_plan` when live contract changes land in runtime tests
- work-item and task-board summaries in `status` and `doctor` output when full-delivery parallel state is active

### Wrapper CLI smoke tests

Run:

```bash
node --test tests/cli/openkit-cli.test.js
```

This covers:

- first-run `openkit run` on a fresh machine or temp OpenCode home
- `openkit doctor` after global install in a repository with an existing `.opencode/opencode.json`
- `openkit run` launching a mocked `opencode` through the managed layering path
- workspace bootstrap and global profile wiring

## Manual CLI Smoke Tests

Run the manual checks below only in a throwaway repo or temporary project copy unless the step explicitly says it is read-only.

### Global install and launch path

On a fresh machine or temporary OpenCode home:

```bash
npm install -g openkit
openkit run
openkit doctor
```

Expected outcome:

- the first `openkit run` materializes the kit under the OpenCode home directory automatically
- `openkit doctor` reports global kit and workspace readiness
- `openkit install-global` remains available when you want to force the manual setup path explicitly

In a repository that already has `.opencode/opencode.json`:

```bash
openkit doctor
openkit run --help
```

Expected outcome:

- `openkit doctor` reports workspace readiness without requiring the kit to be copied into the repository
- `openkit run` remains the supported launcher path over the raw runtime internals

### Workspace bootstrap reporting

Expected outcome after `openkit doctor` in a new repository:

- the command reports the workspace root under the OpenCode home directory
- the command reports the resolved project root
- the command reports the workspace id used for this repository

### Runtime summary and diagnostics

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

Expected outcome:

- `status` prints the active runtime summary using the current state file, including the active profile plus registry and install-manifest paths
- `doctor` reports repository runtime checks instead of application-tooling health
- `doctor` includes contract-consistency checks for declared runtime surfaces and schema alignment
- `doctor` also checks active work-item pointer resolution, compatibility-mirror alignment, and task-board validity when the active full-delivery stage depends on task-board state
- `doctor` exits successfully only when required OpenKit runtime files are present

### Managed work-item inspection

```bash
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item feature-001
```

Expected outcome:

- `list-work-items` prints `Active work item:` and marks the active item with `*`
- `show-work-item feature-001` prints `Work item: feature-001`
- `show-work-item feature-001` prints the work item's mode, stage, and status

### Profile inspection

```bash
node .opencode/workflow-state.js profiles
node .opencode/workflow-state.js show-profile openkit-core
```

Expected outcome:

- `profiles` starts with `OpenKit profiles:`
- the repository default profile is marked with `*`
- `show-profile openkit-core` prints `Profile: openkit-core`
- `show-profile openkit-core` prints `default: yes`
- `show-profile openkit-core` prints a comma-separated `components:` line using registry category names such as `agents`, `skills`, `commands`, `artifacts`, `runtime`, `hooks`, and `docs`

### Install-manifest sync

Work on a throwaway branch, temporary project copy, or restore the checked-in manifest immediately after this check. `sync-install-manifest` rewrites the install manifest for the project root implied by the current `--state` path. If `--state` still points at this repository, the checked-in `.opencode/install-manifest.json` is what will change.

```bash
node .opencode/workflow-state.js sync-install-manifest runtime-docs-surface
node .opencode/workflow-state.js status
```

Expected outcome:

- `sync-install-manifest runtime-docs-surface` prints `Updated install manifest profile to 'runtime-docs-surface'`
- the next `status` output shows `active profile: runtime-docs-surface`
- `.opencode/install-manifest.json` records `installation.activeProfile = runtime-docs-surface`
- no agent, skill, command, or doc files are created or removed by this command; only local metadata changes

To restore the repository-default manifest after the check:

```bash
node .opencode/workflow-state.js sync-install-manifest openkit-core
```

Expected outcome:

- the command prints `Updated install manifest profile to 'openkit-core'`
- `.opencode/install-manifest.json` returns to `installation.activeProfile = openkit-core`

### Quick Task happy path

```bash
node .opencode/workflow-state.js start-task quick TASK-900 copy-fix "Scoped text change"
node .opencode/workflow-state.js advance-stage quick_plan
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

### Full-delivery task-board inspection

```bash
node .opencode/workflow-state.js start-task full FEATURE-910 board-check "Board setup"
node .opencode/workflow-state.js create-task feature-910 TASK-910-A "Implement diagnostics" implementation
node .opencode/workflow-state.js list-tasks feature-910
node .opencode/workflow-state.js validate-work-item-board feature-910
```

Expected outcome:

- `create-task` initializes the task board for the new full-delivery work item
- `list-tasks feature-910` prints `Tasks for feature-910:` followed by task rows
- `validate-work-item-board feature-910` prints `Task board is valid for work item 'feature-910'`

## Notes

- Keep wrapper smoke coverage and the wrapper walkthrough example aligned with the actual `openkit` CLI behavior.
- Keep `openkit doctor` guidance separate from `node .opencode/workflow-state.js doctor`; they validate different layers.
- Prefer using a temporary state file when running manual smoke tests so the checked-in `.opencode/workflow-state.json` remains stable.
- For task-aware smoke tests, prefer a temporary project copy rooted around `.opencode/workflow-state.json` so the compatibility mirror, work-item store, and install manifest can be exercised together.
- Be deliberate when running `sync-install-manifest` because it updates the install manifest associated with the resolved project root, not the `--state` file itself. If that root is this repository, the checked-in `.opencode/install-manifest.json` will change.
- If workflow rules change, update this file alongside the tests and the workflow-state CLI docs.
- If session-start output changes, update this file, `README.md`, and any example docs that describe bootstrap behavior in the same change.
- If registry categories, profile names, or manifest semantics change, update this file together with `README.md`, `docs/operations/README.md`, and the relevant governance notes.
- Prefer behavior-oriented checks over purely structural checks whenever a workflow contract can be observed from CLI output, resume hints, or lane transitions.
