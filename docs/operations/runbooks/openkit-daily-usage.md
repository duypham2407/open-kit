# OpenKit Daily Usage

Use this runbook when you want the practical step-by-step path for working with the checked-in OpenKit runtime that exists in this repository today.

## Current Reality In This Repository

- The live runtime in this worktree is the repository-local surface rooted in `.opencode/`.
- The managed wrapper path is still a staged direction unless wrapper-owned files actually exist in the worktree.
- This repository does not currently contain a wrapper-owned root `opencode.json` or `.openkit/openkit-install.json`.
- The workflow supports three live modes: `quick`, `migration`, and `full`.
- `Quick Task+` is the current semantics of the `quick` lane, not a third mode.
- There is no repo-native application build, lint, or test command yet, so verification must use the real runtime checks plus honest manual or artifact-based validation.

## Fast Path

For normal day-to-day use in this repository:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

Then start work from the chat surface with one of these:

- `/task` when you want the Master Orchestrator to choose the lane
- `/quick-task` when the work is already clearly small, bounded, and low risk
- `/migrate` when the work is primarily an upgrade or migration effort
- `/delivery` when the work clearly needs the full multi-stage delivery flow

If you need to inspect the current state more closely:

```bash
node .opencode/workflow-state.js show
node .opencode/workflow-state.js validate
```

## Choose The Right Entry Point

Use `/task` by default. It is the safest starting point when you are not fully sure whether the request belongs in `Quick Task`, `Migration`, or `Full Delivery`.

Use `/quick-task` only when all of these are already true:

- the scope is bounded
- acceptance is already clear
- no architecture or contract change is needed
- no security, auth, billing, permission, schema, or API model change is involved
- verification stays short and direct

Use `/delivery` when any of these are true:

- the work is a new feature or workflow
- requirements may still move
- multiple subsystems are involved
- architecture or contracts may change
- you need briefs, specs, architecture, plans, or QA artifacts

Use `/migrate` when most of these are true:

- the main goal is upgrading or replacing existing technology
- the expected outcome is preserving layout, behavior, and contracts under a newer stack
- current-state baseline capture is required before editing
- compatibility risk is more central than feature definition
- framework-coupled blockers need seams or adapters before the upgrade is safe
- rollback checkpoints or staged remediation are needed
- validation depends on builds, tests, smoke checks, type checks, or manual regression evidence more than on greenfield TDD slices

Canonical lane rules live in `context/core/workflow.md`.

If the boundary still feels fuzzy, use the `Lane Decision Matrix` in `context/core/workflow.md` before forcing a lane.

## Daily Operator Flow

### 1. Check runtime health

Start with read-only checks:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

What to look for:

- `status` shows the active mode, stage, owner, and work item when one exists
- `doctor` confirms the checked-in runtime files, metadata, hooks, workflow contract, and active work-item state are aligned

If `doctor` reports errors, fix those before trusting resume or task-board behavior.

### 2. Start or resume work

If no work is active, start from chat with `/task`, `/quick-task`, or `/delivery`.

If work already exists, inspect it first:

```bash
node .opencode/workflow-state.js show
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item <work_item_id>
```

Use `show` when you want the raw active state, linked artifacts, approvals, and open issues.

Use `list-work-items` and `show-work-item` when you need to understand which managed item is active or switch your attention to a different full-delivery item.

### 3. Follow the lane that was chosen

Quick lane flow:

- `quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`
- use it for bounded daily work
- `quick_plan` is required, even though a separate task card in `docs/tasks/` remains optional
- QA still happens through the quick verification step; quick does not bypass quality

Full-delivery flow:

- `full_intake -> full_brief -> full_spec -> full_architecture -> full_plan -> full_implementation -> full_qa -> full_done`
- use it for feature work and higher-risk changes
- expect explicit artifacts under `docs/briefs/`, `docs/specs/`, `docs/architecture/`, `docs/plans/`, and `docs/qa/`
- use `/brainstorm`, `/write-plan`, and `/execute-plan` only in this lane

Migration flow:

- `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_verify -> migration_done`
- use it for framework upgrades, dependency modernization, and compatibility remediation
- expect explicit baseline, architecture, and plan context before major edits
- preserve behavior first, decouple only the blockers that make the migration unsafe, then upgrade in slices
- use `/brainstorm`, `/write-plan`, and `/execute-plan` in this lane when strategy or staged execution is needed
- use `docs/templates/migration-baseline-checklist.md` and `docs/templates/migration-verify-checklist.md` as repeatable checklists for baseline and verification
- use `docs/templates/migration-report-template.md` when you want one running artifact for baseline, strategy, execution, and verification

### 4. Inspect work-item and task-board state when needed

The task board belongs only to `Full Delivery` work items.

Useful commands:

```bash
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item <work_item_id>
node .opencode/workflow-state.js list-tasks <work_item_id>
node .opencode/workflow-state.js validate-work-item-board <work_item_id>
```

Guidance:

- use `list-tasks` only for full-delivery items that actually use a task board
- do not expect quick or migration mode to have task-level ownership or task-board commands
- treat task-board support as bounded coordination, not as proof that arbitrary parallel execution is safe

### 5. Validate honestly

In this repository, the workflow-state utility helps you validate runtime state, not application behavior.

Use:

```bash
node .opencode/workflow-state.js validate
```

for workflow-state consistency.

Do not present `status`, `doctor`, `show`, or `validate` as substitutes for application build, lint, or test commands. If app-native tooling does not exist for the work, record the real manual or artifact-based verification path instead.

## Command Reference For Operators

Read-only commands you will use most often:

| Command | Use it when | Notes |
| --- | --- | --- |
| `node .opencode/workflow-state.js status` | you want the current runtime summary | safest first check |
| `node .opencode/workflow-state.js doctor` | you want diagnostics for the checked-in runtime | confirms runtime health and contract alignment |
| `node .opencode/workflow-state.js show` | you need the active state object and linked artifacts | good for resume and debugging |
| `node .opencode/workflow-state.js validate` | you suspect the state may be stale or manually edited | workflow-state check only |
| `node .opencode/workflow-state.js list-work-items` | you want to see tracked work items | marks the active item |
| `node .opencode/workflow-state.js show-work-item <work_item_id>` | you want one item's mode, stage, and status | full-delivery coordination helper |
| `node .opencode/workflow-state.js list-tasks <work_item_id>` | you need task-board visibility for a full item | quick and migration modes stay task-board free |

Lower-level mutation commands exist, but they are operator and maintainer tools. Use them intentionally and prefer the documented lane commands and approved workflow over direct manual state manipulation.

The authoritative full command inventory lives in `context/core/project-config.md`.

## Practical Examples

### Example: start a small bounded fix

1. Run:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

2. In chat, use:

```text
/quick-task Fix the wording in docs/operator/README.md so it matches the current lane terminology.
```

3. Let the quick lane move through `quick_plan`, implementation, and QA Lite.

### Example: start feature work

1. Run:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

2. In chat, use:

```text
/delivery Add a clearer operator onboarding flow for OpenKit, including updated docs and runtime guidance.
```

3. Expect the work to move through PM, BA, Architect, Tech Lead, Fullstack, and QA stages, with artifacts created as the full lane progresses.

### Example: start migration work

1. Run:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js doctor
```

2. In chat, use:

```text
/migrate Upgrade a legacy React 16 app to React 19 and modernize the async data layer safely.
```

3. Expect the work to move through baseline capture, migration strategy, staged upgrade execution, and regression-focused verification.

### Example: resume an existing full-delivery item

Run:

```bash
node .opencode/workflow-state.js status
node .opencode/workflow-state.js show
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item feature-001
node .opencode/workflow-state.js list-tasks feature-001
```

Use the output to confirm the active stage, linked artifacts, and any task-board state before continuing.

## Wrapper Path Note

If a repository really has the managed wrapper installed, the preferred top-level path becomes:

```bash
openkit init
openkit install
openkit doctor
openkit run <args>
```

That is not the concrete operator path in this worktree today because the wrapper-owned files are not present here. In this repository, use the lower-level runtime path rooted in `.opencode/`.

## Where To Read Next

- `README.md` for the top-level runtime and product-boundary summary
- `docs/operator/README.md` for operator routing
- `context/core/workflow.md` for canonical lane rules and stage order
- `context/core/project-config.md` for the maintained command inventory
- `context/core/session-resume.md` for resume behavior
- `docs/operations/runbooks/workflow-state-smoke-tests.md` for deeper verification and manual smoke-test procedures
