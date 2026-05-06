# Tools, Hooks, Skills, Commands, MCPs, And Specialists

This document explains the runtime-facing surfaces that most directly shape how
OpenKit behaves inside OpenCode.

## 1. Tool Layer

The tool registry is assembled in:

- `src/runtime/tools/tool-registry.js`

Tools are wrapped by:

- `wrapToolExecution()`

They are then summarized in:

- `src/runtime/create-tools.js`

## 2. Tool Families

Current notable tool families include:

- workflow
- session
- continuation
- delegation
- mcp
- models
- interactive
- edit
- analysis
- audit
- codemod
- syntax
- browser
- lsp
- ast
- graph
- external
- capability

## 3. Important Tool Groups

Capability status vocabulary for this layer:

- `available`: implemented and dependencies/configuration needed for use are present
- `unavailable`: not usable in the current environment
- `degraded`: usable through fallback behavior or reduced accuracy/scope
- `preview`: early or partial surface with visible limitations
- `compatibility_only`: maintainer or repository-local compatibility surface, not the preferred operator product path
- `not_configured`: implemented but disabled because local config or provider settings are absent

Use these labels when documenting tool, MCP, browser, graph, semantic-search, external-tool, or background execution readiness.

Read-model labeling rules:

- workflow-state, runtime-summary, and evidence-capture tools are `compatibility_runtime` surfaces because they inspect or record OpenKit workflow state
- browser verification remains `preview` `runtime_tooling` because it plans or captures evidence but does not close QA by itself
- typecheck, lint, and test-run tools are `target_project_app` surfaces only when the target project provides the relevant config or framework; otherwise their `unavailable` status records a missing app-native validation path
- graph, semantic search, syntax, AST, codemod, MCP, and background execution tools stay `runtime_tooling` unless a narrower implemented surface label is explicitly provided
- capability graph, resolver, readiness dashboard, and decision-ledger tools stay `runtime_tooling`; when their summaries are rendered through workflow-state or session-resume surfaces, that wrapper is `compatibility_runtime` but the capability evidence remains runtime-tooling evidence
- supervisor dialogue manager configuration and adapter health are `runtime_tooling`; persisted supervisor dialogue read models surfaced through workflow-state `status` or `resume-summary --json` are `compatibility_runtime`
- bundled skill metadata is canonical in `src/capabilities/skill-catalog.js`; `tool.skill-index`, `tool.skill-mcp-bindings`, and skill routing expose it as `runtime_tooling`, while generated install-bundle skill metadata is validated on the `package` surface

### Workflow tools

Examples:
- workflow state
- runtime summary
- evidence capture

Workflow-state runtime summaries also expose supervisor dialogue read models for the active work item when relevant. The compact read model includes supervisor health, outbound delivery counts (`pending`, `delivered`, `failed`, `skipped`), inbound rejection counts, duplicate counts, last adjudication, and attention state. Missing supervisor stores are reported as absent/unavailable so reviewer and QA surfaces stay inspectable without requiring OpenClaw to be configured.

Workflow-state runtime summaries also expose compact capability guidance through `capabilityGuidance` / `capabilityGuidanceLines`. This read model is a `runtime_tooling` guidance summary rendered through `compatibility_runtime` CLI/status surfaces; it is not target-project app validation and does not prove any recommended tool or skill has run.

For FEATURE-940 and later supervisor dialogue work, QA evidence must be explicit about supervisor health, outbound event statuses, inbound dispositions, authority-boundary rejection, duplicate/repeated proposal handling, degraded/offline behavior, and proof that inbound OpenClaw messages did not mutate workflow state beyond supervisor dialogue records. Reports must cite FEATURE-940 artifacts as the active delivery proof; FEATURE-937 is historical risk context only. FEATURE-939 scan/tool evidence remains a separate required reporting section with direct tool status, substitute/manual evidence, classification, false-positive, manual-override, validation-surface, and artifact-ref fields.

### Session and continuation tools

Examples:
- session list/read/search
- continuation status/start/stop/handoff

### Audit and codemod tools

Examples:
- `tool.rule-scan`
- `tool.security-scan`
- `tool.codemod-preview`
- `tool.codemod-apply`

Audit tools are Semgrep-backed `runtime_tooling` surfaces. Standard gate evidence uses bundled rule packs from `assets/semgrep/packs/`:

- `quality-default.yml` for `tool.rule-scan`
- `security-audit.yml` for `tool.security-scan`

