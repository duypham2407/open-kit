# Tech Lead Task Decomposition

Use this runbook when a `Tech Lead` needs to decide whether `Full Delivery` or `Migration` work can use multiple `Fullstack` and `QA` workers safely.

The purpose of this runbook is not to maximize parallelism at all costs. Its purpose is to maximize safe throughput without breaking OpenKit's lane semantics, approval chain, or runtime guarantees.

## Team Model

This runbook assumes the intended OpenKit team topology:

- one `PM Agent`
- one `BA Agent`
- one `Architect Agent`
- one `Tech Lead Agent`
- multiple `Fullstack` workers
- multiple `QA` workers

Planning and architecture roles remain singleton. Worker pools apply only to execution and verification after the plan explicitly blesses parallel work.

## Golden Rule

Parallel execution is optional.

Do not split work in parallel just because multiple `Fullstack` or `QA` workers are available.

If the work cannot be decomposed without unsafe overlap, keep it sequential.

## Planning Decision

Every `full_plan` and every migration plan/strategy should answer this question explicitly:

- can this work run in parallel safely?

Use the `Parallelization Assessment` section in the plan template to record the answer.

Allowed values:

- `parallel_mode = none`
- `parallel_mode = limited`
- `parallel_mode = enabled`

Interpret them this way:

- `none`: keep execution sequential
- `limited`: some slices can run in parallel, but only within explicit guardrails
- `enabled`: the task graph is intentionally designed for multiple active execution tracks

## When To Keep Work Sequential

Choose `parallel_mode = none` when any of these are true:

- one critical path step changes the shared foundation for all later work
- multiple steps must mutate the same schema, routing layer, shared state model, or compatibility seam in order
- architecture is still unstable or likely to change mid-implementation
- migration parity can only be assessed after each step in sequence
- there is no clear integration checkpoint that can detect overlap safely
- the team cannot describe safe task or slice boundaries in one sentence each

If you cannot explain why two workers will not step on each other, do not run them in parallel.

## When Limited Parallelism Is Safe

Choose `parallel_mode = limited` when all of these are true:

- one or more implementation tracks are isolated enough to run together
- the work still has shared integration risk that requires explicit checkpoints
- the critical path is understood and documented
- the plan can name which tasks are safe to overlap and which must remain serialized

Typical examples:

- API adapter work and UI wiring can run in parallel, but shared schema changes stay sequential
- one migration slice prepares a compatibility seam while another updates code that already depends on a stable seam

## When Broader Parallelism Is Safe

Choose `parallel_mode = enabled` only when all of these are true:

- the implementation graph is well understood
- task or slice boundaries are explicit and low-overlap
- integration risks are known and bounded
- the plan defines a real integration checkpoint and final QA path
- active execution tracks can be capped safely

Even in `enabled` mode, do not treat the worker pool as unrestricted. The runtime still needs bounded concurrency rules.

## Full Delivery Decomposition Rules

Use `Full Delivery` task boards for implementation work only after `full_plan` blesses them.

### A good full-delivery task should have:

- one primary outcome
- one clear ownership boundary
- explicit `artifact_refs`
- validation expectations
- a known integration path back into the feature

### Prefer splitting by:

- bounded product or technical surfaces
- stable seams or interfaces
- clearly separated implementation layers
- independently verifiable sub-flows

### Avoid splitting by:

- rough file count
- arbitrary folder boundaries that still share one contract core
- multiple tasks that all rewrite the same shared state or schema

## Full Delivery Concurrency Classes

Classify each task as one of:

- `exclusive`
- `parallel_limited`
- `parallel_safe`

Use them this way:

- `exclusive`: the task owns a shared critical surface and must not overlap with any other active task
- `parallel_limited`: the task may overlap only within bounded conditions and dependency checks
- `parallel_safe`: the task is isolated enough to run concurrently with other safe tasks

Typical examples:

- shared schema rewrite -> `exclusive`
- API adapter touching a shared contract -> `parallel_limited`
- isolated UI follow-up with stable inputs -> `parallel_safe`

## Migration Decomposition Rules

Migration work is not a generic task board. It uses migration slices only when the strategy explicitly blesses them.

### A good migration slice should have:

- preserved invariants it must protect
- compatibility risks it addresses
- rollback notes
- explicit parity verification targets
- a seam or compatibility boundary that limits overlap with other slices

### Prefer splitting migration by:

- compatibility seams
- upgrade slices with clear before/after evidence
- isolated dependency-removal or adapter-introduction steps

### Avoid splitting migration by:

- arbitrary file count
- broad cleanup themes before parity is proven
- slices that all mutate the same compatibility core in conflicting ways

## Dependency Rules

Always model dependencies honestly.

Use `depends_on` or the migration equivalent whenever:

- one task or slice consumes a seam created by another
- one change must land before another can verify safely
- integration or parity evidence from one step is required before the next begins

Do not pretend tasks are parallel-safe just because they live in different files.

## QA Rules

Parallel QA is allowed only after the implementation plan or migration strategy blesses it.

Use this split:

- task or slice QA: verify the local work package
- integration QA: verify cross-task or cross-slice interactions
- final feature or migration QA: verify the whole work item can actually close

Never let task-level QA replace the final integration or feature-level QA gate.

## Integration Checkpoints

Every parallel-capable plan should name at least one integration checkpoint.

Examples:

- merge API adapter and UI wiring, then run combined smoke verification
- complete all migration slices touching the compatibility boundary, then run parity smoke checks before feature closure

If you cannot describe the integration checkpoint clearly, the work probably should not be parallel.

## Anti-Patterns

Do not do any of the following:

- mark work parallel just because more workers exist
- split tasks that all modify one shared contract core
- run migration slices before the baseline and strategy are stable
- let design or requirements ambiguity stay inside local parallel rework
- use per-task QA as a substitute for final QA
- hide overlap behind vague task titles

## Practical Checklist For Tech Leads

Before blessing parallel execution, confirm all of these:

- the plan explicitly records `parallel_mode`
- safe parallel zones are listed
- sequential constraints are listed
- the integration checkpoint is named
- max active execution tracks is set when relevant
- every task or slice has a bounded surface and explicit artifacts or verification targets
- overlap on shared core artifacts has been checked consciously

If any item is unclear, keep the work sequential until it becomes clear.
