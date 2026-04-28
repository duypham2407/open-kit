---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-950
feature_slug: capability-platform-maturation-roadmap
source_scope_package: docs/scope/2026-04-28-capability-platform-maturation-roadmap.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: none
---

# Solution Package: Capability Platform Maturation Roadmap

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-28-capability-platform-maturation-roadmap.md`.
- Current lane/stage/owner: `full` / `full_solution` / `SolutionLead` for `FEATURE-950` / `capability-platform-maturation-roadmap`.
- Product gate: `product_to_solution` is approved by user instruction; this package is the `solution_to_fullstack` handoff artifact only.
- Scope preservation: this is one ordered full-delivery roadmap feature with three mandatory phases: Phase 1 MCP / Extensibility Platform Hardening -> Phase 2 Code Intelligence Hardening -> Phase 3 Capability-Aware Orchestration.
- This solution must not add workflow lanes, redefine `quick` / `migration` / `full`, promise undocumented live parallelism, or treat OpenKit runtime checks as target-project application validation.

## Recommended Path

Execute FEATURE-950 as a sequential capability-maturity program that first normalizes capability status/readiness for MCP and extensibility, then wires code-intelligence tools into that same inspectable capability model, and only then lets orchestration consume the resulting capability summaries as advisory inputs.

This is enough because the repository already contains the necessary foundations:

- MCP configuration and custom MCP lifecycle surfaces under `src/global/mcp/`, `src/capabilities/mcp-catalog.js`, `bin/openkit.js`, and `src/cli/commands/configure.js`.
- Runtime capability inventory, router, and health tools under `src/runtime/tools/capability/`, `src/runtime/managers/capability-registry-manager.js`, and `src/runtime/capability-registry.js`.
- Code-intelligence surfaces under `src/runtime/analysis/`, `src/runtime/tools/graph/`, `src/runtime/tools/syntax/`, `src/runtime/tools/codemod/`, `src/runtime/tools/lsp/`, and `src/runtime/tools/external/`.
- Compatibility runtime read models and evidence surfaces under `.opencode/lib/`, `.opencode/workflow-state.js`, and `src/runtime/tools/workflow/`.
- Existing validation commands in `package.json`, including `npm run verify:all`, `npm run verify:runtime-foundation`, `npm run verify:governance`, `npm run verify:semgrep-quality`, and targeted `node --test ...` suites.

The implementation should harden and align existing surfaces. It should not introduce a second capability platform, a new registry format unrelated to current runtime metadata, a background autonomy layer, or target-project app validation defaults.

## Dependencies

- No new npm package dependency is recommended as part of the default solution.
- Continue using existing runtime dependencies: `@modelcontextprotocol/sdk`, `better-sqlite3`, `@ast-grep/cli`, `jscodeshift`, and Tree-sitter packages already declared in `package.json`.
- Optional or environment-dependent providers, such as semantic embedding providers, MCP credentials, macOS Keychain, global OpenCode MCP config, and network-backed custom MCPs, must stay `not_configured`, `degraded`, or `unavailable` when absent.
- Target-project application validation remains unavailable unless a separate target project defines app-native build/lint/test/smoke commands. OpenKit CLI/runtime/workflow checks are not substitutes for `target_project_app` evidence.

## Impacted Surfaces

### Phase 1 — MCP / Extensibility Platform Hardening

- `src/global/mcp/mcp-configurator.js`
- `src/global/mcp/mcp-config-service.js`
- `src/global/mcp/mcp-config-store.js`
- `src/global/mcp/custom-mcp-store.js`
- `src/global/mcp/custom-mcp-validation.js`
- `src/global/mcp/mcp-inventory.js`
- `src/global/mcp/health-checks.js`
- `src/global/mcp/profile-materializer.js`
- `src/global/mcp/secret-manager.js`
- `src/global/mcp/redaction.js`
- `src/global/mcp/interactive-wizard.js`
- `src/capabilities/mcp-catalog.js`
- `src/runtime/managers/mcp-health-manager.js`
- `src/runtime/tools/capability/mcp-doctor.js`
- `src/runtime/tools/capability/capability-health.js`
- `src/runtime/tools/capability/capability-inventory.js`
- `bin/openkit.js`, `src/cli/index.js`, and `src/cli/commands/configure.js`
- `docs/operator/mcp-configuration.md`, `docs/operator/supported-surfaces.md`, `docs/operator/README.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/project-config.md`, `context/core/runtime-surfaces.md`, and `AGENTS.md` only where command reality changes.
- Tests: `tests/cli/configure-mcp.test.js`, `tests/cli/configure-mcp-custom.test.js`, `tests/cli/configure-mcp-interactive.test.js`, `tests/global/custom-mcp-store.test.js`, `tests/global/custom-mcp-validation.test.js`, `tests/global/mcp-config-store.test.js`, `tests/global/mcp-profile-materializer.test.js`, `tests/global/mcp-interactive-wizard.test.js`, `tests/global/mcp-secret-manager.test.js`, `tests/install/mcp-secret-package-readiness.test.js`, and `tests/runtime/capability-tools.test.js`.

### Phase 2 — Code Intelligence Hardening

- `src/runtime/analysis/project-graph-db.js`
- `src/runtime/analysis/import-graph-builder.js`
- `src/runtime/analysis/call-graph-builder.js`
- `src/runtime/analysis/reference-tracker.js`
- `src/runtime/analysis/embedding-indexer.js`
- `src/runtime/analysis/embedding-provider.js`
- `src/runtime/analysis/code-chunk-extractor.js`
- `src/runtime/analysis/file-watcher.js`
- `src/runtime/analysis/language-support/`
- `src/runtime/managers/project-graph-manager.js`
- `src/runtime/tools/graph/import-graph.js`
- `src/runtime/tools/graph/find-dependencies.js`
- `src/runtime/tools/graph/find-dependents.js`
- `src/runtime/tools/graph/find-symbol.js`
- `src/runtime/tools/graph/semantic-search.js`
- `src/runtime/tools/graph/goto-definition.js`
- `src/runtime/tools/graph/find-references.js`
- `src/runtime/tools/graph/call-hierarchy.js`
- `src/runtime/tools/graph/rename-preview.js`
- `src/runtime/tools/syntax/syntax-outline.js`
- `src/runtime/tools/syntax/syntax-context.js`
- `src/runtime/tools/syntax/syntax-locate.js`
- `src/runtime/tools/codemod/codemod-preview.js`
- `src/runtime/tools/codemod/codemod-apply.js`
- `src/runtime/tools/lsp/`
- `src/runtime/tools/external/typecheck.js`, `src/runtime/tools/external/lint.js`, and `src/runtime/tools/external/test-run.js`
- `src/runtime/tools/tool-registry.js`, `src/runtime/create-tools.js`, `src/runtime/create-managers.js`, and `src/runtime/create-runtime-interface.js`
- `src/mcp-server/tool-schemas.js` and `src/mcp-server/index.js` if tool schema/readiness metadata changes.
- Docs/tests: `docs/operator/supported-surfaces.md`, `docs/maintainer/test-matrix.md`, `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`, `context/core/tool-substitution-rules.md`, `context/core/project-config.md`, `context/core/runtime-surfaces.md`, `tests/runtime/project-graph-manager.test.js`, `tests/runtime/import-graph-builder.test.js`, `tests/runtime/graph-db.test.js`, `tests/runtime/graph-tools.test.js`, `tests/runtime/graph-navigation-tools.test.js`, `tests/runtime/syntax-path-resolution.test.js`, `tests/runtime/codemod-tools.test.js`, `tests/runtime/lsp-graph-integration.test.js`, `tests/runtime/semantic-memory.test.js`, `tests/runtime/embedding-pipeline.test.js`, `tests/runtime/language-support.test.js`, and `tests/runtime/external-tools.test.js`.

### Phase 3 — Capability-Aware Orchestration

- `hooks/session-start.js` and `hooks/session-start`
- `src/runtime/tools/capability/capability-router.js`
- `src/runtime/tools/capability/capability-router-summary.js`
- `src/runtime/managers/capability-registry-manager.js`
- `src/runtime/capability-registry.js`
- `src/runtime/tools/workflow/runtime-summary.js`
- `src/runtime/tools/workflow/workflow-state.js`
- `src/runtime/tools/workflow/evidence-capture.js`
- `.opencode/lib/runtime-summary.js`
- `.opencode/lib/runtime-guidance.js`
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/workflow-state.js`
- `src/runtime/hooks/tool-guards/stage-readiness-hook.js`
- `src/runtime/hooks/tool-guards/parallel-safety-hook.js`
- `src/runtime/hooks/tool-guards/verification-claim-hook.js`
- `agents/fullstack-agent.md`, `agents/code-reviewer.md`, `agents/qa-agent.md`, `agents/solution-lead.md`, and corresponding install-bundle copies only if prompt guidance changes.
- Docs/tests: `context/core/workflow.md`, `context/core/project-config.md`, `context/core/runtime-surfaces.md`, `context/core/approval-gates.md`, `docs/templates/solution-package-template.md`, `docs/templates/qa-report-template.md`, `docs/operator/supported-surfaces.md`, `docs/maintainer/test-matrix.md`, `.opencode/tests/session-start-hook.test.js`, `.opencode/tests/workflow-state-cli.test.js`, `.opencode/tests/workflow-state-controller.test.js`, `.opencode/tests/workflow-contract-consistency.test.js`, `tests/runtime/capability-tools.test.js`, `tests/runtime/runtime-platform.test.js`, `tests/runtime/governance-enforcement.test.js`, and `tests/runtime/invocation-logging.test.js`.

