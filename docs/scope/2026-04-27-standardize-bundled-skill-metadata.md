---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-947
feature_slug: standardize-bundled-skill-metadata
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: Standardize Bundled Skill Metadata

OpenKit should make bundled skills as structured and governable as bundled MCP capabilities by giving every shipped skill consistent metadata, visible maturity status, traceable provenance, routing labels, and package/source sync expectations without changing lane semantics or rewriting skill content beyond what metadata accuracy requires.

## Goal

- Define and enforce a consistent bundled-skill metadata contract covering identity, maturity, routing, MCP linkage, provenance, support, and trigger semantics.
- Ensure runtime capability inventory, routing, and skill-index surfaces consume or expose that metadata consistently.
- Keep install-bundle skill metadata aligned with repository source metadata so operators and agents see the same capability picture after install or upgrade.
- Make stub, preview, and experimental skills visible as such instead of treating them as stable capabilities.

## Target Users

- **OpenKit operator:** wants to know which bundled skills exist, what they do, which are stable versus preview/experimental, and what setup may help them work best.
- **In-session agent:** needs reliable metadata to decide when a skill should be loaded, which roles/stages it applies to, and which MCPs are recommended.
- **Maintainer:** needs a governed metadata source to update bundled skills without source/package drift or hidden capability activation.
- **Capability router/runtime tooling:** needs structured skill records that can be indexed, exposed, filtered, and paired with MCP capability metadata.

## Problem Statement

After the MCP capability pack, interactive wizard, and custom MCP support, bundled MCPs now have clearer governance than bundled skills. Skill capabilities remain harder to inspect consistently because maturity status, role/stage applicability, triggers, recommended MCPs, provenance, and support expectations are not uniformly represented. Operators, agents, maintainers, and runtime routers need a single structured view so skill activation is explainable, preview/stub skills are not misrepresented as stable, and packaged bundles stay aligned with repository source.

## In Scope

- Define required metadata fields for every bundled skill:
  - `name`
  - `description`
  - `status`
  - `tags`
  - `roles`
  - `stages`
  - `triggers`
  - `recommended_mcps`
  - `source` or provenance
  - `support_level`
- Define allowed values and semantics for skill maturity status: `stable`, `preview`, and `experimental`.
- Define a role and stage taxonomy that uses current OpenKit role/stage vocabulary and does not introduce new lane or stage semantics.
- Define how recommended MCP linkage is represented for skills, including optional or unavailable MCPs.
- Define provenance requirements so maintainers can distinguish bundled OpenKit-authored, bundled imported/adapted, and compatibility/stub sources where applicable.
- Define support-level expectations so users can distinguish maintained, best-effort, compatibility-only, and stub/placeholder skills.
- Require runtime capability inventory, router, and skill-index surfaces to consume or expose the same skill metadata contract.
- Require install bundle and repository source metadata to remain synchronized and verifiable.
- Require stub, placeholder, incomplete, preview, and experimental skills to be clearly identified in inventory, runtime summaries, docs, and routing decisions.
- Update documentation and package metadata necessary to explain the skill metadata contract and validation expectations.

## Out of Scope

- Rewriting all bundled skill content or changing skill instructions except where necessary to add, correct, or reconcile metadata.
- Changing `quick`, `migration`, or `full` lane semantics, stage names, approval gates, escalation rules, or workflow-state enums.
- Adding a marketplace, remote skill registry, capability-pack installer, or third-party capability acquisition flow.
- Adding new MCP configuration commands beyond metadata linkage to already-known/bundled/custom MCP IDs.
- Changing target-project application build, lint, or test behavior.
- Treating OpenKit runtime, package, or workflow validation as target-project application validation.
- Introducing hidden skill activation based only on metadata; metadata may inform routing, but activation must remain visible and explainable.

## Users And User Journeys

1. **As an OpenKit operator, I want bundled skills to list status, purpose, and support level, so that I know which skills are safe defaults and which are preview or experimental.**
2. **As an in-session agent, I want skill metadata to expose roles, stages, triggers, tags, and recommended MCPs, so that I can select relevant skills without guessing from unstructured prose.**
3. **As a maintainer, I want repository source metadata and packaged bundle metadata to be checked for sync, so that install and upgrade users receive the same governed skill catalog that exists in source.**
4. **As the capability router, I want skill metadata in a structured contract, so that skill inventory and routing can align with MCP capability inventory and report unsupported or preview capabilities honestly.**
5. **As an operator using a stub or preview skill, I want the runtime to label its limitation before use, so that I do not mistake incomplete guidance for stable OpenKit behavior.**

## Business Rules

### Metadata Contract

