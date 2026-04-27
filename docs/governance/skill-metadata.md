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

`support_level` must be one of `maintained`, `best_effort`, `compatibility_only`, or `stub`. Stub and metadata-only skills must use `preview` or `experimental`; they must not be labeled `stable`.

## Roles And Stages

Roles must use current OpenKit labels: `MasterOrchestrator`, `ProductLead`, `SolutionLead`, `FullstackAgent`, `CodeReviewer`, `QAAgent`, `QuickAgent`, plus operational audiences `operator`, `maintainer`, `in_session_agent`, or metadata wildcard `all`.

Stages must use current workflow stage labels such as `quick_intake`, `quick_brainstorm`, `quick_plan`, `quick_implement`, `quick_test`, `migration_strategy`, `migration_upgrade`, `migration_verify`, `full_product`, `full_solution`, `full_implementation`, `full_code_review`, and `full_qa`; `all` is a metadata wildcard, not a workflow-state enum.

## Trigger, MCP, Provenance, And Support Rules

- `triggers` are structured objects with a supported kind and non-empty value. They explain when a skill should be considered; they do not silently activate the skill.
- `recommended_mcps` are advisory links to known bundled MCP IDs or explicit custom placeholders. They must not include raw secrets or user-specific configuration.
- `source` records provenance: `openkit_authored`, `upstream_imported`, `adapted`, `compatibility`, or `stub`.
- `limitations` must make preview, experimental, compatibility-only, metadata-only, or stub caveats visible in inventory and routing output.

## Package Sync

Package sync is validated on the `package` surface. `npm run sync:install-bundle` derives install-bundle skill files and `assets/install-bundle/opencode/skill-catalog.json` from repository source and canonical metadata. `npm run verify:install-bundle` must fail on missing, extra, stale, or divergent skill assets or derived skill metadata.

`package` validation is separate from `runtime_tooling`, `documentation`, and `compatibility_runtime`; none of these are target-project application validation. If a target project does not define app-native build/lint/test commands, `target_project_app` remains unavailable.
