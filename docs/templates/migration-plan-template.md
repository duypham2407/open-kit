---
artifact_type: migration_plan
version: 1
status: draft
feature_id: FEATURE-000
feature_slug: example-migration
source_architecture: docs/architecture/YYYY-MM-DD-example-migration.md
owner: TechLeadAgent
approval_gate: strategy_to_upgrade
---

# Migration Plan: <Migration Name>

## Goal

- State the target migration or upgrade outcome and the intended end-state stack.

## Preserved Invariants

- Layout or presentation details that must remain equivalent.
- Core flows, contracts, and business logic that must remain equivalent.
- Explicitly allowed behavior changes, if any.

## Baseline Snapshot

- Current versions, important dependencies, runtime assumptions, and known fragile areas.

## Migration Blockers And Seams

- Framework-coupled blockers that make direct upgrade unsafe.
- Seams, adapters, or compatibility shims to create before or during the migration.

## Upgrade Sequence

### [ ] Step 1: <Task Name>
- Files:
- Goal:
- Preserve:
- Seam or adapter work:
- Validation:
- Rollback checkpoint:
- Notes:

## Compatibility Risks

## Parity Verification

- Baseline evidence to compare against after each slice.
- Critical smoke or regression paths.
- Manual or automated checks that prove behavior equivalence.

## Rollback Notes
