---
artifact_type: specification
version: 1
status: draft
feature_id: FEATURE-004
feature_slug: openkit-full-delivery-multi-task-runtime
owner: BAAgent
approval_gate: ba_to_architect
---

# OpenKit Full-Delivery Multi-Task Runtime Specification

## Goal

Extend OpenKit from a single-active-work-item runtime into a multi-work-item runtime that supports team-like execution for `Full Delivery` work. The new runtime must let PM, BA, Architect, and Tech Lead shape a feature at the feature level, then let Tech Lead split that feature into execution tasks assigned to multiple developers and QA owners without overlap.

This specification does **not** expand the quick lane. `Quick Task` keeps the current single-item, low-overhead runtime model.

## Problem Statement

The current OpenKit runtime centers on one file-backed active work item in `.opencode/workflow-state.json`. That model works for a single worker progressing one item through the hard-split workflow, but it breaks down once a `Full Delivery` feature needs to be executed like a real team:

- one feature may need multiple developers working in parallel on independent implementation tasks
- one or more QA owners may need to verify different completed tasks without colliding with implementation ownership
- Tech Lead needs a runtime-native way to break an approved plan into discrete task assignments
- Master Orchestrator needs to see aggregate progress without micromanaging each file-level change
- the runtime needs explicit ownership and dependency rules so work does not overlap or drift

Without a task-aware runtime, the repository can describe team roles but cannot reliably coordinate them.

## Scope

In scope for this feature:

- introduce a multi-work-item runtime foundation
- keep per-work-item state instead of relying on one global work item snapshot only
- add a task-board model for `Full Delivery` work items only
- let Tech Lead create execution tasks from the implementation-plan stage onward
- let developers and QA claim and update task ownership through explicit runtime commands
- add validation rules that prevent overlapping ownership and invalid dependency states
- align runtime docs, workflow docs, and tests to the new model

Out of scope for this feature:

- changing the quick-lane contract
- adding a third lane or new workflow mode enum
- distributed orchestration across multiple repositories or remote services
- rich UI dashboards beyond the existing CLI/runtime-doc surface
- collaborative editing on the same execution task by multiple developers at once
- automatic scheduling or optimization-based assignment
- replacing the current workflow with a general-purpose project management system

## Design Principles

1. Keep the hard split intact: `Quick Task` stays simple, `Full Delivery` gets the richer coordination model.
2. Treat execution tasks as runtime coordination units, not as replacements for the feature-level workflow.
3. Preserve feature-level approvals, artifacts, and stage semantics.
4. Use one primary owner per execution task to prevent overlapping implementation work.
5. Keep QA ownership explicit and task-scoped.
6. Add structure only where it supports real team-like coordination.
7. Maintain file-backed explicit state; avoid hidden orchestration.

## Runtime Model

### 1. Work item layer

OpenKit should move from a single-active-work-item runtime to a multi-work-item runtime.

Each work item remains the top-level workflow entity. A work item still owns:

- `mode`
- `current_stage`
- `current_owner`
- `approvals`
- `artifacts`
- `issues`
- escalation metadata

For phase 1 compatibility, `.opencode/workflow-state.json` remains the external canonical runtime interface referenced by current docs, commands, and resume behavior. The new per-item files are introduced behind that interface, with the active work item mirrored into `.opencode/workflow-state.json` until a later approved migration changes the external canonical contract.

### 2. Execution-task layer

Only `Full Delivery` work items gain an execution-task board.

An execution task is a task-level coordination object created from the implementation plan. It is not a new workflow lane and not a new top-level work item by default.

Each execution task should contain at least:

- `task_id`
- `title`
- `summary`
- `kind`
- `status`
- `primary_owner`
- `qa_owner`
- `depends_on`
- `blocked_by`
- `artifact_refs`
- `plan_refs`
- `branch_or_worktree` (optional metadata only in phase 1)
- `created_by`
- `created_at`
- `updated_at`

## Ownership Matrix

The feature-level workflow owner and the task-level owners serve different purposes.

### Feature-level `current_owner`

`current_owner` stays role-level and reflects who owns the active feature stage, not which developer is editing which execution task.

Examples:

