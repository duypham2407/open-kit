# Runbooks

This directory holds executable operator guidance.

Use these docs when you need step-by-step checks, commands, or repeatable maintenance procedures.

Current runbooks:

- `openkit-daily-usage.md`: practical day-to-day operator flow for the checked-in runtime
- `cross-platform-validation.md`: repeatable Linux, macOS, and Windows validation checklist for the supported global OpenKit path
- `cross-platform-validation-checklist.md`: tick-box matrix for recording Linux, macOS, and Windows validation results
- `tech-lead-task-decomposition.md`: Solution Lead guidance for deciding when full-delivery or migration work can use parallel execution safely (filename retained for compatibility)
- `workflow-state-smoke-tests.md`: repeatable smoke checks for runtime and wrapper-related surfaces

Related reusable migration checklists live under `docs/templates/`:

- `migration-baseline-checklist.md`
- `migration-verify-checklist.md`
- `migration-report-template.md`

Guardrails:

- keep runbooks action-oriented and safe to follow
- include command expectations when they materially reduce ambiguity
- move historical notes or durable project memory to `docs/operations/internal-records/`
- do not treat this directory as the canonical workflow contract; keep that in `context/core/`
