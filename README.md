# OpenKit

## 1. Hero

OpenKit is an AI software factory for OpenCode.

It helps OpenCode behave more like a real software team instead of a single chat session:

- route work through the right delivery mode
- split responsibilities across specialized agents
- keep workflow state, approvals, issues, and evidence explicit
- reduce hallucinated completion claims through runtime checks and verification gates

Preferred operator lifecycle outside OpenCode: `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, then maintain global model profiles with `openkit profiles` and the kit itself with `openkit upgrade` or `openkit uninstall` when needed. If you remember one command after launch, remember this: start with `/task`.

## 2. Why OpenKit

OpenKit exists to solve common failure modes in AI-assisted software work:

- everything gets treated like the same kind of task
- agents jump into code without enough planning or validation
- completion is declared without enough evidence
- context is lost between sessions
- multi-step work has no shared state, no ownership, and no audit trail

It addresses that with:

- explicit modes for different kinds of work
- role-based handoffs between agents
- file-backed workflow state and per-item storage
- approvals, issue routing, and verification evidence
- operator and maintainer tooling for diagnostics, resume, and governance

It is now also evolving a hybrid runtime foundation under `src/runtime/` that adds:

- additive runtime config loading for project and user scopes
- a capability registry for runtime growth
- manager, tool, and hook bootstrap pipelines
- structured scan/tool evidence for review and QA gates
- supervisor dialogue primitives for OpenClaw/OpenKit advisory exchange
- a clean-room path toward MCP, background execution, categories, specialists, and recovery

## 3. Core Modes

OpenKit has 3 workflow modes.

### Quick

- for bounded, low-risk work
- keeps planning and verification lightweight
- uses the `quick_*` stages
- does not use a task board
- expected artifact trail is workflow communication plus verification evidence; a `docs/tasks/YYYY-MM-DD-<task>.md` task card is optional traceability

### Migration

- for upgrades, migrations, dependency modernization, and compatibility fixes
- preserves behavior first, then migrates safely in stages
- uses the `migration_*` stages
- validates through baseline, parity, and compatibility evidence
- expected artifact trail is a migration solution package in `docs/solution/`, baseline/parity context, and optionally a migration report or strategy-enabled migration slice board

### Full

- for feature work and higher-risk changes
- uses scope, solution, implementation, QA, and review handoffs
- uses the `full_*` stages
- can use a task board when the approved solution package allows it
- expected artifact trail is Product Lead scope in `docs/scope/` before Solution Lead design in `docs/solution/`, then implementation evidence, code review, and QA evidence in `docs/qa/`

## 4. How It Works

```text
User request
   |
   v
/task
   |
   v
Master Orchestrator chooses mode
   |
   +--> Quick ------> Quick Agent: brainstorm(3 options) -> plan -> implement -> test -> done
   |
   +--> Migration --> baseline -> strategy -> upgrade -> code review -> verify -> done
    |
   +--> Full -------> Product Lead(scope package) -> Solution Lead(solution package) -> Fullstack -> Code Reviewer -> QA -> done
   |
   v
