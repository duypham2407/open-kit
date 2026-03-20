# Workflow State Controller Design

> Historical background note: this controller design predates the current hard-split workflow. Until `.opencode/workflow-state.js` is updated, the stage and approval details in this document are not the canonical workflow contract.

> Approved design for adding a lightweight CLI controller that manages `.opencode/workflow-state.json` safely and consistently.

## Goal

Provide a small, explicit control surface for reading, validating, and updating OpenKit workflow state without introducing a background service or hidden automation.

## Why This Exists

OpenKit now has a documented workflow state contract, but state transitions are still updated manually. That leaves room for drift between:

- `.opencode/workflow-state.json`
- artifact files under `docs/`
- approval gate rules
- stage ownership rules

The controller exists to make the file-backed operating system practical, not just documented.

## Selected Approach

Implement a single CLI utility under `.opencode/` that reads and writes `.opencode/workflow-state.json`.

The CLI should:

1. Load the current state file.
2. Validate transitions against the documented schema and approval rules.
3. Apply narrowly scoped updates.
4. Write formatted JSON back to disk.
5. Return clear human-readable errors when a transition is invalid.

This keeps orchestration explicit and inspectable while avoiding a heavier runtime service.

The first version may rely on Node.js because the repository already uses a `.opencode/package.json` runtime area. If that dependency becomes part of the supported kit surface, it must be documented in `AGENTS.md` and `context/core/project-config.md`.

## Non-Goals

- Building a daemon, watcher, or background scheduler
- Auto-discovering arbitrary repo structure beyond documented artifact paths
- Replacing human approval with automatic approval
- Introducing application-specific build or test assumptions

## CLI Surface

The initial controller should support these commands:

### `show`

Print the current workflow state in a readable form.

The CLI should also support an alternate state path for verification scenarios, either through an optional `--state <path>` flag or an environment variable such as `OPENKIT_WORKFLOW_STATE`.

The first version should treat `--state <path>` as the primary documented mechanism. `OPENKIT_WORKFLOW_STATE` is optional convenience support in v1. If both are present, `--state <path>` takes precedence.

### `validate`

Check that the current state file satisfies:

- required top-level fields
- required identifiers such as `feature_id` and `feature_slug`
- known `current_stage` values
- known `status` values
- stage-owner alignment
- gate shape validity
- issue objects matching the required schema in `context/core/issue-routing.md`
- `retry_count` presence and numeric shape
- `updated_at` presence

### `start-feature`

Initialize a feature in state using provided identifiers.

Expected inputs:

- `feature_id`
- `feature_slug`

Expected effects:

- set `current_stage` to `intake`
- set `status` to `in_progress`
- set `current_owner` to `MasterOrchestrator`
- clear artifacts and issues
- reset approvals so every gate entry becomes `{ status: "pending", approved_by: null, approved_at: null, notes: null }`
- set `retry_count` to `0`
- set `updated_at` to the current operation timestamp

### `advance-stage`

Move to the next workflow stage.

Expected inputs:

- `to`

Rules:

- transition must be forward-only within the canonical stage sequence
- if a gate protects the transition, that gate must already be `approved`
- `current_owner` must change to the default owner of the new stage
- `status` should remain `in_progress` unless the new stage is `done`, in which case it becomes `done`
- `updated_at` must be refreshed

CLI shape for the first version should be positional and consistent with the examples:

```bash
node .opencode/workflow-state.js advance-stage <stage>
```

### `set-approval`

Set one approval gate.

Expected inputs:

- `gate`
- `status`
- optional `approved_by`
- optional `approved_at`
- optional `notes`

Expected effects:

- update the selected gate only
- refresh `updated_at`

### `link-artifact`

Attach one artifact path to state.

Expected inputs:

- `kind` (`brief`, `spec`, `architecture`, `plan`, `qa_report`, `adr`)
- `path`

Rules:

- the file should exist before linking
- refresh `updated_at`
- when `kind` is `adr`, append to the `artifacts.adr` array instead of replacing a scalar field

### `record-issue`

Append a QA or workflow issue to the `issues` array.

Expected inputs:

- `issue_id`
- `title`
- `type`
- `severity`
- `rooted_in`
- `recommended_owner`
- `evidence`
- `artifact_refs`

Expected effects:

- append a new issue object to `issues`
- set `status` to `blocked` when the issue represents a failed QA or workflow blocker
- refresh `updated_at`

### `clear-issues`

Clear issues after routing or resolution when explicitly requested.

Expected effects:

- empty the `issues` array
- reset `status` to `in_progress` when work is still active, or keep `done` if the workflow is already complete
- refresh `updated_at`

### `route-rework`

Route a failed QA outcome or workflow issue back to the correct working stage.

Expected inputs:

- `issue_type` (`bug`, `design_flaw`, `requirement_gap`)
- optional `repeat_failed_fix` (`true` | `false`), default `false`

Rules:

