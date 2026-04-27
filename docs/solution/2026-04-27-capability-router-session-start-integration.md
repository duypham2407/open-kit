---
artifact_type: solution_package
version: 1
status: ready
handoff_rubric: pass
feature_id: FEATURE-949
feature_slug: capability-router-session-start-integration
source_scope_package: docs/scope/2026-04-27-capability-router-session-start-integration.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: none
---

# Solution Package: Capability Router Session-Start Integration

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-27-capability-router-session-start-integration.md`.
- Current lane/stage/owner: `full` / `full_solution` / `SolutionLead` for `FEATURE-949` / `feature-949`.
- Product gate: `product_to_solution` is approved; this package is the `solution_to_fullstack` handoff artifact only.
- Role boundary: this package defines technical direction, slices, contracts, validation, and review focus. It does **not** implement the feature.

## Recommended Path

Add a shared, pure capability-guidance summary builder that reads existing OpenKit catalog/read-model data and emits a bounded, role/stage-aware advisory summary. Use that same builder in the session-start hook and workflow/runtime summary surfaces so startup text, `tool.runtime-summary`, and workflow-state resume/status views agree without loading skill bodies, executing MCP tools, expanding custom MCP behavior, or changing workflow semantics.

This is enough because the repository already has the required foundations:

- session-start output in `hooks/session-start.js` and `hooks/session-start`
- compatibility runtime summaries in `.opencode/lib/runtime-summary.js`, `.opencode/lib/runtime-guidance.js`, and `.opencode/workflow-state.js`
- in-session runtime summary tool in `src/runtime/tools/workflow/runtime-summary.js`
- capability inventory/router/health/skill-index tools under `src/runtime/tools/capability/`
- catalog metadata from `src/capabilities/skill-catalog.js` and `src/capabilities/mcp-catalog.js`
- custom MCP inventory/status labeling through `src/global/mcp/mcp-inventory.js`, `src/global/mcp/health-checks.js`, and `src/runtime/managers/mcp-health-manager.js`
- current validation commands in `package.json`, `.opencode/tests/`, and `tests/`

Do **not** add a marketplace, keychain, custom MCP expansion, new lane/stage enum, automatic health probe requiring provider/network calls, or target-project application validation claim.

## Chosen Technical Approach

### Startup and runtime summary model

Create a small reusable guidance read model with two outputs:

1. **Structured model** for runtime tools and JSON summary surfaces.
2. **Compact rendered lines** for session-start and human-readable workflow-state output.

The model should be computed from local, already-approved metadata and read models only:

- current workflow state: `mode`, `current_stage`, `current_owner`, `status`, `work_item_id`
- skill metadata: role/stage/tags/status/capabilityState/support/limitations/recommended MCPs
- MCP inventory: bundled/custom kind, origin, ownership, enablement, capabilityState, redacted key state, dependency state, guidance
- known tool route names: `tool.capability-router`, `tool.capability-inventory`, `tool.skill-index`, `tool.skill-mcp-bindings`, `tool.capability-health`, `tool.mcp-doctor`, `tool.runtime-summary`, `tool.workflow-state`, and role-appropriate OpenKit tooling categories

The builder must not:

- load skill bodies
- call the `skill` tool
- dispatch an MCP-backed tool
- run provider/network health checks
- mutate workflow state, custom MCP config, secrets, profiles, task boards, or evidence
- serialize raw env values, headers, command env maps, provider payloads, or secrets

### Startup freshness decision

Session-start guidance should be a **startup snapshot**. It may use local catalog/config/key-presence/dependency-status read models, but it must include a caveat that current readiness can change during the session.

Required refresh paths in output:

- in-session details: call `tool.runtime-summary`, `tool.capability-router`, `tool.skill-index`, `tool.capability-inventory`, `tool.mcp-doctor`, or `tool.capability-health`
- outside-session/operator details: run `openkit configure mcp doctor` or `openkit configure mcp list` when MCP setup is the question
- workflow context: run `node .opencode/workflow-state.js resume-summary` or `node .opencode/workflow-state.js status`

`openkit doctor` does not need a new FEATURE-949 behavior change. It may remain a product/workspace readiness check. This feature affects `openkit run` indirectly through session-start hook output and affects runtime/read-model guidance through compatibility/runtime surfaces.

## Impacted Surfaces

### Guidance builder and capability-router summary

- `src/runtime/tools/capability/capability-router-summary.js` (create)
  - pure summary/ranking/rendering helper
  - no state mutation or provider/network calls
  - used by session-start and runtime summary surfaces
- `src/runtime/managers/capability-registry-manager.js`
  - add a thin `summarizeGuidance(...)` or equivalent method over existing `listCapabilities(...)`
  - preserve existing `routeCapability(...)` semantics
- `src/runtime/tools/capability/capability-router.js`
  - optionally attach compact route-summary metadata only when explicitly requested by input such as `{ summary: true }`; otherwise keep existing single-route behavior stable
- `src/runtime/tools/capability/capability-inventory.js`
- `src/runtime/tools/capability/capability-health.js`
- `src/runtime/tools/capability/mcp-doctor.js`
- `src/runtime/tools/capability/skill-index.js`
- `src/runtime/tools/capability/skill-mcp-bindings.js`
- `src/mcp-server/tool-schemas.js` only if `tool.capability-router` receives a new explicit `summary` input flag

### Session-start hook

- `hooks/session-start.js`
  - render `<openkit_capability_guidance>` after `<openkit_runtime_status>` and before large optional skill/tool-rule blocks
  - fail open: if the helper cannot load or metadata is unavailable, print a short degraded/unavailable guidance block and keep session startup successful
  - use dynamic import or an equivalent guarded loading path so helper failure cannot crash startup
- `hooks/session-start`
  - no expected change unless wrapper behavior must pass through environment flags
- `.opencode/tests/session-start-hook.test.js`
  - add compact output, role/stage, redaction, no-catalog-dump, and degraded-helper coverage

### Runtime summary / compatibility runtime

- `.opencode/lib/runtime-summary.js`
  - add `capabilityGuidance` structured model and `capabilityGuidanceLines` to `getRuntimeContext(...)`
  - maintain existing task-board, migration-slice, scan-evidence, supervisor, artifact, and verification read models
- `.opencode/lib/runtime-guidance.js`
  - add small role/stage guardrail constants only if shared with readiness guidance; avoid duplicating the full workflow contract
- `.opencode/workflow-state.js`
  - print compact guidance lines in `status`, `resume-summary`, and `show` where runtime context is already printed
  - include `capability_guidance` in `resume-summary --json`
  - preserve `status --short` compactness; at most one short line there if implemented
- `src/runtime/tools/workflow/runtime-summary.js`
  - no special logic expected; it should continue returning `runtimeContext`, now including guidance
- `src/runtime/create-runtime-interface.js`
  - optionally include the same compact guidance summary in `runtimeInterface.capabilityPack.guidance` for runtime-bootstrap tests, without expanding the catalog

### Capability, skill, and MCP data sources

- `src/capabilities/skill-catalog.js`
  - read only; no broad metadata schema change for this feature
- `src/capabilities/mcp-catalog.js`
  - read only; no new MCP definitions
- `src/global/mcp/mcp-inventory.js`
- `src/global/mcp/health-checks.js`
- `src/global/mcp/custom-mcp-store.js`
  - read only via existing inventory/status helpers; no custom MCP lifecycle expansion

### Documentation and governance

- `docs/operator/mcp-configuration.md`
  - add session-start/runtime capability guidance section: advisory behavior, detail paths, stale snapshot, redacted key states, custom/origin labeling
- `docs/operator/README.md`
- `docs/operator/supported-surfaces.md`
- `docs/operator/surface-contract.md` if a concise surface split update is needed
- `docs/maintainer/test-matrix.md`
- `docs/maintainer/role-skill-matrix.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `context/core/project-config.md`
- `context/core/runtime-surfaces.md`
- `docs/governance/skill-metadata.md`
- `docs/governance/README.md` if governance index needs a pointer
- `tests/runtime/governance-enforcement.test.js`

