---
artifact_type: solution_package
version: 1
status: draft
feature_id: FEATURE-953
feature_slug: capability-orchestrated-runtime
source_scope_package: docs/scope/2026-04-28-capability-orchestrated-runtime.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Capability-Orchestrated Runtime

## Chosen Approach

Extend the existing capability platform into a governed capability orchestration layer rather than creating a parallel runtime. The implementation should build on the current catalog and runtime surfaces in `src/capabilities/`, `src/runtime/capability-registry.js`, `src/runtime/managers/capability-registry-manager.js`, `src/runtime/tools/capability/`, `src/runtime/tools/tool-registry.js`, `src/mcp-server/tool-schemas.js`, and `src/runtime/create-runtime-interface.js`.

The core design is a metadata-first capability graph with a deterministic resolver, a selection protocol, explicit activation policies, and a capability decision ledger/read model:

- Capability graph: normalize bundled MCPs, custom MCPs, runtime tools, bundled skills, metadata-only skills, policy-gated entries, browser/external capabilities, and target-project validation probes into graph nodes and relationships.
- Resolver: score graph nodes against task intent, mode, stage, role, maturity, support level, readiness, MCP policy/readiness, side-effect level, domain signals, freshness, and validation-surface fit.
- Selection protocol: ranking produces bounded recommendations and exclusions only; activation is a separate step that may load a skill body or run a tool only after eligibility and policy checks pass.
- Activation policies: enforce no hidden skill loading, no MCP execution during ranking, no provider/browser calls unless task-relevant and configured, no mutating/dangerous action without policy gate outcome, and no workflow authority bypass.
- Evidence/read model: every meaningful ranked, selected, loaded, executed, skipped, blocked, degraded, stale, or failed capability decision records a sanitized ledger entry and contributes to bounded dashboard/read-model summaries.
- Dashboard: expose default pack readiness as a compact operator/readiness surface through runtime interface, runtime summary, capability tools, and global doctor/run output without dumping full catalogs by default.

The implementation should remain additive and preserve the current OpenCode config schema behavior. Do not add capability-orchestration keys directly into generated OpenCode config unless `src/opencode/config-schema.js` already permits those keys or is intentionally updated under a separate schema-preservation change. Prefer OpenKit-owned runtime config, read models, and tool output over expanding OpenCode config shape.

Acceptance coverage summary:

| Acceptance | Design Coverage |
| --- | --- |
| AC1-AC2 | Capability graph registers metadata for MCPs, tools, skills, metadata-only skills, policy/browser/external/validation probes with family/ownership/status/freshness/caveats. |
| AC3-AC5 | Resolver returns bounded explainable recommendations, safer-local preference, role/stage fit, downgrade/block reasons, and non-mutating ranking. |
| AC6-AC8 | Selection protocol treats metadata-only skills as discoverable but not loadable; skill load decisions are explicit and ledgered. |
| AC9, AC20-AC21 | Contracts carry `validationSurface`; target-project app validation is probed and reported unavailable unless app-native commands/config exist. |
| AC10-AC14 | Activation policies evaluate side-effect levels, command permission policy, external/browser readiness, blocked/needs-confirmation/degraded outcomes, and next actions. |
| AC15-AC16 | Decision ledger records sanitized evidence, caveats, policy outcomes, freshness, surfaces, and artifact refs without raw secrets/provider payloads. |
| AC17-AC19 | Dashboard/read model summarizes readiness, bounded detail, stale/cached/fresh state, custom/bundled separation, and explicit detail follow-up tools. |
| AC22 | Missing/malformed/stale metadata fails closed as degraded/unavailable with fallback guidance. |
| AC23 | Workflow contract remains advisory; no lane, stage, role, approval, review, QA, or authority changes. |
| AC24 | Documentation slices update operator, governance, and internals docs for governed autonomy. |

## Impacted Surfaces

Primary implementation surfaces:

- `src/capabilities/status.js`: extend shared constants and helper builders only if needed for side-effect/freshness enums while preserving existing capability states and validation surfaces.
- `src/capabilities/schema.js`: validate graph node contracts, resolver output envelopes, activation policy metadata, and ledger/read-model envelopes.
- `src/capabilities/skill-catalog.js`: preserve current skill metadata schema; add only narrow metadata needed for domain signals, side-effect defaults, or loadability if it cannot be derived from existing `packaging`, `support_level`, `roles`, `stages`, `tags`, `triggers`, and `recommended_mcps`.
- `src/capabilities/mcp-catalog.js`: preserve bundled/custom split; add side-effect, external/browser/local, and policy labels where missing and derive readiness from existing secret/dependency/policy fields.
- `src/runtime/capability-registry.js`: include runtime tools and capability graph summaries in default runtime capability metadata.
- `src/runtime/managers/capability-registry-manager.js`: become the main orchestration manager for graph construction, resolving, selection eligibility, policy checks, dashboard summaries, and ledger append/read operations.
- `src/runtime/tools/capability/`: add or extend tools for graph inspection, resolver/selection, decision ledger, and readiness dashboard while keeping existing inventory/router/health/doctor tools compatible.
- `src/runtime/tools/tool-registry.js`: register new runtime tools after manager support exists.
- `src/mcp-server/tool-schemas.js`: expose schemas for new/changed runtime tools and preserve strict JSON Schema definitions.
- `src/runtime/create-runtime-interface.js`: add bounded `capabilityOrchestration` and dashboard read-model summaries to `runtimeInterface`, not raw full catalogs.
- `src/global/doctor.js`, `src/runtime/doctor.js`, `src/cli/commands/run.js`: surface compact readiness/dashboard summaries and degraded caveats where operator-facing output already reports runtime capability state.
- `src/opencode/config-schema.js`, `src/global/materialize.js`, `src/global/mcp/profile-materializer.js`, `src/install/materialize.js`, `src/install/merge-policy.js`: review for schema-preservation risks; avoid adding unknown OpenCode top-level keys.
- `assets/default-command-permission-policy.json` and `src/permissions/command-permission-policy.js`: read policy data for capability gates; do not weaken existing confirm-required/degraded semantics.

Test and documentation surfaces:

- `tests/runtime/capability-tools.test.js`: tool behavior, resolver output, dashboard, ledger, redaction, side-effect/policy gates.
- `tests/runtime/capability-registry.test.js`: graph/registry metadata, runtime tools as registered capabilities, status vocabulary, metadata-only skill handling.
- `tests/runtime/skill-catalog.test.js`: skill metadata validation, loadability, metadata-only, domain signals, role/stage preservation.
- `tests/runtime/mcp-catalog.test.js`: MCP readiness/policy labels, external/browser/custom/bundled separation, placeholder/secret handling.
- `tests/runtime/runtime-bootstrap.test.js` and `tests/runtime/runtime-config-loader.test.js`: runtime interface and config-schema preservation if touched.
- `tests/global/*`, `tests/cli/*`, and `tests/install/*`: global doctor/run/materialization behavior when dashboard output or OpenCode config projection changes.
- `docs/governance/skill-metadata.md`: explain metadata-only/loadability and resolver-relevant skill fields.
- `docs/operator/mcp-configuration.md`: explain MCP readiness, policy labels, external/browser conditions, custom/bundled split, and dashboard next actions.
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`: document graph, resolver, selection protocol, ledger, dashboard, and runtime tools.
- `AGENTS.md` and `context/core/project-config.md`: update only if implementation adds or changes actual validation/build/test commands or current-state facts.

## Boundaries And Components

Component boundaries:

- `CapabilityGraphBuilder`: pure/read-only graph construction from existing capability metadata. Inputs are catalog entries, runtime tool definitions, custom MCP health/readiness entries, workflow context, command permission policy metadata, and target-project validation probes. It must not load skill files, execute MCPs, call providers, run browser automation, or mutate workflow state.
- `CapabilityResolver`: pure/read-only ranking and explanation engine. It scores graph nodes and relationships, returns bounded candidates, and records why candidates were selected, skipped, downgraded, blocked, or unavailable. It must not activate anything.
- `CapabilitySelectionProtocol`: eligibility evaluator that turns a resolver recommendation into an activation plan. It checks loadability, role/stage fit, MCP readiness, external/browser relevance, side-effect level, policy gate status, freshness, and validation-surface fit.
- `CapabilityActivationPolicy`: policy module that classifies side effects and evaluates whether an action is read-only, diagnostic, local mutating, workflow-mutating, browser-mutating, external/provider-backed, git/package/release/deploy/database/system-impacting, destructive, blocked, or confirmation-required.
- `CapabilityDecisionLedger`: append/read abstraction for sanitized decisions. Start with file-backed or workflow-kernel-backed storage consistent with existing `.opencode` runtime state patterns; if persistence is too large for the first slice, provide an in-memory read model plus explicit evidence capture integration, but do not claim persisted review readiness until persistence exists.
- `CapabilityReadModel`: bounded summaries for dashboard/runtime interface. It aggregates graph and ledger status distributions, stale/cached/fresh labels, policy-gated counts, metadata-only/unavailable skills, external/browser/custom/bundled summaries, and target-project validation availability.
- `CapabilityToolSurface`: runtime MCP tools that expose graph, resolver, selection, dashboard, and ledger outputs with schemas and redaction.

Keep the existing `CapabilityRegistryManager` as the orchestration facade. FullstackAgent may split internals under `src/capabilities/` or `src/runtime/managers/`, but external runtime tools should keep using the manager facade to avoid scattering capability logic.

Strict boundaries:

- Registration is metadata readiness, not activation.
- Ranking never loads skill bodies, executes MCPs/tools, invokes browser automation, calls external providers, writes files, mutates workflow state, or changes git/package/deploy/system state.
- Selection may produce an activation plan, but actual activation still goes through the existing user-visible tool/skill invocation path and policy gates.
- Metadata-only, stub, absent-file, install-unbundled, or unavailable skills are never loadable.
- Browser/external MCP evidence is assistive and caveated, never an automatic QA pass.
- OpenKit runtime/package/docs checks never become `target_project_app` validation.
- Workflow ownership remains unchanged across `quick`, `migration`, and `full` modes.

## Interfaces And Data Contracts

Use additive contracts with the existing status vocabulary:

```js
const CAPABILITY_STATES = [
  'available',
  'unavailable',
  'degraded',
  'preview',
  'compatibility_only',
  'not_configured',
];

