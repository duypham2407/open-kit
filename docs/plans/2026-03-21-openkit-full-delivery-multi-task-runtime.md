---
artifact_type: implementation_plan
version: 1
status: draft
feature_id: FEATURE-004
feature_slug: openkit-full-delivery-multi-task-runtime
source_spec: docs/specs/2026-03-21-openkit-full-delivery-multi-task-runtime.md
owner: TechLeadAgent
approval_gate: tech_lead_to_fullstack
---

# OpenKit Full-Delivery Multi-Task Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use `skills/subagent-driven-development/SKILL.md` when subagents are available. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-work-item runtime foundation plus a full-delivery-only execution task board so Tech Lead can split one feature into non-overlapping developer and QA assignments while quick mode stays unchanged.

**Architecture:** Implement this in five layers: work-item storage and compatibility mirroring, full-delivery task-board schema and controller support, CLI commands for work-item and task-board operations, aggregate validation and diagnostics, and doc/test updates that keep the new model aligned with the current hard-split workflow contract. Phase 1 keeps `.opencode/workflow-state.json` as the external canonical interface while new per-item state files become the backing store for the active work item.

**Tech Stack:** Node.js runtime utilities, JSON state files, Node test runner, Markdown docs

---

## Dependencies

- Source spec: `docs/specs/2026-03-21-openkit-full-delivery-multi-task-runtime.md`
- Canonical workflow docs: `AGENTS.md`, `context/core/workflow.md`, `context/core/session-resume.md`, `context/core/workflow-state-schema.md`, `context/core/project-config.md`
- Runtime utilities: `.opencode/workflow-state.js`, `.opencode/lib/workflow-state-controller.js`, `.opencode/lib/workflow-state-rules.js`, `.opencode/lib/contract-consistency.js`
- Existing runtime tests: `.opencode/tests/workflow-state-controller.test.js`, `.opencode/tests/workflow-state-cli.test.js`, `.opencode/tests/workflow-behavior.test.js`, `.opencode/tests/workflow-contract-consistency.test.js`, `.opencode/tests/session-start-hook.test.js`
- Existing validation command: `node --test ".opencode/tests/*.test.js"`

## Planned File Map

- **Work-item storage layer**
  - Create: `.opencode/lib/work-item-store.js`
  - Modify: `.opencode/lib/workflow-state-controller.js`
  - Modify: `.opencode/workflow-state.js`
- **Task-board rules layer**
  - Create: `.opencode/lib/task-board-rules.js`
  - Modify: `.opencode/lib/workflow-state-rules.js`
  - Modify: `.opencode/lib/workflow-state-controller.js`
- **Schema and workflow docs layer**
  - Modify: `context/core/workflow.md`
  - Modify: `context/core/workflow-state-schema.md`
  - Modify: `context/core/session-resume.md`
  - Modify: `context/core/project-config.md`
  - Modify: `AGENTS.md`
  - Modify: `README.md`
- **Diagnostics and operator layer**
  - Modify: `.opencode/lib/contract-consistency.js`
  - Modify: `hooks/session-start`
  - Modify: `docs/operations/README.md`
  - Modify: `docs/operations/workflow-state-smoke-tests.md`
  - Modify: `docs/examples/README.md`
  - Create: `docs/examples/2026-03-21-full-delivery-task-board-walkthrough.md`
- **Test layer**
  - Create: `.opencode/tests/work-item-store.test.js`
  - Create: `.opencode/tests/task-board-rules.test.js`
  - Create: `.opencode/tests/multi-work-item-runtime.test.js`
  - Modify: `.opencode/tests/workflow-state-controller.test.js`
  - Modify: `.opencode/tests/workflow-state-cli.test.js`
  - Modify: `.opencode/tests/workflow-contract-consistency.test.js`
  - Modify: `.opencode/tests/session-start-hook.test.js`

## Execution Rules

- Do not change the quick-lane contract or add task-board runtime to quick mode.
- Keep `.opencode/workflow-state.json` as the external canonical interface for phase 1 compatibility.
- Keep the command surface additive under `node .opencode/workflow-state.js ...`.
- Do not introduce remote orchestration, dashboards, or distributed locking in this phase.
- Prefer explicit validation over hidden background sync.
- Update docs, runtime behavior, and tests together when changing the state model.
- Do not create git commits during execution unless the user explicitly asks for them.

