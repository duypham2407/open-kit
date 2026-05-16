# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What OpenKit Is

OpenKit is an **AI software factory for OpenCode** distributed as the npm package `@duypham93/openkit`. It implements mode-aware workflow orchestration so OpenCode behaves like a real software team: routing work through delivery modes, splitting responsibilities across specialized agents, keeping workflow state/approvals/issues/evidence explicit, and reducing hallucinated completion claims through verification gates.

The repository is **the kit itself** — there is no application code being delivered here. All OpenKit verification scripts validate OpenKit surfaces (`global_cli`, `compatibility_runtime`, `runtime_tooling`, `documentation`, `package`); they do **not** validate target-project build/lint/test behavior.

## Source-of-Truth Order

When deciding what is authoritative, use this order:

1. Direct user instructions in current session
2. Root `AGENTS.md` (the canonical agent guide — read this before making non-trivial changes)
3. `src/context/core/workflow.md` (canonical live workflow contract)
4. Companion core docs: `approval-gates.md`, `issue-routing.md`, `session-resume.md`, `project-config.md`, `workflow-state-schema.md`, `lane-selection.md`, `tool-substitution-rules.md`, `runtime-surfaces.md`
5. Repository files that actually exist in the working tree

If guidance conflicts with repository state, trust the repository state and update docs rather than inventing missing pieces.

## Commands

### Daily Verification

```bash
# Full verification (the gate run before release)
npm run verify:all

# Targeted suites
npm run verify:install-bundle              # Install manifest integrity
npm run verify:mcp-secret-package-readiness  # npm pack dry-run + MCP secret readiness
npm run verify:runtime-foundation          # Runtime config loader, capability registry, bootstrap
npm run verify:governance                  # Governance, registry metadata, workflow-contract consistency
npm run verify:semgrep-quality             # Bundled Semgrep quality rule-pack regression
npm run verify:sessions                    # Sessions, dashboard, finish, banner
npm run verify:audit-wave-1                # Version metadata, FSM table, ast-grep injection, MCP contract

# Single test file (Node's built-in test runner)
node --test src/tests/runtime/runtime-bootstrap.test.js
node --test src/tests/cli/sessions-cli.test.js
node --test src/openkit-runtime/tests/workflow-state-cli.test.js
```

Tests use **Node's native test runner** (`node --test`), not Jest/Mocha/Vitest. There is no transpiler step — source files are ES modules (`"type": "module"`).

### Sync Generated Metadata

```bash
npm run sync:version          # Mirrors package.json#version into package-lock.json, registry.json, install-manifest.json
npm run sync:install-bundle   # Refreshes bundled skill manifest
```

`package.json#version` is the canonical authored version. Always run `sync:version` after a version bump and verify with `verify:install-bundle`.

### Global CLI (End-User Surface)

```bash
# Installation and setup
npm install -g @duypham93/openkit
openkit doctor                          # Readiness check (fastest first diagnostic)
openkit doctor --diagnostics            # Detailed diagnostics
openkit install --verify                # Explicit setup + post-install verification
openkit run                             # Launch OpenCode with OpenKit

# Configuration
openkit profiles --list                 # Reusable global agent model profiles
openkit profiles --create               # Create profile
openkit profiles --set-default          # Default for future `openkit run`
openkit switch-profiles                 # Current-session-only profile switch (alias: openkit switch)
openkit configure-agent-models --list   # Per-agent model overrides
openkit configure mcp --interactive     # Guided MCP setup wizard
openkit configure-embedding --interactive  # Semantic search provider

# Sessions (v0.7.0+ multi-session)
openkit sessions list                   # active + orphan by default
openkit sessions show <session_id>
openkit sessions resume <session_id>    # Re-attach orphan/closed; emits shell exports
openkit sessions abandon <session_id>
openkit sessions kill <session_id> [--abandon]
openkit dashboard                       # Cross-session colored summary
openkit finish                          # Run lane-appropriate closeout for current session

# Maintenance
openkit upgrade                         # Refresh managed kit under OPENCODE_HOME
openkit uninstall

# Maintainer-only
openkit release prepare <version> --summary "<text>"
openkit release verify
openkit release publish
```

Two binaries are exported (see `package.json#bin`):
- `openkit` → `src/bin/openkit.js` (delegates to `src/cli/index.js`)
- `openkit-mcp` → `src/bin/openkit-mcp.js` (MCP server entrypoint)