- `bug` routes to `implementation` with owner `FullstackAgent`
- `design_flaw` routes to `architecture` with owner `ArchitectAgent` in the first version
- `requirement_gap` routes to `spec` with owner `BAAgent`
- increment `retry_count` only when `repeat_failed_fix` is `true`
- set `status` to `in_progress`
- refresh `updated_at`

This command is required so the controller can model the documented QA feedback loop instead of only happy-path forward movement.

This explicit flag keeps the first version deterministic without requiring hidden issue-history state beyond the documented schema.

In the first version, escalation signaling should also be explicit: the caller provides the retry context, and the controller reports when `retry_count` has reached the documented threshold of `3`. The controller should not attempt to infer issue-family history from cleared issues.

Reaching the threshold should return a clear warning or escalation message to the caller, but it does not need to hard-block routing in v1.

## Source Of Truth For Validation

The controller should validate against repository docs rather than inventing behavior:

- `context/core/workflow-state-schema.md`
- `context/core/approval-gates.md`
- `context/core/issue-routing.md`
- `context/core/workflow.md`

In implementation, the first version may encode the rules directly in code, but those rules must match the docs above.

## Data Model Decisions

### Stage Sequence

Canonical sequence:

`intake -> brief -> spec -> architecture -> plan -> implementation -> qa -> done`

This is the canonical forward sequence. Rework transitions are exceptions driven by `route-rework` after issues are recorded.

### Stage Owner Mapping

- `intake` -> `MasterOrchestrator`
- `brief` -> `PMAgent`
- `spec` -> `BAAgent`
- `architecture` -> `ArchitectAgent`
- `plan` -> `TechLeadAgent`
- `implementation` -> `FullstackAgent`
- `qa` -> `QAAgent`
- `done` -> `MasterOrchestrator`

### Gate Mapping

- `brief -> spec` requires `pm_to_ba`
- `spec -> architecture` requires `ba_to_architect`
- `architecture -> plan` requires `architect_to_tech_lead`
- `plan -> implementation` requires `tech_lead_to_fullstack`
- `implementation -> qa` requires `fullstack_to_qa`
- `qa -> done` requires `qa_to_done`

No approval gate is required to move into `brief` from `intake`.

### Approval Reset Shape

`start-feature` must recreate every documented gate entry using the canonical pending shape:

`{ status: "pending", approved_by: null, approved_at: null, notes: null }`

### QA Failure Routing

When QA fails, the controller must support routing work backward without inventing new stages.

- `bug` -> `implementation`
- `design_flaw` -> `architecture`
- `requirement_gap` -> `spec`

After rework is complete, the workflow may advance forward again through the normal stage sequence.

### Issue Ownership Validation

The first version should validate `recommended_owner` conservatively:

- `bug` -> `FullstackAgent`
- `requirement_gap` -> `BAAgent`
- `design_flaw` -> `ArchitectAgent` or `TechLeadAgent`

## Error Handling

The controller should fail loudly and specifically.

Examples:

- unknown stage value
- attempt to skip a stage
- missing approval gate for the requested transition
- artifact path does not exist
- malformed state JSON
- missing required `updated_at`
- missing required `retry_count`

Errors should describe both what failed and what the caller should fix.

## File Layout

Recommended implementation files:

- `.opencode/workflow-state.js` — CLI entry point
- `.opencode/lib/workflow-state-controller.js` — state update logic
- `.opencode/lib/workflow-state-rules.js` — canonical stage/gate/owner constants

If this is too heavy for the first pass, the logic may start in one file and split only when needed.

## Integration Points

The controller should be easy to invoke from:

- future command wrappers
- hook scripts
- manual terminal usage
- agent instructions that need explicit state transitions

Example intended usage:

```bash
node .opencode/workflow-state.js validate
node .opencode/workflow-state.js start-feature FEATURE-002 login-flow
node .opencode/workflow-state.js link-artifact brief docs/briefs/2026-03-20-login-flow.md
node .opencode/workflow-state.js set-approval pm_to_ba approved user 2026-03-20 "Brief approved"
node .opencode/workflow-state.js advance-stage brief
node .opencode/workflow-state.js record-issue ISSUE-001 "Missing validation" bug medium implementation FullstackAgent "Spec compliance failed in QA" docs/qa/2026-03-20-task-intake-dashboard.md
node .opencode/workflow-state.js route-rework bug
```

## Testing Strategy

This repository does not yet define a repo-native test runner for application code, so validation should be lightweight and explicit.

Initial verification path:

- run the CLI against the current state file
- verify JSON remains parseable
- verify expected failures for invalid transitions
- verify valid transitions update the correct fields only
- verify QA-failure routing updates stage, owner, status, and retry count correctly

## Trade-Offs

### Benefits

- Makes the operating system executable, not only documented
- Reduces state drift
- Makes resume behavior more trustworthy
- Keeps orchestration visible and file-backed

### Costs

- Adds small maintenance surface in `.opencode/`
- Requires docs and code to stay aligned
- Needs careful guardrails to avoid over-automation

## Decision

Build a small CLI workflow-state controller as the first executable orchestration component of OpenKit.