### Tests

- `.opencode/tests/session-start-hook.test.js`
- `.opencode/tests/workflow-state-cli.test.js`
- `tests/runtime/capability-tools.test.js`
- `tests/runtime/capability-registry.test.js` only if runtime interface/capability summary shape changes
- `tests/runtime/runtime-platform.test.js` if runtime summary tool or runtime interface expectations change
- `tests/runtime/governance-enforcement.test.js`
- `tests/cli/openkit-cli.test.js` only if packaged `openkit run` hook wiring/help text changes

## Prompt And Content Design

### Output block

Session-start should emit a dedicated block similar to:

```text
<openkit_capability_guidance>
capability guidance: startup snapshot; advisory only; no skill or MCP was auto-activated.
workflow context: full / full_solution / SolutionLead; refresh with tool.runtime-summary or node .opencode/workflow-state.js resume-summary.
recommended routes:
- workflow: use tool.workflow-state/tool.runtime-summary for stage, approvals, artifacts, evidence.
- skills: use tool.capability-router for intent routing; use tool.skill-index for filtered role/stage details.
- MCP readiness: use tool.mcp-doctor/tool.capability-health; key-required MCPs show not_configured/needs-key only.
- custom MCPs: custom/origin-labeled entries may appear in MCP health; they are not bundled defaults.
role guardrail: SolutionLead plans technical direction from approved scope; do not rewrite product scope or implement.
target app validation: unavailable unless the target project defines app-native commands.
</openkit_capability_guidance>
```

