# Runbooks

This directory holds executable operator guidance.

Use these docs when you need step-by-step checks, commands, or repeatable maintenance procedures.

Current runbooks:

- `openkit-daily-usage.md`: practical day-to-day operator flow for the checked-in runtime
- `workflow-state-smoke-tests.md`: repeatable smoke checks for runtime and wrapper-related surfaces

Guardrails:

- keep runbooks action-oriented and safe to follow
- include command expectations when they materially reduce ambiguity
- move historical notes or durable project memory to `docs/operations/internal-records/`
- do not treat this directory as the canonical workflow contract; keep that in `context/core/`
