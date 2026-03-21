---
artifact_type: architecture
version: 1
status: draft
feature_id: FEATURE-002
feature_slug: openkit-evolution-direction
source_spec: docs/specs/2026-03-21-openkit-improvement-analysis.md
owner: ArchitectAgent
approval_gate: architect_to_tech_lead
---

# Architecture: OpenKit Evolution Direction

## Summary

Implement the next phase of OpenKit as an incremental repository evolution rather than a ground-up redesign. Preserve the current hard-split model and file-backed workflow-state core, then layer improvements in four bounded areas: workflow contract updates, runtime/bootstrap hardening, operational command surface, and workflow-level verification.

The architectural goal is to make `Quick Task+` the successor semantics for the existing quick lane while keeping `Full Delivery` intact for heavy work. The repository should remain explicit, inspectable, and honest about current tooling at every step.

## System Diagram

`Brief/Spec/ADR -> Workflow Contract -> Agent + Command Contracts -> Runtime Bootstrap + State -> Verification Tests + Docs`

## Components

### Workflow Contract Layer
- Responsibility: define the authoritative lane model, stage semantics, escalation boundaries, and approval behavior
- Interface: `context/core/workflow.md`, related core context docs, and artifact conventions
- Dependencies: approved brief/spec/ADR artifacts

### Agent and Command Contract Layer
- Responsibility: align `MasterOrchestrator`, `FullstackAgent`, `QAAgent`, and command entrypoints with the updated quick-lane semantics
- Interface: `agents/*.md`, `commands/*.md`
- Dependencies: workflow contract layer

### Runtime Bootstrap and State Layer
- Responsibility: make runtime behavior easier to inspect and trust through better session-start guidance, state handling, and operational commands
- Interface: `hooks/session-start`, `hooks/hooks.json`, `.opencode/opencode.json`, `.opencode/workflow-state.js`, related library files
- Dependencies: workflow contract layer and command contract layer

### Workflow Verification Layer
- Responsibility: verify that lane selection, state transitions, escalation, bootstrap behavior, and command/runtime expectations continue to work as intended
- Interface: `.opencode/tests/` and future workflow-level test fixtures
- Dependencies: runtime bootstrap and state layer, agent and command contract layer

### Documentation and Productization Layer
- Responsibility: keep README, context docs, governance, operations guidance, and examples aligned with actual runtime behavior
- Interface: `README.md`, `AGENTS.md`, `context/`, `docs/examples/`, `docs/governance/`, `docs/operations/`
- Dependencies: all other layers

## Data Contracts

- `workflow mode contract`
  - current live values remain `quick` and `full` until an explicit change is implemented and documented
  - `Quick Task+` is a semantic evolution target, not a third mode
- `artifact chain`
  - `docs/briefs/2026-03-21-openkit-evolution-direction.md`
  - `docs/specs/2026-03-21-openkit-improvement-analysis.md`
  - `docs/architecture/2026-03-21-openkit-evolution-direction.md`
  - `docs/plans/2026-03-21-openkit-evolution-direction.md`
- `state compatibility`
  - preserve the current file-backed workflow-state model unless a deliberate breaking change is approved

## Technology Choices

- Keep the current file-backed repository operating model rather than introducing a service-backed control plane.
- Prefer additive runtime hardening over broad structural rewrites.
- Use repository-native documentation artifacts as the control surface for the next phase.
- Expand tests around existing Node-based workflow utilities because that toolchain already exists in the repo.

## Risks and Mitigations

- Risk: `Quick Task+` accidentally becomes an informal third lane
- Mitigation: keep mode enums explicit and define `Quick Task+` as successor semantics for the existing quick lane

- Risk: runtime/productization work outpaces documentation updates
- Mitigation: require docs updates in the same implementation tasks that change hooks, commands, or state behavior

- Risk: command and agent contracts drift apart
- Mitigation: update workflow docs, agents, and commands together and add tests around the expected behavior

- Risk: the repo claims capabilities it still does not implement
- Mitigation: keep validation language explicit and preserve current-state disclaimers until tooling lands

## ADR References

- `docs/adr/2026-03-21-openkit-runtime-enforcement-and-quick-task-plus.md`
