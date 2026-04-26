# Conditional Parallel Execution Note

This note explains the conservative parallel-execution model for OpenKit. It is not permission for unrestricted parallelism.

For the shortest reference, use `docs/maintainer/parallel-execution-matrix.md`.

## Core Rule

Parallel execution is conditional.

OpenKit does not assume that `Full Delivery` or `Migration` should always run with multiple active workers. Parallel execution is allowed only when the approved solution package explicitly blesses it and the runtime checks pass. If `parallel_mode` is `none`, execution remains sequential even when multiple tasks or slices appear ready.

Deeper orchestration should be treated as ready only after operator guidance and runtime/tooling command reality are inspectable, or the remaining gaps are explicitly listed as blockers. Adding hidden background work is not an acceptable substitute for those foundations.

## Team Shape Assumption

OpenKit now models the intended team shape this way:

- one `Product Lead`
- one `Solution Lead`
- multiple `Fullstack` workers
- multiple `QA` workers

Planning roles remain singleton. Worker pools apply only to execution after the solution package says the work is safe to split.

## What This Means For Full Delivery

- `full_intake`, `full_product`, and `full_solution` remain singleton-led stages.
- Parallel implementation and task-level QA can happen only after `full_solution` records a `Parallelization Assessment`.
- Even then, runtime checks still enforce bounded task allocation, overlap rules, and integration checkpoints.
- For `parallel_mode = limited`, `safe_parallel_zones` currently mean repo-relative artifact path-prefix allowlists evaluated against task `artifact_refs`.
- `sequential_constraints` currently mean ordered task-chain strings that the full-delivery task runtime evaluates as dependency overlays.
- Task-board state should expose task owner, status, artifact refs, dependencies or sequential constraints, safe parallel zones when approved, QA owner, integration readiness, unresolved issues, and verification evidence before handoff or resume.
- Full-delivery task boards belong only to full-delivery work items.

## What This Means For Migration

- `migration_intake`, `migration_baseline`, and `migration_strategy` remain singleton-led and sequential by default.
- Migration slices may run in parallel only after the migration strategy explicitly blesses them.
- Migration parallelism stays parity-oriented and behavior-preserving; it is not a copy of the full-delivery task board.
- The same `safe_parallel_zones` semantics apply when limited parallel migration slices are introduced through strategy-approved artifact boundaries.
- `sequential_constraints` may still be documented in migration strategy notes, but current runtime enforcement for ordered chains remains a full-delivery task-board behavior.
- Migration inspectability centers on preserved behavior, baseline evidence, compatibility risk, staged sequencing, rollback checkpoints, parity evidence, and slice verification.
- Migration slice boards remain strategy-driven and parity-oriented; they are not full-delivery task boards by default.

## What OpenKit Intentionally Does Not Do

- It does not parallelize Product Lead or Solution Lead ownership.
- It does not turn quick work into a task-board workflow.
- It does not make migration parallel by default.
- It does not treat more workers as automatic permission to split the work.
- It does not let Master Orchestrator own scope, solution design, implementation, review, or QA judgment.

## Why This Boundary Matters

The goal is to improve throughput only when the work can be decomposed safely.

If safe task or slice boundaries cannot be defined clearly, the correct behavior is to keep the work sequential.
