# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is OpenKit

OpenKit is an AI software factory for OpenCode that implements mode-aware workflow orchestration for software development:

- **Quick Task**: narrow, low-risk daily work with lightweight planning
- **Migration**: upgrades, framework migrations, and compatibility remediation that preserve behavior
- **Full Delivery**: feature work requiring Product Lead → Solution Lead → Implementation → Review → QA handoffs

The system is built on a **hybrid architecture** combining a workflow kernel (explicit state, approvals, gates) with a capability runtime (config loading, managers, tools, hooks, MCP integration).

## Commands

### Daily Development

```bash
# Run all verification
npm run verify:all

# Run specific verification suites
npm run verify:install-bundle          # Verify install manifest
npm run verify:runtime-foundation      # Test runtime config loader, capability registry, bootstrap
npm run verify:governance              # Test governance enforcement, registry metadata, workflow contract
npm run verify:sessions                # Test session management and multi-session workflows
npm run verify:semgrep-quality         # Verify Semgrep quality rules

# Run single test file
node --test <path-to-test-file>

# Example: test workflow state CLI
node --test .opencode/tests/workflow-state-cli.test.js
```

### Global CLI (End-User Product Surface)

```bash
# Installation and setup
npm install -g @duypham93/openkit
openkit doctor                         # Check readiness
openkit install --verify               # Explicit setup + verification

# Launch and daily use
openkit run                            # Launch OpenCode with OpenKit

# Configuration
openkit profiles --list                # List agent model profiles
openkit profiles --create              # Create new profile
openkit configure-agent-models --list  # List per-agent model overrides
openkit configure mcp --interactive    # Guided MCP setup
openkit configure-embedding --interactive  # Configure semantic search

# Maintenance
openkit upgrade                        # Refresh managed kit
openkit uninstall                      # Remove global install
```

### Runtime Inspection (Maintainer/Diagnostics)

```bash
node .opencode/workflow-state.js ops-summary
node .opencode/workflow-state.js resume-summary
node .opencode/workflow-state.js status --short
node .opencode/workflow-state.js workflow-metrics
node .opencode/workflow-state.js release-readiness
```

These commands inspect workflow state. They do NOT validate target application build/lint/test behavior.

### Release Workflow (Maintainer Only)

```bash
openkit release prepare <version> --summary "<text>"
openkit release verify
openkit release publish
```

## Architecture

### Hybrid Runtime Model

OpenKit uses a two-layer architecture defined in `docs/architecture/2026-03-hybrid-runtime-rfc.md`:

**1. Workflow Kernel** (source of truth for delivery semantics)
- Lane selection (quick/migration/full)
- Stage ownership and transitions
- Approval gates and artifact readiness
- Issue routing and verification evidence
- Located in: `context/core/workflow.md`, `.opencode/workflow-state.js`, `.opencode/lib/*`

**2. Capability Runtime** (execution infrastructure)
- Runtime config loading (project + user scopes)
- Capability registry and manager lifecycle
- Tool registration and hook composition
- MCP integration and specialist selection
- Multi-Layer Intelligence Stack (L1 structural, L2 semantic, L3 intent, L4 context assembly)
- Located in: `src/runtime/`

**State Ownership Rule**: No capability module may advance workflow stage, close issues, approve gates, or mark work complete implicitly. All automation routes through explicit workflow-state surfaces.

### Three Workflow Lanes

Canonical lane choice is by **dominant uncertainty**, not size:

**Quick Task** (`/quick-task`)
- Stages: `quick_intake → quick_plan → quick_implement → quick_test → quick_done`
- Single-agent lane (Quick Agent owns all stages)
- No Master Orchestrator, no QA Agent, no code review gate
- Brainstorming happens inline during `quick_plan`
- Requires explicit user confirmation of understanding before solution options
- Default: 3 meaningfully different options with pros/cons/effort/risk
- Separate user confirmation of execution plan before implementation

**Migration** (`/migrate`)
- Stages: `migration_intake → migration_baseline → migration_strategy → migration_upgrade → migration_code_review → migration_verify → migration_done`
- Preserves behavior first, migrates safely in stages
- Validates through baseline, parity, and compatibility evidence
- Expected artifacts: migration solution package, baseline/parity context

**Full Delivery** (`/delivery`)
- Stages: `full_intake → full_product → full_solution → full_implementation → full_code_review → full_qa → full_done`
- Product Lead defines scope → Solution Lead designs solution → Fullstack implements → Code Reviewer checks → QA validates
- Expected artifacts: scope package (`docs/scope/`), solution package (`docs/solution/`), QA evidence (`docs/qa/`)
- Can use task board when solution package allows it

### Agent Roles

