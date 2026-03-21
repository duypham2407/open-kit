# Governance

This directory defines durable policy for naming, severity, ADR usage, and definition of done.

Use these documents to keep OpenKit maintainable as a reusable operating kit rather than a pile of one-off workflow notes.

Current governance surface:

- `naming-conventions.md`: filename, slug, and durable ID rules for workflow artifacts
- `severity-levels.md`: issue severity language used by QA and rework routing
- `adr-policy.md`: when to record a durable architecture decision
- `definition-of-done.md`: minimum completion criteria for the current workflow contract

Current-state guardrails:

- Govern the live two-lane contract: `Quick Task` and `Full Delivery`.
- Treat `Quick Task+` as approved future direction for the existing quick lane, not as a third live mode or naming scheme.
- Keep artifact names aligned with the directories and examples that actually exist in the repository.
- Do not require build, lint, or test evidence that the repository has not adopted yet; when tooling is absent, require honest verification notes instead.

Maintainer note:

- When runtime commands, workflow state fields, or artifact expectations change, update the relevant governance docs in the same change so policy stays aligned with the repository's real behavior.
