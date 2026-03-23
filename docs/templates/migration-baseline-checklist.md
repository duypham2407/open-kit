# Migration Baseline Checklist

Use this checklist during `migration_baseline` to capture the current reality before any meaningful upgrade work starts.

## Scope And Invariants

- [ ] Migration goal is stated in one sentence.
- [ ] Target stack or dependency destination is named explicitly.
- [ ] In-scope surfaces are listed.
- [ ] Out-of-scope surfaces are listed.
- [ ] Preserved layout expectations are recorded.
- [ ] Preserved flows and user journeys are recorded.
- [ ] Preserved contracts are recorded: API payloads, routes, events, schemas, permissions, storage shapes.
- [ ] Preserved core logic or business rules are recorded.
- [ ] Any allowed behavior change is explicitly documented as an exception.

## Baseline Evidence

- [ ] Current versions of framework, runtime, and critical dependencies are recorded.
- [ ] Existing build, test, typecheck, lint, codemod, or smoke commands are listed if they exist.
- [ ] Missing validation tooling is called out honestly if commands do not exist.
- [ ] Critical screens or flows have baseline screenshots, notes, or equivalent evidence.
- [ ] Important request/response or contract samples are captured when relevant.
- [ ] Known warnings, deprecations, and fragile areas are recorded.

## Coupling And Blockers

- [ ] Framework-coupled hotspots are identified.
- [ ] Lifecycle, routing, state, fetching, rendering, or side-effect patterns that block upgrade are identified.
- [ ] Business logic mixed into framework glue is identified.
- [ ] Candidate seams, adapters, or compatibility shims are listed.
- [ ] High-risk modules or pages are listed.

## Risk And Sequencing Readiness

- [ ] Compatibility risks are listed.
- [ ] Rollback concerns are listed.
- [ ] Unknowns that require spike or investigation are listed.
- [ ] The work still fits migration semantics and is not drifting into rewrite or new-feature delivery.

## Baseline Exit Gate

Baseline is ready for `migration_strategy` only when:

- preserved invariants are inspectable
- baseline evidence is concrete enough to compare later
- main blockers and likely seams are known
- the validation path is honest
