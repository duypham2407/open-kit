# OpenSpec Adoption Note

This note explains what OpenKit intentionally absorbed from OpenSpec and what it intentionally did not copy.

## What OpenKit absorbed

- clearer default-path framing so `/task` is the obvious first entrypoint
- more action-oriented operator UX that tells the user the next action, not only the current lane or stage
- transcript-style command examples to reduce onboarding friction
- stronger operator-facing surface mapping so supported product surfaces are easier to discover
- structured runtime guidance through command/lane instruction contracts and lane-aware artifact readiness summaries
- a guided onboarding command (`openkit onboard`) for safer first use
- more ergonomic closeout and reconciliation helpers for full-delivery work items
- adapter-friendly groundwork so future tool delivery does not require flattening the workflow model

## What OpenKit intentionally did not copy

- OpenKit did not replace its lane-based workflow with a single universal planning chain; full delivery still requires `Product Lead` to produce the scope package in `full_product` before `Solution Lead` produces the solution package in `full_solution`.
- OpenKit did not collapse migration into a generic planning flow; migration remains a first-class, behavior-preserving lane.
- OpenKit did not relax bounded parallelism or extend task boards into quick or migration work.
- OpenKit did not hide its workflow-state runtime behind a purely documentation-driven facade; runtime state remains explicit and authoritative.
- OpenKit did not trade away current-state honesty for lighter onboarding language.

## Why this boundary matters

OpenSpec is strongest in product UX, command ergonomics, and artifact-guided change management.

OpenKit is strongest in:

- explicit lane routing
- migration semantics
- resumable workflow state
- bounded full-delivery task orchestration
- operational honesty about what exists today

The goal of the adaptation work is to make OpenKit easier to start, easier to understand, and more consistent at runtime without weakening the properties that make it useful for lane-based orchestration.
