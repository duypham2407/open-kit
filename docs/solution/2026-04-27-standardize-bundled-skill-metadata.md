---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-947
feature_slug: standardize-bundled-skill-metadata
source_scope_package: docs/scope/2026-04-27-standardize-bundled-skill-metadata.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
parallel_mode: limited
handoff_rubric: pass
---

# Solution Package: Standardize Bundled Skill Metadata

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-27-standardize-bundled-skill-metadata.md`.
- Current lane/stage/owner: `full` / `full_solution` / `SolutionLead` for `FEATURE-947` / `feature-947`.
- Product gate: `product_to_solution` is approved. This package is the `solution_to_fullstack` handoff artifact only.
- Role boundary: this package defines technical direction, schemas, slices, dependencies, and validation. It does not implement the feature.

## Recommended Path

Use `src/capabilities/skill-catalog.js` as the single canonical metadata source for shipped and declared OpenKit skills, add schema validation around it, and derive every runtime, install-bundle, registry, and documentation read model from that catalog.

This is enough because the repository already has the necessary seams from the MCP capability-pack work:

- shared capability modules under `src/capabilities/`
- runtime capability inventory/router/skill-index tools under `src/runtime/tools/capability/`
- `CapabilityRegistryManager` and `SkillMcpManager` joining skills to MCP inventory
- install-bundle sync/verify scripts and `OPENKIT_ASSET_MANIFEST`
- source skill files under `skills/` and derived install assets under `assets/install-bundle/opencode/skills/`
- repo-native OpenKit validation commands in `package.json`

Do **not** make `SKILL.md` prose the canonical metadata source. Skill markdown may receive minimal frontmatter/header corrections where needed for OpenCode-native display, but canonical machine-readable fields and validation must live in the shared catalog module so runtime and package validation do not parse long-form prose.

## Current Repository Baseline

Observed at solution time:

- `src/capabilities/skill-catalog.js` already defines a v1 catalog but uses `lifecycle`, `triggerHints`, `roleHints`, `modeHints`, `mcpRefs`, and `optionalMcpRefs`; it also uses `status` as computed runtime availability (`available`, `preview`, `unavailable`).
- `src/capabilities/schema.js` validates only `skill.*` ids and standard runtime capability-state labels; it does not validate required skill metadata fields, status semantics, role/stage taxonomy, provenance, support level, or install-bundle sync.
- `skills/` currently contains 20 source skill files.
- `assets/install-bundle/opencode/skills/` currently contains 13 derived skill files.
- The current catalog also declares additional unavailable skill records for frontend/Next/Rust/etc. skills whose `skills/<name>/SKILL.md` files are not present in this repository.
- Runtime tools already exist for `tool.capability-inventory`, `tool.capability-router`, `tool.capability-health`, `tool.mcp-doctor`, `tool.skill-index`, and `tool.skill-mcp-bindings`, but they expose the v1 skill shape and do not route by structured skill metadata.
- `docs/maintainer/role-skill-matrix.md`, `docs/operator/mcp-configuration.md`, `docs/operator/supported-surfaces.md`, and `docs/kit-internals/04-tools-hooks-skills-and-mcps.md` mention skills but do not define the canonical metadata contract.
- Validation commands exist for OpenKit runtime/package/docs surfaces. Target-project application build/lint/test validation is unavailable for this feature.

## Impacted Surfaces

### Shared skill metadata contract

- `src/capabilities/skill-catalog.js`
- `src/capabilities/schema.js`
- `src/capabilities/status.js`
- `src/runtime/capability-registry.js`
- `tests/runtime/skill-catalog.test.js`
- `tests/runtime/capability-registry.test.js`

### Runtime managers and tools

- `src/runtime/managers/capability-registry-manager.js`
- `src/runtime/managers/skill-mcp-manager.js`
- `src/runtime/mcp/skill-mcp-registry.js`
- `src/runtime/tools/capability/capability-inventory.js`
- `src/runtime/tools/capability/capability-router.js`
- `src/runtime/tools/capability/skill-index.js`
- `src/runtime/tools/capability/skill-mcp-bindings.js`
- `src/runtime/create-runtime-interface.js`
- `src/runtime/index.js` only if skill binding registration needs the normalized catalog shape
- `src/mcp-server/tool-schemas.js`
- `tests/runtime/capability-tools.test.js`
- `tests/mcp-server/mcp-server.test.js` if schemas/read models change

### Install-bundle and package sync

- `src/install/asset-manifest.js`
- `scripts/sync-install-bundle.mjs`
- `scripts/verify-install-bundle.mjs`
- `assets/install-bundle/opencode/skills/**`
- `assets/install-bundle/opencode/skill-catalog.json` (create as a generated, non-canonical bundle read model)
- `tests/install/materialize.test.js`
- `tests/install/skill-bundle-sync.test.js` (create, or add equivalent assertions to an existing install test)
- `package.json` only if a new targeted script is added; otherwise keep existing `sync:install-bundle` and `verify:install-bundle`

### Docs, registry, and governance

- `docs/governance/skill-metadata.md` (create)
- `docs/governance/README.md`
- `docs/operator/mcp-configuration.md`
- `docs/operator/supported-surfaces.md`
- `docs/maintainer/role-skill-matrix.md`
- `docs/maintainer/test-matrix.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `context/core/project-config.md`
- `context/core/runtime-surfaces.md`
- `context/core/workflow-state-schema.md` only for validation-surface vocabulary updates; do not change workflow stages or approvals
- `registry.json`
- `.opencode/install-manifest.json` only if it needs to reference the derived skill catalog artifact
- `tests/runtime/governance-enforcement.test.js`
- `tests/runtime/registry-metadata.test.js`

### Skill content files

- `skills/*/SKILL.md` only for targeted metadata/frontmatter corrections.
- Do not rewrite skill bodies broadly.
- Do not add marketplace acquisition, capability-pack installer behavior, lane/stage semantics, or target-project app commands.

## Canonical Metadata Contract

### Source of truth

`src/capabilities/skill-catalog.js` remains the canonical source. It should export:

- `SKILL_CATALOG_VERSION = 2`
- enum constants for status, support, provenance, role, stage, trigger, and MCP relationship values
- `listCanonicalSkillMetadata()` returning undecorated canonical records
- `listBundledSkills(options)` returning decorated runtime records with computed capability state and bundle/source flags
- `getBundledSkill(nameOrId)`
- `assertSkillCatalogEntry(entry)` or equivalent validator used by `src/capabilities/schema.js`
- sync helpers such as `listInstallBundleSkillMetadata()` if useful for package validation

Keep v1 compatibility aliases only as derived fields during transition. Existing consumers may still receive `lifecycle`, `triggerHints`, `roleHints`, `modeHints`, `mcpRefs`, and `optionalMcpRefs`, but those aliases must be computed from v2 canonical fields rather than maintained separately.

### Skill metadata record

```js
{
  schema: 'openkit/skill-catalog-entry@2',
  catalogVersion: 2,
  id: 'skill.verification-before-completion',
  name: 'verification-before-completion',
  displayName: 'Verification Before Completion',
  description: 'Requires fresh verification evidence before completion claims.',
  path: 'skills/verification-before-completion/SKILL.md',

  // Skill maturity, not runtime availability.
  status: 'stable',

  tags: ['workflow', 'verification'],
  roles: ['FullstackAgent', 'QAAgent', 'QuickAgent'],
  stages: ['quick_test', 'full_implementation', 'full_qa', 'migration_verify'],
  triggers: [
    { kind: 'phrase', value: 'before claiming work is complete' },
    { kind: 'keyword', value: 'verification evidence' }
  ],
  recommended_mcps: [
    {
      id: 'openkit',
      relationship: 'primary',
      reason: 'records workflow evidence through OpenKit runtime tools'
    }
  ],

  source: {
    kind: 'openkit_authored',
    origin: 'openkit',
    license: null,
    notes: 'Bundled OpenKit workflow skill.'
  },
  support_level: 'maintained',

  packaging: {
    source: 'repo',
    installBundle: true,
    bundledPath: 'assets/install-bundle/opencode/skills/verification-before-completion/SKILL.md',
    exclusionReason: null
  },

  limitations: [],
  docs: {
    source: 'skills/verification-before-completion/SKILL.md',
    governance: 'docs/governance/skill-metadata.md'
  }
}
```

### Required fields

Every canonical skill record must include:

- `schema`
- `catalogVersion`
- `id`
- `name`
- `displayName`
- `description`
- `path`
- `status`
- `tags`
- `roles`
- `stages`
- `triggers`
- `recommended_mcps`
- `source`
- `support_level`
- `packaging`
- `limitations`
- `docs`

This satisfies the Product scope required fields while adding packaging metadata needed to make source/install-bundle sync enforceable.

### Enum decisions

Skill maturity `status`:

- `stable` — intended for normal bundled OpenKit use.
- `preview` — usable but early, partial, or subject to change; caveats must be visible.
- `experimental` — exploratory or volatile; never the default stable route unless explicitly requested or no stable match exists.

Runtime availability remains separate and should be exposed as `capabilityState` using the existing runtime vocabulary:

- `available`
- `unavailable`
- `degraded`
- `preview`
- `compatibility_only`
- `not_configured`

Support level `support_level`:

- `maintained` — normal OpenKit-bundled support.
- `best_effort` — upstream/community/adapted content where OpenKit maintains metadata and packaging but content support depends partly on upstream quality.
- `compatibility_only` — retained for compatibility or migration support, not preferred as a normal skill path.
- `stub` — placeholder/scaffolded metadata or incomplete skill content.

Provenance `source.kind`:

- `openkit_authored`
- `upstream_imported`
- `adapted`
- `compatibility`
- `stub`

Trigger `kind`:

- `keyword`
- `phrase`
- `command`
- `file_pattern`
- `domain`
- `error_code`
- `request_pattern`

Recommended MCP `relationship`:

- `primary` — strongest advisory backing capability, still not a hard dependency.
- `supporting` — useful backing capability for common use.
- `optional` — nice-to-have or environment-dependent capability.

Role labels:

- Canonical OpenKit roles: `MasterOrchestrator`, `ProductLead`, `SolutionLead`, `FullstackAgent`, `CodeReviewer`, `QAAgent`, `QuickAgent`.
- Non-stage operational audiences: `operator`, `maintainer`, `in_session_agent`.
- `all` is allowed only as a metadata wildcard meaning all current roles/audiences; it is not a workflow role or approval authority.

Stage labels:

- Current stage names only: `quick_intake`, `quick_brainstorm`, `quick_plan`, `quick_implement`, `quick_test`, `quick_done`, `migration_intake`, `migration_baseline`, `migration_strategy`, `migration_upgrade`, `migration_code_review`, `migration_verify`, `migration_done`, `full_intake`, `full_product`, `full_solution`, `full_implementation`, `full_code_review`, `full_qa`, `full_done`.
- `all` is allowed only as a metadata wildcard meaning all current stages; it is not a new stage, lane, enum, or workflow-state value.

Packaging `source`:

- `repo` — `skills/<name>/SKILL.md` exists in repository source.
- `metadata_only` — no source skill file exists; record is a visible stub/placeholder.
- `external_reference` — metadata points to an upstream/imported source without copying content into this repository.

### Validation rules

Catalog validation must fail with the skill id, field, actual value, and allowed values when:

- a required field is missing or has the wrong type
- `id` is not `skill.${name}`
- `name` is not a normalized skill slug
- `path` is absolute, contains `..`, contains `~`, or does not match `skills/<name>/SKILL.md` for repo-backed records
- `description` is empty
- `status` is not `stable`, `preview`, or `experimental`
- a `stub`, `metadata_only`, or `support_level: 'stub'` record is labeled `stable`
- `tags` are not normalized lower-kebab/topic labels
- `roles` contain labels outside the allowed role/audience set plus `all`
- `stages` contain labels outside the current workflow stage set plus `all`
- `triggers` are not structured trigger objects with supported `kind` values and non-empty `value`
- `recommended_mcps` reference an unknown bundled/custom MCP id without an explicit documented custom placeholder convention
- `recommended_mcps` contain secrets, raw environment values, or user-specific config
- `source.kind` is unsupported or imported/adapted records omit enough provenance to audit origin
- `support_level` is unsupported or conflicts with `source.kind`
- `packaging.installBundle === true` but source or derived bundle files are missing
- a source skill exists under `skills/*/SKILL.md` without exactly one catalog record
- a derived install-bundle skill exists without exactly one catalog record and manifest entry
- source and derived install-bundle content diverge without running `npm run sync:install-bundle`

Validation should return structured errors for tests and human-readable summaries for scripts.

## Skill Set And Packaging Strategy

### Existing install-bundled skills

For skills already present under `assets/install-bundle/opencode/skills/`, keep them discoverable as normal bundled skills after metadata is complete. Classify them as `stable` only when:

- source file exists under `skills/<name>/SKILL.md`
- install-bundle asset manifest includes the file
- support level is not `stub`
- role/stage/trigger/provenance/MCP metadata is complete
- no known partial/stub limitation applies

If any of those are uncertain, use `preview` with an explicit `limitations` entry instead of assuming `stable`.

### Existing source-only skills

For source skill files present under `skills/` but absent from `assets/install-bundle/opencode/skills/` at solution time, prefer including them in the install bundle unless there is a concrete exclusion reason.

Current source-only candidates to reconcile include:

- `codebase-exploration`
- `deep-research`
- `refactoring`
- `frontend-ui-ux`
- `dev-browser`
- `browser-automation`
- `git-master`

Implementation choices for each such skill must be explicit in metadata:

- `packaging.installBundle: true` and a corresponding asset-manifest entry, or
- `packaging.installBundle: false` with `exclusionReason` and a non-misleading runtime `capabilityState`.

Do not leave source-only drift implicit.

### Metadata-only, preview, and stub skills

Catalog records for skills without a repository `SKILL.md` file may remain only when they are explicitly represented as metadata-only preview/stub records:

- `status: 'preview'` or `status: 'experimental'`
- `support_level: 'stub'` or `support_level: 'best_effort'` as applicable
- `source.kind: 'stub'` or an audited imported/adapted source kind
- `packaging.source: 'metadata_only'`
- `packaging.installBundle: false`
- a clear `limitations` entry explaining that no bundled skill file is currently shipped
- computed `capabilityState: 'unavailable'` unless a real source file or runtime-loaded equivalent is present

Do not fabricate full skill content for these entries as part of this feature. Adding real skill bodies for missing Next/Rust/frontend skills would be separate content work unless a minimal stub file is already approved.

### Skill markdown headers

Canonical metadata remains in `skill-catalog.js`. However, source `SKILL.md` files that currently lack basic frontmatter may receive targeted metadata headers for native skill display:

```yaml
---
name: codebase-exploration
description: Locate code, trace behavior, and map repository structure using OpenKit intelligence tools.
---
```

Only add or correct headers where needed for display or validation. Do not rewrite the instructional body unless metadata accuracy requires a small correction.

### Install-bundle consistency

Add a generated, derived bundle read model at `assets/install-bundle/opencode/skill-catalog.json` so the static install bundle can be inspected without importing source modules. This file is not canonical and must be regenerated by `npm run sync:install-bundle`.

`npm run verify:install-bundle` must detect:

- source skill missing from catalog
- catalog install-bundled skill missing from `OPENKIT_ASSET_MANIFEST`
- manifest skill missing from catalog
- derived bundle skill file missing or extra
- source/bundle file mismatch
- derived `skill-catalog.json` mismatch against canonical metadata
- catalog metadata-only/stub record accidentally marked install-bundled

## Runtime And Tool Exposure Plan

### Capability inventory

`tool.capability-inventory` and `CapabilityRegistryManager.listCapabilities()` should return skills with canonical metadata plus computed runtime context:

```js
{
  id,
  name,
  displayName,
  description,
  status,          // stable | preview | experimental
  capabilityState, // available | unavailable | degraded | preview | compatibility_only | not_configured
  support_level,
  source,
  roles,
  stages,
  tags,
  triggers,
  recommended_mcps,
  packaging,
  limitations,
  bundled,
  validationSurface: 'runtime_tooling'
}
```

Do not collapse `status` and `capabilityState` into one ambiguous label.

### Skill index

`tool.skill-index` should use the same canonical metadata as package validation. Extend filters without breaking the existing category filter:

- `category` / `tag`
- `role`
- `stage`
- `status`
- `support_level`
- `includeUnavailable` (default should include preview/stub labels when listed, but routing defaults may suppress unstable matches)

Return selection-ready metadata and visible caveats for preview/experimental/stub records.

### Skill MCP bindings

`SkillMcpManager` and `tool.skill-mcp-bindings` should derive bindings from `recommended_mcps`, not from hand-maintained `mcpRefs` arrays. Each binding should include:

- `skillId`
- `skillName`
- `mcpId`
- `relationship`
- `reason`
- `mcpKnown: true | false`
- `mcpCapabilityState` when known from MCP inventory
- `mcpEnabled` when known
- `skillStatus`
- `skillSupportLevel`
- `optionalOrCustomCaveat` when the MCP is custom-only, disabled, unavailable, degraded, or not configured

Recommended MCP linkage is advisory. Missing/degraded MCPs should be shown as context and must not automatically hide the skill unless the skill itself is metadata-only/unavailable.

### Capability router metadata

`tool.capability-router` should support metadata-backed skill routing in addition to current MCP routing.

Input should keep existing fields and add optional metadata filters:

```js
{
  scope: 'openkit',
  intent: 'debug a React render performance issue',
  skillName: null,
  mcpId: null,
  role: 'FullstackAgent',
  stage: 'full_implementation',
  tags: ['frontend', 'performance'],
  includePreview: false,
  includeExperimental: false
}
```

Output should explain selection without hidden activation:

```js
{
  validationSurface: 'runtime_tooling',
  status: 'available',
  matchStatus: 'matched',
  selectedSkill: { id, name, status, capabilityState, support_level, limitations },
  selectionReasons: [
    { field: 'trigger', value: 'React', weight: 3 },
    { field: 'role', value: 'FullstackAgent', weight: 2 },
    { field: 'stage', value: 'full_implementation', weight: 2 }
  ],
  candidatesConsidered: 4,
  suppressedCandidates: [
    { skillId: 'skill.some-experimental-skill', reason: 'experimental-not-requested' }
  ],
  recommendedMcps: [
    { id: 'chrome-devtools', relationship: 'supporting', capabilityState: 'degraded', guidance: '...' }
  ],
  guidance: 'Load the selected skill explicitly before using it.'
}
```

Routing rules:

- Exact `skillName` may return preview/experimental records, but must show caveats.
- Intent-based matching ranks stable over preview over experimental unless the request explicitly asks for preview/experimental or no stable skill satisfies the request.
- Metadata-only/stub skills are never default recommendations when a stable source-backed skill matches.
- No suitable match returns `status: 'unavailable'`, `matchStatus: 'no_match'`, and guidance, not an unrelated silent fallback.
- Router output recommends skill loading; it does not silently activate a skill or change lane/stage workflow semantics.

### Runtime summary and compatibility surfaces

Update `createRuntimeInterface()` capability-pack summaries to count skill maturity and runtime capability states separately:

```js
skillSummary: {
  total,
  maturity: { stable, preview, experimental },
  capabilityStates: { available, unavailable, degraded, preview, compatibility_only, not_configured },
  supportLevels: { maintained, best_effort, compatibility_only, stub }
}
```

If workflow evidence records package/source sync results, add `package` to the validation-surface vocabulary and keep it separate from `runtime_tooling`, `documentation`, `compatibility_runtime`, and `target_project_app`.

## Dependencies

- No new npm package dependency is required.
- No new environment variables are required.
- Existing Node.js `>=18` and `node:test` are enough for schema/package/runtime tests.
- Target-project app validation remains unavailable because this repository does not define app-native application build, lint, or test commands.

## Implementation Slices

### [ ] Slice 1: Canonical skill metadata schema and catalog normalization

- **Executable task id**: `TASK-F947-SKILL-SCHEMA`
- **Files**:
  - `src/capabilities/skill-catalog.js`
  - `src/capabilities/schema.js`
  - `src/capabilities/status.js`
  - `src/runtime/capability-registry.js`
  - `tests/runtime/skill-catalog.test.js`
  - `tests/runtime/capability-registry.test.js`
- **Goal**: define v2 canonical skill metadata and separate skill maturity from runtime capability state.
- **Dependencies**: none.
- **Validation Command**:
  - `node --test "tests/runtime/skill-catalog.test.js"`
  - `node --test "tests/runtime/capability-registry.test.js"`
- **Details**:
  - Write failing tests first for required fields, enum validation, role/stage taxonomy, `status` vs `capabilityState` separation, provenance/support rules, trigger shape, and recommended MCP id validation.
  - Convert v1 fields into canonical v2 fields and generate transitional aliases for existing consumers.
  - Add `package` to validation-surface vocabulary only for package/install-bundle sync evidence; do not change workflow stage or approval enums.
  - Treat uncertain or missing skill content as `preview`/`experimental` with visible limitations, never `stable` by assumption.

### [ ] Slice 2: Existing skill classification and install-bundle synchronization

- **Executable task id**: `TASK-F947-BUNDLE-SYNC`
- **Files**:
  - `src/install/asset-manifest.js`
  - `scripts/sync-install-bundle.mjs`
  - `scripts/verify-install-bundle.mjs`
  - `assets/install-bundle/opencode/skills/**`
  - `assets/install-bundle/opencode/skill-catalog.json` (create, generated)
  - `skills/*/SKILL.md` only for targeted metadata header fixes
  - `tests/install/skill-bundle-sync.test.js` (create, or equivalent install test)
  - `tests/install/materialize.test.js` if install materialization expectations change
- **Goal**: make source skill files, asset manifest entries, derived bundle files, and derived bundle metadata agree.
- **Dependencies**: `TASK-F947-SKILL-SCHEMA`.
- **Validation Command**:
  - `npm run sync:install-bundle`
  - `npm run verify:install-bundle`
  - `node --test "tests/install/skill-bundle-sync.test.js"` if created
  - `node --test "tests/install/materialize.test.js"` if touched
- **Details**:
  - Reconcile the current 20 source skill files against the current 13 install-bundle skill files.
  - Include source-only skills in the install bundle by default, unless metadata records an explicit exclusion reason.
  - Generate the derived bundle `skill-catalog.json` from canonical metadata; never edit it by hand.
  - Ensure metadata-only/stub catalog entries are visible but not accidentally install-bundled.
  - Keep source and derived install-bundle skill bodies byte-for-byte synced through the existing sync/verify flow.

### [ ] Slice 3: Runtime inventory, skill index, MCP bindings, and router metadata

- **Executable task id**: `TASK-F947-RUNTIME-EXPOSURE`
- **Files**:
  - `src/runtime/managers/capability-registry-manager.js`
  - `src/runtime/managers/skill-mcp-manager.js`
  - `src/runtime/mcp/skill-mcp-registry.js`
  - `src/runtime/tools/capability/capability-inventory.js`
  - `src/runtime/tools/capability/capability-router.js`
  - `src/runtime/tools/capability/skill-index.js`
  - `src/runtime/tools/capability/skill-mcp-bindings.js`
  - `src/runtime/create-runtime-interface.js`
  - `src/runtime/index.js` if registration inputs need normalization
  - `src/mcp-server/tool-schemas.js`
  - `tests/runtime/capability-tools.test.js`
  - `tests/mcp-server/mcp-server.test.js` if schemas are changed
- **Goal**: expose canonical skill metadata consistently in runtime tooling and make router decisions explainable.
- **Dependencies**: `TASK-F947-SKILL-SCHEMA`.
- **Validation Command**:
  - `node --test "tests/runtime/capability-tools.test.js"`
  - `node --test "tests/runtime/capability-registry.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"` if touched
  - `npm run verify:runtime-foundation`
- **Details**:
  - Update capability inventory and skill index outputs to include canonical fields plus computed runtime context.
  - Update `SkillMcpManager` to derive bindings from `recommended_mcps`.
  - Update router matching to consider trigger/tag/role/stage/status/MCP metadata and to prefer stable skills by default.
  - Return explicit no-match/degraded/unavailable responses rather than silent unrelated fallback.
  - Show recommended MCP status/guidance without hiding the skill or exposing secrets.

### [ ] Slice 4: Documentation, governance, registry, and role-skill matrix

- **Executable task id**: `TASK-F947-DOCS-GOVERNANCE`
- **Files**:
  - `docs/governance/skill-metadata.md` (create)
  - `docs/governance/README.md`
  - `docs/operator/mcp-configuration.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/maintainer/role-skill-matrix.md`
  - `docs/maintainer/test-matrix.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `context/core/workflow-state-schema.md` only for validation-surface vocabulary updates
  - `registry.json`
  - `.opencode/install-manifest.json` only if it references the derived bundle metadata
  - `tests/runtime/governance-enforcement.test.js`
  - `tests/runtime/registry-metadata.test.js`