- `full_plan` -> `TechLeadAgent`
- `full_implementation` -> `FullstackAgent`
- `full_qa` -> `QAAgent`

This preserves compatibility with the current workflow schema and stage ownership map.

### Task-level owners

- `primary_owner` identifies the single developer or implementation agent currently responsible for one execution task
- `qa_owner` identifies the QA owner responsible for validating that execution task during QA handoff

### Mutation authority

- `MasterOrchestrator` may create, activate, summarize, and route work items and may block or reroute the feature-level workflow
- `TechLeadAgent` may create execution tasks, define dependencies, assign initial owners, and restructure the task board during `full_plan`
- the task `primary_owner` may move that task through implementation states
- the task `qa_owner` may move that task through QA states and emit task-scoped findings
- only the feature-level authority for the current stage may advance the feature stage itself

Task-level ownership never overrides feature-stage ownership.

## Mode-specific Behavior

### Quick Task

Quick mode stays unchanged:

- no task board
- no task-level ownership model
- no multi-developer orchestration
- no QA-per-subtask coordination layer
- existing `quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done` flow remains the source of truth

This feature must not make quick mode heavier.

### Full Delivery

Full mode gains a task board from `full_plan` onward.

#### Stage expectations

- `full_intake`, `full_brief`, `full_spec`, `full_architecture`
  - no execution-task board is required yet
  - work remains coordinated at the feature level

- `full_plan`
  - Tech Lead creates or updates the implementation plan
  - Tech Lead creates the initial execution-task board
  - tasks may begin in `queued` or `ready`
  - dependencies, ownership strategy, and QA expectations become explicit here
  - a feature may remain in `full_plan` while the board is still being defined, but it may not enter `full_implementation` until the board exists and passes validation

- `full_implementation`
  - execution-task board is the source of truth for implementation progress
  - developers claim and advance execution tasks
  - feature-level `current_owner` remains `FullstackAgent` while task-level implementation ownership is distributed across execution tasks

- `full_qa`
  - execution-task board is also the source of truth for task-level QA progress
  - QA owners claim and verify task handoffs
  - feature-level `current_owner` remains `QAAgent` while task-level QA ownership is distributed across execution tasks

- `full_done`
  - feature-level completion is allowed only when all required execution tasks are complete and no blocking issue remains open

## Execution Task Lifecycle

Recommended task statuses:

- `queued`
- `ready`
- `claimed`
- `in_progress`
- `dev_done`
- `qa_ready`
- `qa_in_progress`
- `done`
- `blocked`
- `cancelled`

These statuses are task-board statuses, not replacements for feature-level workflow stages.

### Required transition rules

- `queued -> ready`
  - allowed only when dependencies are satisfied or absent
  - controlled by `TechLeadAgent` or orchestration logic during planning

- `ready -> claimed`
  - allowed when the task has no blocking dependency and no current primary owner

- `claimed -> in_progress`
  - allowed only for the current `primary_owner`

- `in_progress -> dev_done`
  - allowed only for the current `primary_owner`
  - requires implementation evidence to be attached or referenced

- `dev_done -> qa_ready`
  - allowed only when the task has either an assigned `qa_owner` or is explicitly ready for QA assignment
  - may be performed by the task owner, `TechLeadAgent`, or orchestrating logic, but must preserve task evidence and ownership history

- `qa_ready -> qa_in_progress`
  - allowed only for the assigned `qa_owner`, or for a QA claimant when the task is explicitly available for QA claim

- `qa_in_progress -> done`
  - allowed only for the active `qa_owner`

- `qa_in_progress -> blocked`
  - allowed for the active `qa_owner` when the task cannot be verified due to missing input, invalid environment, or unresolved upstream dependency

- `qa_in_progress -> claimed` or `in_progress`
  - allowed only as a QA-fail rework transition
  - must attach a task-scoped finding
  - the rework target is chosen by `MasterOrchestrator` or `TechLeadAgent`, not by QA alone

- `* -> cancelled`
  - allowed only for `TechLeadAgent` or `MasterOrchestrator`
  - cancelled tasks are excluded from aggregate completion requirements unless a later policy introduces required-vs-optional cancellation semantics explicitly

## Ownership Model

### Primary ownership

Each execution task has exactly one `primary_owner` at a time.

Rules:

- no two developers may actively own the same execution task simultaneously
- if work truly needs two developers, Tech Lead must split it into multiple execution tasks with explicit dependencies
- only the current owner or the orchestrating authority may advance the task through implementation states

### QA ownership

Each execution task may also have one `qa_owner` when it reaches QA handoff.

Rules:

- QA ownership is task-scoped
- QA does not become the implementation owner
- QA may move a task through QA-specific validation states and emit task-scoped findings
- QA findings must point back to a specific execution task unless the issue is genuinely feature-wide or systemic

### Reassignment

The runtime must support explicit reassignment or release.

Reassignment should happen only when:

- the owner explicitly releases the task
- the orchestrator or Tech Lead reassigns it intentionally
- a stale or blocked state is resolved through an explicit runtime action

## QA Failure And Rework Rules

When a QA owner fails an execution task:

- the task must leave `qa_in_progress`
- the task returns only to an allowed rework target state defined in the transition rules above
- the finding must be attached to the specific `task_id`
- the feature may remain in `full_qa` if the board is already in the QA phase, or it may be routed back to `full_implementation` if the aggregate feature state requires renewed implementation work

Feature-level rework decisions remain owned by `MasterOrchestrator` according to the canonical workflow rules.

## Dependency Model

Execution tasks may depend on other execution tasks.

Rules:

- a task cannot be moved to `ready` if required dependencies are not satisfied
- a task cannot be claimed when it is blocked by unresolved dependencies
- dependency cycles must be rejected by runtime validation
- the task board should allow simple directed dependencies rather than a complex generic graph model in phase 1

## Aggregate Feature Rules

The feature-level workflow and the task board must stay aligned.

Minimum aggregate rules:

- a `full` work item cannot enter `full_implementation` without an initialized task board
- a `full` work item in `full_implementation` must have at least one task in `ready`, `claimed`, `in_progress`, `dev_done`, `qa_ready`, or `qa_in_progress`
- a `full` work item cannot enter `full_qa` while required implementation tasks remain incomplete
- a `full` work item cannot enter `full_done` while required QA tasks remain incomplete or blocking issues remain open

Feature-level approval integration:

- `tech_lead_to_fullstack` may be granted only when the implementation plan is approved and the initial task board exists in a valid form
- `fullstack_to_qa` may be granted only when all required implementation tasks have reached a completed developer handoff state such as `dev_done` or `qa_ready`
- `qa_to_done` may be granted only when all required QA tasks are `done` and no blocking feature-level issue remains open

## Resume Behavior For Multi-Task Full Delivery

When the active work item is a `full` item in `full_implementation` or `full_qa`, resume must restore both:

- feature-level context
  - active work item id
  - current feature stage
  - feature-level owner
  - linked artifacts and open issues relevant to the current stage

- task-level context
  - tasks currently assigned to the resuming worker or agent role
  - tasks currently in `claimed`, `in_progress`, `qa_ready`, `qa_in_progress`, or `blocked`
  - any dependencies or blockers that prevent the worker from continuing safely

Resume priority rules:

- resume always starts from the active work item first
- the feature stage remains the primary workflow coordinate
- task-level context is then narrowed to the assigned or active execution tasks relevant to the resuming owner or role
- if multiple tasks are active for the same role, resume should present a concise task summary rather than guessing one implicit active subtask
- if no execution task is assigned to the resuming owner, resume should show the feature-stage context and the set of `ready` tasks appropriate for that role instead of inventing assignment

## Suggested File Layout

Phase-1 target layout:

- `.opencode/work-items/index.json`
- `.opencode/work-items/<work-item-id>/state.json`
- `.opencode/work-items/<work-item-id>/tasks.json`

Recommended responsibilities:

- `index.json`
  - lists known work items
  - tracks which item is active in the current repo/session context
  - stores lightweight summary metadata only

- `state.json`
  - stores feature-level workflow state for one work item
  - preserves lane/stage/approvals/artifacts/issues semantics

- `tasks.json`
  - stores the execution-task board for `full` work items
  - remains absent or unused for `quick` work items

## Migration Strategy

The repository should migrate in phases, not in one breaking rewrite.

### Phase 1 migration rules

