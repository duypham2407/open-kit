# Templates

These files are source-of-truth document templates for OpenKit artifacts.

Their presence does not automatically mean the runtime can scaffold every artifact type.

Current reality:

- templates define the expected artifact shapes
- runtime scaffolding support now covers the active scope-package, solution-package, migration-report, and quick-task artifacts
- quick-mode work does not require every template-backed artifact
- template ownership stays here even though audience routing now starts from `README.md`, `docs/operator/README.md`, and `docs/maintainer/README.md`

Current template set aligns to the live artifact directories:

- quick-task card drafts for `docs/tasks/` when optional traceability is useful
- migration and full-delivery artifacts for `docs/solution/`, `docs/qa/`, and `docs/adr/`
- reusable migration checklists for `migration_baseline` and `migration_verify`
- a reusable migration report template for teams that want one artifact spanning baseline, strategy, execution, and verification
- full-delivery artifacts for `docs/scope/`, `docs/solution/`, `docs/qa/`, and `docs/adr/`
- historical split-role templates live under `docs/archive/templates/` and are not part of the active AI-first surface

Use current runtime docs before assuming a template is backed by a live command.

For the current command reality, use `context/core/project-config.md`.

For navigation around related support surfaces, use:

- `docs/operator/README.md` for operator wayfinding
- `docs/maintainer/README.md` for maintainer wayfinding
- `docs/operations/README.md` for runbooks and internal-record guidance

Authority guardrail:

- templates are source-of-truth shapes for artifacts
- canonical workflow and runtime semantics still live under `context/core/` and `.opencode/`
- the new audience and support indexes route readers to those sources; they do not replace them