- **Goal**: make the contract discoverable for maintainers/operators and align machine-readable registry docs with canonical metadata.
- **Dependencies**: `TASK-F947-SKILL-SCHEMA`.
- **Validation Command**:
  - `npm run verify:governance`
  - `node --test "tests/runtime/registry-metadata.test.js"`
- **Details**:
  - Document required fields, enum meanings, role/stage taxonomy, trigger semantics, recommended MCP linkage, provenance, support level, stub handling, package sync, and target-project validation boundaries.
  - Update role-skill matrix to reference the canonical metadata contract and avoid becoming an unsynchronized duplicate catalog. If it still lists key skills manually, tests should verify it stays aligned with canonical role metadata.
  - Add `package` as a validation-surface label for bundle/source sync if implemented in `status.js`; keep `target_project_app` explicitly unavailable.
  - Do not change lane/stage names, approval gates, or workflow-state stage enums.

### [ ] Slice 5: Integration validation and handoff evidence

- **Executable task id**: `TASK-F947-INTEGRATION`
- **Files**:
  - No primary production files unless integration fixes are needed.
  - Verification artifacts or workflow evidence only.
- **Goal**: prove the schema, package sync, runtime tools, docs, and governance outputs agree before code review.
- **Dependencies**: `TASK-F947-BUNDLE-SYNC`, `TASK-F947-RUNTIME-EXPOSURE`, `TASK-F947-DOCS-GOVERNANCE`.
- **Validation Command**:
  - `node --test "tests/runtime/skill-catalog.test.js"`
  - `node --test "tests/runtime/capability-registry.test.js"`
  - `node --test "tests/runtime/capability-tools.test.js"`
  - `npm run verify:install-bundle`
  - `npm run verify:governance`
  - `npm run verify:runtime-foundation`
  - `npm run verify:all`
  - `node .opencode/workflow-state.js validate`
