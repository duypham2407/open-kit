# OpenKit Daily Usage

Use this runbook when you want the practical step-by-step path for working with the globally installed OpenKit kit and its workspace-specific runtime state.

## Current Reality In This Repository

- The preferred operator path is now the global OpenKit install under the OpenCode home directory.
- OpenKit workspace state is created per project in global storage instead of requiring the kit to be copied into each repository.
- The checked-in `.opencode/` runtime in this repository remains the authoring and compatibility surface.
- The workflow supports three live modes: `quick`, `migration`, and `full`.
- `Quick Task+` is the current semantics of the `quick` lane, not a third mode.
- There is no repo-native application build, lint, or test command yet, so verification must use the real runtime checks plus honest manual or artifact-based validation.

## Fast Path

For normal day-to-day use on a machine with OpenKit installed globally:

```bash
npm install -g @duypham93/openkit
openkit run
openkit doctor
```

Lifecycle commands:

```bash
openkit upgrade
openkit uninstall
```

Then start work from the chat surface with one of these:

- `/task` when you want the Master Orchestrator to choose the lane
- `/quick-task` when the work is already clearly small, bounded, and low risk
- `/migrate` when the work is primarily an upgrade or migration effort
- `/delivery` when the work clearly needs the full multi-stage delivery flow
- `/configure-agent-models` when you want to bind exact provider-qualified models to OpenKit agents
- `/browser-verify` when acceptance depends on UI flows, browser evidence, or page behavior

If you need to inspect the current state more closely inside this repository's compatibility runtime:

```bash
node .opencode/workflow-state.js show
node .opencode/workflow-state.js validate
```

## Path Model

Treat these paths as distinct on purpose:

- global kit root: `OPENCODE_HOME/kits/openkit`
- workspace state root: `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode`
- project compatibility shim: `projectRoot/.opencode`

What each one means:

- the global kit root holds the managed OpenKit kit, runtime helpers, commands, skills, and hooks used by `openkit run`
- the workspace state root holds the active workflow state and other managed runtime files for the current project
- the project compatibility shim exists so checked-in runtime commands like `node .opencode/workflow-state.js ...` still work, but it is not the default source of truth for managed runtime state

Practical rule:

- treat `OPENKIT_KIT_ROOT` as the canonical config and kit path
- treat `OPENKIT_WORKFLOW_STATE` as the canonical workflow-state path
- treat `OPENKIT_PROJECT_ROOT` as the repository you are working on
- do not assume `projectRoot/.opencode/workflow-state.json` is the primary runtime state just because it exists

When paths look inconsistent, run `openkit doctor` first. It now prints the global kit root, workspace root, workspace state path, compatibility shim root, and workspace shim root explicitly.

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
- you need scope packages, solution packages, architecture, or QA artifacts

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

If role boundaries feel fuzzy after lane selection, use `docs/maintainer/2026-03-26-role-operating-policy.md` as the short-form policy for who owns scope, solution, code review, and runtime verification.

## Daily Operator Flow

### 1. Check global install and workspace health

Start with non-mutating checks:

```bash
openkit doctor
```

What to look for:

- `doctor` confirms the global kit is installed, shows the derived workspace root, workspace state path, and compatibility shim locations, and reports whether the current project can launch with OpenKit cleanly without mutating local workspace files

If `doctor` reports `install-missing`, run `openkit run` for first-time setup. If `doctor` reports other errors, fix those before trusting resume or task-board behavior.

### 2. Launch OpenKit for the current project

```bash
openkit run
```

This launches OpenCode with the `openkit` profile and injects the workspace-specific OpenKit environment for the current project.

On the first run on a machine or a fresh OpenCode home, `openkit run` also materializes the managed global kit automatically.

Do not expect `openkit run` to use the checked-in project `.opencode/` directory as its only runtime source. The managed launch path reads kit assets from the global kit root and runtime state from the derived workspace state path, while leaving the project `.opencode/` surface available as a compatibility layer.