### Workflow State CLI (Maintainer/Diagnostics)

The compatibility runtime CLI is at `src/openkit-runtime/workflow-state.js` (in this repo); the README references it as `.opencode/workflow-state.js` because that is its installed/mirrored path in target projects. Both refer to the same file.

```bash
node src/openkit-runtime/workflow-state.js ops-summary
node src/openkit-runtime/workflow-state.js resume-summary [--json]
node src/openkit-runtime/workflow-state.js status [--short]
node src/openkit-runtime/workflow-state.js workflow-metrics
node src/openkit-runtime/workflow-state.js show-dod
node src/openkit-runtime/workflow-state.js release-readiness
node src/openkit-runtime/workflow-state.js release-dashboard
node src/openkit-runtime/workflow-state.js policy-trace
node src/openkit-runtime/workflow-state.js doctor          # validation_surface = compatibility_runtime
```

These inspect workflow state only. They do not update the npm package, refresh the managed kit, or validate target-project app behavior.

## Architecture

### Hybrid Runtime Model

OpenKit uses a two-layer architecture (RFC: `docs/architecture/2026-03-hybrid-runtime-rfc.md`):

**1. Workflow Kernel** — source of truth for delivery semantics
- Owns: lane selection, stage transitions, approval gates, artifact readiness, issue routing, evidence
- Code: `src/context/core/workflow.md`, `src/openkit-runtime/workflow-state.js`, `src/openkit-runtime/lib/workflow-state-controller.js` (~161K LOC, the workflow kernel)
- Helpers: `src/openkit-runtime/lib/policy-engine.js`, `work-item-store.js`, `state-guard.js`, `parallel-execution-rules.js`, `migration-slice-rules.js`, `task-board-rules.js`, `runtime-summary.js`, `runtime-guidance.js`

**2. Capability Runtime** — execution infrastructure (`src/runtime/`)
- Bootstrap: `src/runtime/index.js` → `bootstrapRuntimeFoundation()` wires config → capabilities → managers → tools → hooks → MCP → categories → specialists → modelRuntime → skills → commands → contextInjection → runtimeInterface
- Config: `src/runtime/runtime-config-loader.js` (JSONC; project + user scopes, additive merge)
- Capabilities: `src/runtime/capability-registry.js` (foundation/runtime categories, feature-flag gated)
- Managers: `src/runtime/managers/` (project-graph, context-assembly, session-memory, capability-registry, delegation-supervisor, etc.)
- Tools: `src/runtime/tools/` organized by category (graph, ast, codemod, syntax, browser, lsp, mcp, workflow, …)
- Analysis: `src/runtime/analysis/` (SQLite project graph, embedding indexer, pattern recognition, intent extraction, data-flow)

**State Ownership Rule**: No capability module may advance workflow stage, close issues, approve gates, or mark work complete implicitly. All automation routes through explicit workflow-state surfaces. The kernel owns "did this work happen"; the capability runtime owns "what tools/managers are available to do the work".

### Three Workflow Lanes

Canonical choice is by **dominant uncertainty**, not size (`src/context/core/lane-selection.md`).

| Lane | Trigger | Stages | Ownership | Approval Gates |
|---|---|---|---|---|
| **Quick** | `/quick-task` | `quick_intake → quick_plan → quick_implement → quick_test → quick_done` | Quick Agent owns all stages (no MO, no QA) | `quick_verified` |
| **Migration** | `/migrate` | `migration_intake → migration_baseline → migration_strategy → migration_upgrade → migration_code_review → migration_verify → migration_done` | MO routes; SL strategy; FS upgrade; CR review; QA verify | `baseline_to_strategy`, `strategy_to_upgrade`, `upgrade_to_code_review`, `code_review_to_verify`, `migration_verified` |
| **Full** | `/delivery` | `full_intake → full_product → full_solution → full_implementation → full_code_review → full_qa → full_done` | MO → PL → SL → FS → CR → QA → MO | `product_to_solution`, `solution_to_fullstack`, `fullstack_to_code_review`, `code_review_to_qa`, `qa_to_done` |

**Lane authority is always `user_explicit`** — Master Orchestrator must not reject, reroute, or auto-escalate. It may issue **one** advisory warning on apparent mismatch, then proceed with the user's choice. Only the user can authorize a lane change after a reported blocker.