## Phase-1 Compatibility Notes

- The repository already contains `.opencode/workflow-state.json` as the checked-in active work-item example.
- Phase 1 must bootstrap from that existing file into `.opencode/work-items/index.json` plus `.opencode/work-items/<work-item-id>/state.json` without breaking existing entry commands.
- `start-feature` and `start-task` must remain backward-compatible entrypoints: they should create or select a work item, write per-item state first, then refresh `.opencode/workflow-state.json` as the active compatibility mirror.
- The checked-in example repo state must continue to load cleanly after the new storage model is introduced.

Phase-1 storage contract:

- `work_item_id` must be a stable persisted identifier, not a transient runtime pointer
- bootstrap from the checked-in `.opencode/workflow-state.json` should derive `work_item_id` from `feature_id` unless a stored work-item id already exists
- `.opencode/work-items/index.json` must contain at least:
  - `active_work_item_id`
  - `work_items` summary entries with `work_item_id`, `feature_id`, `feature_slug`, `mode`, `status`, and state-file path
- repeated bootstrap runs against the same checked-in state must produce the same `work_item_id` and not duplicate entries

## Tasks

### Task 1: Introduce the work-item storage layer behind the compatibility state file

**Files:**
- Create: `.opencode/lib/work-item-store.js`
- Modify: `.opencode/lib/workflow-state-controller.js`
- Modify: `.opencode/workflow-state.js`
- Create: `.opencode/tests/work-item-store.test.js`
- Modify: `.opencode/tests/workflow-state-controller.test.js`

- [ ] **Step 1: Write failing tests for multi-work-item storage and compatibility mirroring**

Create `.opencode/tests/work-item-store.test.js` with cases for:
- bootstrapping an existing `.opencode/workflow-state.json` into `.opencode/work-items/index.json` and `.opencode/work-items/<id>/state.json`
- deriving a stable `work_item_id` and avoiding duplicate bootstrap entries across repeated runs
- creating `.opencode/work-items/index.json`
- creating `.opencode/work-items/<id>/state.json`
- activating one work item and mirroring it into `.opencode/workflow-state.json`
- reporting divergence when the active-item mirror is stale or missing

Add focused failing coverage in `.opencode/tests/workflow-state-controller.test.js` for reading and writing the active work item through the compatibility layer.

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: FAIL because the work-item store does not exist yet.

- [ ] **Step 2: Implement a focused work-item store helper**

Create `.opencode/lib/work-item-store.js` with narrow responsibilities:
- bootstrap a legacy `.opencode/workflow-state.json` into the phase-1 work-item layout
- derive and persist stable `work_item_id` values plus the minimal `index.json` shape
- resolve `.opencode/work-items/index.json`
- read and write the work-item index
- read and write one work item state file
- update the active-item pointer in the index
- refresh `.opencode/workflow-state.json` as the active compatibility mirror

Keep this helper file-focused. Do not add task-board logic here.

- [ ] **Step 3: Route controller reads and writes through the active work-item store**

Update `.opencode/lib/workflow-state-controller.js` so feature-level operations use the active work-item backing store while preserving current command behavior for callers that still target `.opencode/workflow-state.json`.

Explicitly implement legacy-command behavior:
- `start-feature` bootstraps or creates the target work item, marks it active, writes per-item state, then refreshes the compatibility mirror
- `start-task` does the same for explicit quick/full task start flows

- [ ] **Step 4: Add additive work-item CLI commands**

Extend `.opencode/workflow-state.js` with concrete commands:
- `create-work-item <mode> <feature_id> <feature_slug> <mode_reason>`
- `list-work-items`
- `show-work-item <work_item_id>`
- `activate-work-item <work_item_id>`

Keep `start-task`, `start-feature`, `status`, `show`, and `doctor` working during the transition.

- [ ] **Step 5: Re-run the full test suite and confirm mirror behavior**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS for the new storage and compatibility tests.

- [ ] **Step 6: Verify the checked-in example repository state still loads cleanly**

Run:
```bash
node .opencode/workflow-state.js show
node .opencode/workflow-state.js status
```
Expected:
- the checked-in example state still renders correctly through the compatibility interface
- no bootstrap error appears for the repository root

