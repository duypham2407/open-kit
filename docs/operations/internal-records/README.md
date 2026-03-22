# Internal Records

This directory holds project memory for operations work.

Use these docs to preserve durable context, lightweight records, and guidance that explains how to capture operational history.

Guardrails:

- keep these docs descriptive, not procedural
- store repeatable command walkthroughs in `docs/operations/runbooks/`
- prefer concise records that help future maintainers recover context quickly
- escalate architecture-shaping decisions to ADRs when repository policy requires it

Current state:

- no standing internal-record files are kept checked in after the repository cleanup pass
- add a focused record here only when it preserves durable operational context that does not belong in an ADR or runbook
- prefer one clearly named file per topic and delete stale records once they stop helping maintainers