- Every bundled skill must have exactly one canonical metadata record discoverable by runtime tooling and package validation.
- Required metadata fields are:
  - `name`: stable human-readable skill name or canonical skill identifier.
  - `description`: concise statement of what the skill is for.
  - `status`: one of `stable`, `preview`, or `experimental`.
  - `tags`: zero or more normalized topic labels for discovery and filtering.
  - `roles`: zero or more OpenKit role labels for intended users/agents.
  - `stages`: zero or more workflow stage labels where the skill is relevant.
  - `triggers`: explicit activation hints, keywords, commands, or request patterns.
  - `recommended_mcps`: zero or more MCP capability IDs that improve or support the skill.
  - `source` or provenance: where the skill came from and whether it is OpenKit-authored, imported/adapted, compatibility, or stub/placeholder.
  - `support_level`: support expectation visible to maintainers and operators.
- Missing required fields must be reported as metadata validation failures for bundled skills.
- Metadata must be machine-consumable and should not require parsing long-form skill prose to answer inventory or routing questions.
- Skill prose may remain as-is unless metadata accuracy requires targeted edits.

### Status Semantics

- `stable` means the skill is intended for normal use, has complete metadata, and is supported as part of the bundled OpenKit experience.
- `preview` means the skill is usable but early, partial, or subject to change; limitations must be visible wherever the skill appears in inventory or routing summaries.
- `experimental` means the skill is exploratory, volatile, or not yet proven for normal workflow reliance; runtime/router output must not present it as a stable default.
- Stub or placeholder skills must not be labeled `stable`; they must use `preview` or `experimental` and carry provenance/support text that makes the limitation visible.
- Status labels for skills are separate from runtime capability labels such as `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`; downstream design may map or display both, but must not collapse them into ambiguous wording.

### Role And Stage Taxonomy

- Role metadata must use current OpenKit role vocabulary where applicable, including `MasterOrchestrator`, `ProductLead`, `SolutionLead`, `FullstackAgent`, `CodeReviewer`, `QAAgent`, `QuickAgent`, `operator`, `maintainer`, and `in_session_agent`.
- Stage metadata must use current workflow stage names where applicable, including `quick_*`, `migration_*`, and `full_*` stages already defined in the canonical workflow contract.
- Cross-cutting skills may declare broad labels such as `all` or empty stage lists only if the metadata contract defines their meaning explicitly.
- Role/stage metadata must not add, rename, remove, or reinterpret workflow lanes, stages, approval gates, or workflow-state enums.

### Trigger And Routing Semantics

- Trigger metadata must describe when a skill should be considered; it must not silently force activation.
- Runtime router or skill-index output must make skill selection explainable by exposing the metadata factors used, such as matching trigger, role, stage, tag, status, or recommended MCP availability.
- No hidden skill activation: if a skill is selected automatically, the session or runtime summary must be able to explain why and show its status/support limitations.
- When multiple skills match, stable skills should be preferred over preview or experimental skills unless the request explicitly needs the less-stable skill or no stable option exists.
- When no appropriate skill metadata match exists, the router must report no match or degraded fallback honestly instead of selecting an unrelated skill silently.

### Recommended MCP Linkage

- `recommended_mcps` must reference known MCP capability IDs or clearly documented optional/custom placeholders.
- Recommended MCPs are advisory unless downstream design explicitly marks a dependency as required; this feature only requires recommended linkage.
- If a recommended MCP is disabled, missing, custom-only, not configured, unavailable, or degraded, skill inventory/router output must report that status without treating the skill itself as necessarily unusable.
- Skill metadata must not embed MCP secrets, raw credentials, or user-specific configuration.
- Recommended MCP linkage must stay aligned with the bundled/custom MCP inventory vocabulary introduced by prior MCP features.

### Provenance And Support Level

- Provenance must identify whether a skill is OpenKit-authored, bundled from an external/upstream source, adapted, compatibility-only, or stub/placeholder.
- Imported or adapted skills must retain enough source/provenance detail for maintainers to audit origin and update responsibility.
- Support level must distinguish at least these product meanings:
  - maintained as a normal bundled skill
  - best-effort or community/upstream-dependent
  - compatibility-only
  - stub/placeholder or scaffolded
- Support level must be visible to maintainers and available to runtime inventory consumers.

### Install-Bundle Sync

- Repository source metadata and installed/package bundle metadata must describe the same bundled skill set after build/install/upgrade flows covered by OpenKit packaging.
- Validation must detect missing, extra, stale, or divergent skill metadata between source and package bundle surfaces.
- If a skill exists in source but is intentionally excluded from the install bundle, that exclusion must be explicit in metadata or package documentation.
- If a skill exists in the install bundle but not source metadata, validation must fail or report a blocking package metadata defect.
- Package validation must not require target-project application commands.

### Stub, Preview, And Experimental Skill Handling