- **Details**:
  - Record validation evidence using the correct surface labels: `runtime_tooling`, `documentation`, `package`, and `compatibility_runtime`.
  - Explicitly record `target_project_app` validation as unavailable for this feature.
  - Run a manual spot check of `tool.skill-index`, `tool.capability-inventory`, `tool.skill-mcp-bindings`, and `tool.capability-router` output to confirm preview/stub/support/provenance/MCP caveats are visible.

## Dependency Graph

Sequential constraints:

```text
TASK-F947-SKILL-SCHEMA -> TASK-F947-BUNDLE-SYNC -> TASK-F947-INTEGRATION
TASK-F947-SKILL-SCHEMA -> TASK-F947-RUNTIME-EXPOSURE -> TASK-F947-INTEGRATION
TASK-F947-SKILL-SCHEMA -> TASK-F947-DOCS-GOVERNANCE -> TASK-F947-INTEGRATION
```

Critical path: schema/catalog normalization -> bundle/runtime/docs consumers -> final integrated verification.

## Parallelization Assessment

- parallel_mode: `limited`
- why: the canonical schema/catalog slice is a shared dependency and must land first. After that, install-bundle sync, runtime exposure, and docs/governance updates can proceed in limited parallel if they do not edit the same files and all rebase onto the finalized schema.
- safe_parallel_zones:
  - `src/install/`
  - `scripts/`
  - `assets/install-bundle/opencode/skills/`
  - `assets/install-bundle/opencode/skill-catalog.json`
  - `tests/install/`
  - `src/runtime/`
  - `src/mcp-server/`
  - `tests/runtime/capability-`
  - `docs/`
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `context/core/workflow-state-schema.md`
  - `registry.json`
  - `tests/runtime/governance-enforcement.test.js`
  - `tests/runtime/registry-metadata.test.js`