- keep `.opencode/workflow-state.json` for compatibility during transition
- introduce the new work-item directory structure alongside the current file
- allow the current active state file to mirror the active work item while the new runtime becomes authoritative internally
- update `status`, `doctor`, `show`, and resume behavior to understand the new layout incrementally

Mirror and sync invariants:

- the active per-item `state.json` is written first
- `.opencode/workflow-state.json` is then refreshed as the compatibility mirror for the active work item
- if the mirror refresh fails, the runtime must report divergence clearly rather than silently claiming success
- `doctor` must report active-item pointer errors, missing per-item state, stale `tasks.json` on quick items, and mirror divergence across active state surfaces

The repository must not pretend that the old single-state model disappeared until code, tests, and docs all agree.

## Command Surface Direction

Expected new commands should follow the existing CLI shape:

`node .opencode/workflow-state.js <command> ...`

### Concrete direction for phase 1

Work-item commands:

- `list-work-items`
- `show-work-item <work_item_id>`
- `activate-work-item <work_item_id>`
- `create-work-item <mode> <feature_id> <feature_slug> <mode_reason>`

Full-delivery task-board commands:

- `list-tasks <work_item_id>`
- `create-task <work_item_id> <task_id> <title> <kind>`
- `show-task <work_item_id> <task_id>`
- `claim-task <work_item_id> <task_id> <owner>`
- `release-task <work_item_id> <task_id>`
- `assign-qa-owner <work_item_id> <task_id> <owner>`
- `set-task-status <work_item_id> <task_id> <status>`
- `add-task-dependency <work_item_id> <task_id> <depends_on_task_id>`

Aggregate and validation commands:

- `summarize-work-item <work_item_id>`
- `validate-work-item-board <work_item_id>`
- existing `status`, `show`, and `doctor` should become multi-item aware

These names may still be refined during implementation planning, but the runtime must stay additive and CLI-oriented rather than introducing a separate orchestration surface first.

## Validation Requirements

The runtime must reject at least these invalid states:

- a quick work item with an active execution-task board
- a full work item in `full_implementation` without a task board
- more than one primary owner on the same task
- dependency cycles in a task board
- tasks marked `ready` or claimable while blocked by incomplete prerequisites
- invalid task transition edges, including `dev_done -> done` without QA and QA-fail transitions chosen by the wrong authority
- feature-level completion while required tasks or blocking issues remain open
- active-item pointer referencing a missing work item
- active compatibility mirror diverging from the active per-item state
- a quick item carrying a stale `tasks.json`

`doctor` and targeted runtime tests should be extended to cover these invariants.

## Testing Strategy

Phase 1 should add tests for:

- work-item index and per-item state behavior
- compatibility behavior for the active-item mirror during migration
- task-board creation only for `full` work items
- task ownership and reassignment guardrails
- dependency validation and cycle rejection
- aggregate stage/task-board alignment rules
- `doctor` diagnostics for invalid multi-item and task-board states
- session-start and resume behavior when multiple work items exist
- active-item pointer and compatibility-mirror sync behavior

## Risks

- letting the task board leak into quick mode would destroy quick-lane simplicity
- mixing feature-level stages with task-level statuses too loosely would create ambiguous ownership and broken resume logic
- allowing multiple active implementers on the same execution task would reintroduce overlap instead of preventing it
- migrating away from the current single-state runtime too abruptly would destabilize docs, commands, and tests together
- unclear sync order between per-item state and the compatibility mirror would create split-brain runtime state

## Non-Goals For Phase 1

- advanced locking or lease expiry across distributed workers
- real-time synchronization across multiple machines
- a graphical board UI
- auto-assignment or workload balancing
- multi-collaborator execution on one task
- changing `Quick Task` into a multi-worker lane

## Acceptance Criteria

- OpenKit can represent multiple work items in the repository runtime.
- `Full Delivery` work items can carry a task board from `full_plan` onward.
- Tech Lead can split a full-delivery feature into execution tasks with explicit dependencies.
- Each execution task has one primary owner at a time.
- QA ownership is explicit and task-scoped.
- Runtime validation blocks overlapping ownership and invalid dependency states.
- Quick mode remains unchanged in contract and runtime complexity.
- Docs, runtime commands, and tests describe the same model honestly.