The exact wording may differ, but it must preserve these content rules.

### Size and grouping limits

Default output must be bounded and testable:

- maximum rendered guidance block: **25 lines** or **2,400 characters**, whichever is hit first
- maximum categories shown: **5**
- maximum concrete skill names shown: **3**, and only when they are role/stage-relevant
- maximum concrete MCP ids shown: **3 bundled + 3 custom**, and custom entries only when they are relevant or explain an unavailable route
- overflow must collapse to grouped counts and explicit detail calls, not continue listing catalog entries

Never print one line per bundled skill, one line per bundled MCP, or one line per custom MCP by default.

### Concise categories

Use stable category labels instead of full catalog rows:

1. **workflow** — `tool.workflow-state`, `tool.runtime-summary`, artifact/readiness/evidence context
2. **skill-discovery** — `tool.capability-router`, `tool.skill-index`, `tool.skill-mcp-bindings`
3. **mcp-readiness** — `tool.mcp-doctor`, `tool.capability-health`, `openkit configure mcp doctor/list`
4. **code-intelligence** — graph/syntax/AST/semantic/codemod tools when role/stage owns code exploration or implementation planning
5. **verification-review** — rule/security scan, browser verification, evidence capture when role/stage owns review or QA/verification

Custom MCP visibility is not a separate full catalog section by default. Mention it only as a caveat/count/detail path: custom MCP entries are `kind=custom`, origin-labeled, and never bundled defaults.

### Recommendation wording

Every recommendation must be advisory and explicit:

- Use: “consider”, “call”, “inspect”, “refresh with”, “load explicitly if needed”.
- Do not use: “activated”, “loaded”, “ran”, “verified”, “healthy now” unless a fresh explicit check actually ran.
- Always include: “advisory only; no skill or MCP was auto-activated” in session-start output.
- If a route is unavailable/degraded/not_configured, include the state and a next action.
- `needs-key` is a human caveat over `not_configured`, not a new canonical status enum.

### Redaction and secret safety

The guidance builder and renderer must redact by construction:

- key state labels only: `missing`, `present_redacted`, `not_configured`, `needs-key`
- no raw secrets, token-like substrings, bearer headers, cookies, URL credentials, query tokens, env dumps, command env values, hashes, prefixes, or suffixes
- no raw provider payloads or stderr/stdout dumps
- custom MCP command/env/header summaries must show placeholder/redacted readiness only
- if a source is unsafe or malformed, summarize as sanitized `unavailable`/`degraded` and point to doctor/detail commands

## Role And Stage Guardrails

The builder should derive guardrails from current `mode`, `current_stage`, and `current_owner`. Unknown/missing state must fall back to generic discovery guidance with an unknown/stale-state caveat instead of guessing a role.