Workflow state, approvals, issues, and evidence stored in managed workspace state and mirrored through project `.opencode/` compatibility surfaces
```

At runtime, OpenKit keeps the process explicit through:

- `.opencode/workflow-state.json` as the active compatibility mirror
- `.opencode/work-items/` as the per-item store
- `node .opencode/workflow-state.js ...` for runtime inspection and operations

## 5. Example Flow

Example: you ask OpenKit to add a new feature.

1. You launch OpenKit and start with `/task add export support to the dashboard`.
2. `Master Orchestrator` inspects the request and chooses `Full` mode.
3. `Product Lead` creates the scope package in `full_product` and gets it ready for approval.
4. `Solution Lead` uses that approved scope package in `full_solution` to create the solution package.
5. `Fullstack Agent` implements the approved work and records verification evidence.
6. `Code Reviewer` checks scope compliance first and code quality second.
7. `QA Agent` validates runtime behavior, routes any issues, and the workflow only closes when the gates are satisfied.

For a narrow bugfix, the same entrypoint may route to `Quick`.
For a framework upgrade, it may route to `Migration`.

## 6. Quick Start

### Install (macOS and Ubuntu)

OpenKit is distributed as an npm global package:

```bash
npm install -g @duypham93/openkit
```

Preferred operator path after npm install:

```bash
openkit doctor
openkit run
```

Use these lifecycle commands when maintaining the global kit:

```bash
openkit profiles --list
openkit upgrade
openkit uninstall
```

`openkit profiles` manages reusable global agent model profiles for this OpenKit installation. `openkit run` materializes the managed OpenKit kit under `OPENCODE_HOME` on first use when needed. `openkit doctor` is the non-mutating readiness check for the global install and current workspace. Do not treat repository-local `.opencode/` commands as the preferred end-user install path; they are compatibility and maintainer diagnostics.

Optional manual provisioning remains available when you intentionally need it:

```bash
openkit install --verify
```

`openkit install --verify` is a manual/compatibility helper that can:

- materialize the managed OpenKit kit under `OPENCODE_HOME`
- enable default MCP servers for OpenKit runtime tools and Chrome DevTools debugging
- install or link `ast-grep`
- install or link `semgrep`
- provision runtime dependencies used by OpenKit tooling:
  - `better-sqlite3`
  - `jscodeshift`
  - `web-tree-sitter`
  - `tree-sitter-javascript`
  - `tree-sitter-typescript`

#### 6.1 macOS setup

Prerequisites:

- Node.js >= 18 (recommended: Node 20 LTS)
- npm
- OpenCode CLI (`opencode`) available on PATH

Recommended install flow:

```bash
# 1) Verify Node/npm
node -v
npm -v

# 2) Install OpenKit globally
npm install -g @duypham93/openkit

# 3) Doctor check
openkit doctor

# 4) Launch OpenKit
openkit run
```

If `semgrep` or another managed tool is missing, run the readiness check first and follow the printed recovery step:

```bash
openkit doctor
openkit upgrade
openkit doctor
```

If native module setup fails (`better-sqlite3`):

```bash
npm install -g @duypham93/openkit
openkit doctor
openkit run
```

#### 6.2 Ubuntu / Debian setup

Prerequisites:

- Node.js >= 18 (recommended: Node 20 LTS)
- npm
- OpenCode CLI (`opencode`) available on PATH
- build tools for native modules (`better-sqlite3`): `build-essential`, `python3`

Recommended install flow:

```bash
# 1) Install system prerequisites
sudo apt update
sudo apt install -y build-essential python3 python3-pip

# 2) Verify Node/npm
node -v
npm -v

# 3) Install OpenKit globally
npm install -g @duypham93/openkit

# 4) Doctor check
openkit doctor