- sequential_constraints:
  - `TASK-F947-SKILL-SCHEMA -> TASK-F947-BUNDLE-SYNC -> TASK-F947-INTEGRATION`
  - `TASK-F947-SKILL-SCHEMA -> TASK-F947-RUNTIME-EXPOSURE -> TASK-F947-INTEGRATION`
  - `TASK-F947-SKILL-SCHEMA -> TASK-F947-DOCS-GOVERNANCE -> TASK-F947-INTEGRATION`
- integration_checkpoint: after bundle/runtime/docs slices complete, run the Slice 5 validation set and inspect runtime tool outputs for status/support/provenance/MCP consistency before Code Reviewer.
- max_active_execution_tracks: `2`

Parallel work is unsafe before `TASK-F947-SKILL-SCHEMA` is complete. Any task that needs to edit `src/capabilities/skill-catalog.js`, `src/capabilities/schema.js`, or `src/capabilities/status.js` after Slice 1 must pause parallel execution and re-coordinate because those files define the shared contract.

## Task Board Recommendation

Create a full-delivery task board for `feature-947` after solution approval if the orchestrator uses board-backed implementation. Use limited parallel mode only after the schema/catalog task is complete.

Recommended tasks:

| Task ID | Title | Kind | Depends On | Primary artifact refs | Primary validation |
| --- | --- | --- | --- | --- | --- |
| `TASK-F947-SKILL-SCHEMA` | Define canonical bundled skill metadata schema | `implementation` | none | `src/capabilities/`, `tests/runtime/skill-catalog.test.js` | skill catalog and capability registry tests |
| `TASK-F947-BUNDLE-SYNC` | Synchronize source skills with install-bundle metadata | `implementation` | `TASK-F947-SKILL-SCHEMA` | `src/install/`, `scripts/`, `assets/install-bundle/opencode/`, `tests/install/` | install-bundle sync/verify tests |
| `TASK-F947-RUNTIME-EXPOSURE` | Expose skill metadata in runtime tools and router | `implementation` | `TASK-F947-SKILL-SCHEMA` | `src/runtime/`, `src/mcp-server/`, `tests/runtime/capability-*` | runtime capability tools tests |
| `TASK-F947-DOCS-GOVERNANCE` | Document governance, role matrix, and registry expectations | `documentation` | `TASK-F947-SKILL-SCHEMA` | `docs/`, `context/core/`, `registry.json`, governance tests | governance and registry tests |
| `TASK-F947-INTEGRATION` | Run integrated validation and record handoff evidence | `verification` | bundle/runtime/docs tasks | workflow evidence and QA handoff refs | `verify:all`, workflow-state validation, manual runtime output spot checks |