| Role / context | Allowed guidance | Must not suggest |
| --- | --- | --- |
| `MasterOrchestrator` | workflow-state/status/readiness, routing profile, dispatch, approval and artifact inspection, capability discovery for routing only | implementation, technical design, code review, QA execution, scope/solution authorship |
| `ProductLead` / `full_product` | brainstorming, `writing-scope`, business rules, acceptance criteria, requirement/context reads | implementation details, architecture decisions, tool routes that imply coding ownership |
| `SolutionLead` / `full_solution` or `migration_strategy` | `writing-solution`, codebase exploration, dependency/syntax/semantic discovery for design, validation planning, capability readiness caveats | rewriting approved product scope, direct implementation, review/QA ownership |
| `FullstackAgent` / implementation-owned stages | implementation aids, TDD when real test tooling exists, debugging, code intelligence, explicit evidence capture after work | QA ownership, code-review approval, product/scope changes without routing |
| `CodeReviewer` / review-owned stages | scope compliance, solution compliance, diff/dependency/scan/security review, finding classification | implementing fixes directly as reviewer, QA closure, product-scope changes |
| `QAAgent` / QA or verification stages | verification, browser checks, evidence, runtime health, issue classification, closure recommendation | implementation, code-review ownership, bypassing evidence/gates |
| `QuickAgent` / quick mode | quick-lane single-owner guidance across brainstorm/plan/implement/test, closest real validation path, no task board | ProductLead/SolutionLead/CodeReviewer/QA handoffs, full-delivery task board assumptions |
| migration mode | baseline, preserved invariants, compatibility, parity, staged upgrade, rollback, migration review/verify surfaces | full-delivery task-board assumptions unless a migration slice board exists, behavior rewrite by default |

These guardrails must not change lane semantics, stage names, approval gates, workflow-state enums, or ownership policy.

## Interfaces And Data Contracts

### Capability guidance model

Recommended structured shape:

```js
{
  status: 'ok' | 'degraded' | 'unavailable',
  validationSurface: 'runtime_tooling',
  generatedAt: '<iso timestamp>',
  source: 'startup_snapshot' | 'runtime_summary' | 'explicit_runtime_tool',
  freshness: {
    kind: 'startup_snapshot' | 'last_known' | 'fresh_read',
    caveat: 'Capability readiness can change after this snapshot.',
    refreshRoutes: ['tool.runtime-summary', 'tool.capability-router', 'tool.skill-index', 'tool.mcp-doctor']
  },
  workflowContext: {
    mode: 'quick' | 'migration' | 'full' | 'unknown',
    stage: '<current stage or unknown>',
    owner: '<current owner or unknown>',
    status: '<workflow status or unknown>'
  },
  categories: [
    {
      id: 'skill-discovery',
      status: 'available',
      summary: 'Use capability router for intent routing and skill-index for details.',
      nextActions: ['tool.capability-router', 'tool.skill-index'],
      caveats: []
    }
  ],
  roleHints: [
    {
      role: 'SolutionLead',
      stage: 'full_solution',
      hint: 'Plan technical direction from approved scope; do not implement.',
      suggestedRoutes: ['tool.capability-router', 'tool.semantic-search', 'tool.syntax-outline'],
      caveats: []
    }
  ],
  capabilityCaveats: [
    {
      id: 'context7',
      kind: 'bundled_mcp',
      state: 'not_configured',
      caveat: 'needs-key; use openkit configure mcp set-key context7 --stdin',
      secretSafe: true
    }
  ],
  customMcpSummary: {
    total: 0,
    shown: [],
    overflow: 0,
    caveat: 'Custom MCPs are origin-labeled and are not bundled defaults.'
  },
  limits: {
    maxLines: 25,
    maxChars: 2400,
    truncated: false
  },
  targetProjectValidation: {
    status: 'unavailable',
    caveat: 'OpenKit capability checks are not target-project app build/lint/test evidence.'
  }
}
```

Do not persist high-volume skill/MCP records in this model. Detail paths remain explicit follow-up calls.

### Ranking rules

- First priority: role/stage ownership guardrail.
- Second priority: current mode semantics (`quick`, `migration`, `full`).
- Third priority: available/stable capabilities before preview/degraded/not_configured/unavailable capabilities.
- Fourth priority: current acceptance/validation needs, e.g. review stages may show scans, QA stages may show verification/browser/evidence.
- Custom MCPs only appear when they are enabled/relevant or explain why an MCP route is unavailable; always include `kind`, `origin`, and `ownership` caveat when shown.
- Unknown state returns generic discovery categories and a stale/unknown-state caveat.

## Dependencies

- No new npm package dependency is required.
- No new environment variable is required.
- Use existing Node.js `>=18`, ESM modules, and `node:test`.
- Do not add or require target-project build/lint/test tooling.