**Quick lane specifics** (`src/agents/quick-agent.md` is authoritative):
- `quick_plan` requires deep codebase reading + explicit user confirmation of understanding **before** offering solution options
- Default: 3 meaningfully different options with pros/cons/effort/risk (fewer only with explicit justification)
- Separate user confirmation of execution plan before `quick_implement`
- No task board, no required code review, no QA Agent
- Bugs are fixed in place during `quick_test`; only repeated failures crossing retry threshold report to the user

**Migration lane specifics** (parity-oriented):
- `migration_context` schema is required: `baseline_summary`, `target_outcome`, `preserved_invariants`, `allowed_behavior_changes`, `compatibility_hotspots`, `baseline_evidence_refs`, `rollback_checkpoints`
- Behavior-preserving by default; refactor only to create seams/adapters for safe upgrade
- Migration slice boards are optional and strategy-driven; entering `migration_done` requires every slice `verified` or `cancelled`

**Full delivery specifics**:
- Execution task boards live under `src/openkit-runtime/work-items/<work_item_id>/tasks.json`, only when the solution package blesses them
- `parallel_mode` ∈ `none|limited|enabled`; for `limited`, `safe_parallel_zones` are repo-relative path-prefix allowlists evaluated against task `artifact_refs`
- `sequential_constraints` ("TASK-A -> TASK-B -> TASK-C") compile into `depends_on`/`blocked_by` overlays, not separate fields

### Agent Roles

| Role | File | Owns |
|---|---|---|
| Master Orchestrator (MO) | `src/agents/master-orchestrator.md` | Procedural routing, state recording, gate control — **never codes or authors content** |
| Product Lead (PL) | `src/agents/product-lead-agent.md` | Scope package (`docs/scope/`), business rules, acceptance criteria — full-delivery only |
| Solution Lead (SL) | `src/agents/solution-lead-agent.md` | Solution package (`docs/solution/`), migration strategy, sequencing, validation expectations |
| Fullstack Agent (FS) | `src/agents/fullstack-agent.md` | Implementation, debugging, verification |
| Code Reviewer (CR) | `src/agents/code-reviewer.md` | Scope-compliance review first, code-quality review second |
| QA Agent | `src/agents/qa-agent.md` | Runtime behavior validation, issue classification, QA evidence (`docs/qa/`) |
| Quick Agent | `src/agents/quick-agent.md` | Sole owner of entire quick lane lifecycle |

Stage ownership and approval authority maps live in `src/context/core/workflow-state-schema.md` and are mirrored in `src/context/core/active-contract.json` (machine-readable).

## Multi-Session Workflow Isolation (v0.7.0+)

Each `openkit run` tab gets its own session id (`s_<6hex>`) and its own per-session workflow-state mirror. Two tabs in the same repo can hold two different work items concurrently.

**Key environment variables** (set by launcher, do not invent or rebind):
- `OPENKIT_SESSION_ID` — truth for "which session am I in"
- `OPENKIT_WORKFLOW_STATE` — points at the per-session mirror; **read live state from here**, not from the legacy stub
- `OPENKIT_KIT_ROOT`, `OPENKIT_PROJECT_ROOT` — prefer these over guessed relative paths
- `OPENKIT_RUNTIME_SESSION_ID` — required by `openkit switch-profiles` (fails closed outside active session)

**Session resolution pattern** — all call sites that previously read a global `active_work_item_id` now use:

```js
import { resolveSession } from 'src/runtime/sessions/session-resolver.js';
const { sessionId, workItemId, baseDir } = resolveSession({ env, repoRoot });
```

**Storage layout** (per-session):
- Sessions index: `<workflow_root>/sessions/index.json` (`openkit/sessions-index@1`)
- Per-session dir: `<workflow_root>/sessions/<session_id>/{meta.json, heartbeat.json, workflow-state.json}`
- Work-items index: `<workflow_root>/work-items/index.json` (`openkit/work-items-index@3` — per-item `lane`, `status`, `current_session_id`; root `active_work_item_id` is **removed**)
- Legacy stub at `<workflow_root>/workflow-state.json` (`openkit/legacy-stub@1`) is forwarding only; previous mirrors retained as `workflow-state.json.legacy.<timestamp>` with 10-file rotation cap

**Lane binding**: `/quick-task`, `/migrate`, `/delivery` bind the active session to a work item. A second lane slash in the same session is rejected with `SessionAlreadyBoundError` — open a new tab to work on a different item.

