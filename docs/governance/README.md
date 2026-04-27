# Governance

This directory defines durable policy for naming, severity, ADR usage, and definition of done.

Use these documents to keep OpenKit maintainable as a reusable operating kit rather than a pile of one-off workflow notes.

Current governance surface:

- `naming-conventions.md`: filename, slug, and durable ID rules for workflow artifacts
- `severity-levels.md`: issue severity language used by QA and rework routing
- `adr-policy.md`: when to record a durable architecture decision
- `definition-of-done.md`: minimum completion criteria for the current workflow contract
- `skill-metadata.md`: canonical bundled skill metadata contract, status/support semantics, role/stage taxonomy, recommended MCP linkage, provenance, and package sync rules
- `2026-03-clean-room-reimplementation-policy.md`: implementation boundary for runtime inspiration from external systems

Current-state guardrails:

- Govern the live lane contract: `Quick Task`, `Migration`, and `Full Delivery`.
- Treat `Quick Task+` as the live successor semantics of the existing quick lane, not as a third live mode or naming scheme.
- Keep artifact names aligned with the directories and examples that actually exist in the repository.
- Do not require build, lint, or test evidence that the repository has not adopted yet; when tooling is absent, require honest verification notes instead.
- When runtime commands, workflow-state fields, or checked-in templates change, update the related smoke tests and operator docs in the same change.
- Custom MCP governance is secret-safe by default: OpenKit-managed custom MCP definitions must stay separate from the bundled catalog, carry explicit origin/ownership metadata, use placeholder-only env/header values in config/profiles/docs/output, reject unsafe local command strings or unsafe remote URLs before mutation, and preserve unmanaged global OpenCode entries on conflict.
- Bundled skill governance is catalog-first: `src/capabilities/skill-catalog.js` owns canonical metadata, `assets/install-bundle/opencode/skill-catalog.json` is generated package evidence, and `status` (`stable`, `preview`, `experimental`) stays distinct from runtime `capabilityState`.

Maintainer note:

- When runtime commands, workflow state fields, or artifact expectations change, update the relevant governance docs in the same change so policy stays aligned with the repository's real behavior.
- When a change updates canonical workflow semantics, also review `doctor` consistency checks and any examples that act as runtime walkthroughs.