const VALIDATION_SURFACES = [
  'global_cli',
  'in_session',
  'compatibility_runtime',
  'runtime_tooling',
  'documentation',
  'package',
  'target_project_app',
];
```

Capability graph node:

```js
{
  id: 'skill.verification-before-completion',
  family: 'skill',
  ownership: 'bundled',
  surface: 'runtime_tooling',
  state: 'available',
  maturity: 'stable',
  supportLevel: 'maintained',
  loadability: 'loadable',
  sideEffectLevel: 'read_only',
  locality: 'local',
  domainSignals: ['verification', 'evidence'],
  roles: ['FullstackAgent', 'QAAgent', 'QuickAgent'],
  stages: ['full_implementation', 'full_qa', 'quick_test'],
  freshness: { state: 'cached', checkedAt: '2026-04-28T00:00:00.000Z', source: 'startup_snapshot' },
  caveats: [],
  nextActions: [],
  relationships: [{ type: 'recommended_mcp', targetId: 'mcp.openkit', relationship: 'primary' }],
}
```

Capability families should include at minimum `runtime_tool`, `bundled_mcp`, `custom_mcp`, `skill`, `metadata_only_skill`, `browser`, `external`, `policy_gated`, and `target_project_validation_probe`. If implementation uses a single `family` plus labels, preserve equivalent distinction in output.

Side-effect levels:

```js
[
  'metadata_only',
  'read_only',
  'diagnostic',
  'local_mutating',
  'workflow_mutating',
  'browser_read',
  'browser_mutating',
  'external_read',
  'external_mutating',
  'git_mutating',
  'package_mutating',
  'deploy_release',
  'database_mutating',
  'system_privileged',
  'destructive',
]
```

Resolver input:

```js
{
  intent: 'debug React render performance issue',
  mode: 'full',
  stage: 'full_implementation',
  role: 'FullstackAgent',
  status: 'in_progress',
  tags: ['frontend', 'performance'],
  includePreview: false,
  includeExperimental: false,
  allowExternal: false,
  allowBrowser: false,
  allowMutating: false,
  maxCandidates: 5,
}
```

Resolver output:

```js
{
  status: 'ok',
  validationSurface: 'runtime_tooling',
  decisionId: 'capdec_...',
  selected: [{ capabilityId, score, reasons: [], caveats: [], activation: { eligible: true, requiredGate: null } }],
  downgraded: [{ capabilityId, reason, caveats: [], nextActions: [] }],
  blocked: [{ capabilityId, policyGate, reason, nextActions: [] }],
  unavailable: [{ capabilityId, reason, nextActions: [] }],
  suppressed: [{ capabilityId, reason }],
  summary: 'Stable local non-mutating skill and runtime tools preferred; browser/external options withheld because not requested.',
}
```

Activation policy result:

```js
{
  capabilityId,
  actionType: 'select | load_skill | execute_tool | execute_mcp | browser_action | workflow_mutation',
  sideEffectLevel,
  outcome: 'approved | blocked | needs_confirmation | degraded | unavailable | not_applicable',
  reason,
  caveats: [],
  nextActions: [],
  policyRefs: ['assets/default-command-permission-policy.json'],
  validationSurface: 'runtime_tooling',
}
```

Ledger entry:

```js
{
  id: 'capdec_20260428_...',
  timestamp,
  featureId: 'FEATURE-953',
  workflow: { mode, stage, role, status },
  capability: { id, family, ownership, state, surface },
  actionType: 'rank | select | load_skill | execute_tool | skip | block | degrade | fail',
  outcome: 'selected | skipped | blocked | degraded | failed | loaded | executed',
  reason,
  caveats: [],
  freshness: { state: 'fresh | cached | stale | unknown', source: 'startup_snapshot | read_model | fresh_check' },
  policyGate: null,
  validationSurface: 'runtime_tooling',
  evidenceRefs: [],
  artifactRefs: [],
}
```

Ledger and dashboard redaction requirements:

- Never store raw secrets, tokens, auth headers, cookies, env dumps, provider payloads, browser storage, or custom MCP command outputs containing sensitive values.
- Represent key state only as `present_redacted`, `missing`, `needs_key`, `not_configured`, or equivalent existing redacted state.
- Sanitize free-text errors before ledger write and dashboard output.

Runtime tool/API surfaces to add or extend:

- Extend `tool.capability-router` with graph-backed `rank` behavior while preserving current inputs and `summary: true` behavior.
- Add `tool.capability-readiness` or extend `tool.runtime-summary` to expose the default pack readiness dashboard read model.
- Add `tool.capability-ledger` with read-only actions such as `summary`, `list`, and `get` if persisted ledger exists; if append is exposed, it must be internal or policy-gated and sanitized.
- Add `tool.capability-selection` only if selection needs a separate explicit activation-plan surface; otherwise keep selection output inside router results.
- Keep `tool.capability-inventory`, `tool.capability-health`, `tool.mcp-doctor`, `tool.skill-index`, and `tool.skill-mcp-bindings` compatible and bounded.
- Update `src/mcp-server/tool-schemas.js` for every new or changed tool.

OpenCode config schema preservation:

- `src/global/materialize.js`, `src/global/mcp/profile-materializer.js`, and `src/install/materialize.js` must continue to call `sanitizeOpenCodeConfig` or equivalent before writing OpenCode config.
- Unknown OpenCode top-level keys must remain rejected or stripped according to `src/opencode/config-schema.js` and `src/install/merge-policy.js`.
- Capability orchestration config belongs in OpenKit runtime config/read models, not in root `opencode.json`, unless a schema-safe projection already exists.

## Risks And Trade-offs

- Graph richness vs scope control: a full capability ontology could sprawl. Keep FEATURE-953 focused on fields required by AC1-AC24 and derive values from existing metadata wherever possible.
- Resolver determinism vs semantic accuracy: deterministic scoring is reviewable but less flexible than LLM-only routing. Prefer deterministic scoring plus explainable signal matches; agents can still use output as advisory guidance.
- Ledger persistence vs noise: persistent event logs help review/QA but can become noisy. Use bounded summaries, filters, and artifact refs; avoid raw event walls in default dashboard output.
- Dashboard detail vs prompt bloat: default readiness must stay compact. Preserve explicit follow-up tools for full inventory and ledger details.
- Policy strictness vs convenience: false negatives are acceptable for risky capability use; false readiness or hidden mutating actions are not.
- Metadata-only skill discoverability vs user confusion: metadata-only entries are useful for discovery but must be visibly unavailable and never loadable.
- Existing router compatibility vs new resolver behavior: keep current `tool.capability-router` input compatibility and add fields/output rather than breaking tests and callers.
- Config schema preservation vs feature discoverability: avoid using OpenCode config as the orchestration data store even if that would make inspection easy; use runtime summaries/tools/docs instead.

## Recommended Path

Build this as a sequence of small additive slices:

1. Establish graph/data contracts and tests around pure metadata normalization.
2. Add resolver scoring and selection protocol without activation or persistence.
3. Add policy/side-effect evaluation and MCP readiness gating.
4. Add decision ledger/read model and dashboard summaries.
5. Wire runtime tools, MCP schemas, runtime interface, and operator output.
6. Update docs and full validation.

Do not start by changing CLI output or OpenCode config materialization. Those surfaces should consume stable read models after graph/resolver/ledger behavior is covered by tests.

Ranking weights should be simple and inspectable:

- Strong positive: explicit `skillName`/`mcpId`, exact trigger/domain/tag match, available state, stable maturity, maintained support, role match, stage match, local/read-only/diagnostic, fresh state, validation-surface fit.
- Moderate positive: optional but configured MCP relationship, preview requested explicitly, browser/external explicitly requested and configured, current mode/stage family match.
- Negative: degraded, compatibility-only, stale, unsupported dependency, missing optional MCP, preview not requested, role/stage mismatch, external/browser when not requested.
- Hard block or non-loadable: metadata-only skill load attempt, absent skill file, disabled MCP, missing required key, placeholder secret, policy blocked, destructive command without explicit user intent, unknown workflow authority for risky action.

Recommended bounded output limits:

- Default ranking: top 3 selected/recommended, top 3 downgraded, top 3 blocked/unavailable, plus counts for suppressed remainder.
- Default dashboard: family/status counts, top caveats/next actions, target-project validation state, stale/cached/fresh label, and explicit follow-up tool names.
- Full inventory/ledger details: only through explicit tool actions and filters.

## Implementation Slices

### Slice 1: Capability Graph Contracts

- Add graph contract helpers under `src/capabilities/`, likely `src/capabilities/capability-graph.js` and contract validation in `src/capabilities/schema.js`.
- Normalize existing bundled MCPs from `src/capabilities/mcp-catalog.js`, skills from `src/capabilities/skill-catalog.js`, runtime capabilities from `src/runtime/capability-registry.js`, custom MCP readiness from MCP health manager output, and target-project validation probes from existing external validation tools.
- Include family, ownership, state, surface, freshness, caveats, next actions, loadability, side-effect level, locality, domain signals, roles, stages, and relationships.
- Preserve existing `STANDARD_CAPABILITY_STATES`, `VALIDATION_SURFACES`, `SKILL_MATURITY_STATUSES`, and support-level values.
- Tests: `tests/runtime/capability-registry.test.js`, `tests/runtime/skill-catalog.test.js`, `tests/runtime/mcp-catalog.test.js`.
- Acceptance: AC1, AC2, AC6, AC9, AC20, AC22.

### Slice 2: Resolver And Selection Protocol

- Extend `src/runtime/managers/capability-registry-manager.js` with graph-backed `rankCapabilities()` and `selectCapability()` methods, keeping `routeCapability()` backward compatible.
- Implement deterministic scoring, bounded output, reasons/caveats, suppressed/downgraded/blocked/unavailable arrays, and no side effects during ranking.
- Add explicit metadata-only handling: discoverable, rankable with caveat, never loadable, fallback/next action required.
- Ensure role/stage/mode guardrails map to Product Lead, Solution Lead, Fullstack Agent, Code Reviewer, QA Agent, Quick Agent, and Master Orchestrator responsibilities.
- Tests: extend `tests/runtime/capability-tools.test.js` with role/stage scoring, safer-local preference, no silent fallback, metadata-only non-loadability, bounded output.
- Acceptance: AC3, AC4, AC5, AC6, AC7, AC8, AC14, AC23.

### Slice 3: Activation Policies, MCP Readiness, And Side Effects

- Add policy classification helpers, likely `src/capabilities/activation-policy.js`, consumed by `CapabilityRegistryManager`.
- Classify capabilities by side-effect level and locality using existing tool family, MCP catalog category/lifecycle/policy, custom MCP risk warnings, command permission policy, and browser/external labels.
- Evaluate MCP readiness from enabled state, secret/key redacted state, placeholders, dependency checks, lifecycle, scope, custom ownership, and `mcp-doctor`/health outputs.
- Return `approved`, `blocked`, `needs_confirmation`, `degraded`, `unavailable`, or `not_applicable` gate outcomes without executing the action.
- Preserve git safety: no commit/amend/destructive git/force push unless explicit user intent and existing safety checks permit it.
- Tests: policy-gated git, missing key, placeholder key, disabled MCP, browser/external conditional use, local mutating tool requiring gate, degraded OpenCode permission support caveats.
- Acceptance: AC10, AC11, AC12, AC13, AC14, AC16, AC22.

### Slice 4: Decision Ledger And Read Model

- Add a sanitized `CapabilityDecisionLedger` behind the manager. Prefer workflow-kernel-compatible project runtime state under the managed `.opencode` state model if existing kernel APIs support it; otherwise use a narrowly scoped runtime state file with schema/version and document the path.
- Record rank/select/load/execute/skip/block/degrade/fail decisions that affect work. Do not record raw provider payloads or secrets.
- Add a bounded `CapabilityReadModel` for dashboard summaries: status distribution, family counts, policy-gated count, metadata-only/unavailable skills, external/browser readiness, custom/bundled separation, stale/cached/fresh status, target-project validation availability, and next actions.
- Integrate with `tool.evidence-capture` by including ledger IDs in evidence refs where capability decisions support review/QA.
- Tests: redaction, persistence or explicit non-persistence behavior, bounded summaries, filters, stale/cached/fresh labels, target-project validation unavailable state.
- Acceptance: AC15, AC16, AC17, AC18, AC19, AC20, AC21.

### Slice 5: Runtime Tool And API Surfaces

- Extend `src/runtime/tools/capability/capability-router.js` to expose graph-backed ranking while preserving current advisory semantics.
- Add `src/runtime/tools/capability/capability-readiness.js` for dashboard summaries if not folded into `runtime-summary`.
- Add `src/runtime/tools/capability/capability-ledger.js` for ledger read operations if persistence is implemented.
- Register new tools in `src/runtime/tools/tool-registry.js`.
- Add JSON schemas to `src/mcp-server/tool-schemas.js`.
- Add bounded summaries to `src/runtime/create-runtime-interface.js`, `src/runtime/tools/workflow/runtime-summary.js`, `src/runtime/doctor.js`, `src/global/doctor.js`, and `src/cli/commands/run.js` only after read model tests pass.
- Tests: runtime bootstrap exposes summaries, tool registry includes schemas, MCP server schemas match runtime tools, default output remains bounded and redacted.
- Acceptance: AC7, AC8, AC15, AC17, AC18, AC19, AC20, AC23.

### Slice 6: Documentation And Operator Guidance

- Update `docs/governance/skill-metadata.md` for loadability, metadata-only handling, role/stage/domain signals, maturity vs capability state, and recommended MCP caveats.
- Update `docs/operator/mcp-configuration.md` for readiness dashboard, MCP policy/readiness labels, custom/bundled separation, browser/external conditional use, and next actions.
- Update `docs/kit-internals/04-tools-hooks-skills-and-mcps.md` for graph, resolver, selection protocol, activation policies, ledger, dashboard, runtime tools, and validation-surface separation.
- Update `context/core/project-config.md` or `AGENTS.md` only if implementation changes actual current-state commands/config expectations.
- Tests/verification: documentation grep/read review for required terms and no false target-project validation claims.
- Acceptance: AC24 plus documentation support for AC1-AC23.

## Dependency Graph

Sequential dependencies:

```text
SLICE-1 graph contracts
  -> SLICE-2 resolver and selection protocol
  -> SLICE-3 activation policies and MCP readiness
  -> SLICE-4 ledger and readiness read model
  -> SLICE-5 runtime tools/API/operator surfaces
  -> SLICE-6 documentation and final validation
