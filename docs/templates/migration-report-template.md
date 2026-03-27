---
artifact_type: migration_report
version: 1
status: draft
feature_id: FEATURE-000
feature_slug: example-migration
owner: MasterOrchestrator
source_architecture: docs/architecture/YYYY-MM-DD-example-migration.md
source_plan: docs/solution/YYYY-MM-DD-example-migration.md
---

# Migration Report: <Migration Name>

## Goal

- State the migration objective and the intended target stack.

## Preserved Invariants

- Layout or presentation expectations that must remain equivalent.
- Core flows, contracts, and business logic that must remain equivalent.
- Explicitly allowed behavior changes, if any.

## Baseline Snapshot

- Current versions and critical dependency state.
- Existing validation commands, or a note that they do not exist.
- Baseline screenshots, notes, request/response samples, or equivalent evidence.
- Known warnings, deprecations, or fragile areas.

## Migration Blockers And Seams

- Framework-coupled blockers that make direct upgrade unsafe.
- Candidate seams, adapters, or compatibility shims.
- High-risk modules, pages, or integration points.

## Strategy

- Chosen migration approach.
- Slice order and rollback checkpoints.
- Validation approach for each slice.

## Execution Log

### Slice 1: <Task Name>
- Goal:
- Files or surfaces touched:
- Seam or adapter work:
- Upgrade work:
- Validation:
- Result:
- Rollback note:

## Verification Summary

- Versions actually landed.
- Parity checks completed.
- Manual and automated evidence.
- Remaining adapters or shims.

## Issues And Risks

### ISSUE-001: <Title>
- Type:
- Severity:
- Rooted In:
- Recommendation:
- Evidence:

## Conclusion

- Overall migration status: PASS | FAIL | PARTIAL
- Ready for `migration_done`: yes | no
- Follow-up cleanup or escalation notes.