# 5) Launch OpenKit
openkit run
```

If `better-sqlite3` fails to build, reinstall after confirming build tools are installed:

```bash
sudo apt install -y build-essential python3
npm install -g @duypham93/openkit
openkit doctor
openkit run
```

#### 6.3 Common post-install checks (both OSes)

```bash
which openkit
which openkit-mcp
which opencode
openkit doctor
```

If doctor reports install drift or missing global-kit files:

```bash
openkit upgrade
openkit doctor
```

#### 6.4 Default browser testing/debugging MCP

OpenKit now enables Chrome DevTools MCP by default so browser testing and debugging are available out of the box.

Configured server:

- MCP id: `chrome-devtools`
- command: `npx -y chrome-devtools-mcp@0.21.0`
- enabled: `true`

This is written to both:

- repository authoring config: `.opencode/opencode.json`
- managed global profile: `OPENCODE_HOME/profiles/openkit/opencode.json`

Quick validation:

```bash
openkit doctor
openkit run
```

Then in-session, browser tools should be available for page navigation, console/network inspection, screenshots, and UI debugging flows.

### Verify setup

```bash
openkit doctor
```

### Configure per-agent models

Before you start a session you can assign different models to different OpenKit agents:

```bash
openkit configure-agent-models --interactive
```

Useful commands:

```bash
openkit configure-agent-models --list
openkit configure-agent-models --models
openkit configure-agent-models --models <provider>
openkit configure-agent-models --agent <agent-id> --model <provider/model>
openkit configure-agent-models --agent <agent-id> --model <provider/model> --variant <variant>
openkit configure-agent-models --agent <agent-id> --clear
```

Active agent ids:

- `master-orchestrator`
- `product-lead-agent`
- `solution-lead-agent`
- `fullstack-agent`
- `code-reviewer`
- `qa-agent`

Recommended flow:

1. `openkit configure-agent-models --list`
2. `openkit configure-agent-models --interactive`
3. `openkit run`

### Manage reusable global model profiles

Use `openkit profiles` when you want named, reusable model mixes across OpenKit agents instead of only the current per-agent override set:

```bash
openkit profiles --list
openkit profiles --create
openkit profiles --edit
openkit profiles --set-default
openkit profiles --delete
```

Profiles are global to the current OpenCode home (`global_cli`). `--set-default` controls the initial profile for future `openkit run` launches. Deletion is blocked when a profile is the global default or is reported active in a running OpenKit session.

Inside an active OpenKit session, use `/switch-profiles` to choose one of those existing global profiles for the current session only. `/switch-profiles` is an `in_session` command: it does not create profiles, edit profiles, delete profiles, set the global default, or intentionally affect other running sessions.

OpenKit profile checks are not target-project application validation. Record target-project app validation as unavailable unless the target project declares its own build, lint, test, smoke, or regression command.

### Configure semantic embedding search

OpenKit supports semantic code search backed by embedding vectors. When enabled, the `tool.semantic-search` tool uses embeddings instead of keyword matching.

```bash
openkit configure-embedding --interactive
```

Useful commands:

```bash
openkit configure-embedding --list
openkit configure-embedding --provider openai --model openai/text-embedding-3-small --enable
openkit configure-embedding --provider ollama --model ollama/nomic-embed-text --dimensions 768 --enable
openkit configure-embedding --provider custom --model my-model --base-url https://my-api.example.com/v1 --enable
openkit configure-embedding --disable
openkit configure-embedding --clear
```

Supported providers:

| Provider | Notes |
|---|---|
| `openai` | Requires `OPENAI_API_KEY` env var or `--api-key`. Default model: `text-embedding-3-small` (1536 dims). |
| `ollama` | Local server, no API key needed. Default URL: `http://localhost:11434`. Default model: `nomic-embed-text` (768 dims). |
| `custom` | Any OpenAI-compatible endpoint. Requires `--base-url`. |

Recommended flow:

1. `openkit configure-embedding --interactive`
2. `openkit run`
3. Inside the session, run `tool.embedding-index` with `action: index-project` to index the codebase.

Config is written to `.opencode/openkit.runtime.jsonc` in the project root. Restart `openkit run` to pick up changes. When embedding is disabled the semantic search tool falls back to keyword search automatically.

### Launch OpenCode with OpenKit

```bash
openkit run
```

Path model during managed launch:

- kit/config root: `OPENCODE_HOME/kits/openkit`
- workspace runtime state: `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode`
- project compatibility shim: `projectRoot/.opencode`

Treat those as different layers. `openkit run` uses the managed global kit plus the derived workspace state. The checked-in project `.opencode/` path remains a compatibility surface, not the default source of truth for managed runtime state.

### Start work

Inside OpenCode:

```text
/task <your request>
```

Use `/quick-task`, `/migrate`, or `/delivery` only when the lane is already obvious.

If workflow state already exists, these are the fastest runtime views:

```bash
node .opencode/workflow-state.js ops-summary
node .opencode/workflow-state.js resume-summary
node .opencode/workflow-state.js status --short
```

## 7. Concepts

### Orchestrator

`Master Orchestrator` is the delivery router.

It chooses the mode when `/task` is used, records state, controls handoffs and gates, tracks feedback loops, and keeps work moving through the right workflow.

It does not code, define scope, design the solution, perform review, or make QA judgment. It is a procedural controller: route, dispatch, record, reroute, and close the loop only after the owning role has produced the required evidence.

### Agents

OpenKit currently ships active orchestration and delivery roles plus compatibility split-role views:

1. **Master Orchestrator**: chooses the mode, routes handoffs, manages feedback loops, and never performs code or artifact-authoring work itself
2. **Product Lead**: defines scope, business rules, acceptance criteria, and the scope package for full delivery
3. **Solution Lead**: defines technical direction, migration strategy, sequencing, validation expectations, and the solution package that depends on the approved scope package
4. **Fullstack Agent**: implements, debugs, and verifies approved work
5. **Code Reviewer**: performs independent scope-compliance and code-quality review before QA
6. **QA Agent**: validates implementation evidence and classifies issues

### Workflow State

Workflow state is the shared runtime memory of the system.

It tracks things like:

- current mode and stage
- current owner
- linked artifacts
- approvals
- issues and issue lifecycle
- verification evidence
- readiness, closeout, and release-level signals

### Approvals And Evidence

OpenKit separates:

- stage readiness
- definition of done
- release readiness

Approvals alone are not enough for closure-sensitive stages. Verification evidence must also be inspectable in workflow state.

## 8. Advanced

### Product vs Compatibility Surfaces

OpenKit has 3 main surfaces:

- product path (`global_cli`): `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit profiles`, `openkit upgrade`, `openkit uninstall`
- in-session path (`in_session`): `/task`, `/quick-task`, `/migrate`, `/delivery`, `/switch-profiles`
- compatibility runtime path (`compatibility_runtime`): `node .opencode/workflow-state.js ...`

Use the product path for daily use. Use the lower-level runtime CLI for inspection, diagnostics, and maintainer workflows.

Validation evidence should name the surface it validates: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, or `target_project_app`. OpenKit runtime checks validate OpenKit surfaces; they do not prove target application build, lint, or test behavior unless the target project defines those commands.

### Hybrid Runtime Foundation

OpenKit now includes the first phase of a hybrid runtime foundation:

- `src/runtime/index.js`: bootstrap entrypoint for runtime config, capabilities, managers, tools, and hooks
- `src/runtime/runtime-config-loader.js`: project and user runtime config loader with JSONC support
- `src/runtime/capability-registry.js`: current and planned runtime capability inventory
- `docs/architecture/2026-03-hybrid-runtime-rfc.md`: architecture source of truth for the runtime expansion program

The runtime foundation now also includes thin but real surfaces for:

- manager lifecycle under `src/runtime/managers/`
- MCP bootstrap under `src/runtime/mcp/`
- categories and specialist registries under `src/runtime/categories/` and `src/runtime/specialists/`
- model routing diagnostics under `src/runtime/models/`
- skill and command loaders under `src/runtime/skills/` and `src/runtime/commands/`
- context injection under `src/runtime/context/`
- hook composition and recovery scaffolding under `src/runtime/hooks/` and `src/runtime/recovery/`

The current runtime config path also supports:

- category and specialist model overrides through `.opencode/openkit.runtime.jsonc`
- `fallback_models` chains for categories and specialists
- automatic fallback activation after repeated model failures through `modelExecution.autoFallback` and agent `auto_fallback`
- two agent model profiles for quick provider switching, useful when the same model family is available from multiple providers
- global named agent model profiles through `openkit profiles`, plus current-session selection through `/switch-profiles`
- `file://` prompt references for agent prompts and category prompt appends
- model-resolution trace visibility in doctor/runtime diagnostics