## Implementation Slices

### [ ] Slice 1: Shared compact guidance builder

- **Executable task id**: `TASK-F949-GUIDANCE-BUILDER`
- **Files**:
  - `src/runtime/tools/capability/capability-router-summary.js` (create)
  - `src/runtime/managers/capability-registry-manager.js`
  - `src/runtime/tools/capability/capability-router.js` only if explicit summary input is added
  - `src/mcp-server/tool-schemas.js` only if router input schema changes
  - `tests/runtime/capability-tools.test.js`
- **Goal**: produce a reusable, bounded, role/stage-aware guidance read model from existing catalog and MCP inventory metadata.
- **Dependencies**: none.
- **Validation Command**:
  - `node --test "tests/runtime/capability-tools.test.js"`
  - `node --test "tests/runtime/capability-registry.test.js"` if manager/runtime interface shape changes
- **Details**:
  - Write failing tests first for compact output limits, role/stage ranking, available/degraded/not_configured/unavailable caveats, no full catalog dump, custom MCP origin labeling, and sentinel redaction.
  - Keep the helper pure: pass state/capabilities in, receive a model/lines out.
  - Use existing status vocabulary. Treat `needs-key` as a caveat for `not_configured`.
  - Return safe generic guidance when workflow state is missing or malformed.

### [ ] Slice 2: Session-start hook integration

- **Executable task id**: `TASK-F949-SESSION-START`
- **Files**:
  - `hooks/session-start.js`
  - `hooks/session-start` only if wrapper env passthrough changes are needed
  - `.opencode/tests/session-start-hook.test.js`
- **Goal**: print compact startup capability guidance without blocking session startup or triggering hidden activation.
- **Dependencies**: `TASK-F949-GUIDANCE-BUILDER`.
- **Validation Command**:
  - `node --test ".opencode/tests/session-start-hook.test.js"`
- **Details**:
  - Render `<openkit_capability_guidance>` after `<openkit_runtime_status>`.
  - Use guarded/dynamic helper loading so guidance failure prints a degraded block and exits `0`.
  - Add tests for quick/full/migration/unknown state, role guardrails, bounded size, no full catalog dump, no skill body injection, no MCP execution claim, stale snapshot wording, detail paths, custom MCP labeling, needs-key caveats, and raw secret redaction.
  - Preserve current `OPENKIT_SESSION_START_NO_SKILL`, `OPENKIT_SESSION_START_NO_TOOL_RULES`, and graph-index behavior.

### [ ] Slice 3: Runtime summary and workflow-state read-model integration

- **Executable task id**: `TASK-F949-RUNTIME-SUMMARY`
- **Files**:
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/lib/runtime-guidance.js` only if role/stage constants are shared there
  - `.opencode/workflow-state.js`
  - `src/runtime/tools/workflow/runtime-summary.js` only if tool metadata/description changes are needed
  - `src/runtime/create-runtime-interface.js` if runtime interface should expose the same compact guidance summary
  - `.opencode/tests/workflow-state-cli.test.js`
  - `tests/runtime/runtime-platform.test.js` if runtime tool/interface assertions change
- **Goal**: expose the same compact guidance through runtime summaries and resume/status surfaces.
- **Dependencies**: `TASK-F949-GUIDANCE-BUILDER`.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"` if touched
- **Details**:
  - Add `capabilityGuidance` and `capabilityGuidanceLines` to `runtimeContext`.
  - Print guidance in human status/resume paths only as compact lines.
  - Include structured `capability_guidance` in `resume-summary --json` with `validationSurface` and stale snapshot/refresh caveats.
  - Do not treat capability readiness as `target_project_app` validation.
  - Keep existing runtime summary read models for task boards, migration slices, scan evidence, supervisor dialogue, issues, and artifacts intact.

### [ ] Slice 4: Documentation and governance alignment