- Stub, placeholder, incomplete, preview, or experimental skills must remain discoverable but clearly labeled.
- Runtime surfaces must not default to presenting stub or experimental skills as stable recommendations.
- Documentation must explain what users should expect from preview and experimental skills.
- If an existing bundled skill cannot be confidently classified, the safer default is `preview` with an explicit follow-up note, not `stable` by assumption.

## Acceptance Criteria Matrix

### Metadata Contract Coverage

- **Given** the bundled skill catalog is inspected, **when** each bundled skill metadata record is validated, **then** every record includes `name`, `description`, `status`, `tags`, `roles`, `stages`, `triggers`, `recommended_mcps`, provenance/source, and `support_level`.
- **Given** a bundled skill metadata record has an unsupported `status`, **when** metadata validation runs, **then** validation reports the record as invalid and identifies the supported statuses `stable`, `preview`, and `experimental`.
- **Given** a bundled skill lacks one or more required fields, **when** metadata validation runs, **then** validation identifies the skill and missing fields without requiring manual prose inspection.
- **Given** a skill is a stub or placeholder, **when** its metadata is inspected, **then** it is labeled `preview` or `experimental` and its support/provenance fields identify the limitation.

### Status, Role, Stage, And Trigger Behavior

- **Given** a skill is labeled `stable`, **when** it appears in inventory or router output, **then** output presents it as normal bundled capability without preview/experimental caveats.
- **Given** a skill is labeled `preview`, **when** it appears in inventory or router output, **then** output visibly identifies it as preview and exposes limitations or support expectations.
- **Given** a skill is labeled `experimental`, **when** it appears in inventory or router output, **then** output visibly identifies it as experimental and does not present it as the default stable route unless explicitly requested or no stable option exists.
- **Given** role or stage metadata is present, **when** metadata validation runs, **then** values align with the current OpenKit role/stage taxonomy and do not introduce new lane or stage semantics.
- **Given** trigger metadata matches a user request, **when** the router or skill index selects or recommends a skill, **then** the selection can be explained using structured metadata such as trigger, tag, role, stage, status, or MCP linkage.

### Runtime Inventory, Router, And Skill Index

- **Given** runtime capability inventory is requested, **when** bundled skills are included, **then** the inventory exposes consistent metadata fields for each skill.
- **Given** the skill index is requested, **when** it lists bundled skills, **then** it uses the same canonical metadata as packaging/source validation.
- **Given** a router evaluates a request with multiple matching skills, **when** both stable and experimental matches exist, **then** the stable skill is preferred unless the request explicitly targets the experimental skill or no stable skill satisfies the request.
- **Given** no suitable skill is available, **when** routing is attempted, **then** the runtime reports no suitable metadata-backed match or an explicitly degraded fallback rather than silently selecting an unrelated skill.
- **Given** a skill has recommended MCPs, **when** inventory/router output displays the skill, **then** it includes MCP recommendations and their known status or setup caveats without exposing secrets.

### Recommended MCP And Provenance Visibility

- **Given** a skill references a recommended MCP, **when** metadata validation runs, **then** the MCP ID is recognized or explicitly documented as optional/custom; unknown undocumented IDs are reported.
- **Given** a recommended MCP is not configured, disabled, unavailable, or degraded, **when** the skill appears in runtime output, **then** the MCP condition is shown as context without hiding the skill.
- **Given** a bundled skill is imported, adapted, compatibility-only, or stubbed, **when** metadata is inspected, **then** provenance and support level reveal that source/support status.
- **Given** runtime or documentation examples show skill metadata, **when** they mention MCP linkage, **then** they use MCP IDs/placeholders and do not include secrets or user-specific config.

### Install Bundle And Source Sync

- **Given** source skill metadata and install/package bundle metadata are compared, **when** validation runs, **then** missing, extra, stale, or divergent skill records are detected and reported.
- **Given** a skill is intentionally excluded from the install bundle, **when** sync validation runs, **then** the exclusion is represented explicitly rather than appearing as accidental drift.
- **Given** OpenKit is installed or upgraded from the bundled package, **when** runtime inventory or skill-index surfaces are inspected, **then** they expose the same bundled skill metadata contract as the repository source.
- **Given** package metadata sync validation fails, **when** delivery evidence is prepared, **then** the failure is treated as a package/runtime metadata defect rather than ignored as documentation-only drift.

### Documentation And Governance

- **Given** maintainers update or add a bundled skill, **when** they consult documentation, **then** they can find the required metadata fields, allowed status values, role/stage taxonomy expectations, recommended MCP linkage rule, provenance rule, support-level rule, and package sync expectation.
- **Given** operators inspect bundled skills, **when** they read operator-facing docs or runtime output, **then** stable, preview, experimental, compatibility-only, and stub expectations are clear.
- **Given** validation evidence is reported, **when** it references this feature, **then** it uses surface labels `runtime_tooling`, `documentation`, `package`, and `compatibility_runtime`, and it explicitly marks `target_project_app` as unavailable.

