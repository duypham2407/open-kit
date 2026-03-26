# Conditional Parallel Execution Note

This note explains the intended parallel-execution model for OpenKit after introducing bounded worker-pool support for `Full Delivery` and `Migration`.

For the shortest reference, use `docs/maintainer/parallel-execution-matrix.md`.

## Core Rule

Parallel execution is conditional.

OpenKit does not assume that `Full Delivery` or `Migration` should always run with multiple active workers. Parallel execution is allowed only when the approved plan explicitly blesses it.

## Team Shape Assumption

OpenKit now models the intended team shape this way:

- one `PM Agent`
- one `BA Agent`
- one `Architect Agent`
- one `Tech Lead Agent`
- multiple `Fullstack` workers
- multiple `QA` workers

Planning roles remain singleton. Worker pools apply only to execution after planning says the work is safe to split.

## What This Means For Full Delivery

- `full_intake`, `full_brief`, `full_spec`, `full_architecture`, and `full_plan` remain singleton-led stages.
- Parallel implementation and task-level QA can happen only after `full_plan` records a `Parallelization Assessment`.
- Even then, runtime checks still enforce bounded task allocation, overlap rules, and integration checkpoints.

## What This Means For Migration

- `migration_intake`, `migration_baseline`, and `migration_strategy` remain singleton-led and sequential by default.
- Migration slices may run in parallel only after the migration strategy explicitly blesses them.
- Migration parallelism stays parity-oriented and behavior-preserving; it is not a copy of the full-delivery task board.

## What OpenKit Intentionally Does Not Do

- It does not parallelize PM, BA, Architect, or Tech Lead ownership.
- It does not turn quick work into a task-board workflow.
- It does not make migration parallel by default.
- It does not treat more workers as automatic permission to split the work.

## Why This Boundary Matters

The goal is to improve throughput only when the work can be decomposed safely.

If safe task or slice boundaries cannot be defined clearly, the correct behavior is to keep the work sequential.
