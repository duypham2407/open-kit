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

1. `npm install -g @duypham93/openkit`
2. `openkit doctor`
3. `openkit run`
4. `openkit upgrade` or `openkit uninstall` for lifecycle maintenance
5. `node .opencode/workflow-state.js ...` only when you need raw repository/runtime inspection

`openkit install` and `openkit install-global` remain manual/compatibility paths. Do not use them as the preferred operator onboarding sequence in new docs.

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
- `resume-summary` output for resumable workflow snapshots
- compact `--short` runtime views for fast operator and maintainer inspection
- workflow telemetry, stage-readiness checks, and issue lifecycle inspection
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
npm install -g @duypham93/openkit
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
node .opencode/workflow-state.js status --short
node .opencode/workflow-state.js resume-summary
node .opencode/workflow-state.js resume-summary --short
node .opencode/workflow-state.js doctor
node .opencode/workflow-state.js doctor --short
```

Expected outcome:

- `status` prints the active runtime summary using the current state file, including the active profile plus registry and install-manifest paths
- `resume-summary` prints the next safe action, linked artifacts, pending approvals, and open issues for quick operator or maintainer resume
- `resume-summary --json` exposes the same resumable context for automation-friendly consumers, including `validation_surfaces`, diagnostic surface labels, verification readiness, evidence lines, and issue telemetry
- short views trade detail for speed while staying grounded in the same runtime state
- `doctor` reports repository runtime checks instead of application-tooling health
- `doctor` includes contract-consistency checks for declared runtime surfaces and schema alignment
- `doctor` also checks active work-item pointer resolution, compatibility-mirror alignment, and task-board validity when the active full-delivery stage depends on task-board state
- `doctor` exits successfully only when required OpenKit runtime files are present

### Managed work-item inspection

```bash
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js task-aging-report
node .opencode/workflow-state.js show-work-item feature-001
node .opencode/workflow-state.js workflow-metrics
node .opencode/workflow-state.js approval-bottlenecks
node .opencode/workflow-state.js issue-aging-report
```

Expected outcome:

- `list-work-items` prints `Active work item:` and marks the active item with `*`
- `task-aging-report` shows which tracked work items still carry stale execution tasks
- `show-work-item feature-001` prints `Work item: feature-001`
- `show-work-item feature-001` prints the work item's mode, stage, and status
- `workflow-metrics` reports retry count, issue telemetry, and readiness blockers
- `approval-bottlenecks` reports pending gates that still block forward movement
- `issue-aging-report` reports open, repeated, and stale issue signals

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
node .opencode/workflow-state.js advance-stage quick_brainstorm
node .opencode/workflow-state.js advance-stage quick_plan
node .opencode/workflow-state.js advance-stage quick_implement
node .opencode/workflow-state.js advance-stage quick_test
node .opencode/workflow-state.js record-verification-evidence quick-agent manual quick_test "Quick Agent verification pass" quick-agent
node .opencode/workflow-state.js set-approval quick_verified approved QuickAgent 2026-03-31 "Quick Agent verified"
node .opencode/workflow-state.js advance-stage quick_done
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = quick`
- `current_stage = quick_done`
- `status = done`
- `advance-stage quick_done` should fail if the verification evidence step is skipped

### Quick Task escalation path

```bash
node .opencode/workflow-state.js start-task quick TASK-901 needs-spec "Initially looked small"
node .opencode/workflow-state.js route-rework design_flaw
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = quick`
- `current_stage = quick_test`
- `current_owner = QuickAgent`
- Quick Agent reports the design gap to the user and waits for an explicit decision (continue quick or switch to /delivery)

To test forced escalation after repeated failures:

```bash
node .opencode/workflow-state.js start-task quick TASK-902 repeat-fail "Repeated failure test"
node .opencode/workflow-state.js route-rework bug true
node .opencode/workflow-state.js route-rework bug true
node .opencode/workflow-state.js route-rework bug true
node .opencode/workflow-state.js show
```

