# OpenKit

OpenKit is an AI software factory for OpenCode.

It helps OpenCode behave more like a real software team instead of a single chat session:

- route work through the right delivery mode
- split responsibilities across specialized agents
- keep workflow state, approvals, issues, and evidence explicit
- reduce hallucinated completion claims through runtime checks and verification gates

If you are new, start here: install the global CLI, run the doctor check, launch OpenKit, then use `/task` inside OpenCode.

## Install

OpenKit is distributed as the npm package `@duypham93/openkit`.

Prerequisites:

- Node.js >= 18, with Node 20 LTS recommended
- npm
- OpenCode CLI (`opencode`) available on `PATH`
- Ubuntu/Debian only: build tools for native modules such as `better-sqlite3` (`build-essential`, `python3`)

First-time install flow:

```bash
npm install -g @duypham93/openkit
openkit doctor
openkit run
```

What each command does:

- `npm install -g @duypham93/openkit` installs the global npm CLI package that provides the `openkit` command.
- `openkit doctor` checks global OpenKit readiness and the current workspace bootstrap.
- `openkit run` launches OpenCode with the OpenKit-managed config and performs first-time managed-kit setup when needed.

Explicit setup and verification flow:

```bash
openkit install
openkit install --verify
```

`openkit install` is the explicit setup path for materializing the global managed kit and provisioning runtime tooling. `openkit install --verify` runs that setup path plus post-install verification. Most users should still begin with `npm install -g @duypham93/openkit`, `openkit doctor`, and `openkit run`; use `openkit install --verify` when you intentionally want an explicit setup and verification pass.

## Upgrade

Use both the npm package update and OpenKit managed-kit refresh when you want the latest global OpenKit installation:

```bash
npm install -g @duypham93/openkit@latest
openkit upgrade
openkit doctor
```

Update responsibilities are split on purpose:

- `npm install -g @duypham93/openkit@latest` updates the global npm CLI package.
- `openkit upgrade` refreshes the managed OpenKit kit under `OPENCODE_HOME`.
- `openkit doctor` checks readiness after the package and managed kit are refreshed.

Use the global `openkit` CLI for product lifecycle updates. Do not use repository-local workflow-state commands as a substitute for updating the global package or the managed kit.

## Verify

Primary readiness check:

```bash
openkit doctor
```

Explicit setup plus post-install verification:

```bash
openkit install --verify
```

Common post-install checks:

```bash
which openkit
which openkit-mcp
which opencode
openkit doctor
```

OpenKit checks validate OpenKit surfaces such as `global_cli`, `compatibility_runtime`, `runtime_tooling`, `documentation`, and `package` depending on the command. They do not prove a target project's application build, lint, or test behavior unless that target project defines app-native commands.

## Start OpenKit

Launch OpenCode with OpenKit:

```bash
openkit run
```

Path model during managed launch:

- kit/config root: `OPENCODE_HOME/kits/openkit`
- workspace runtime state: `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode`
- project compatibility shim: `projectRoot/.opencode`

Treat those as different layers. `openkit run` uses the managed global kit plus the derived workspace state. The checked-in project `.opencode/` path remains a compatibility surface, not the default source of truth for managed runtime state.

After launch, start most work with:

```text
/task <your request>
```

Use `/quick-task`, `/migrate`, or `/delivery` only when the lane is already obvious.

## Daily commands

High-value global CLI commands for regular operators:

```bash
openkit help
openkit onboard
openkit doctor
openkit run
openkit profiles --list
openkit configure mcp --interactive
openkit upgrade
openkit uninstall
```

Current global CLI commands shown by `openkit help`:

| Command | Primary use |
| --- | --- |
| `openkit help` | Show CLI help. |
| `openkit install-global` | Manual global setup command; manual/compatibility helper, not the primary onboarding path. |
| `openkit init` | Manual/compatibility helper alias for `install-global`; not the primary onboarding path. |
| `openkit install` | Explicitly install the global kit and provision runtime tooling. Use `openkit install --verify` for setup plus post-install verification. |
| `openkit run` | Launch OpenCode and perform first-time setup if needed. |
| `openkit upgrade` | Refresh the global OpenKit managed kit under `OPENCODE_HOME`. |
| `openkit uninstall` | Remove the global OpenKit install; use documented options when intentionally removing workspace state. |
| `openkit doctor` | Inspect global OpenKit and workspace readiness. |
| `openkit onboard` | Explain the safest first-run path and command choices. |
| `openkit configure` | Configure OpenKit product surfaces such as bundled MCPs. |
| `openkit configure-agent-models` | Configure provider-specific models per OpenKit agent. |
| `openkit profiles` | Manage reusable global agent model profiles. |
| `openkit release` | Maintainer-only release preparation, verification, and publishing workflow. |

