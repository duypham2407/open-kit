# OpenKit Operating System Design

> Approved implementation direction for evolving OpenKit from a documentation-first kit into a stateful agent team operating system.

## Goal

Create a reliable orchestration layer for OpenCode that combines OpenAgentsControl-style workflow control with superpowers-style execution discipline.

## Selected Approach

Use a docs-and-state architecture rather than introducing a custom runtime service.

- Persist workflow state in `.opencode/workflow-state.json`
- Keep artifacts human-readable in `docs/`
- Keep agent behavior explicit in `agents/`, `skills/`, and `context/`
- Add contracts and examples so each handoff is parseable and reviewable

This keeps the kit lightweight while still making the workflow resumable and auditable.

## Scope

- Add runtime manifest and state file
- Add artifact templates and required directories
- Add orchestration contracts for approvals, issue routing, and resumability
- Add an end-to-end golden path example
- Add governance and observability docs
- Align repository docs with actual current state

## Non-Goals

- Building a custom daemon or scheduler
- Claiming repo-native build/test/lint tooling that does not exist yet
- Introducing application code unrelated to the kit itself

## Design Principles

1. State is explicit and file-backed.
2. Every phase produces an artifact.
3. Every stage transition requires a recorded approval state.
4. QA findings are routed using a stable schema.
5. New sessions can resume from state plus latest artifacts.

## Deliverables

- `.opencode/opencode.json`
- `.opencode/workflow-state.json`
- `docs/templates/*`
- `docs/examples/*`
- `docs/governance/*`
- `docs/operations/*`
- Context docs for routing, approvals, and resume behavior