### Task 2: Add full-delivery execution-task board rules and persistence

**Files:**
- Create: `.opencode/lib/task-board-rules.js`
- Modify: `.opencode/lib/workflow-state-rules.js`
- Modify: `.opencode/lib/workflow-state-controller.js`
- Create: `.opencode/tests/task-board-rules.test.js`
- Create: `.opencode/tests/multi-work-item-runtime.test.js`

- [ ] **Step 1: Write failing tests for full-only task-board behavior**

Create `.opencode/tests/task-board-rules.test.js` and `.opencode/tests/multi-work-item-runtime.test.js` with cases for:
- rejecting task boards on quick work items
- allowing task-board creation only for full work items
- persisting the minimum task record shape required by the spec: `task_id`, `title`, `summary`, `kind`, `status`, `primary_owner`, `qa_owner`, `depends_on`, `blocked_by`, `artifact_refs`, `plan_refs`, `branch_or_worktree`, `created_by`, `created_at`, and `updated_at`
- one `primary_owner` per task
- one `qa_owner` per task handoff phase
- explicit primary-owner reassignment allowed only to `TechLeadAgent` or `MasterOrchestrator`
- dependency cycle rejection
- rejecting invalid task transitions
- rejecting QA-fail rework transitions unless a task-scoped finding is attached
- rejecting `full_implementation` without a valid task board

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: FAIL because task-board rules and persistence do not exist yet.

- [ ] **Step 2: Implement the task-board rules helper**

Create `.opencode/lib/task-board-rules.js` to own:
- the minimum persisted task record contract
- task shape validation
- allowed task statuses
- allowed transition edges
- task-scoped finding shape for QA-fail rework
- dependency validation
- aggregate completion logic for full-delivery boards

Do not mix feature-stage logic deeply into this helper; expose clear validation functions instead.

- [ ] **Step 3: Add task-board persistence to the controller**

Update `.opencode/lib/workflow-state-controller.js` so `full` work items can carry `tasks.json` under `.opencode/work-items/<id>/tasks.json`, while `quick` work items reject task-board operations.

Persist task-scoped findings with the board so QA-fail rework decisions can point to a specific `task_id` without overloading feature-level issue storage.

- [ ] **Step 4: Enforce feature-stage and task-board alignment**

Add controller validation for:
- `full_plan` may create and revise the initial board
- `full_implementation` requires an initialized board
- `full_qa` requires implementation tasks to be complete enough for QA handoff
- `full_done` requires aggregate board completion and no blocking issue
- `tech_lead_to_fullstack` requires a valid initial board
- `fullstack_to_qa` requires implementation-complete tasks in valid handoff states
- `qa_to_done` requires QA-complete tasks and no blocking feature-level issue
- `qa_in_progress -> claimed|in_progress` rework transitions require an attached task-scoped finding

- [ ] **Step 5: Re-run targeted tests, then the full suite**

Run targeted task-board tests first, then:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

- [ ] **Step 6: Re-run legacy entrypoint regression checks**

Run focused checks for:
- `start-feature`
- `start-task quick ...`
- `start-task full ...`
- repeated bootstrap against the checked-in example state

Expected:
- all entrypoints create or activate work items through the new storage layer without breaking the compatibility mirror
- repeated bootstrap keeps a stable `work_item_id` and does not duplicate index entries

### Task 3: Add additive CLI commands for task-board operation and assignment

**Files:**
- Modify: `.opencode/workflow-state.js`
- Modify: `.opencode/lib/workflow-state-controller.js`
- Modify: `.opencode/tests/workflow-state-cli.test.js`
- Modify: `.opencode/tests/multi-work-item-runtime.test.js`

- [ ] **Step 1: Write failing CLI tests for task-board commands**

Add CLI tests for:
- `list-tasks <work_item_id>`
- `create-task <work_item_id> <task_id> <title> <kind>`
- `show-task <work_item_id> <task_id>`
- `claim-task <work_item_id> <task_id> <owner>`
- `release-task <work_item_id> <task_id>`
- `reassign-task <work_item_id> <task_id> <owner>`
- `assign-qa-owner <work_item_id> <task_id> <owner>`
- `set-task-status <work_item_id> <task_id> <status>`
- `add-task-dependency <work_item_id> <task_id> <depends_on_task_id>`
- `add-task-finding <work_item_id> <task_id> <finding_id> <summary> <severity> <evidence>`