## Boundaries And Component Decisions

- **Capability status vocabulary stays canonical.** Use `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`; do not add synonyms such as `ready-ish`, `active`, or `maybe`.
- **Validation-surface labels stay canonical.** Use `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, `package`, and `target_project_app` exactly as defined in `context/core/project-config.md` and `context/core/runtime-surfaces.md`.
- **Phase artifacts must be inspectable in both docs and affected runtime/diagnostic/read-model surfaces.** Documentation-only hardening is insufficient when the phase claims to harden runtime behavior.
- **Capability summaries are read models, not authority grants.** They may guide routing, tool choice, diagnostics, and evidence interpretation, but they must not approve gates, mutate workflow state, load skills, execute MCP tools, or assign role ownership.
- **Global, in-session, compatibility runtime, and target app surfaces remain distinct.** A healthy `openkit doctor` result cannot prove graph indexing behavior; a passing workflow-state doctor cannot prove target app tests.
- **Fallbacks are product behavior and must be visible.** Missing native modules, unindexed graphs, disabled embeddings, unavailable Semgrep, absent credentials, non-TTY wizard context, stale MCP sessions, and global/check-in version drift should produce clear status/caveat output instead of silent success.
- **Task-board parallelism remains conservative.** This feature should use a task board only for traceability after `solution_to_fullstack`; do not enable parallel overlap because the three phases intentionally share status vocabulary, read models, docs, and orchestration surfaces.

## Interfaces And Data Contracts

### Capability status envelope

All hardened capability surfaces should converge on a compact status envelope. The exact implementation can be plain JavaScript objects, but downstream read models and docs should expose the same concepts:

```text
CapabilityStatus {
  id
  label
  family: mcp | custom_mcp | code_intelligence | workflow | scan | browser | background | external_tool
  surface: global_cli | in_session | compatibility_runtime | runtime_tooling | documentation | package | target_project_app
  state: available | unavailable | degraded | preview | compatibility_only | not_configured
  source: bundled | custom | runtime | compatibility | package | target-project
  freshness: fresh | startup_snapshot | cached | stale | unknown
  evidenceRefs: string[]
  caveats: string[]
  nextActions: string[]
}
```

Rules:

- Do not require every existing command to return this literal object, but align human and JSON read models around these fields where status is reported.
- Do not serialize raw secrets, env values, headers, provider payloads, or full command env maps.
- `needs-key` may appear only as a human caveat over `not_configured`; it is not a new state.
- If a status is derived from startup or cached context, expose freshness and refresh guidance.

### Phase completion record

Each phase should leave an implementation-facing completion record in workflow evidence and/or QA artifacts containing:

```text
PhaseCompletion {
  phase_id: phase-1 | phase-2 | phase-3
  phase_name
  completed_slices
  acceptance_criteria_covered
  validation_surfaces_checked
  commands_or_tools_run
  unavailable_validation_paths
  unresolved_blockers
  downstream_unlock_decision
}
```

Phase 2 cannot start as delivery work until Phase 1's record exists with either no blockers or explicit accepted caveats. Phase 3 cannot start as delivery work until Phase 2's record exists with the same standard.

### Orchestration guidance contract

Capability-aware orchestration outputs must say:

- what capability state influenced the recommendation;
- whether the state is fresh, cached, degraded, preview-only, or not configured;
- what evidence or read model was used;
- what manual confirmation, approval gate, or validation remains required;
- that role/stage ownership and lane semantics are unchanged.

They must not say:

- a skill, MCP, tool, QA pass, or parallel worker was activated unless it actually was;
- target-project app validation passed unless an app-native command exists and passed;
- full-delivery parallelism is live without explicit task-board approval and safe zone coverage.

## Risks And Trade-offs

- **Risk: roadmap breadth becomes capability sprawl.** Containment: keep every slice tied to hardening, inspectability, diagnostics, validation, or role-safe orchestration; route unrelated capability ideas back to Product Lead.
- **Risk: Phase 3 pressure causes foundation bypass.** Containment: Phase 2 and Phase 3 have explicit unlock gates based on earlier phase completion records.
- **Risk: status vocabulary forks across MCP, graph, runtime summary, and docs.** Containment: update shared docs and read-model helpers first in each phase, then align individual tools.
- **Risk: validation overclaims.** Containment: every slice records validation surface labels and explicitly reports unavailable `target_project_app` validation when relevant.
- **Risk: code-intelligence readiness varies by environment.** Containment: treat missing `better-sqlite3`, missing embeddings, unsupported languages, unindexed projects, and absent external tools as first-class statuses.
- **Risk: stale active sessions hide fresh implementation.** Containment: distinguish checked-in test/runtime validation from active in-session namespace status and document refresh/restart guidance.
- **Trade-off: sequential delivery is slower.** Accepted because phase order is a product requirement and shared surfaces make parallel overlap unsafe.

## Implementation Slices

### [ ] Slice 0: Baseline capability map and phase gate scaffolding

- **Phase**: Cross-phase prerequisite.
- **Files**: `context/core/project-config.md`, `context/core/runtime-surfaces.md`, `docs/maintainer/test-matrix.md`, `docs/operator/supported-surfaces.md`, `.opencode/lib/runtime-summary.js`, `.opencode/workflow-state.js`, `src/runtime/tools/workflow/evidence-capture.js` if evidence/read-model shape changes.
- **Goal**: capture the current MCP/extensibility, code-intelligence, and orchestration capability map before hardening begins, and define the phase completion evidence shape used to unlock later phases.
- **Validation Command**: `node --test .opencode/tests/workflow-state-cli.test.js .opencode/tests/workflow-contract-consistency.test.js` plus documentation review. Target-project app validation is unavailable.
- **Details**:
  - Add or update a concise capability inventory table in docs with current status labels, validation surfaces, refresh paths, and known caveats.
  - Define the implementation evidence convention for Phase 1/2/3 completion records without adding new workflow stages or gates.
  - Fullstack should record Phase 0 evidence before touching Phase 1 runtime behavior so reviewers can identify maturity deltas.

### [ ] Slice 1: Phase 1 MCP/extensibility status normalization

- **Phase**: Phase 1 — MCP / Extensibility Platform Hardening.
- **Files**: `src/global/mcp/mcp-inventory.js`, `src/global/mcp/health-checks.js`, `src/global/mcp/mcp-config-service.js`, `src/runtime/managers/mcp-health-manager.js`, `src/runtime/tools/capability/mcp-doctor.js`, `src/runtime/tools/capability/capability-health.js`, `src/runtime/tools/capability/capability-inventory.js`, `src/capabilities/mcp-catalog.js` only for metadata/caveat alignment.
- **Goal**: make bundled and custom MCP/extensibility statuses consistent, redacted, and inspectable across CLI, runtime health, and capability inventory.
- **Validation Command**: `node --test tests/runtime/capability-tools.test.js tests/runtime/mcp-catalog.test.js tests/global/custom-mcp-store.test.js tests/global/custom-mcp-validation.test.js tests/global/mcp-config-store.test.js tests/global/mcp-secret-manager.test.js`.
- **Details**:
  - Normalize bundled/custom MCP inventory rows around capability state, kind, origin, ownership, enablement, key/dependency status, caveats, and next actions.
  - Preserve secret safety: no raw keys, headers, env values, or provider payloads in command output, runtime summaries, tests, docs, or evidence.
  - Missing credentials, disabled custom MCPs, unconfigured supervisor/OpenClaw transports, and unsupported remote tests should be reported as status/caveat outcomes, not silent success or fatal failure by default.

### [ ] Slice 2: Phase 1 CLI/operator diagnostics and setup boundary hardening

- **Phase**: Phase 1 — MCP / Extensibility Platform Hardening.
- **Files**: `bin/openkit.js`, `src/cli/index.js`, `src/cli/commands/configure.js`, `src/global/mcp/mcp-configurator.js`, `src/global/mcp/interactive-wizard.js`, `src/global/mcp/profile-materializer.js`, `src/global/mcp/redaction.js`, `docs/operator/mcp-configuration.md`, `docs/operator/supported-surfaces.md`, `context/core/project-config.md`, `AGENTS.md` if command reality changes.
- **Goal**: ensure operator-facing MCP diagnostics, guided setup, custom MCP lifecycle, and profile materialization expose real readiness and safety boundaries.
- **Validation Command**: `node --test tests/cli/configure-mcp.test.js tests/cli/configure-mcp-custom.test.js tests/cli/configure-mcp-interactive.test.js tests/global/mcp-interactive-wizard.test.js tests/global/mcp-profile-materializer.test.js tests/install/mcp-secret-package-readiness.test.js` and `npm run verify:mcp-secret-package-readiness`.
- **Details**:
  - Keep `openkit configure mcp --interactive` TTY-only and fail-closed without mutation in non-TTY contexts.
  - Keep custom MCP definitions separate from bundled catalog state and materialize placeholders only.
  - CLI output should label `global_cli` validation separately from runtime/in-session capability summaries.
  - Phase 1 completion requires inspectable docs plus passing targeted MCP/global/package tests or explicit blockers.

### [ ] Slice 3: Phase 2 code-intelligence readiness envelope

- **Phase**: Phase 2 — Code Intelligence Hardening. Requires Phase 1 completion record.
- **Files**: `src/runtime/managers/project-graph-manager.js`, `src/runtime/analysis/project-graph-db.js`, `src/runtime/analysis/import-graph-builder.js`, `src/runtime/analysis/embedding-indexer.js`, `src/runtime/analysis/embedding-provider.js`, `src/runtime/tools/graph/import-graph.js`, `src/runtime/tools/graph/semantic-search.js`, `src/runtime/tools/graph/find-symbol.js`, `src/runtime/tools/graph/find-dependencies.js`, `src/runtime/tools/graph/find-dependents.js`, `src/runtime/create-managers.js`, `src/runtime/create-runtime-interface.js`.
- **Goal**: make graph, symbol, dependency, semantic, and embedding readiness/fallback behavior explicit and machine-readable enough for runtime summaries and agents to trust cautiously.
- **Validation Command**: `node --test tests/runtime/project-graph-manager.test.js tests/runtime/import-graph-builder.test.js tests/runtime/graph-db.test.js tests/runtime/graph-tools.test.js tests/runtime/semantic-memory.test.js tests/runtime/embedding-pipeline.test.js tests/runtime/enhanced-symbols.test.js`.
- **Details**:
  - Report index status, DB availability, `better-sqlite3` availability, indexing errors, stale indexes, empty graph, embedding disabled/not configured/degraded-to-keyword behavior, and unsupported project shapes.
  - Ensure semantic search distinguishes `embedding`, `keyword`, and `hybrid` evidence without implying full semantic coverage when embeddings are missing.
  - Do not bypass Phase 1 status conventions; reuse the shared status envelope and validation-surface labels.

### [ ] Slice 4: Phase 2 syntax/AST/codemod/LSP/external tool evidence quality

- **Phase**: Phase 2 — Code Intelligence Hardening.
- **Files**: `src/runtime/tools/syntax/syntax-outline.js`, `src/runtime/tools/syntax/syntax-context.js`, `src/runtime/tools/syntax/syntax-locate.js`, `src/runtime/tools/codemod/codemod-preview.js`, `src/runtime/tools/codemod/codemod-apply.js`, `src/runtime/tools/lsp/`, `src/runtime/tools/external/typecheck.js`, `src/runtime/tools/external/lint.js`, `src/runtime/tools/external/test-run.js`, `src/runtime/tools/shared/project-file-utils.js`, `src/runtime/tools/tool-registry.js`, `src/mcp-server/tool-schemas.js` if schemas change.
- **Goal**: harden non-graph code-intelligence tools so unsupported languages, path boundaries, fallback modes, missing external configs, and preview-only behavior are explicit.
- **Validation Command**: `node --test tests/runtime/syntax-path-resolution.test.js tests/runtime/codemod-tools.test.js tests/runtime/lsp-graph-integration.test.js tests/runtime/graph-navigation-tools.test.js tests/runtime/language-support.test.js tests/runtime/external-tools.test.js tests/mcp-server/mcp-server.test.js`.
- **Details**:
  - Syntax tools should expose unsupported-language and path-root outcomes without pretending all files are parseable.
  - AST/codemod tools should distinguish preview/dry-run/unsupported/fallback behavior and avoid destructive ambiguity.
  - `tool.typecheck`, `tool.lint`, and `tool.test-run` should continue to report unavailable `target_project_app` validation when target project configs are absent.
  - Phase 2 completion requires docs and read models showing how to interpret code-intelligence evidence quality.

### [ ] Slice 5: Phase 3 orchestration advisory consumption of capability state

- **Phase**: Phase 3 — Capability-Aware Orchestration. Requires Phase 2 completion record.
- **Files**: `src/runtime/tools/capability/capability-router.js`, `src/runtime/tools/capability/capability-router-summary.js`, `src/runtime/managers/capability-registry-manager.js`, `src/runtime/capability-registry.js`, `hooks/session-start.js`, `src/runtime/tools/workflow/runtime-summary.js`, `.opencode/lib/runtime-summary.js`, `.opencode/lib/runtime-guidance.js`, `.opencode/workflow-state.js`.
- **Goal**: let orchestration and startup/readiness guidance use hardened capability summaries as advisory context while preserving role boundaries and explicit caveats.
- **Validation Command**: `node --test .opencode/tests/session-start-hook.test.js .opencode/tests/workflow-state-cli.test.js tests/runtime/capability-tools.test.js tests/runtime/runtime-platform.test.js tests/runtime/capability-registry.test.js`.
- **Details**:
  - Startup and runtime summaries may recommend tool families, refresh paths, or caveats, but must say advisory-only and no skill/MCP/tool was auto-activated.
  - Capability guidance should include stale snapshot/freshness caveats and role/stage guardrails.
  - Avoid large catalog dumps; route users to explicit detail tools such as `tool.runtime-summary`, `tool.capability-router`, `tool.skill-index`, `tool.capability-inventory`, `tool.mcp-doctor`, and workflow-state status/resume commands.

### [ ] Slice 6: Phase 3 workflow guardrails, docs, and final evidence alignment

- **Phase**: Phase 3 — Capability-Aware Orchestration.
- **Files**: `context/core/workflow.md`, `context/core/approval-gates.md`, `context/core/project-config.md`, `context/core/runtime-surfaces.md`, `context/core/tool-substitution-rules.md`, `docs/templates/solution-package-template.md`, `docs/templates/qa-report-template.md`, `docs/operator/supported-surfaces.md`, `docs/maintainer/test-matrix.md`, `agents/fullstack-agent.md`, `agents/code-reviewer.md`, `agents/qa-agent.md`, install-bundle copies if prompts/templates are packaged, `.opencode/lib/workflow-state-controller.js`, `src/runtime/hooks/tool-guards/stage-readiness-hook.js`, `src/runtime/hooks/tool-guards/parallel-safety-hook.js`, `src/runtime/hooks/tool-guards/verification-claim-hook.js` only if guard behavior changes.
- **Goal**: align workflow docs, prompts, templates, guards, and evidence expectations so capability-aware orchestration cannot be mistaken for new lanes, hidden approvals, or undocumented parallel autonomy.
- **Validation Command**: `npm run verify:governance`, `npm run verify:install-bundle`, `node --test tests/runtime/governance-enforcement.test.js tests/runtime/invocation-logging.test.js`, and final `npm run verify:all` before handoff to Code Review if implementation changes runtime/package surfaces broadly.
- **Details**:
  - Confirm `quick`, `migration`, and `full` semantics remain unchanged.
  - Confirm full-delivery task-board guidance stays conditional and solution-approved; this package keeps `parallel_mode: none`.
  - Final evidence must include phase completion records, validation-surface labels, unavailable target-project app validation, and unresolved caveats/blockers.

## Dependency Graph

- Critical path: `Slice 0 -> Slice 1 -> Slice 2 -> Phase 1 completion record -> Slice 3 -> Slice 4 -> Phase 2 completion record -> Slice 5 -> Slice 6 -> final verification`.
- Mandatory phase chain: `Phase 1 MCP/extensibility -> Phase 2 code intelligence -> Phase 3 capability-aware orchestration`.
- Phase 2 must not start until Phase 1 docs/runtime diagnostics are inspectable and blockers are recorded.
- Phase 3 must not start until Phase 2 readiness/fallback/evidence-quality behavior is inspectable and blockers are recorded.
- Within a phase, Fullstack may stage local commits or internal task rows, but execution should remain sequential because shared status vocabulary, runtime summaries, docs, and guardrails are touched across slices.

## Parallelization Assessment

- parallel_mode: `none`
- why: FEATURE-950 intentionally hardens shared capability vocabulary, diagnostics, runtime read models, workflow guidance, and docs in a strict phase order. Parallel overlap would make it easy for Phase 2/3 work to depend on incomplete Phase 1/2 definitions or to overstate capability readiness.
- safe_parallel_zones: []
- sequential_constraints:
  - `TASK-F950-BASELINE -> TASK-F950-P1-STATUS -> TASK-F950-P1-CLI -> TASK-F950-P2-GRAPH -> TASK-F950-P2-TOOLS -> TASK-F950-P3-GUIDANCE -> TASK-F950-P3-GUARDRAILS`
- integration_checkpoint: after each phase, record a phase completion evidence item and run the phase validation commands before starting the next phase.
- max_active_execution_tracks: 1

If a full-delivery task board is created after approval, use it for traceability only. Do not set `parallel_limited` or `parallel_enabled` for this feature without a revised Solution Lead artifact and explicit shared-surface safety analysis.

## Validation Matrix

| Acceptance target | Validation path | Surface label |
| --- | --- | --- |
| AC1.1 MCP/extensibility status is inspectable | Targeted MCP inventory/health/runtime tests; CLI output review; docs review | `global_cli`, `runtime_tooling`, `documentation` |
| AC1.2 diagnostics and validation boundaries are explicit | CLI/configure tests, mcp secret package readiness, docs review for surface labels | `global_cli`, `package`, `documentation` |
| AC1.3 Phase 1 product artifacts exist | Phase 1 completion evidence plus docs/runtime read-model inspection | `compatibility_runtime`, `runtime_tooling`, `documentation` |
| AC1.4 control and safety boundaries preserved | Secret redaction tests, custom MCP validation tests, profile materializer tests | `global_cli`, `package`, `runtime_tooling` |
| AC2.1 code-intelligence capability state is honest | Graph/semantic/syntax/codemod/external tool tests with available/degraded/unavailable cases | `runtime_tooling` |
| AC2.2 evidence quality is clarified | Runtime summary/read-model inspection plus docs/test matrix updates | `runtime_tooling`, `documentation`, `compatibility_runtime` |
| AC2.3 Phase 2 depends on Phase 1 | Phase completion record inspection before starting Phase 2 | `compatibility_runtime`, `documentation` |
| AC2.4 Phase 2 outputs are inspectable | Targeted code-intelligence tests plus docs/operator/maintainer updates | `runtime_tooling`, `documentation` |
| AC3.1 orchestration depends on hardened foundations | Phase 1 and Phase 2 completion evidence checked before Phase 3 slices | `compatibility_runtime`, `documentation` |
| AC3.2 capability influence is inspectable | Session-start/runtime-summary/workflow-state tests and output review | `in_session`, `runtime_tooling`, `compatibility_runtime` |
| AC3.3 workflow and role boundaries preserved | `npm run verify:governance`, workflow contract consistency tests, prompt/template review | `documentation`, `compatibility_runtime`, `package` |
| AC3.4 no overpromised parallelism/autonomy | Parallel-safety docs/guard tests if touched; final artifact and QA review | `documentation`, `compatibility_runtime` |
| No target-project app validation overclaim | All reports label `target_project_app` as unavailable unless a real target app command exists | `target_project_app` unavailable-path reporting |

Final implementation should run the strongest available repository validation before Code Review. For this broad feature that likely means targeted phase commands during implementation and `npm run verify:all` at final integration, provided dependencies such as Semgrep and native modules are available. If a command cannot run in the environment, record the exact failure and unavailable/degraded surface rather than replacing it with a fake pass.

## Integration Checkpoints

1. **Baseline checkpoint**: capability inventory/status map exists and current command reality is documented before runtime changes.
2. **Phase 1 checkpoint**: MCP/extensibility diagnostics, CLI setup boundaries, redaction, and docs are inspectable; Phase 1 completion evidence is recorded.
3. **Phase 2 checkpoint**: graph/syntax/AST/semantic/external tool readiness and fallback states are inspectable; Phase 2 completion evidence is recorded.
4. **Phase 3 checkpoint**: orchestration guidance consumes capability state only as advisory context and preserves lane/role boundaries; final evidence is recorded.
5. **Pre-review checkpoint**: targeted phase validations plus `npm run verify:governance`, package sync/readiness checks where affected, and final `npm run verify:all` when feasible.

## Rollback And Guardrail Notes

- Prefer additive read-model fields and docs before replacing existing behavior. If a phase causes instability, revert the phase-specific read model/tool wiring while preserving earlier phase outputs.
- Phase 1 rollback must not delete existing bundled MCP config, custom MCP registry files, or user secrets. Disable new reporting paths or service helpers rather than mutating user state.
- Phase 2 rollback must not delete project graph databases or embedding config. Make new readiness fields optional and tolerate missing index data.
- Phase 3 rollback should remove advisory orchestration consumption while leaving hardened Phase 1/2 status surfaces intact.
- Keep schema changes backward-compatible where possible. If a persisted schema must change, include versioning and migration/compatibility notes in the implementation evidence.
- Guard against documentation drift by updating `context/core/project-config.md`, `context/core/runtime-surfaces.md`, `AGENTS.md`, and maintainer/operator docs in the same phase as command or surface changes.

## Task Slicing Guidance For Fullstack

- Create a full-delivery task board only after `solution_to_fullstack` approval if the runtime/workflow expects one for this large feature.
- Use task ids matching the dependency chain in the parallelization assessment.
- Each task should list artifact refs limited to its phase/slice, but all tasks remain sequential.
- Each phase should end with an evidence-capture task that records completed acceptance criteria, validation commands, validation surfaces, unavailable paths, and blockers.
- Do not begin Phase 2 or Phase 3 tasks until the previous phase evidence task is complete.
- Keep implementation diffs reviewable by separating runtime behavior, CLI/docs, and tests within each phase, but do not allow cross-phase overlap.

## Anti-Scope-Creep Controls

- Reject new workflow lanes, stage names, approval gates, or owner responsibility changes unless Product Lead explicitly reopens scope.
- Reject new hosted services, marketplace behavior, broad MCP protocol expansion, or generalized background autonomy unless separately approved.
- Reject changes that turn custom MCP support into bundled MCP catalog entries or mix custom state into bundled config defaults.
- Reject code-intelligence claims that hide fallback/degraded behavior to make tools look more capable.
- Reject capability-router recommendations that imply automatic skill loading, MCP activation, hidden QA approval, or parallel execution.
- Reject any validation report that labels OpenKit runtime/CLI checks as target-project app-native build/lint/test evidence.

## Reviewer Focus Points

- Verify the strict phase order is preserved in code, docs, tests, and evidence.
- Verify capability status vocabulary and validation-surface labels are consistent across MCP, code-intelligence, runtime summary, workflow-state, and docs.
- Verify secrets and provider payloads are never printed in diagnostics, runtime summaries, tests, fixtures, or docs.
- Verify fallback/degraded/unavailable states are tested, not only the happy path.
- Verify `better-sqlite3`, embedding provider, Semgrep, external tool config, MCP credentials, and target-project app commands are treated as environment-dependent surfaces.
- Verify no new lane, stage enum, hidden approval, or undocumented parallel behavior is introduced.
- Verify package/install-bundle docs and generated assets stay synchronized if prompt/template/runtime surfaces are packaged.
- Verify final reports include unavailable `target_project_app` validation where applicable.

## Handoff Payload

- Recommended approach: sequential, phase-gated hardening of MCP/extensibility, code-intelligence, then advisory orchestration consumption.
- Required preservation: current `quick`, `migration`, and `full` lane semantics; existing role boundaries; conservative task-board/parallel behavior; validation-surface honesty.
- Required evidence: phase completion records, targeted phase validation outputs, final repository validation output or explicit unavailable/degraded command evidence, and QA artifact tying acceptance criteria to surfaces.
- Handoff decision: **pass** — this package provides one recommended path, explicit affected surfaces, strict sequencing, validation hooks that match real repository commands, rollback notes, parallelization constraints, and review focus points tied to the approved scope.