Do not create a task for broad skill-body rewriting. Any missing or incomplete skill content discovered during implementation should be represented as preview/experimental/stub metadata or raised as follow-up scope.

## Validation Matrix

| Acceptance target | Validation surface | Implementation proof | Validation path |
| --- | --- | --- | --- |
| Every catalog record has required metadata | `runtime_tooling` / `package` | v2 validator and catalog tests | `node --test "tests/runtime/skill-catalog.test.js"` |
| Unsupported skill maturity status fails validation | `runtime_tooling` | enum assertions and negative fixtures | `node --test "tests/runtime/skill-catalog.test.js"` |
| Role/stage taxonomy stays canonical | `runtime_tooling` / `documentation` | allowed enum tests and docs | skill catalog tests; `npm run verify:governance` |
| Stub/preview/experimental skills are labeled visibly | `runtime_tooling` / `documentation` | catalog records, runtime outputs, docs caveats | skill catalog tests; capability tools tests; governance tests |
| Skill status is separate from runtime capability state | `runtime_tooling` | `status` and `capabilityState` both exposed | capability registry/tools tests |
| Recommended MCP ids are known or documented placeholders | `runtime_tooling` | validator joins MCP catalog/custom placeholder convention | skill catalog tests; skill-MCP bindings tests |
| Runtime capability inventory exposes canonical metadata | `runtime_tooling` | inventory output uses canonical fields | `node --test "tests/runtime/capability-tools.test.js"` |
| Skill index uses same canonical catalog as package validation | `runtime_tooling` / `package` | skill-index reads canonical module, not duplicate data | capability tools tests; install bundle tests |
| Router selection is explainable and stable-first | `runtime_tooling` | router returns selected skill, reasons, suppressed candidates, MCP context | capability tools tests |
| No suitable skill match degrades honestly | `runtime_tooling` | router returns no-match/unavailable guidance | capability tools tests |
| Source and install-bundle metadata stay synchronized | `package` | asset manifest and derived bundle catalog compare to canonical source | `npm run verify:install-bundle`; install sync test |
| Docs explain metadata governance and validation boundaries | `documentation` | governance/operator/maintainer docs updated | `npm run verify:governance` |
| Workflow/runtime validation records correct surface labels | `compatibility_runtime` | workflow state validation and evidence labels | `node .opencode/workflow-state.js validate` |
| Target-project app validation boundary preserved | `target_project_app` | app-native validation explicitly unavailable | final handoff evidence; governance docs |