```

Detailed task dependencies:

```text
GRAPH-CONTRACTS -> RESOLVER-SCORING -> ROUTER-COMPAT
GRAPH-CONTRACTS -> POLICY-CLASSIFIER -> SELECTION-GATES
GRAPH-CONTRACTS -> READINESS-READ-MODEL
SELECTION-GATES -> DECISION-LEDGER
READINESS-READ-MODEL -> RUNTIME-INTERFACE -> DOCTOR-RUN-OUTPUT
DECISION-LEDGER -> LEDGER-TOOL -> MCP-SCHEMAS
ROUTER-COMPAT -> CAPABILITY-TOOLS-TESTS
POLICY-CLASSIFIER -> MCP-CATALOG-TESTS
SKILL-LOADABILITY -> SKILL-CATALOG-TESTS
RUNTIME-INTERFACE -> RUNTIME-BOOTSTRAP-TESTS
ALL-CODE-SLICES -> DOCS-UPDATES -> FINAL-VALIDATION
```

Do not implement dashboard/operator output before the read model exists. Do not implement activation plans before side-effect/policy classification exists. Do not update docs to claim behavior until the corresponding runtime/tool tests exist.

## Parallelization Assessment

- parallel_mode: `limited`
- why: The graph contract and manager facade are central integration points, but tests/docs can proceed in parallel after the first contract slice stabilizes. Runtime tool wiring, CLI/doctor output, and schema updates should be sequential because they depend on stable manager/read-model APIs.
- safe_parallel_zones: [`docs/governance/`, `docs/operator/`, `docs/kit-internals/`, `tests/runtime/skill-catalog.test.js`, `tests/runtime/mcp-catalog.test.js`]
- sequential_constraints: [`SLICE-1 -> SLICE-2 -> SLICE-3 -> SLICE-4 -> SLICE-5`, `GRAPH-CONTRACTS -> DOCS-FINAL-WORDING`, `READINESS-READ-MODEL -> DOCTOR-RUN-OUTPUT`, `RUNTIME-TOOLS -> MCP-SCHEMAS -> TOOL-REGISTRY-VALIDATION`]
- integration_checkpoint: After Slice 5, before documentation finalization and final validation. Verify router compatibility, readiness dashboard, ledger/read model, MCP schemas, runtime interface, and OpenCode config schema preservation together.
- max_active_execution_tracks: 2

Parallel guidance:

- Track A may implement graph/resolver/policy/ledger/runtime tools sequentially.
- Track B may prepare tests for skill/MCP catalog metadata and docs drafts after graph contract names are stable.
- Do not run simultaneous edits in `src/runtime/managers/capability-registry-manager.js`, `src/capabilities/status.js`, or `src/mcp-server/tool-schemas.js`; these are integration hotspots.
- Documentation final wording must wait until runtime tool names and output fields are settled.

## Validation Matrix

| Surface | Required Validation | Commands / Evidence |
| --- | --- | --- |
| `runtime_tooling` | Graph contracts normalize all capability families, statuses, surfaces, loadability, side-effect levels, domain signals, freshness, caveats, and next actions. | `node --test tests/runtime/capability-registry.test.js`; focused tests added for graph contracts. |
| `runtime_tooling` | Resolver returns bounded explainable output, safer-local preference, role/stage fit, fallback/skips, metadata-only non-loadability, no hidden activation. | `node --test tests/runtime/capability-tools.test.js`; assertions that ranking does not load skill bodies or execute MCPs. |
| `runtime_tooling` | MCP readiness and policy checks distinguish configured, missing key, placeholder, disabled, custom, bundled, browser, external, degraded, policy-gated. | `node --test tests/runtime/mcp-catalog.test.js`; `node --test tests/runtime/capability-tools.test.js`. |
| `runtime_tooling` | Ledger/read model redacts secrets, stores decision metadata, summarizes stale/cached/fresh state, and remains bounded. | New/extended `tests/runtime/capability-tools.test.js` or `tests/runtime/capability-ledger.test.js`. |
| `runtime_tooling` | Runtime interface exposes compact readiness without full catalog prompt bloat. | `node --test tests/runtime/runtime-bootstrap.test.js`; existing runtime interface assertions extended. |
| `runtime_tooling` | Tool registry and MCP schemas include every new/changed capability tool. | `node --test tests/runtime/*.test.js`; add schema-specific assertions if absent. |
| `global_cli` | `openkit doctor` and `openkit run` output compact readiness/dashboard caveats and no raw secrets. | Existing `tests/global/*` and `tests/cli/*`; add focused tests for readiness output. |
| `compatibility_runtime` | Workflow-state/evidence integration exposes capability decision refs without changing workflow authority. | `.opencode/tests/workflow-state-cli.test.js` if evidence/workflow-state surface is touched; otherwise runtime tool tests with `validationSurface: 'compatibility_runtime'` caveats. |
| `package` | Shipped files include new source/docs/tests where relevant and exclude generated runtime/secret artifacts. | `npm run verify:install-bundle`; `npm run verify:mcp-secret-package-readiness`. |
| `documentation` | Docs explain governed autonomy, metadata registration, ranking, selective loading, policy gates, ledger, dashboard, redaction, stale state, and target-project validation separation. | Read/review updated docs; optional repository search for required phrases and absence of false app-validation claims. |
| `target_project_app` | Report unavailable unless target project declares app-native build/lint/test/smoke/regression config. | No substitution allowed. If absent, ledger/dashboard/handoff must state `target_project_app` unavailable. |

Recommended full regression after implementation:

```sh
npm run verify:runtime-foundation
npm run verify:governance
npm run verify:mcp-secret-package-readiness
node --test tests/runtime/capability-tools.test.js
node --test tests/runtime/capability-registry.test.js
node --test tests/runtime/skill-catalog.test.js
node --test tests/runtime/mcp-catalog.test.js
```

Run `npm run verify:install-bundle`, `npm run verify:semgrep-quality`, and broader `npm run verify:all` when the implementation affects install bundle, governance, package surfaces, or release readiness. If Semgrep is unavailable locally, report that gate as unavailable/failed according to repository policy rather than substituting another check.

Acceptance mapping by validation focus:

- AC1-AC2: graph contract and registry tests.
- AC3-AC5: resolver/ranking tests.
- AC6-AC8: skill catalog, resolver, and ledger tests.
- AC9, AC20-AC21: validation-surface assertions and target-project probe tests.
- AC10-AC14: activation policy and MCP readiness tests.
- AC15-AC16: ledger/redaction tests.
- AC17-AC19: dashboard/read-model/runtime-summary tests.
- AC22: malformed/missing/stale metadata tests.
- AC23: role/stage/workflow guardrail tests.
- AC24: documentation review.

## Integration Checkpoint

Hold the required integration checkpoint after Slice 5 and before final docs/signoff.

Checkpoint requirements:

- `CapabilityRegistryManager` can build the capability graph, rank candidates, evaluate selection gates, expose dashboard summaries, and read ledger entries through one facade.
- `tool.capability-router` remains backward compatible with existing tests while returning the new bounded explanations and caveats.
- New tools, if any, are registered in `src/runtime/tools/tool-registry.js` and have matching entries in `src/mcp-server/tool-schemas.js`.
- Runtime interface and doctor/run summaries show compact readiness without raw full catalog dumps.
- Metadata-only skills are visible but non-loadable in both ranking and dashboard output.
- MCP readiness reports missing keys/placeholders/custom ownership/browser/external/policy labels without false availability.
- Mutating/dangerous capabilities produce gate outcomes before any action proceeds.
- Ledger/read model outputs are redacted and include validation-surface labels.
- `target_project_app` is explicitly unavailable when app-native commands/config are absent.
- OpenCode config materialization still strips/rejects schema-invalid top-level keys and does not persist OpenKit-only orchestration state into `opencode.json`.
- Existing workflow modes, stages, owners, approval gates, review, QA, and quick-lane semantics remain unchanged.

If any checkpoint item fails, pause further CLI/docs expansion and fix the manager/contracts first.

## Rollback Notes

- Keep new graph/resolver/policy/ledger code additive behind manager methods and runtime tools so rollback can remove tool registration and runtime interface fields without touching existing catalog data.
- Preserve existing `tool.capability-router`, `tool.capability-inventory`, `tool.capability-health`, `tool.mcp-doctor`, `tool.skill-index`, and `tool.skill-mcp-bindings` contracts. If new resolver behavior causes regressions, temporarily route `tool.capability-router` back to the pre-existing skill/MCP routing path while retaining graph code disabled.
- Do not migrate or rewrite existing skill/MCP catalog schemas destructively. Any new metadata fields should be optional with safe derived defaults.
- If ledger persistence causes issues, disable persistent append and keep read-model summaries derived from current runtime state, while clearly reporting ledger persistence as degraded/unavailable.
- If CLI/doctor readiness output becomes noisy or unstable, remove the operator-facing summary first and keep explicit runtime tools available for inspection.
- If OpenCode config schema preservation fails, rollback any materialization/config changes immediately; capability orchestration must not depend on unknown OpenCode config keys.
- No rollback path may loosen command permission policy, secret redaction, git safety, external/browser caveats, or target-project validation separation.

## Reviewer Focus Points

- Scope compliance: verify implementation satisfies AC1-AC24 and does not introduce new workflow lanes, roles, stages, approvals, or Master Orchestrator authority.
- No hidden activation: ranking and registration must not load skill bodies, execute MCPs, call providers, run browser automation, or mutate state.
- Metadata-only handling: metadata-only/stub/absent/install-unbundled skills must be discoverable but never loadable, with fallback guidance.
- Resolver explainability: selected, downgraded, blocked, unavailable, stale, preview, external/browser, and policy-gated decisions need reasons/caveats.
- Safety gates: mutating/dangerous/git/package/deploy/database/system/browser/external actions must report policy outcomes before action and preserve existing git safety rules.
- MCP readiness: missing keys, placeholders, disabled scopes, dependency failures, custom ownership, external/browser labels, and stale state must not be reported as available.
- Redaction: dashboard, ledger, doctor, runtime summary, tests, docs examples, and errors must not expose raw secrets, tokens, auth headers, cookies, env dumps, provider payloads, or browser data.
- Validation-surface honesty: OpenKit runtime/package/docs/doctor/browser/scan checks must not be labeled as target-project app validation.
- Dashboard boundedness: default summaries must stay compact and provide explicit follow-up tools for details.
- OpenCode config schema preservation: materialized OpenCode config must remain schema-valid and free of OpenKit-only orchestration keys unless the schema intentionally supports them.
- Backward compatibility: existing runtime tool tests and current capability tools should continue to pass or be updated only for additive, documented behavior.
- Documentation accuracy: operator and internals docs must describe current implemented behavior, not planned behavior.