This foundation is additive. The canonical workflow contract still lives in `context/core/workflow.md` and `.opencode/workflow-state.js` remains the explicit state surface.

### Model Overrides

Per-agent model overrides and named agent model profiles are saved by the global OpenKit install and reused by future `openkit run` sessions. `openkit profiles --set-default` sets the launch default; `/switch-profiles` writes only current-session selection state.

Current limitation: `/switch-profiles` refreshes OpenKit runtime model-resolution read models and persisted current-session selection for subsequent runtime resolution paths. It cannot retroactively change prompts, model choices, or background work that were already dispatched before the switch.

Global install behavior: OpenKit now provisions `ast-grep` into its managed global tooling path by default and prepends that tooling bin directory during `openkit run`, so AST tooling is available without requiring a separate manual install in the common case.

Current AST tooling scope: the runtime surfaces expose structural-search metadata and preview-first replacement semantics, but the checked-in AST tools still operate on JSON and JSONC documents today. They must report degraded or fallback status honestly when broader language-aware structural search is not yet active.

Syntax parsing scope: OpenKit now exposes a Tree-sitter-backed syntax layer for JavaScript-family files (`.js`, `.jsx`, `.cjs`, `.mjs`) so agents can request file outlines, locate node types, and inspect nearest structure around a position without reading full files blindly.

Use them when you want different strengths per role, for example:

- a stronger reasoning model for `product-lead-agent` and `solution-lead-agent`
- a code-focused model for `fullstack-agent`
- a careful review-oriented model for `code-reviewer`
- a verification-oriented model for `qa-agent`

Use `openkit configure-agent-models --list` any time you want to inspect or confirm the current saved overrides. Use `openkit profiles --list` to inspect reusable global profiles and their default marker.

### Useful Runtime Commands

Some high-value runtime commands:

- `node .opencode/workflow-state.js resume-summary`
- `node .opencode/workflow-state.js workflow-metrics`
- `node .opencode/workflow-state.js show-dod`
- `node .opencode/workflow-state.js release-readiness`
- `node .opencode/workflow-state.js release-dashboard`
- `node .opencode/workflow-state.js policy-trace`

### Release Workflow

OpenKit now supports release-level governance through:

- release candidates
- release notes drafting and validation
- release gates
- rollback plans
- release-linked hotfixes

### Supervisor Dialogue And Scan Evidence

OpenKit now includes runtime support for a guarded OpenClaw supervisor dialogue path:

- OpenKit emits audit-oriented supervisor events after successful workflow authority writes.
- OpenClaw can acknowledge, propose, raise concerns, or request attention through advisory inbound records.
- OpenClaw cannot execute code, mutate workflow state, approve gates, update tasks, record evidence, close issues, or mark QA done.
- Supervisor dialogue defaults to disabled/unconfigured and degrades without blocking normal OpenKit workflow progress.
- Status and resume surfaces expose supervisor health, delivery counts, inbound dispositions, rejected authority-boundary requests, duplicates, concerns, and attention signals.

Review and QA flows also use structured scan/tool evidence:

- `tool.rule-scan` and `tool.security-scan` results, substitutes, or manual caveats must be classified explicitly.
- High-volume scan output is summarized with artifact references instead of being treated as silent success.
- Target-project application validation remains separate from OpenKit runtime, compatibility runtime, documentation, and global CLI validation.

### Where To Go Next

- operator path: `docs/operator/README.md`
- surface selection: `docs/operator/surface-contract.md`
- maintainer path: `docs/maintainer/README.md`
- command map: `docs/maintainer/command-matrix.md`
- workflow contract: `context/core/workflow.md`
- runtime command reality: `context/core/project-config.md`
- session resume: `context/core/session-resume.md`
- workflow-state schema: `context/core/workflow-state-schema.md`
- operations runbooks: `docs/operations/README.md`
