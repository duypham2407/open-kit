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
- supervisor dialogue manager configuration and adapter health are `runtime_tooling`; persisted supervisor dialogue read models surfaced through workflow-state `status` or `resume-summary --json` are `compatibility_runtime`

### Workflow tools

Examples:
- workflow state
- runtime summary
- evidence capture

Workflow-state runtime summaries also expose supervisor dialogue read models for the active work item when relevant. The compact read model includes supervisor health, outbound delivery counts (`pending`, `delivered`, `failed`, `skipped`), inbound rejection counts, duplicate counts, last adjudication, and attention state. Missing supervisor stores are reported as absent/unavailable so reviewer and QA surfaces stay inspectable without requiring OpenClaw to be configured.

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

## 7. MCP Platform

The MCP platform is created in:

- `src/runtime/mcp/index.js`

Built-in MCPs are currently:

- `mcp.websearch`
- `mcp.docs-search`
- `mcp.code-search`

The platform also loads configured external MCP servers via runtime config.

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