**Heartbeat**: each session writes `heartbeat.json` once per minute. After 10 minutes of silence the session becomes `orphan` and is resumable from any tab.

**Finish workflow** (`openkit finish` / `/finish`): verifies the lane's approval gate (`quick_verified` / `qa_to_done` / `migration_verified`), then for full/migration validates worktree (exists, on `meta.feature_branch`, clean), repo on `meta.target_branch`, runs `git merge --squash`, commits with subject `<lane>(<slug>): <summary>`, removes worktree, deletes branch. Refuses cleanly (no mutation) on `OK_FINISH_GATE_NOT_MET`, `OK_FINISH_WORKTREE_DIRTY`, `OK_FINISH_WORKTREE_MISSING`, `OK_FINISH_BRANCH_MISMATCH`, `OK_FINISH_REPO_WRONG_BRANCH`, `OK_FINISH_MERGE_CONFLICT`.

## Tool Substitution Rules (Enforced at Runtime)

Agents MUST follow `src/context/core/tool-substitution-rules.md`:

1. **OS commands are blocked on source files.** Do NOT use `grep`, `find`, `cat`, `head`, `tail`, `sed`, `awk`, `wc`, or `echo > file` on source code. Use built-in `Grep`, `Glob`, `Read`, `Edit`, `Write`. In quick and full modes this is enforced — blocked commands are rejected.
2. **Prefer kit intelligence tools** when structural/semantic understanding helps:

| Instead of | Consider | When |
|---|---|---|
| `Grep` (regex) | `tool.semantic-search` | Exploring unfamiliar code by meaning |
| `Grep` (regex) | `tool.ast-grep-search` | Structural patterns (function calls, class shapes) |
| `Glob` | `tool.find-symbol` | Looking up where a symbol is defined |
| `Glob` | `tool.import-graph` | Tracing imports/exports |
| `Read` (full file) | `tool.syntax-outline` | Understanding file structure first |
| `Read` (position) | `tool.syntax-context` | Surrounding code at a location |
| `Edit` | `tool.codemod-preview` / `tool.codemod-apply` | Same transformation across many files |
| Manual tracing | `tool.find-dependencies` / `tool.find-dependents` | Module dependency graphs |
| Manual tracing | `tool.graph-goto-definition` / `tool.graph-find-references` / `tool.graph-call-hierarchy` | IDE-like navigation |
| Manual renaming | `tool.graph-rename-preview` | Multi-file rename impact |

3. **Fallback is always allowed.** If a kit tool is unavailable, degraded, or not indexed yet, fall back to the built-in tool — but try the smarter one first.

## Multi-Layer Intelligence Stack

A 4-layer stack for codebase understanding (`docs/configuration/code-intelligence.md`, `docs/features/multi-layer-intelligence.md`):

- **L1 Structural**: SQLite project graph (`src/runtime/analysis/project-graph-db.js`), tree-sitter parsing, type flows (`type_flows`), lexical scopes (`scope_contexts`). Tools: `tool.import-graph`, `tool.find-dependencies`, `tool.find-dependents`, `tool.find-symbol`, `tool.type-flow-trace`. Requires `better-sqlite3` (checked by `openkit doctor`).
- **L2 Semantic**: pattern recognition (`code_patterns` + FTS), data-flow BFS, usage mining, embedding-based search. Tools: `tool.pattern-search`, `tool.data-flow-trace`, `tool.semantic-search` (falls back to keyword when embedding disabled).
- **L3 Intent**: LLM-augmented business-rule/edge-case/constraint extraction (`code_intents`), SHA256 hash cache. Tools: `tool.business-rule-query`, `tool.constraint-query`. LLM-bound — disabled by default.
- **L4 Context Assembly**: orchestrates L1+L2+L3 in parallel. Budget: 40% critical / 30% important / 20% supplementary / 10% buffer. Modes: task / session / project. Tool: `tool.comprehensive-context`.

Configure under `.opencode/openkit.runtime.jsonc` → `codeIntelligence`.

## Path Model (Anti-Confusion)

Do not collapse these layers — a missing file in one does not mean others are missing:

- **Global kit/config root**: `OPENCODE_HOME/kits/openkit` (the materialized managed kit)
- **Workspace runtime state**: `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode` (per-workspace derived state)
- **Project compatibility shim**: `projectRoot/.opencode` (authoring/compat surface, not the default managed source of truth)
- **This repo's runtime surfaces** (authoring view): `src/openkit-runtime/` mirrors what installs into `.opencode/` in target projects