1. **Master Orchestrator** - procedural workflow controller; routes, dispatches, records state; NEVER codes or authors artifacts
2. **Product Lead** - defines scope, business rules, acceptance criteria for full delivery
3. **Solution Lead** - defines technical direction, migration strategy, sequencing, validation expectations
4. **Fullstack Agent** - implements, debugs, verifies approved work
5. **Code Reviewer** - performs scope-compliance and code-quality review before QA
6. **QA Agent** - validates implementation evidence and classifies issues
7. **Quick Agent** - single owner for entire quick lane lifecycle

## Directory Structure

```
agents/                    # Agent role definitions (master-orchestrator.md, product-lead-agent.md, etc.)
commands/                  # User-facing slash commands (/quick-task, /migrate, /delivery, etc.)
skills/                    # Composable workflow procedures (TDD, brainstorming, planning, debugging)
context/                   # Shared intelligence (navigation, code quality, workflow)
  core/workflow.md         # *** Canonical workflow contract (source of truth) ***
  core/lane-selection.md   # Routing rubric with examples and anti-patterns
hooks/                     # Session bootstrap integration (session-start)
.opencode/                 # OpenCode runtime environment
  workflow-state.js        # *** Workflow state CLI (mode-aware contract) ***
  workflow-state.json      # Active external compatibility mirror
  work-items/              # Per-item workflow backing store
  lib/                     # Workflow kernel implementation
src/runtime/               # *** Capability runtime foundation ***
  index.js                 # Bootstrap entrypoint
  runtime-config-loader.js # Project + user config loader (JSONC support)
  capability-registry.js   # Current and planned runtime capability inventory
  managers/                # Manager lifecycle (project-graph, embedding, context-assembly, etc.)
  tools/                   # Runtime tool registry (graph tools, embedding index, comprehensive-context, etc.)
  analysis/                # Static analysis (project-graph-db, data-flow-analyzer, etc.)
  lib/                     # Shared library code (budget-manager, result-ranker)
  mcp/                     # MCP bootstrap
  sessions/                # Multi-session workflow isolation
docs/
  architecture/            # Architecture RFCs (hybrid-runtime-rfc.md)
  configuration/           # Runtime config references (code-intelligence.md)
  features/                # Feature guides (multi-layer-intelligence.md)
  operator/                # Operator-facing documentation
  maintainer/              # Maintainer-facing documentation
  governance/              # Naming, severity, ADR, definition-of-done policy
  templates/               # Workflow artifact templates
tests/                     # Test suites organized by surface
  runtime/                 # Runtime foundation tests
  cli/                     # CLI tests
  install/                 # Installation tests
```

## Key Technical Details

### Runtime Config

- Config path: `.opencode/openkit.runtime.jsonc` (project root)
- Supports category/specialist model overrides, fallback chains, auto-fallback on repeated failures
- `file://` prompt references for agent prompts and category prompt appends
- Additive loading: project config → user config → runtime defaults

### Project Graph

- SQLite-backed project graph (`src/runtime/analysis/project-graph-db.js`)
- Import/export and symbol extraction using tree-sitter
- Tools: `tool.import-graph`, `tool.find-dependencies`, `tool.find-dependents`, `tool.find-symbol`
- Requires `better-sqlite3` native module (checked by `openkit doctor`)

### Multi-Layer Intelligence Stack

OpenKit includes a comprehensive 4-layer intelligence stack for codebase understanding. The stack ensures OpenKit reads codebases **broadly** (finds all relevant context), **deeply** (understands how code works), and **reliably** (never misses critical context).

**Layer 1 — Structural:**
- Enhanced graph: types, flows, scopes
- Type-flow tracking: param / return / assignment / property
- Scope context tracking: lexical scopes with bindings
- Query capabilities: type flows, scope chains, decorator searches
- Storage: extra columns on `nodes`/`symbols`, plus `type_flows` and `scope_contexts` tables

**Layer 2 — Semantic:**
- Pattern recognition: api-usage, validation, error-handling, architectural
- Data-flow analysis: trace values through transformations
- Usage pattern mining: actual usage fingerprints
- Multi-source semantic search: embeddings + patterns + usage + graph
- Storage: `code_patterns` table, embeddings + FTS index

**Layer 3 — Intent:**
- LLM-augmented business logic extraction
- Extractors: business rules, edge cases, design patterns, constraints, data transformations
- Intent caching: hash-based with code-change invalidation
- Confidence scoring: cross-validation with structural data
- Storage: `code_intents` table

**Layer 4 — Context Assembly:**
- Smart orchestration: queries L1 + L2 + L3 in parallel
- Budget management: 40% critical, 30% important, 20% supplementary, 10% buffer
- Multi-layer ranking: combines structural, semantic, intent signals
- Session memory: maintains working set across tasks