- **Executable task id**: `TASK-F949-DOCS-GOVERNANCE`
- **Files**:
  - `docs/operator/mcp-configuration.md`
  - `docs/operator/README.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/operator/surface-contract.md` if updated
  - `docs/maintainer/test-matrix.md`
  - `docs/maintainer/role-skill-matrix.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `docs/governance/skill-metadata.md`
  - `docs/governance/README.md` if index update is needed
  - `tests/runtime/governance-enforcement.test.js`
- **Goal**: document advisory router behavior, lazy activation, compact output, role/stage boundaries, custom MCP visibility, stale snapshot caveats, redaction, and validation-surface boundaries.
- **Dependencies**: `TASK-F949-GUIDANCE-BUILDER`; may draft after Slice 1 but should finalize after Slices 2 and 3 stabilize wording.
- **Validation Command**:
  - `node --test "tests/runtime/governance-enforcement.test.js"`
  - `npm run verify:governance`
- **Details**:
  - Docs examples must be placeholder-only and must not show full skill/MCP/custom catalogs.
  - Update test matrix so future maintainers know which tests to run when session-start/runtime guidance changes.
  - State `target_project_app` validation is unavailable unless a target project declares app-native commands.

### [ ] Slice 5: Integrated validation and handoff evidence

- **Executable task id**: `TASK-F949-INTEGRATION`
- **Files**: no primary production files unless validation reveals defects.
- **Goal**: prove hook, runtime summary, capability builder, docs, and governance agree before Code Review.
- **Dependencies**: `TASK-F949-SESSION-START`, `TASK-F949-RUNTIME-SUMMARY`, `TASK-F949-DOCS-GOVERNANCE`.
- **Validation Command**:
  - `node --test ".opencode/tests/session-start-hook.test.js"`
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node --test "tests/runtime/capability-tools.test.js"`
  - `node --test "tests/runtime/runtime-platform.test.js"` if touched
  - `npm run verify:governance`
  - `npm run verify:runtime-foundation`
  - `npm run verify:install-bundle` only if package/bundle assets or docs covered by the install bundle changed
  - `npm run verify:all` when the environment can run the full OpenKit gate
  - `node .opencode/workflow-state.js validate`
- **Details**:
  - Record evidence with correct surfaces: `global_cli` for `openkit run`/hook behavior, `runtime_tooling` for builder/runtime tools, `compatibility_runtime` for workflow-state read models, `documentation` for docs/governance, `package` only if package sync is involved.
  - Explicitly record `target_project_app` validation as unavailable.
  - Include a manual spot check of representative role/stage outputs: Master, ProductLead, SolutionLead, Fullstack, CodeReviewer, QAAgent, QuickAgent, plus migration mode.

## Dependency Graph

Sequential constraints:

```text
TASK-F949-GUIDANCE-BUILDER -> TASK-F949-SESSION-START -> TASK-F949-INTEGRATION
TASK-F949-GUIDANCE-BUILDER -> TASK-F949-RUNTIME-SUMMARY -> TASK-F949-INTEGRATION
TASK-F949-GUIDANCE-BUILDER -> TASK-F949-DOCS-GOVERNANCE -> TASK-F949-INTEGRATION
```

Critical path: shared builder contract -> session-start/runtime consumers -> integrated verification.

## Parallelization Assessment

- `parallel_mode`: `none`
- why: the feature modifies shared prompt text, redaction-sensitive capability summaries, runtime read models, and docs. The compact wording and guardrails must stay identical across startup and runtime summaries; parallel edits risk inconsistent role guidance, stale-state caveats, or secret-safety drift.
- `safe_parallel_zones`: []
- `sequential_constraints`:
  - `TASK-F949-GUIDANCE-BUILDER -> TASK-F949-SESSION-START -> TASK-F949-INTEGRATION`
  - `TASK-F949-GUIDANCE-BUILDER -> TASK-F949-RUNTIME-SUMMARY -> TASK-F949-INTEGRATION`
  - `TASK-F949-GUIDANCE-BUILDER -> TASK-F949-DOCS-GOVERNANCE -> TASK-F949-INTEGRATION`
- `integration_checkpoint`: after session-start, runtime-summary, and docs slices pass their focused tests, run the Slice 5 validation set and inspect outputs for compactness, role/stage correctness, custom MCP labeling, redaction, stale snapshot caveats, and validation-surface honesty before Code Review.
- `max_active_execution_tracks`: 1

No implementation task should run concurrently unless this solution package is revised with explicit safe zones and a new integration checkpoint.

## Task Board Recommendation

Create a full-delivery task board for `feature-949` after solution approval if the orchestrator uses board-backed implementation. Use `parallel_mode=none` and one task per slice:

| Task ID | Title | Kind | Depends On | Primary artifact refs | Primary validation |
| --- | --- | --- | --- | --- | --- |
| `TASK-F949-GUIDANCE-BUILDER` | Build compact capability guidance summary model | `implementation` | none | `src/runtime/tools/capability/capability-router-summary.js`, `src/runtime/managers/capability-registry-manager.js`, `tests/runtime/capability-tools.test.js` | capability tools tests |
| `TASK-F949-SESSION-START` | Integrate compact guidance into session-start | `implementation` | `TASK-F949-GUIDANCE-BUILDER` | `hooks/session-start.js`, `.opencode/tests/session-start-hook.test.js` | session-start hook tests |
| `TASK-F949-RUNTIME-SUMMARY` | Expose guidance through runtime/workflow summaries | `implementation` | `TASK-F949-GUIDANCE-BUILDER` | `.opencode/lib/runtime-summary.js`, `.opencode/workflow-state.js`, runtime summary tests | workflow-state/runtime-platform tests |
| `TASK-F949-DOCS-GOVERNANCE` | Document advisory guidance and boundaries | `documentation` | `TASK-F949-GUIDANCE-BUILDER` | `docs/`, `context/core/`, governance tests | governance tests |
| `TASK-F949-INTEGRATION` | Run integrated validation and record evidence | `verification` | all prior tasks | workflow evidence and handoff refs | focused tests, `verify:governance`, `verify:runtime-foundation`, `verify:all` when available |

Keep only one task active at a time. If implementation discovers the builder must touch additional shared catalog/status files, pause and update the board/artifact refs before proceeding.

## Validation Matrix

| Acceptance / risk target | Validation surface | Proof path |
| --- | --- | --- |
| Session-start shows compact grouped capability guidance | `global_cli` / hook behavior | `.opencode/tests/session-start-hook.test.js` with `OPENKIT_SESSION_START_NO_SKILL=1` and bounded block assertions |
| No full skill/MCP/custom catalog dump | `global_cli` / `runtime_tooling` | builder tests and session-start tests assert line/char caps and bounded names/counts |
| No hidden skill activation | `global_cli` / `runtime_tooling` | tests assert no recommended skill body text appears and wording says explicit load/call required |
| No MCP tool execution at startup | `global_cli` | session-start tests assert advisory language and no “ran/verified/healthy now” claim without explicit check |
| Role/stage guidance preserves ownership | `runtime_tooling` / `compatibility_runtime` | builder/runtime-summary tests for Master, ProductLead, SolutionLead, Fullstack, CodeReviewer, QAAgent, QuickAgent, migration mode |
| Unknown/malformed workflow state is safe | `global_cli` / `compatibility_runtime` | session-start and workflow-state tests for missing/malformed state producing generic degraded guidance |
| Unavailable/degraded/preview/compatibility_only/not_configured states visible | `runtime_tooling` | capability builder tests using existing MCP/skill fixtures |
| Needs-key caveats do not introduce a new enum | `runtime_tooling` / `documentation` | tests/docs assert `not_configured` plus needs-key caveat |
| Custom MCP visibility is custom/origin-labeled | `runtime_tooling` | capability tools tests with custom MCP fixture asserting `kind=custom`, origin, ownership, no bundled-default wording |
| Raw secrets never appear | `global_cli` / `runtime_tooling` / `documentation` | sentinel tests across session-start, builder/runtime summary, docs examples, and workflow output |
| Stale startup snapshot caveat appears | `global_cli` / `compatibility_runtime` | session-start and workflow-state output tests assert snapshot/refresh wording |
| Runtime summaries expose guidance with surface labels | `compatibility_runtime` | `.opencode/tests/workflow-state-cli.test.js`; `tool.runtime-summary` runtime-platform test if touched |
| Docs explain advisory/lazy/compact/redacted boundaries | `documentation` | `tests/runtime/governance-enforcement.test.js`; `npm run verify:governance` |
| Target app validation is not claimed | `documentation` / `compatibility_runtime` | docs/evidence assertions state `target_project_app` unavailable |

## Integration Checkpoint

Before requesting Code Review, Fullstack must provide evidence for:

1. `node --test ".opencode/tests/session-start-hook.test.js"`
2. `node --test ".opencode/tests/workflow-state-cli.test.js"`
3. `node --test "tests/runtime/capability-tools.test.js"`
4. `node --test "tests/runtime/runtime-platform.test.js"` if runtime interface/tool behavior changed
5. `npm run verify:governance`
6. `npm run verify:runtime-foundation`
7. `npm run verify:install-bundle` if package/bundle assets or install-bundled docs are touched
8. `npm run verify:all` when the environment can run the full OpenKit gate
9. `node .opencode/workflow-state.js validate`

The evidence note must explicitly label surfaces and state: `target_project_app` validation is unavailable because this feature changes OpenKit hook/runtime/docs behavior, not a target application.

## Rollback Notes

- Roll back by reverting the guidance builder, session-start integration, runtime-summary read-model fields, workflow-state rendering, and docs/tests together. Do not leave session-start and runtime summary using different guidance contracts.
- If startup output becomes too noisy, disable only the rendered `<openkit_capability_guidance>` block behind a temporary env flag such as `OPENKIT_SESSION_START_NO_CAPABILITY_GUIDANCE` while preserving explicit runtime detail tools. Add the flag only if implemented and documented; do not silently remove guidance.
- If the builder fails in production, session-start must degrade to a short fallback block and continue startup. Runtime summary should report guidance as `unavailable`/`degraded`, not throw.
- No user data migration is required. This feature reads existing local config/inventory state and does not alter MCP config, secrets, profiles, workflow stages, or target application files.
- Do not roll back by weakening redaction, status vocabulary, custom MCP origin labeling, or validation-surface wording.

## Risks And Trade-offs

- **Prompt bloat as catalogs grow**: mitigated with hard line/char/item caps and grouped categories.
- **Hidden activation ambiguity**: mitigated by mandatory advisory wording and tests that no skill body/MCP execution claim appears.
- **Role-boundary drift**: mitigated by explicit role/stage guardrail table and role fixture tests.
- **Stale startup readiness**: mitigated by startup-snapshot caveat and explicit refresh routes.
- **Secret leakage through custom MCP/env/status data**: mitigated by redacted key states only, no raw env/header serialization, and sentinel tests.
- **Custom/bundled ownership confusion**: mitigated by showing custom MCPs only with `kind`, `origin`, and `ownership` caveats and never merging them into bundled defaults.
- **Runtime dependency fragility at startup**: mitigated by guarded helper loading and degraded fallback output.
- **Validation-surface confusion**: mitigated by explicit labels and `target_project_app` unavailable wording in output/docs/evidence.

## Reviewer Focus Points

- Scope compliance: no marketplace, keychain, custom MCP expansion, lane/stage semantic change, or target-project app claim.
- Context economy: session-start/runtime output remains within caps and does not dump full skill/MCP/custom catalogs.
- Lazy activation: recommendations do not load skills, run MCPs, or imply execution.
- Role guardrails: Master/Product/Solution/Fullstack/CodeReviewer/QA/Quick recommendations match current workflow responsibilities.
- Status/caveats: standard vocabulary is used, and `needs-key` remains a caveat over `not_configured`.
- Redaction: no raw secrets, placeholders treated as placeholders, custom MCP env/header/command data summarized safely.
- Staleness: startup snapshot and refresh paths are visible.
- Runtime surfaces: OpenKit capability checks are labeled as `global_cli`, `runtime_tooling`, `compatibility_runtime`, `documentation`, or `package` where appropriate, never `target_project_app`.

## QA Focus Points

- Verify session-start output for compactness, content, stale caveat, redaction, and no hidden activation.
- Verify runtime summary/status/resume JSON carries the same compact guidance and validation-surface labels.
- Verify role/stage scenarios: Master, ProductLead, SolutionLead, Fullstack, CodeReviewer, QAAgent, QuickAgent, migration mode, and unknown state.
- Verify custom MCP fixtures remain origin-labeled and never appear as bundled defaults.
- Verify unavailable/degraded/not_configured/needs-key caveats and detail paths.
- Verify docs/governance examples use placeholders only and do not show full catalogs.
- Mark `target_project_app` validation unavailable unless a separate real target project defines app-native commands.

## Solution Lead Handoff Decision

- **Pass:** this solution defines one recommended approach, explicit impacted files/modules, prompt/content design, role/stage guardrails, test strategy, validation plan, sequential task slices, risks, rollback notes, and review/QA focus points for `solution_to_fullstack` approval.