Maintainers can inspect command details with `openkit <command> --help` before changing docs or release processes.

## Agent model profiles

OpenKit has two related model-configuration surfaces.

### Reusable global profiles

Use `openkit profiles` when you want named, reusable model mixes across OpenKit agents:

```bash
openkit profiles --create
openkit profiles --edit
openkit profiles --list
openkit profiles --delete
openkit profiles --set-default
```

Profiles are global to the current OpenCode home (`global_cli`). `openkit profiles --set-default` controls the initial profile for future `openkit run` launches. Deletion is blocked when a profile is the global default or is reported active in a running OpenKit session.

Inside an active OpenKit runtime session, use `openkit switch-profiles` or its short alias `openkit switch` to choose one of those existing global profiles for the current session only. The CLI requires `OPENKIT_RUNTIME_SESSION_ID`, fails closed outside an active OpenKit runtime session, and does not create profiles, edit profiles, delete profiles, set the global default, or intentionally affect other running sessions.

The `/switch-profiles` slash command is kept as an in-session prompt template for the same current-session profile switch. OpenCode custom slash command files are prompt templates; true native executable slash command support is not currently documented, so `/switch-profiles` may be agent-mediated and should not be described as a guaranteed native command runner.

### Per-agent model overrides

Use `openkit configure-agent-models` when you want to inspect or assign provider-specific models per OpenKit agent:

```bash
openkit configure-agent-models --list
openkit configure-agent-models --interactive
openkit configure-agent-models --models
openkit configure-agent-models --models <provider>
openkit configure-agent-models --models <provider> --refresh
openkit configure-agent-models --models <provider> --refresh --verbose
openkit configure-agent-models --agent <agent-id> --model <provider/model>
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
2. `openkit configure-agent-models --models`
3. `openkit configure-agent-models --interactive`
4. `openkit run`

OpenKit profile and model checks are not target-project application validation.

## MCP config

Start with the guided MCP setup wizard:

```bash
openkit configure mcp --interactive
```

The MCP configuration surface supports bundled MCP visibility, readiness checks, enable/disable actions, secret placeholder management, repair, and testing:

```bash
openkit configure mcp list
openkit configure mcp doctor
openkit configure mcp enable <mcp-id>
openkit configure mcp disable <mcp-id>
openkit configure mcp set-key <mcp-id> --stdin
openkit configure mcp unset-key <mcp-id>
openkit configure mcp list-key <mcp-id>
openkit configure mcp copy-key <mcp-id>
openkit configure mcp repair <mcp-id>
openkit configure mcp test <mcp-id>
```

Representative custom MCP commands:

```bash
openkit configure mcp custom list
openkit configure mcp custom add-local <custom-id> --cmd <executable> --arg <arg>
openkit configure mcp custom add-remote <custom-id> --url <url> --transport http
openkit configure mcp custom import-global <global-id> --as <custom-id>
openkit configure mcp custom disable <custom-id>
openkit configure mcp custom remove <custom-id>
openkit configure mcp custom doctor [<custom-id>]
openkit configure mcp custom test <custom-id>
```

Custom MCP definitions are OpenKit-managed, separate from the bundled catalog, and materialize placeholder-only config. Avoid putting raw secrets in command arguments or config files; prefer `--stdin` or environment-backed placeholders where supported.

OpenKit enables Chrome DevTools MCP by default so browser testing and debugging tools are available out of the box when the surrounding environment can run them.

Configured server:

- MCP id: `chrome-devtools`
- command: `npx -y chrome-devtools-mcp@0.21.0`
- enabled: `true`

Then in-session, browser tools should be available for page navigation, console/network inspection, screenshots, and UI debugging flows.

## In-session commands

Use these slash commands inside an active `openkit run` session:

| Command | Use |
| --- | --- |
| `/task <request>` | Default entrypoint. Master Orchestrator chooses the right lane. |
| `/quick-task <request>` | Explicit quick lane for narrow, low-risk work. |
| `/migrate <request>` | Explicit migration lane for upgrades, dependency modernization, and compatibility remediation. |
| `/delivery <request>` | Explicit full-delivery lane for feature work or higher-risk changes. |
| `/brainstorm <topic>` | Structured brainstorming before scope, solution, or implementation work. |
| `/write-solution <request>` | Create or refine a solution package from approved scope or migration context. |
| `/execute-solution <request>` | Execute approved solution work through the implementation path. |
| `/switch-profiles` | Agent-mediated prompt template for switching to an existing global agent model profile for the current session only. Direct CLI picker: `openkit switch-profiles` or `openkit switch`. |

Lane-lock note: when you explicitly use `/quick-task`, `/migrate`, or `/delivery`, OpenKit honors that lane choice unless you authorize a lane change after a reported blocker.

## Troubleshooting and update notes

If `openkit doctor` reports install drift or missing managed-kit files:

```bash
openkit upgrade
openkit doctor
```

If the global CLI itself is stale, update the npm package first:

```bash
npm install -g @duypham93/openkit@latest
openkit upgrade
openkit doctor
```

If you want an explicit setup and verification pass:

```bash
openkit install
openkit install --verify
```

Use this distinction when troubleshooting updates:

- `npm install -g @duypham93/openkit@latest` updates the global npm CLI package.
- `openkit upgrade` refreshes the managed kit under `OPENCODE_HOME`.
- `openkit install --verify` is explicit setup plus post-install verification.
- `openkit doctor` checks readiness; it is the safest first diagnostic command.
- `openkit install-global` and `openkit init` remain manual/compatibility aliases, not the primary path for new users.

Platform notes:

- macOS: confirm Node/npm and `opencode` are on `PATH`, then use the first-time install flow.
- Ubuntu/Debian: install build tools before setup when native modules fail: `sudo apt install -y build-essential python3`.
- If `better-sqlite3`, `ast-grep`, or `semgrep` readiness is reported as missing, run `openkit doctor`, follow the printed recovery step, then rerun `openkit doctor`.

There is currently no repo-native target-project application build, lint, or test command documented by OpenKit itself. Do not treat OpenKit runtime, CLI, workflow-state, or MCP checks as target application validation.

## Why OpenKit

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

## Core modes

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

## How it works

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

## Example flow

Example: you ask OpenKit to add a new feature.

1. You launch OpenKit and start with `/task add export support to the dashboard`.
2. `Master Orchestrator` inspects the request and chooses `Full` mode.
3. `Product Lead` creates the scope package in `full_product` and gets it ready for approval.
4. `Solution Lead` uses that approved scope package in `full_solution` to create the solution package.
5. `Fullstack Agent` implements the approved work and records verification evidence.
6. `Code Reviewer` checks scope compliance first and code quality second.
7. `QA Agent` validates runtime behavior, routes any issues, and the workflow only closes when the gates are satisfied.

For a narrow bugfix, the same entrypoint may route to `Quick`. For a framework upgrade, it may route to `Migration`.

## Concepts

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

### Workflow state

Workflow state is the shared runtime memory of the system.

It tracks things like:

- current mode and stage
- current owner
- linked artifacts
- approvals
- issues and issue lifecycle
- verification evidence
- readiness, closeout, and release-level signals

### Approvals and evidence

OpenKit separates:

- stage readiness
- definition of done
- release readiness

Approvals alone are not enough for closure-sensitive stages. Verification evidence must also be inspectable in workflow state.

## Advanced

### Product vs compatibility surfaces

OpenKit has 3 main operator-facing surfaces:

- product path (`global_cli`): `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit profiles`, `openkit switch-profiles`, `openkit switch`, `openkit upgrade`, `openkit uninstall`
- in-session path (`in_session`): `/task`, `/quick-task`, `/migrate`, `/delivery`, `/brainstorm`, `/write-solution`, `/execute-solution`, `/switch-profiles`
- compatibility runtime path (`compatibility_runtime`): `node .opencode/workflow-state.js ...`

Use the product path for daily use. Use the lower-level runtime CLI for inspection, diagnostics, and maintainer workflows.

Validation evidence should name the surface it validates: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, `package`, or `target_project_app`. OpenKit runtime checks validate OpenKit surfaces; they do not prove target application build, lint, or test behavior unless the target project defines those commands.

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
| --- | --- |
| `openai` | Requires `OPENAI_API_KEY` env var or `--api-key`. Default model: `text-embedding-3-small` with 1536 dimensions. |
| `ollama` | Local server, no API key needed. Default URL: `http://localhost:11434`. Default model: `nomic-embed-text` with 768 dimensions. |
| `custom` | Any OpenAI-compatible endpoint. Requires `--base-url`. |

Recommended flow:

1. `openkit configure-embedding --interactive`
2. `openkit run`
3. Inside the session, run `tool.embedding-index` with `action: index-project` to index the codebase.

Config is written to `.opencode/openkit.runtime.jsonc` in the project root. Restart `openkit run` to pick up changes. When embedding is disabled, the semantic search tool falls back to keyword search automatically.