**Tools:**
- `tool.comprehensive-context` — main context gathering (task / session / project modes)
- `tool.data-flow-trace` — trace data flows
- `tool.type-flow-trace` — trace type flows
- `tool.pattern-search` — search by patterns
- `tool.business-rule-query` — query business rules
- `tool.constraint-query` — query constraints

**Configuration:** `.opencode/openkit.runtime.jsonc` → `codeIntelligence` section. See `docs/configuration/code-intelligence.md` for the full reference and `docs/features/multi-layer-intelligence.md` for the usage guide.

### Semantic Search

- Configure via `openkit configure-embedding --interactive`
- Supported providers: `openai`, `ollama`, `custom`
- Index with `tool.embedding-index` action: `index-project`
- Falls back to keyword search when disabled

### Multi-Session Workflow Isolation

- Runtime state: `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode`
- Project compatibility shim: `projectRoot/.opencode`
- Session management in `src/runtime/sessions/`
- Per-session profile switching via `openkit switch-profiles` or `/switch-profiles`

## Workflow State Contract

The workflow state schema (v3) is defined in `context/core/workflow-state-schema.md`:

- Each work item has: `work_item_id`, `lane`, `stage`, `owner`, `linked_artifacts`, `approvals`, `issues`, `evidence`
- Approvals track: `approved_by`, `timestamp`, `summary`, `link`
- Evidence tracks: verification results, test outputs, scan results
- Issues have lifecycle: `needs_fix`, `investigating`, `blocked`, `resolved`, `reopened`

## Important Constraints

### What OpenKit Does NOT Validate

OpenKit runtime, CLI, and workflow-state checks validate **OpenKit surfaces only**:
- `global_cli` - global CLI commands
- `in_session` - slash commands in active session
- `compatibility_runtime` - workflow-state.js commands
- `runtime_tooling` - ast-grep, better-sqlite3, etc.
- `documentation` - docs correctness
- `package` - npm package integrity

OpenKit does **NOT** validate target application:
- No repo-native build command
- No repo-native lint command
- No repo-native test command

When target project defines app-native commands, those can prove app behavior. Otherwise, report unavailable app-native validation honestly.

### Permissions and Security

- Command permission policy: `assets/default-command-permission-policy.json` (canonical)
- Custom MCP config: placeholder-only, no raw secrets in arguments
- MCP secrets: use `--stdin` or environment-backed placeholders

### Supervisor Dialogue

- OpenClaw supervisor path: guarded, advisory-only, defaults disabled
- OpenClaw CANNOT execute code, mutate workflow state, approve gates, update tasks, record evidence, close issues, or mark QA done
- Status surfaces expose supervisor health, delivery counts, concerns, rejected authority requests

## Source of Truth Order

When deciding what is authoritative:

1. Direct user instructions in current session
2. Root `AGENTS.md`
3. `context/core/workflow.md` (canonical workflow contract)
4. Companion core workflow docs for operational details

## Common Patterns

### Adding a New Runtime Capability

1. Define capability in `src/runtime/capability-registry.js`
2. Create manager in `src/runtime/managers/` if needed
3. Register tools in `src/runtime/create-tools.js`
4. Add config schema to `src/runtime/runtime-config-defaults.js`
5. Update `docs/architecture/` and `registry.json`
6. Add tests in `tests/runtime/`

### Verifying Workflow State

```bash
# Quick status check
node .opencode/workflow-state.js status --short

# Detailed metrics
node .opencode/workflow-state.js workflow-metrics

# Resume context after session interruption
node .opencode/workflow-state.js resume-summary
```

### Testing a New Agent or Skill

1. Add agent definition to `agents/` or skill to `skills/`
2. Update registry.json with metadata
3. Test via `openkit run` and appropriate lane command
4. Verify workflow state transitions correctly
5. Add governance tests if introducing new stage/role

## Platform Notes

- **macOS**: Confirm Node/npm and `opencode` are on `PATH`
- **Ubuntu/Debian**: Install build tools before setup: `sudo apt install -y build-essential python3`
- **Node version**: >= 18 (Node 20 LTS recommended)
- **Native modules**: `better-sqlite3`, `ast-grep` (provisioned by `openkit install`)

## Getting Help

- README.md - product overview, installation, daily commands
- docs/operator/README.md - operator path and surface selection
- docs/maintainer/README.md - maintainer path and command matrix
- docs/configuration/code-intelligence.md - Multi-Layer Intelligence config reference
- docs/features/multi-layer-intelligence.md - Multi-Layer Intelligence usage guide
- context/core/workflow.md - canonical workflow contract
- docs/architecture/2026-03-hybrid-runtime-rfc.md - runtime architecture