When debugging runtime issues, name the layer explicitly. Prefer env vars (`OPENKIT_KIT_ROOT`, `OPENKIT_WORKFLOW_STATE`, `OPENKIT_PROJECT_ROOT`) over guessed paths.

## Repository Structure (Big Picture)

```
src/
  agents/                  Role definitions (markdown prompts)
  commands/                User-facing slash commands (/quick-task, /migrate, /delivery, /finish, …)
  skills/                  Composable workflow procedures (TDD, brainstorming, debugging, …)
  context/                 Shared intelligence
    core/workflow.md       *** Canonical live workflow contract ***
    core/active-contract.json   Machine-readable mirror
    core/lane-selection.md      Routing rubric, tie-breakers, anti-patterns
    core/workflow-state-schema.md  State enums, ownership/approval maps
    core/tool-substitution-rules.md
  hooks/                   Session bootstrap (session-start, graph-indexer)
  openkit-runtime/         OpenCode compatibility runtime
    workflow-state.js      Workflow-state CLI (mode-aware contract)
    lib/                   Workflow kernel implementation (controller, policy, rules, stores)
    work-items/            Per-item backing store
    sessions/              Per-session mirrors (when materialized)
  runtime/                 *** Capability runtime foundation ***
    index.js               bootstrapRuntimeFoundation() entrypoint
    capability-registry.js Capability inventory + feature-flag gating
    runtime-config-loader.js  Project + user JSONC config
    managers/              Manager lifecycle
    tools/                 Tool registry (workflow/, graph/, ast/, codemod/, syntax/, browser/, lsp/, mcp/, …)
    analysis/              Project graph DB, embeddings, patterns, intent
    sessions/              Multi-session resolver, lifecycle, finish, dashboard helpers
    workflow-kernel.js     Capability-side workflow wiring
    workflow/              Workflow tools (advance-stage, set-approval, evidence-capture, …)
  bin/                     CLI entrypoints (openkit, openkit-mcp)
  cli/                     CLI command implementations
  tests/                   Test suites: runtime/, cli/, install/, hooks/, commands/, semgrep/, release/, …
  scripts/                 Verification + sync scripts
docs/
  architecture/            RFCs (hybrid-runtime-rfc, completion-roadmap, capability-matrix)
  configuration/code-intelligence.md
  features/multi-layer-intelligence.md
  governance/              Naming, severity, ADR, DoD policy
  operator/, maintainer/   Audience-specific index layers (routing only)
  kit-internals/           Consolidated maintainer map (architecture → runtime → tooling)
  templates/               Workflow artifact templates
  qa/, scope/, solution/, adr/, tasks/   Active workflow artifacts
AGENTS.md                  *** Canonical agent guide (always read first) ***
registry.json              Repository surface and profile metadata (mirror of package.json#version)
src/openkit-runtime/install-manifest.json   Install metadata (mirror of package.json#version)
```

## Runtime Config

- Path: `.opencode/openkit.runtime.jsonc` (project root)
- Format: JSONC (comments allowed)
- Loading: project → user → runtime defaults (additive merge)
- Supports: category/specialist model overrides, `fallback_models` chains, `modelExecution.autoFallback` on repeated failures, `file://` prompt references, `codeIntelligence.*` config
- See `docs/configuration/code-intelligence.md` for the intelligence-stack reference and `docs/configuration/` for other config surfaces

## Semantic Search Setup

```bash
openkit configure-embedding --interactive
# Providers: openai (needs OPENAI_API_KEY), ollama (local), custom (OpenAI-compatible endpoint)
# Then in-session:
# tool.embedding-index with action=index-project
```

Falls back to keyword search when embedding is disabled.

## Permissions and Security

- Canonical command permission policy: `src/assets/default-command-permission-policy.json`
- MCP custom config materializes **placeholder-only**; no raw secrets in arguments. Use `--stdin` (`openkit configure mcp set-key <id> --stdin`) or env-backed placeholders.
- Chrome DevTools MCP is enabled by default (`chrome-devtools`, `npx -y chrome-devtools-mcp@0.21.0`)

## Supervisor Dialogue