Availability states for scan tools use the standard runtime vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`. Missing Semgrep or managed tooling path is `unavailable` with reason/fallback guidance, not a silent success. Partial usable output is `degraded` and must report its limitations.

Result states are separate from availability states: a scan can be `succeeded`, `failed`/`scan_failed`, `unavailable`, `degraded`, or `invalid_path`. A succeeded scan can still block if findings are unclassified, `blocking`, or unresolved `true_positive` security findings.

Evidence types stay distinct through runtime evidence and human reports:

- `direct_tool`: the OpenKit tool (`tool.rule-scan` or `tool.security-scan`) actually ran
- `substitute_scan`: direct invocation was unavailable/degraded and an allowed substitute path produced evidence with explicit limitations
- `manual_override`: an exceptional caveat for genuine tool unavailability, unusable scan output, or authorized operational exception

High-volume finding triage should group findings by rule, severity/category, affected area, and relevance to changed work, then classify groups as `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, or `unclassified`. Human reports should reference raw artifact refs for full output rather than embedding untriaged walls of findings.

False-positive requirements are explicit: record rule/finding id, file or area, context, rationale, behavior/security impact, and follow-up decision. Test-fixture placeholders must be distinguished from production/runtime code before they are considered non-blocking.

Manual override limits: overrides must include target stage, unavailable tool, reason, actor when known, substitute evidence ids and limitations when present, and a downstream-visible caveat. Overrides cannot be used to avoid classifying noisy but usable findings and do not convert OpenKit scan evidence into `target_project_app` validation.

### Syntax, AST, and graph tools

Examples:
- syntax outline/context/locate
- AST search / AST replace / AST-grep search
- import graph / dependencies / dependents / symbol lookup
- graph goto definition / find references / call hierarchy / rename preview
- semantic search

### Semantic-search and embedding tools

Examples:
- `tool.semantic-search`
- `tool.embedding-index`

### Skill capability tools

Examples:

- `tool.skill-index`
- `tool.skill-mcp-bindings`
- skill-aware `tool.capability-router`
- `tool.capability-readiness`
- `tool.capability-ledger`

These read from canonical bundled skill metadata and expose skill maturity `status` (`stable`, `preview`, `experimental`) separately from runtime `capabilityState`. They also surface support level, provenance/source, roles, stages, triggers, limitations, packaging, docs refs, and advisory `recommended_mcps` with MCP status caveats. Router output is explainable and advisory; it recommends explicit skill loading and must not silently activate a skill.

`src/runtime/tools/capability/capability-router-summary.js` builds the compact capability guidance model used by the session-start hook, runtime summaries, and explicit `tool.capability-router` summary calls. The builder is pure and bounded: it reads local workflow state, skill metadata, and MCP inventory/read models; it must not load skill bodies, call MCP-backed tools, perform provider/network health checks, mutate workflow state, or print raw secrets. Rendered guidance must keep startup snapshot/stale caveats, refresh routes, custom MCP origin labels, and unavailable `target_project_app` validation visible.

### Capability graph, resolver, selection, and ledger tools

The capability orchestration core is assembled through these source surfaces:

- `src/capabilities/capability-graph.js` normalizes runtime tools, bundled MCPs, custom MCPs, loadable skills, metadata-only skills, browser/external capabilities, policy-gated capabilities, and target-project validation probes into graph nodes.
- `src/runtime/managers/capability-registry-manager.js` is the facade for graph construction, `rankCapabilities()`, `selectCapability()`, read-model summaries, and ledger access.
- `src/capabilities/activation-policy.js` classifies side-effect level and evaluates activation outcomes before use.
- `src/capabilities/capability-decision-ledger.js` stores sanitized decision entries in a file-backed ledger when runtime root is writable, otherwise in a memory/degraded ledger.
- `src/capabilities/capability-read-model.js` builds the bounded readiness dashboard read model.
- `src/runtime/tools/capability/capability-readiness.js` exposes the dashboard as `tool.capability-readiness`.
- `src/runtime/tools/capability/capability-ledger.js` exposes read-only ledger `list`, `get`, and `summary` actions as `tool.capability-ledger`.
- `src/mcp-server/tool-schemas.js` defines MCP-server schemas for the new capability tools.

Graph node families currently include `runtime_tool`, `bundled_mcp`, `custom_mcp`, `skill`, `metadata_only_skill`, `browser`, `external`, `policy_gated`, and `target_project_validation_probe`. Nodes carry ownership, state, validation surface, maturity, support level, loadability, side-effect level, locality, domain signals, roles, stages, freshness, caveats, next actions, and relationships such as `recommended_mcp`.

The resolver protocol is deliberately split from activation:

- Ranking is read-only and deterministic. It scores explicit skill/MCP requests, intent/domain/tag matches, current state, maturity, support level, role fit, stage fit, local/read-only preference, validation-surface fit, freshness, and requested preview/experimental allowances.
- Ranking can return bounded `selected`, `downgraded`, `blocked`, `unavailable`, and `suppressed` groups with counts, reasons, caveats, policy gates, and next actions.
- Ranking must not load skill bodies, execute MCPs/tools, invoke browser automation, call external providers, write files, mutate workflow state, or alter git/package/deploy/system state.
- Selection evaluates whether one graph node is eligible for explicit activation. It can return `approved`, `blocked`, `needs_confirmation`, `degraded`, `unavailable`, or `not_applicable`, but it still does not activate the capability.
- Actual activation remains the existing user-visible tool or `skill` invocation path and must respect normal workflow guards and command permission policy.

Activation policy handles side-effect levels including `metadata_only`, `read_only`, `diagnostic`, `local_mutating`, `workflow_mutating`, `browser_read`, `browser_mutating`, `external_read`, `external_mutating`, `git_mutating`, `package_mutating`, `deploy_release`, `database_mutating`, `system_privileged`, and `destructive`. Browser and external capabilities require both relevance and explicit allowance; mutating and dangerous capabilities require policy gates and, for dangerous operations, explicit user intent plus existing safety checks.

The readiness dashboard is a read model, not an activation result. It summarizes standard state distribution, family counts, policy-gated counts, metadata-only/unavailable skill counts, freshness labels, browser/external readiness, target-project validation availability, ownership split, ledger counts, and bounded next actions. Default output must remain compact and direct callers to `tool.capability-router`, `tool.capability-ledger`, `tool.capability-inventory`, `tool.capability-health`, `tool.mcp-doctor`, `tool.skill-index`, and `tool.skill-mcp-bindings` for detail.

The decision ledger records sanitized capability decisions such as rank, select, skip, block, degrade, fail, load, and execute. It stores workflow context, capability identity, outcome, reason, caveats, freshness, policy gate, validation surface, and evidence/artifact references. It must not store raw secrets, tokens, auth headers, cookies, provider payloads, browser storage, raw command env maps, or sensitive stdout/stderr. Redacted key state must remain symbolic, for example `missing`, `needs_key`, `not_configured`, `present_redacted`, `unavailable`, or `unknown`.

Validation-surface separation is mandatory:

- `tool.capability-readiness`, `tool.capability-router`, `tool.capability-ledger`, graph/resolver/policy tests, and MCP-server schema tests are `runtime_tooling` validation.
- `openkit doctor`, `openkit run`, and `openkit configure mcp ...` are `global_cli` or operator-readiness validation depending on the command.
- Workflow-state status, resume, and evidence wrappers are `compatibility_runtime` validation.
- `npm run verify:install-bundle`, `npm run verify:mcp-secret-package-readiness`, and `npm pack --dry-run --json` are `package` validation.
- Documentation review and docs search are `documentation` validation.
- Target-project app validation exists only when app-native build, lint, test, smoke, or regression commands/config are present and run. OpenKit runtime, package, doctor, browser, scan, or MCP readiness checks must not be reported as `target_project_app` evidence.

### External tooling tools

These tools run project-local toolchains through a safe child-process runner
with timeout, structured output parsing, and graceful degradation.

Each tool self-gates based on project config detection:

- `tool.typecheck` — runs `tsc --noEmit` when `tsconfig.json` exists; returns
  structured diagnostics (file, line, column, severity, code, message)
- `tool.lint` — runs ESLint or Biome when config detected; returns structured
  findings with fixable counts
- `tool.test-run` — auto-detects vitest/jest/node:test/pytest/go test; returns
  structured pass/fail/failure details

Source files:

- `src/runtime/tools/external/tool-runner.js` — spawn wrapper with timeout,
  PATH augmentation, and structured result
- `src/runtime/tools/external/typecheck.js` — tsc config detection and output parsing
- `src/runtime/tools/external/lint.js` — eslint/biome config detection and output parsing
- `src/runtime/tools/external/test-run.js` — framework detection and output parsing

All external tools return `status: 'unavailable'` when the relevant config is
missing, and `status: 'timeout'` when the child process exceeds its deadline.
They are registered in `createToolRegistry()` and wrapped by `wrapToolExecution()`
like all other tools.

External tools validate target-project app behavior only when project-local config exists. If no `tsconfig`, lint config, or test framework is detected, their `unavailable` result is honest evidence of a missing target-project validation path, not a failed OpenKit runtime check.

## 4. Hook Layer

Hooks are created in:

- `src/runtime/create-hooks.js`

Hook groups come from:

- session hooks
- tool guard hooks
- continuation hooks
- skill hooks

### Tool guard hooks

These are especially important because they constrain runtime behavior:

- stage readiness
- verification claim guard
- issue closure guard
- parallel safety guard
- write guard
- bash guard
- tool output truncation

Tool guard hooks are assembled in:

- `src/runtime/hooks/create-tool-guard-hooks.js`