## Edge Cases

- A skill has no obvious stage because it is cross-cutting or meta-level.
- A skill has multiple role audiences, such as both maintainer and in-session agent.
- A skill has triggers that overlap with another skill in the same domain.
- A skill recommends an MCP that is optional, custom, disabled, not configured, unavailable, degraded, or preview-only.
- A skill appears in source but not the install bundle, or appears in the install bundle but not source metadata.
- A bundled skill file is renamed but metadata still uses an old name or provenance path.
- A skill imported from an upstream source has unclear support ownership.
- A stub skill has useful trigger text but should not be treated as stable.
- Existing runtime status vocabulary overlaps with skill maturity labels, especially `preview`.
- Metadata examples risk becoming stale if they duplicate generated inventory output.

## Error And Failure Cases

- If required metadata is missing for a bundled skill, validation must fail or report a blocking metadata defect before the feature is considered complete.
- If a metadata field uses an unsupported enum value, validation must identify the skill, field, actual value, and supported values.
- If role/stage metadata introduces non-canonical lane or stage semantics, validation or review must treat it as out of scope for this feature.
- If source/package bundle skill sets diverge without an explicit exclusion rule, package sync validation must report the drift.
- If a recommended MCP reference is unknown and not documented as optional/custom, validation must report it.
- If runtime routing cannot load metadata, it must fail visibly or degrade honestly; it must not silently activate skills from unstructured prose.
- If preview/experimental/stub status is unavailable in an output surface that lists skills, that surface must be treated as incomplete for this feature.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `runtime_tooling` | Validate capability inventory, router, runtime summary, and skill-index surfaces consume or expose canonical skill metadata; verify stable/preview/experimental labels, role/stage/trigger matching, recommended MCP context, and no hidden skill activation. |
| `documentation` | Validate maintainer/operator docs explain required metadata fields, status semantics, role/stage taxonomy, trigger expectations, recommended MCP linkage, provenance, support levels, stub handling, and target-project validation boundaries. |
| `package` | Validate the install bundle contains synchronized skill metadata matching repository source or explicit exclusions; detect missing, extra, stale, or divergent bundled skill records after packaging/install/upgrade-relevant flows. |
| `compatibility_runtime` | Validate workflow-state/runtime read models or compatibility diagnostics expose skill metadata evidence with correct surface labels and preserve package/source sync results where applicable. |
| `target_project_app` | Unavailable for this feature unless a separate target project defines app-native build/lint/test commands; OpenKit runtime, package, documentation, or workflow checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Preserve scope boundaries: standardize metadata and related inventory/router/package/docs behavior; do not rewrite broad skill content unless metadata accuracy requires targeted edits.
- Do not change lane semantics, stage names, approval gates, escalation behavior, or workflow-state enums.
- Decide the technical source of truth for metadata, but ensure there is one canonical metadata record per bundled skill that runtime tooling and package validation can consume.
- Include a validation plan for package/source sync and for runtime surfaces that list, route, or summarize skills.
- Ensure preview, experimental, compatibility-only, and stub handling stays visible in operator, maintainer, and in-session outputs.
- Keep recommended MCP linkage aligned with existing MCP capability inventory and custom MCP vocabulary without adding a marketplace or new installer flow.
- Treat `target_project_app` validation as unavailable unless a real target project contributes app-native commands.

## Open Questions And Assumptions

- Assumption: this feature may introduce or update metadata files, manifests, schemas, docs, and validation checks, but should not perform a wholesale rewrite of skill instruction bodies.
- Assumption: `package` is used as a validation surface label for install-bundle/source synchronization in addition to the existing OpenKit runtime-surface labels requested for this feature.
- Assumption: recommended MCPs are advisory metadata unless downstream design identifies a skill-specific hard dependency that must be represented explicitly.
- Open question for Solution Lead: choose the final enum values for `support_level` while preserving the product meanings: maintained, best-effort/upstream-dependent, compatibility-only, and stub/placeholder.
- Open question for Solution Lead: decide whether cross-cutting skills should use `stages: ["all"]`, an empty stage list with documented meaning, or explicit stage lists.

## Success Signal

- Operators, agents, maintainers, and runtime tooling can inspect the bundled skill catalog and see a consistent, synchronized, metadata-backed capability view that identifies each skill's purpose, maturity, roles, stages, triggers, recommended MCPs, provenance, and support level, with preview/stub limitations visible and no changes to workflow lane semantics.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users/journeys, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, and Solution Lead handoff notes for `product_to_solution` review.