- OpenClaw supervisor path is guarded, advisory-only, **defaults disabled**
- OpenClaw CANNOT execute code, mutate workflow state, approve gates, update tasks, record evidence, close issues, or mark QA done
- Status surfaces expose supervisor health, delivery counts, concerns, rejected authority requests
- Implementation: `src/runtime/supervisor/`, `src/openkit-runtime/lib/supervisor-dialogue-store.js`, `src/runtime/managers/supervisor-dialogue-manager.js`

## Important Constraints

- **OpenKit does NOT validate target-app behavior.** No repo-native build/lint/test command exists for "application code" — this repo *is* the kit. When a target project defines app-native commands, those prove app behavior; otherwise report `target_project_app` validation as unavailable rather than substituting OpenKit runtime checks.
- **Do not create commits unless the user explicitly asks**, even when agent-level instructions mention commit opportunities.
- **Do not skip pre-commit hooks** (`--no-verify`, `--no-gpg-sign`) unless the user explicitly requests it.
- **Lane lock**: when the user invokes `/quick-task`, `/migrate`, or `/delivery`, `lane_source = user_explicit` — honor it; at most one advisory warning on mismatch.
- **No grep/find/cat on source files** — see Tool Substitution Rules.
- **AGENTS.md is the canonical agent guide** — always read it before making non-trivial structural changes.

## Platform Notes

- **Node**: ≥ 18 (Node 20 LTS recommended)
- **macOS**: confirm `node`, `npm`, and `opencode` are on `PATH`
- **Ubuntu/Debian**: `sudo apt install -y build-essential python3` for native modules (`better-sqlite3`, tree-sitter)
- **Native modules**: `better-sqlite3` (project graph), `@ast-grep/cli` (provisioned by `openkit install`), `tree-sitter-javascript`, `tree-sitter-typescript`, `web-tree-sitter`, `jscodeshift` (codemods)
- If `openkit doctor` reports drift or missing managed-kit files: `openkit upgrade` then `openkit doctor`
- If the global CLI is stale: `npm install -g @duypham93/openkit@latest` then `openkit upgrade` then `openkit doctor`

## Common Patterns

### Adding a New Runtime Capability

1. Add capability metadata in `src/runtime/capability-registry.js` (id, category, description, status, `enabledByDefault`, optional `featureFlag`)
2. Create manager in `src/runtime/managers/` if it owns lifecycle state
3. Register tools in `src/runtime/create-tools.js` and the relevant `src/runtime/tools/<category>/` directory
4. Add config schema defaults to `src/runtime/runtime-config-defaults.js`
5. Update `registry.json` if it changes operator-facing surface metadata
6. Add tests in `src/tests/runtime/` (and architecture docs under `docs/architecture/` for non-trivial additions)

### Adding/Changing a Workflow Stage or Approval Gate

1. Update `src/context/core/workflow.md` (canonical contract) and `src/context/core/workflow-state-schema.md` (schema/enums/ownership/approval maps)
2. Update `src/context/core/active-contract.json` (machine-readable mirror)
3. Update kernel: `src/openkit-runtime/workflow-state.js` and `src/openkit-runtime/lib/workflow-state-controller.js`
4. Update affected agent prompts in `src/agents/`
5. Add governance tests covering the new transition (`src/tests/runtime/governance-enforcement.test.js`, `src/openkit-runtime/tests/workflow-contract-consistency.test.js`)

### Verifying Workflow State Mid-Work

```bash
node src/openkit-runtime/workflow-state.js status --short
node src/openkit-runtime/workflow-state.js resume-summary --json
node src/openkit-runtime/workflow-state.js workflow-metrics
```

For multi-session inspection use `openkit dashboard` and `openkit sessions list`.

## Getting Help

- `README.md` — product overview, install/upgrade flow
- `AGENTS.md` — agent guide and repository contract (read first)
- `src/context/core/workflow.md` — canonical workflow contract
- `docs/operator/README.md`, `docs/operator/troubleshooting.md` — operator path
- `docs/maintainer/README.md`, `docs/maintainer/error-codes.md`, `docs/maintainer/command-matrix.md` — maintainer path
- `docs/kit-internals/README.md` — consolidated maintainer map
- `docs/architecture/2026-03-hybrid-runtime-rfc.md` — runtime architecture
- `docs/configuration/code-intelligence.md` — intelligence-stack config reference
- `docs/features/multi-layer-intelligence.md` — intelligence-stack usage guide
