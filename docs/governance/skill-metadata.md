# Bundled Skill Metadata Governance

`src/capabilities/skill-catalog.js` is the canonical machine-readable source for bundled OpenKit skill metadata. Do not treat `SKILL.md` prose, `registry.json`, or generated install-bundle artifacts as the source of truth.

## Canonical Record

Each bundled skill record uses `openkit/skill-catalog-entry@2` and must include:

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

`status` is skill maturity status only: `stable`, `preview`, or `experimental`. It must not be collapsed with runtime `capabilityState`, which still uses `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`.

Capability graph output may also expose a resolver-facing `maturity` field derived from skill `status`, plus a separate graph node `state` derived from runtime availability. A stable skill can still be unavailable when its bundled source is absent, and a preview skill can still be available with caveats. Reviewers should treat maturity as product/support confidence and capability state as current runtime readiness.

`support_level` must be one of `maintained`, `best_effort`, `compatibility_only`, or `stub`. Stub and metadata-only skills must use `preview` or `experimental`; they must not be labeled `stable`.

## Loadability And Metadata-Only Skills

Skill loadability is derived from canonical metadata and source-file availability:

- `loadable`: the skill has a bundled source body and is eligible for explicit `skill` tool loading after resolver and policy checks.
- `non_loadable`: the skill is discoverable as metadata but must never be loaded. This includes `packaging.source = metadata_only`, `source.kind = stub`, `support_level = stub`, missing source files, and unavailable skill capability state.
- `not_applicable` or `unknown`: reserved for non-skill graph nodes or incomplete metadata that must fail closed as degraded or unavailable.

Metadata-only and stub skills stay useful for discovery, routing explanations, future capability planning, and skill/MCP binding visibility. They must always carry visible limitations and next actions. `tool.capability-router` may rank or report them, but selection must return an unavailable or non-loadable outcome and must not call the `skill` tool or read a missing `SKILL.md` body.

## Roles And Stages

Roles must use current OpenKit labels: `MasterOrchestrator`, `ProductLead`, `SolutionLead`, `FullstackAgent`, `CodeReviewer`, `QAAgent`, `QuickAgent`, plus operational audiences `operator`, `maintainer`, `in_session_agent`, or metadata wildcard `all`.

Stages must use current workflow stage labels such as `quick_intake`, `quick_brainstorm`, `quick_plan`, `quick_implement`, `quick_test`, `migration_strategy`, `migration_upgrade`, `migration_verify`, `full_product`, `full_solution`, `full_implementation`, `full_code_review`, and `full_qa`; `all` is a metadata wildcard, not a workflow-state enum.

Role and stage metadata are resolver signals, not workflow authority. A match can improve ranking and selection explanations; a mismatch must produce caveats or downgraded fit, not override lane ownership, approval gates, code review, QA, or Master Orchestrator boundaries.

Domain signals come from `tags`, structured trigger text, descriptions, role/stage labels, and related catalog fields. They help the graph resolver match an intent such as `debug`, `verification`, `frontend`, `rust`, or `mcp` to a bounded candidate set. Domain signals must stay descriptive and secret-free; do not encode user-specific provider names, local paths, keys, or private project facts in the bundled catalog.

## Trigger, MCP, Provenance, And Support Rules

- `triggers` are structured objects with a supported kind and non-empty value. They explain when a skill should be considered; they do not silently activate the skill.
- `recommended_mcps` are advisory links to known bundled MCP IDs or explicit custom placeholders. They must not include raw secrets or user-specific configuration.
- `source` records provenance: `openkit_authored`, `upstream_imported`, `adapted`, `compatibility`, or `stub`.
- `limitations` must make preview, experimental, compatibility-only, metadata-only, or stub caveats visible in inventory and routing output.

Recommended MCP caveats:

- A recommended MCP relationship does not mean the MCP is enabled, configured, keyed, reachable, or safe to execute.
- Missing keys, placeholder values, disabled scopes, dependency failures, external/provider caveats, browser dependency caveats, and policy-gated MCPs must be reflected as capability caveats or next actions.
- Custom MCP references must preserve custom origin/ownership labels and must not be folded into bundled defaults.
- Router and readiness outputs must keep key state redacted with values such as `missing`, `needs_key`, `not_configured`, `present_redacted`, or `unavailable`.

## Consumption By Capability Guidance

Session-start and runtime capability guidance may consume this metadata for compact role/stage-aware recommendations, but the summary must remain bounded and advisory. It may mention a small relevant subset of skills or grouped counts, and it must point to explicit detail tools such as `tool.capability-router`, `tool.skill-index`, `tool.skill-mcp-bindings`, `tool.capability-readiness`, and `tool.capability-ledger` instead of dumping full catalogs.

Metadata consumption must not load `SKILL.md` bodies, call the `skill` tool, execute MCP-backed tools, mutate workflow state, approve gates, or treat `recommended_mcps` as configured secrets. MCP-backed caveats remain redacted capability states such as `not_configured` / `needs-key`, and custom MCP references must be origin/ownership-labeled instead of folded into bundled defaults.

The capability graph and resolver use skill metadata in two phases:

- Ranking is read-only. It may score role, stage, domain, maturity, support level, readiness, loadability, freshness, side-effect level, validation surface, and MCP relationships.
- Selection is still not activation. It may return an activation plan or policy outcome, but the actual skill load must remain an explicit user-visible `skill` tool invocation and must respect loadability and policy gates.

Capability decision ledger entries may record ranked, selected, skipped, blocked, degraded, failed, loaded, or executed outcomes. Ledger and readiness summaries are sanitized runtime-tooling evidence and must not include raw secrets, provider payloads, browser storage, command output with sensitive values, or hidden skill-body content.

## Package Sync

Package sync is validated on the `package` surface. `npm run sync:install-bundle` derives install-bundle skill files and `assets/install-bundle/opencode/skill-catalog.json` from repository source and canonical metadata. `npm run verify:install-bundle` must fail on missing, extra, stale, or divergent skill assets or derived skill metadata.

`package` validation is separate from `runtime_tooling`, `documentation`, and `compatibility_runtime`; none of these are target-project application validation. If a target project does not define app-native build/lint/test commands, `target_project_app` remains unavailable.