- [ ] **Step 2: Implement the smallest useful controller helpers for each CLI action**

Keep helpers narrow:
- no bulk mutation API
- no hidden auto-assignment
- no broad “update anything” command that bypasses guardrails

- [ ] **Step 3: Enforce ownership-safe transitions in CLI flows**

Ensure runtime rejects:
- claiming an already owned task
- reassigning a task from the wrong authority
- QA ownership on a task that is not in a QA-handoff-capable state
- status changes by the wrong owner or wrong role
- QA-fail rework transitions without a task-scoped finding
- task creation for a quick item

- [ ] **Step 4: Add aggregate inspection commands**

Extend the CLI with:
- `summarize-work-item <work_item_id>`
- `validate-work-item-board <work_item_id>`

Keep output concise and operator-readable.

- [ ] **Step 5: Re-run CLI and runtime tests**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

### Task 4: Update workflow docs and schema docs for the multi-item full-delivery model

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `context/core/workflow.md`
- Modify: `context/core/workflow-state-schema.md`
- Modify: `context/core/session-resume.md`
- Modify: `context/core/project-config.md`

- [ ] **Step 1: Build a doc alignment checklist from the approved spec**

List the canonical points that must become true in docs:
- quick lane unchanged
- `.opencode/workflow-state.json` still canonical externally in phase 1
- per-item backing store exists behind it
- full-delivery-only task board from `full_plan` onward
- role-level feature owner vs task-level owners

- [ ] **Step 2: Update the workflow and schema docs together**

Make `context/core/workflow.md` and `context/core/workflow-state-schema.md` agree on:
- the new multi-work-item runtime model
- the compatibility role of `.opencode/workflow-state.json`
- the full-delivery task-board concept
- quick-mode non-participation in task-board behavior
- the minimum new multi-item and task-board fields introduced in phase 1

- [ ] **Step 3: Update resume and project-config docs**

Make `context/core/session-resume.md` describe how full-delivery resume should surface feature context plus assigned task context.

Make `context/core/project-config.md` list the new runtime commands and limits honestly.

- [ ] **Step 4: Update top-level docs without restating too much workflow law**

Update `AGENTS.md` and `README.md` so they:
- acknowledge multi-work-item runtime support
- keep quick/full limits clear
- point back to the canonical workflow and schema docs for detail

- [ ] **Step 5: Manually verify the doc set is internally consistent**

Validation:
- read the touched docs together
- confirm no doc implies task-board support for quick mode
- confirm no doc says `.opencode/workflow-state.json` disappeared in phase 1
- confirm schema docs and runtime validators describe the same new fields and invariants

### Task 5: Extend diagnostics, resume output, and drift detection for the new state model

**Files:**
- Modify: `.opencode/lib/contract-consistency.js`
- Modify: `hooks/session-start`
- Modify: `.opencode/lib/workflow-state-controller.js`
- Modify: `.opencode/tests/workflow-contract-consistency.test.js`
- Modify: `.opencode/tests/session-start-hook.test.js`
- Modify: `.opencode/tests/workflow-state-cli.test.js`

- [ ] **Step 1: Write failing tests for multi-item diagnostics and resume output**

Add cases for:
- active-item pointer referencing a missing work item
- compatibility mirror divergence
- quick work item incorrectly carrying a `tasks.json`
- session-start showing active work item plus task-level resume summary for full delivery
- `doctor` surfacing task-board integrity failures

- [ ] **Step 2: Extend contract-consistency checks narrowly**

Update `.opencode/lib/contract-consistency.js` to validate only stable multi-item invariants:
- expected work-item index and active pointer surfaces exist
- active-item pointer targets a real work item
- quick items do not carry task-board data
- schema/docs mention the right phase-1 compatibility behavior

- [ ] **Step 3: Update `status`, `doctor`, and `session-start`**

Make runtime output show:
- active work item id
- work-item count summary where useful
- task-board summary for active full-delivery work items
- resume hints that surface assigned or active tasks without guessing one implicit subtask when several are active

