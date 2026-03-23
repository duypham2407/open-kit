# Migration Verify Checklist

Use this checklist during `migration_verify` to judge whether the upgraded system still preserves the intended behavior under the new stack.

## Upgrade Outcome

- [ ] Target framework or dependency versions match the migration goal.
- [ ] Planned upgrade slices were completed or deferred explicitly.
- [ ] Temporary adapters or shims still present are listed with follow-up intent.

## Parity Checks

- [ ] Preserved layout expectations still hold.
- [ ] Preserved user flows still hold.
- [ ] Preserved contracts still hold: API payloads, routes, events, schemas, permissions, storage shapes.
- [ ] Preserved core logic or business rules still hold.
- [ ] Any approved exception is still the only intentional behavior difference.

## Validation Evidence

- [ ] Build, test, typecheck, lint, codemod, or smoke evidence is recorded when tooling exists.
- [ ] Manual regression evidence is recorded for flows not covered by automation.
- [ ] Before/after screenshots, notes, or equivalent parity evidence are attached or referenced when relevant.
- [ ] Performance or runtime warnings introduced by the migration are recorded when relevant.

## Issue Classification

- [ ] Remaining defects are classified as implementation fallout, migration-strategy flaw, or requirement ambiguity.
- [ ] Open risks and deferred items are listed.
- [ ] Escalation to `full` is recommended if the issue is no longer primarily a technical migration problem.

## Verify Exit Gate

Migration is ready for `migration_done` only when:

- parity evidence is inspectable
- remaining issues are resolved or explicitly routed
- rollback and residual-risk notes are clear
- `migration_verified` can be approved honestly