## 5. Skills

Skills are loaded through:

- `src/runtime/skills/skill-loader.js`
- `src/runtime/skills/skill-registry.js`

Skill sources include:

- project-local skills
- project `.opencode` skill scope
- user-local skills

Each skill may also declare MCP references by mentioning `mcp.<name>` in its markdown.

## 6. Commands

Runtime commands are loaded through:

- `src/runtime/commands/command-loader.js`

Command sources include:

- builtin runtime commands
- project markdown commands under `commands/`

Builtin runtime commands currently include:

- `/browser-verify`
- `/switch`
- `/switch-profiles`
- `/init-deep`
- `/refactor`
- `/start-work`
- `/handoff`
- `/stop-continuation`

Project command markdown also provides lane commands and workflow ergonomics such as:

- `/task`
- `/quick-task`
- `/migrate`
- `/delivery`
- `/brainstorm`
- `/write-solution`
- `/execute-solution`
- `/configure-agent-models`
- `/switch-profiles`

## 7. MCP Platform

The MCP platform is created in:

- `src/runtime/mcp/index.js`

Built-in MCPs are currently:

- `mcp.websearch`
- `mcp.docs-search`
- `mcp.code-search`

The platform also loads configured external MCP servers via runtime config.

Operator-facing MCP setup is handled outside this runtime MCP dispatch layer by the `global_cli` command surface. `openkit configure mcp --interactive` is a thin TTY-only wizard over the bundled catalog, custom MCP registry, local MCP config store, secret manager, profile materializer, and health checks. The wizard can list/doctor/test custom MCPs and route creation/import requests to non-interactive commands, but it does not implement a full custom creation wizard or create wizard-specific runtime state.

Custom MCP definitions live in `<OPENCODE_HOME>/openkit/custom-mcp-config.json`, separate from the bundled catalog and bundled `mcp-config.json`. Custom entries carry `kind=custom`, `origin=local|remote|imported-global`, and `ownership=openkit-managed-custom`; runtime capability inventory and `tool.mcp-doctor` merge them with bundled entries only as read models and keep bundled skill-to-MCP routing catalog-owned. Generated profiles and runtime summaries must keep placeholders/redacted key state only.

### MCP dispatch behavior

Dispatch entry:
- `src/runtime/mcp/dispatch.js`

Current behavior:
- builtin dispatch is now executable (`dispatchMcpCall` invokes builtin `execute()`)
- builtin enable/disable flags from runtime config are honored
- unknown builtin requests attempt external-server dispatch
- external servers are normalized from `.mcp.json` / `.opencode/mcp.json`
- external transports currently supported:
  - `http` (JSON POST)
  - `stdio` (single-request process invoke)
- dispatch is timeout-bounded and returns structured timeout/error payloads

Builtin MCP runtime semantics:
- `mcp.code-search` delegates to `SessionMemoryManager.semanticSearchQuery()`
- `mcp.docs-search` delegates to external provider capability `docs-search` when configured, otherwise returns `no-provider`
- `mcp.websearch` delegates to external provider capability `websearch` when configured, otherwise returns `no-provider`

Treat provider-backed MCPs without a configured provider as `not_configured` or `degraded` in operator-facing summaries rather than fully available.

## 7.1 Browser And Background Boundaries

- `/browser-verify` and browser runtime tools are `preview` evidence helpers. They can plan checks and capture artifacts, but they do not approve QA gates by themselves.
- Background execution and continuation controls are runtime aids. They do not create unrestricted parallelism and do not override workflow stages, approvals, or task-board safety checks.
- Any parallel or background work must stay inside the approved solution package and runtime allocation constraints.

## 8. Specialists

Specialists are created in:

- `src/runtime/specialists/specialist-registry.js`

Default specialist set:

- oracle
- librarian
- explore
- multimodal-looker
- metis
- momus

These are support surfaces layered under workflow ownership, not replacements
for the lane/role contract.

### Specialist enrichments

Specialists now include:

- `systemPromptPath` (checked-in prompt file)
- `systemPrompt` (hydrated content loaded by registry)
- `tools` (explicit tool allowance list)

Prompt source directory:

- `src/runtime/specialists/prompts/`

Registry hydration path:

- `src/runtime/specialists/specialist-registry.js`

## 9. Context Injection

Context injection is created in:

- `src/runtime/context/context-injector.js`

It currently provides:

- directory agent path discovery
- README path discovery
- workflow-state context
- injected rule fragments from hooks

## 10. Mental Model

The easiest way to think about these layers is:

```text
commands shape how work starts
skills shape how work should be done
hooks constrain unsafe behavior
tools provide direct capabilities
MCPs provide external/search-style surfaces
specialists provide focused support roles
```