- [ ] **Step 4: Re-run diagnostics and full tests**

Run:
```bash
node .opencode/workflow-state.js doctor
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

- [ ] **Step 5: Keep diagnostics additive and readable**

Refactor output strings only if the new runtime data makes command output too noisy or unclear.

### Task 6: Update operations/examples guidance and add one realistic full-delivery task-board walkthrough

**Files:**
- Modify: `docs/operations/README.md`
- Modify: `docs/operations/workflow-state-smoke-tests.md`
- Modify: `docs/examples/README.md`
- Create: `docs/examples/2026-03-21-full-delivery-task-board-walkthrough.md`
- Modify: `README.md` if the walkthrough needs a top-level pointer

- [ ] **Step 1: Add operator guidance for work-item and task-board inspection**

Document the smallest honest flow for:
- listing work items
- activating a work item
- listing tasks on a full-delivery board
- validating board integrity

- [ ] **Step 2: Add runnable smoke-test steps with exact commands**

Include exact commands for:
```bash
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item <id>
node .opencode/workflow-state.js list-tasks <id>
node .opencode/workflow-state.js validate-work-item-board <id>
node --test ".opencode/tests/*.test.js"
```

- [ ] **Step 3: Add one realistic walkthrough example**

Create `docs/examples/2026-03-21-full-delivery-task-board-walkthrough.md` showing:
- one full-delivery feature entering `full_plan`
- Tech Lead creating task-board entries
- two implementation tasks with different primary owners
- one QA handoff
- final validation commands

- [ ] **Step 4: Review docs for honesty and scope control**

Confirm docs do not imply:
- quick-mode task boards
- collaborative multi-owner task editing
- dashboards or remote orchestrators

- [ ] **Step 5: Re-run the runtime test suite after any example-linked doc changes**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

### Task 7: Final integration pass for the phase-1 multi-task runtime slice

**Files:**
- Modify: any touched file that fails final verification

- [ ] **Step 1: Run the full runtime suite**

Run:
```bash
node --test ".opencode/tests/*.test.js"
```
Expected: PASS.

- [ ] **Step 2: Run the runtime inspection commands on the repository root**

Run:
```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
node .opencode/workflow-state.js show
```

Expected:
- commands exit successfully for the checked-in repo state
- active-item compatibility output is readable
- no task-board diagnostics incorrectly appear for the current quick-less golden-path example unless a full example board is intentionally added

- [ ] **Step 2b: Re-run legacy entrypoint verification on the repository root or isolated fixture path**

Run legacy-compatible start flows against a temp state path or isolated fixture path and confirm they still create or activate work items correctly through the new runtime model.

- [ ] **Step 3: Perform a final cross-surface consistency pass**

Read together:
- `AGENTS.md`
- `context/core/workflow.md`
- `context/core/workflow-state-schema.md`
- `context/core/session-resume.md`
- `README.md`
- `.opencode/workflow-state.js --help` output

Confirm they tell the same story about:
- quick mode staying simple
- full-delivery-only task boards
- compatibility mirroring through `.opencode/workflow-state.json`

- [ ] **Step 4: Record remaining non-blocking follow-ups in the delivery summary**

Call out deferred work such as:
- richer event logs
- stale-lock handling
- optional dashboard UI
- optional worktree orchestration metadata beyond phase-1 support

- [ ] **Step 5: Prepare execution handoff notes**

Document:
- what changed in runtime shape
- what operators must now watch for
- what remains intentionally out of scope in phase 1

## Risks

- The active-item compatibility mirror could drift from per-item backing files if sync order is not enforced tightly.
- Full-delivery task-board rules could accidentally leak into quick mode if validation and docs are not updated together.
- Overly generic task mutation commands could bypass ownership and dependency safeguards.
- The current golden-path example state may need careful migration or fixture strategy so tests remain readable.

## Rollback Notes

- Revert work-item storage changes together with the CLI and diagnostics changes if the compatibility mirror becomes unreliable.
- Revert task-board persistence and commands together if full-delivery ownership rules prove inconsistent.
- Restore the last passing `node --test ".opencode/tests/*.test.js"` baseline before retrying any failed slice.