## Integration Checkpoint

Before handoff to Code Reviewer:

1. Confirm `src/capabilities/skill-catalog.js` is the only canonical metadata source.
2. Confirm `assets/install-bundle/opencode/skill-catalog.json` is generated and matches canonical metadata.
3. Confirm every `skills/*/SKILL.md` has exactly one canonical metadata record.
4. Confirm every install-bundle skill asset has exactly one canonical metadata record and manifest entry.
5. Confirm runtime outputs expose `status`, `capabilityState`, `support_level`, `source`, `roles`, `stages`, `triggers`, and `recommended_mcps` without secrets.
6. Confirm router output explains why a skill was selected or why no suitable match exists.
7. Run the Slice 5 validation set.
8. Record that `target_project_app` validation is unavailable.

## Rollback Notes

- Roll back by reverting `src/capabilities/skill-catalog.js`, `src/capabilities/schema.js`, runtime consumer updates, asset-manifest changes, and generated bundle catalog together. Do not roll back only the generated bundle artifact because it is derived from the catalog.
- If runtime output breaks after deployment, temporarily keep v1 compatibility aliases (`lifecycle`, `triggerHints`, `roleHints`, `modeHints`, `mcpRefs`, `optionalMcpRefs`) while fixing consumers; do not reintroduce duplicate canonical metadata.
- If install-bundle sync becomes noisy, fail closed in `verify:install-bundle` and keep explicit `packaging.installBundle: false` exclusions rather than silently allowing drift.
- No user data migration or target-project application rollback is required. This feature changes OpenKit metadata/runtime/package/docs surfaces only.
- Do not mutate workflow-state enums or lane/stage semantics as part of rollback.