### Optional: configure per-agent models before launch

If you want different models for different OpenKit agents, inspect the exact provider-qualified model ids that OpenCode currently knows about:

```bash
openkit configure-agent-models --interactive
openkit configure-agent-models --models
openkit configure-agent-models --models openai --refresh
openkit configure-agent-models --list
openkit configure-agent-models --agent qa-agent --model openai/gpt-5
```

Use this flow when the same model family exists under multiple providers and you need an exact `provider/model` choice.

The interactive flow now supports numbered provider and model pickers, so you do not need to remember the exact provider/model id up front.

If `opencode models --verbose` exposes variants for the selected model, the interactive flow will also offer a numbered variant picker before saving the override.

If verbose discovery is unavailable, OpenKit falls back to plain provider/model selection so setup can still continue without variant metadata.

### 3. Start or resume work

If no work is active, start from chat with `/task`, `/quick-task`, or `/delivery`.

If work already exists, inspect it first:

```bash
node .opencode/workflow-state.js show
node .opencode/workflow-state.js list-work-items
node .opencode/workflow-state.js show-work-item <work_item_id>
```

Use `show` when you want the raw active state, linked artifacts, approvals, and open issues.

Use `list-work-items` and `show-work-item` when you need to understand which managed item is active or switch your attention to a different full-delivery item.

### 4. Follow the lane that was chosen

Quick lane flow:

- `quick_intake -> quick_plan -> quick_build -> quick_verify -> quick_done`
- use it for bounded daily work
- `quick_plan` is required, even though a separate task card in `docs/tasks/` remains optional
- QA still happens through the quick verification step; quick does not bypass quality

Full-delivery flow:

- `full_intake -> full_product -> full_solution -> full_implementation -> full_code_review -> full_qa -> full_done`
- use it for feature work and higher-risk changes
- expect explicit artifacts under `docs/scope/`, `docs/architecture/`, `docs/solution/`, and `docs/qa/`
- use `/brainstorm`, `/write-solution`, and `/execute-solution` only in this lane

Migration flow:

- `migration_intake -> migration_baseline -> migration_strategy -> migration_upgrade -> migration_code_review -> migration_verify -> migration_done`
- use it for framework upgrades, dependency modernization, and compatibility remediation
- expect explicit baseline, migration solution package, and parity context before major edits
- preserve behavior first, decouple only the blockers that make the migration unsafe, then upgrade in slices
- use `/brainstorm`, `/write-solution`, and `/execute-solution` in this lane when strategy or staged execution is needed
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

### Example: verify a browser-dependent change

1. Run:

```bash
openkit doctor
```

2. In chat, use:

```text
/browser-verify Validate the updated onboarding flow in the browser and capture the evidence needed for QA.
```

3. Use the resulting browser checklist and evidence notes to support explicit QA verification.

## Global Kit Note

The preferred top-level path is now:

```bash
npm install -g @duypham93/openkit
openkit run <args>
openkit doctor
openkit upgrade
openkit uninstall
```

`openkit install-global` still exists as a manual or compatibility setup command, but it is no longer the preferred onboarding step.

Use the lower-level `.opencode/` runtime commands in this repository when you are validating or maintaining the checked-in compatibility runtime itself.

If an agent or operator reports a missing path or runtime file, check which layer they actually mean before changing anything:

- missing under `OPENCODE_HOME/kits/openkit` usually means a global install or upgrade problem
- missing under `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode` usually means a workspace runtime-state problem
- missing under `projectRoot/.opencode` may only mean the compatibility shim is stale or incomplete, not that the managed workspace state is gone

## Where To Read Next

- `README.md` for the top-level runtime and product-boundary summary
- `docs/operator/README.md` for operator routing
- `context/core/workflow.md` for canonical lane rules and stage order
- `context/core/project-config.md` for the maintained command inventory
- `context/core/session-resume.md` for resume behavior
- `docs/operations/runbooks/workflow-state-smoke-tests.md` for deeper verification and manual smoke-test procedures