### Hybrid runtime foundation

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
- global named agent model profiles through `openkit profiles`, plus current-session selection through `openkit switch-profiles`, `openkit switch`, or the `/switch-profiles` prompt template inside a session
- `file://` prompt references for agent prompts and category prompt appends
- model-resolution trace visibility in doctor/runtime diagnostics

This foundation is additive. The canonical workflow contract still lives in `context/core/workflow.md` and `.opencode/workflow-state.js` remains the explicit state surface.

### Model override notes

Per-agent model overrides and named agent model profiles are saved by the global OpenKit install and reused by future `openkit run` sessions. `openkit profiles --set-default` sets the launch default; `openkit switch-profiles`, `openkit switch`, and `/switch-profiles` write only current-session selection state.

Current limitation: current-session profile switching refreshes OpenKit runtime model-resolution read models and persisted current-session selection for subsequent runtime resolution paths. It cannot retroactively change prompts, model choices, or background work that were already dispatched before the switch.

Use model overrides when you want different strengths per role, for example:

- a stronger reasoning model for `product-lead-agent` and `solution-lead-agent`
- a code-focused model for `fullstack-agent`
- a careful review-oriented model for `code-reviewer`
- a verification-oriented model for `qa-agent`

Use `openkit configure-agent-models --list` any time you want to inspect or confirm the current saved overrides. Use `openkit profiles --list` to inspect reusable global profiles and their default marker.

### Runtime tooling notes

Global install behavior: OpenKit provisions `ast-grep` into its managed global tooling path by default and prepends that tooling bin directory during `openkit run`, so AST tooling is available without requiring a separate manual install in the common case.

Current AST tooling scope: runtime surfaces expose structural-search metadata and preview-first replacement semantics. They must report degraded or fallback status honestly when broader language-aware structural search is not active.

Syntax parsing scope: OpenKit exposes a Tree-sitter-backed syntax layer for JavaScript-family files (`.js`, `.jsx`, `.cjs`, `.mjs`) so agents can request file outlines, locate node types, and inspect nearest structure around a position without reading full files blindly.

### Useful runtime commands

Some high-value compatibility runtime commands:

```bash
node .opencode/workflow-state.js ops-summary
node .opencode/workflow-state.js resume-summary
node .opencode/workflow-state.js status --short
node .opencode/workflow-state.js workflow-metrics
node .opencode/workflow-state.js show-dod
node .opencode/workflow-state.js release-readiness
node .opencode/workflow-state.js release-dashboard
node .opencode/workflow-state.js policy-trace
```

These commands inspect OpenKit workflow/runtime state. They do not update the global npm package, refresh the managed kit under `OPENCODE_HOME`, or validate target-project app behavior.

### Release workflow

`openkit release` is maintainer-only. It supports release-level governance through:

- release preparation
- release metadata verification
- optional full test-suite verification
- npm publishing
- optional GitHub release creation

Current release subcommands:

```bash
openkit release prepare <version> --summary "<text>"
openkit release verify
openkit release publish
```

Do not run release publishing commands unless you are intentionally performing a maintainer release.

### Supervisor dialogue and scan evidence

OpenKit includes runtime support for a guarded OpenClaw supervisor dialogue path:

- OpenKit emits audit-oriented supervisor events after successful workflow authority writes.
- OpenClaw can acknowledge, propose, raise concerns, or request attention through advisory inbound records.
- OpenClaw cannot execute code, mutate workflow state, approve gates, update tasks, record evidence, close issues, or mark QA done.
- Supervisor dialogue defaults to disabled/unconfigured and degrades without blocking normal OpenKit workflow progress.
- Status and resume surfaces expose supervisor health, delivery counts, inbound dispositions, rejected authority-boundary requests, duplicates, concerns, and attention signals.

Review and QA flows also use structured scan/tool evidence:

- `tool.rule-scan` and `tool.security-scan` results, substitutes, or manual caveats must be classified explicitly.
- High-volume scan output is summarized with artifact references instead of being treated as silent success.
- Target-project application validation remains separate from OpenKit runtime, compatibility runtime, documentation, and global CLI validation.

### Where to go next

- operator path: `docs/operator/README.md`
- surface selection: `docs/operator/surface-contract.md`
- maintainer path: `docs/maintainer/README.md`
- command map: `docs/maintainer/command-matrix.md`
- workflow contract: `context/core/workflow.md`
- runtime command reality: `context/core/project-config.md`
- session resume: `context/core/session-resume.md`
- workflow-state schema: `context/core/workflow-state-schema.md`
- operations runbooks: `docs/operations/README.md`