## Risks And Trade-offs

- **Status naming collision:** current skill records use `status` as runtime availability, while the scope requires `status` as skill maturity. Mitigation: introduce `capabilityState` for runtime availability and update all consumers/tests in the same change.
- **Catalog overclaiming unavailable skills:** existing catalog entries for absent skill files can be mistaken for shipped capabilities. Mitigation: classify them as metadata-only preview/experimental/stub with `capabilityState: 'unavailable'` and visible limitations.
- **Install-bundle drift:** source skills and derived bundle skills already differ. Mitigation: canonical packaging metadata, generated bundle catalog, and stronger `verify:install-bundle` checks.
- **Docs becoming duplicate metadata:** role-skill matrix and operator docs can drift if they repeat the full catalog. Mitigation: document taxonomy/rules and only list stable examples; tests should check docs reference canonical metadata.
- **Router hidden activation risk:** richer metadata could tempt silent skill activation. Mitigation: router only recommends and explains; actual skill loading remains visible through existing skill invocation behavior.
- **Validation surface vocabulary expansion:** adding `package` requires doc/test alignment. Mitigation: restrict `package` to install-bundle/source sync evidence and keep `target_project_app` separate and unavailable.

## Reviewer Focus Points

- Verify the implementation preserves the approved scope and does not add marketplace/install-acquisition behavior.
- Confirm lane, stage, approval, and workflow-state enums are unchanged except for validation-surface vocabulary if `package` is added.
- Check that `status` means skill maturity and `capabilityState` means runtime availability everywhere.
- Check that stub/source-only/unavailable skills are not presented as stable defaults.
- Check that recommended MCP metadata uses known MCP ids or documented custom placeholders and contains no secrets.
- Check install-bundle validation fails on missing, extra, stale, or divergent skill metadata/assets.
- Check runtime router output is explainable and does not silently activate skills.
- Check docs and registry are aligned with canonical metadata without broad skill-body rewrites.

## QA Focus Points

- Run package, runtime, documentation, and compatibility-runtime validation separately and label evidence accurately.
- Inspect representative runtime outputs for one stable skill, one preview skill, one metadata-only/stub skill, and one skill with unavailable/not-configured recommended MCPs.
- Confirm `target_project_app` validation remains explicitly unavailable.
- Confirm no generated docs, bundle metadata, runtime summaries, or tool outputs expose user-specific configuration or secrets.