Expected outcome after crossing `ESCALATION_RETRY_THRESHOLD`:

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

### Migration happy path

```bash
node .opencode/workflow-state.js start-task migration MIGRATE-900 upgrade-react "React 17 to 18 upgrade" --lane-source user_explicit
node .opencode/workflow-state.js advance-stage migration_baseline
node .opencode/workflow-state.js set-migration-context --baseline-summary "React 17.0.2; all 342 tests passing" --target-outcome "React 18 with concurrent features"
node .opencode/workflow-state.js append-preserved-invariant "Component render outputs must be identical"
node .opencode/workflow-state.js append-baseline-evidence "docs/baseline/react17-tests.txt"
node .opencode/workflow-state.js append-compatibility-hotspot "ReactDOM.render -> createRoot in src/index.js"
node .opencode/workflow-state.js show-migration-context
node .opencode/workflow-state.js set-approval baseline_to_strategy approved MasterOrchestrator 2026-03-31 "Baseline captured"
node .opencode/workflow-state.js advance-stage migration_strategy
node .opencode/workflow-state.js append-rollback-checkpoint "Git tag react17-baseline"
node .opencode/workflow-state.js set-approval strategy_to_upgrade approved FullstackAgent 2026-03-31 "Strategy solid"
node .opencode/workflow-state.js advance-stage migration_upgrade
node .opencode/workflow-state.js create-migration-slice migrate-900 SLICE-001 "Migrate ReactDOM.render" upgrade
node .opencode/workflow-state.js claim-migration-slice migrate-900 SLICE-001 FullstackAgent MasterOrchestrator
node .opencode/workflow-state.js set-migration-slice-status migrate-900 SLICE-001 in_progress
node .opencode/workflow-state.js assign-migration-qa-owner migrate-900 SLICE-001 QAAgent MasterOrchestrator
node .opencode/workflow-state.js set-migration-slice-status migrate-900 SLICE-001 parity_ready
node .opencode/workflow-state.js set-migration-slice-status migrate-900 SLICE-001 verified
node .opencode/workflow-state.js set-approval upgrade_to_code_review approved CodeReviewer 2026-03-31 "Ready for review"
node .opencode/workflow-state.js advance-stage migration_code_review
node .opencode/workflow-state.js record-verification-evidence review-001 review migration_code_review "Parity review complete" CodeReviewer
node .opencode/workflow-state.js set-approval code_review_to_verify approved QAAgent 2026-03-31 "Findings resolved"
node .opencode/workflow-state.js advance-stage migration_verify
node .opencode/workflow-state.js record-verification-evidence runtime-001 runtime migration_verify "App starts on React 18" QAAgent
node .opencode/workflow-state.js record-verification-evidence auto-001 automated migration_verify "342 tests passing" QAAgent "npm test" 0
node .opencode/workflow-state.js record-verification-evidence manual-001 manual migration_verify "Parity checklist complete" QAAgent
node .opencode/workflow-state.js set-approval migration_verified approved QAAgent 2026-03-31 "Parity confirmed"
node .opencode/workflow-state.js advance-stage migration_done
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = migration`
- `lane_source = user_explicit`
- `current_stage = migration_done`
- `status = done`
- `migration_context.baseline_summary` is set
- `migration_context.preserved_invariants` has at least one entry
- `show-migration-context` prints the full migration_context as JSON

### Migration requirement gap with lane-lock

```bash
node .opencode/workflow-state.js start-task migration MIGRATE-901 upgrade-ts "TypeScript upgrade" --lane-source user_explicit
node .opencode/workflow-state.js advance-stage migration_baseline
node .opencode/workflow-state.js route-rework requirement_gap
node .opencode/workflow-state.js show
```

Expected outcome:

- `mode = migration` (NOT escalated to full)
- `current_stage = migration_verify`
- `status = blocked`
- the lane-lock semantics prevented auto-escalation because `lane_source = user_explicit`
- the operator must resolve the requirement gap manually before unblocking

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
