---
artifact_type: adr
version: 1
status: proposed
decision_id: ADR-001
decision_slug: openkit-runtime-enforcement-and-quick-task-plus
owner: ArchitectAgent
---

# ADR: OpenKit Runtime Enforcement and Quick Task+

## Context

OpenKit already has a strong workflow architecture for turning OpenCode into a mode-aware software team. The current repository clearly defines:

- a hard split between `Quick Task` and `Full Delivery`
- explicit team roles and handoffs
- file-backed workflow state and approval gates
- artifact directories for each delivery stage

This gives OpenKit a stronger operating model than a loose collection of prompts, but the current repository is still weaker as an executable product than as a documented framework.

Based on the current checked-in reference materials, comparison against the two reference influences shows the main gaps:

- relative to `OpenAgentsControl/`, OpenKit is lighter on installability, runtime discoverability, operational commands, and update/distribution mechanics
- relative to `superpowers/`, OpenKit is lighter on behavior enforcement, rigid execution discipline, and workflow-level verification

The current `Quick Task` lane is intentionally narrow and safe. That keeps the lane honest, but it also risks making the fast path too small for realistic daily work. Many practical tasks sit between a tiny local fix and a full feature delivery. If OpenKit does not absorb those tasks into a stronger quick lane, users will either:

- force medium-complexity work through an underspecified quick path, or
- bypass the quick path entirely and pay too much workflow overhead

OpenKit therefore needs two strategic changes:

1. evolve from a documentation-first workflow kit into a more runtime-enforced operating kit
2. expand `Quick Task` into `Quick Task+`, a lane that stays fast while handling a broader class of daily work without collapsing into `Full Delivery`

## Decision

OpenKit will adopt the following product direction.

This ADR records the intended architectural direction. Until follow-on workflow, runtime, and documentation updates land, the current authoritative contract remains the `Quick Task` and `Full Delivery` model defined in `context/core/workflow.md`.

### 1. Strengthen runtime enforcement and productization

OpenKit will invest in runtime surfaces that make the workflow easier to install, inspect, validate, and trust in real projects.

Priority areas include:

- stronger session bootstrap behavior
- clearer runtime status and diagnostics commands
- more explicit install/update/versioning ergonomics
- better workflow-level verification for the kit itself

The goal is to reduce reliance on user memory and improve execution consistency.

### 2. Replace the current narrow quick lane with `Quick Task+`

OpenKit will evolve `Quick Task` into `Quick Task+`.

`Quick Task+` is not a third lane. It is the proposed successor semantics for the existing quick lane, preserving the hard split while expanding the quick lane's practical capacity.

`Quick Task+` remains the fast lane, but it is no longer limited to only the smallest possible localized tasks. It is intended for small-to-medium daily work that is still sufficiently bounded and low risk.

`Quick Task+` may include:

- a short intake brief
- a lightweight implementation plan or execution checklist
- a concise review or QA loop
- a lightweight artifact when traceability is useful
- stronger verification than the current minimal quick path

`Quick Task+` must still stay out of work that requires deliberate product/spec/architecture treatment.

### 3. Keep `Full Delivery` as the heavy lane

`Full Delivery` remains the correct lane for work that introduces meaningful ambiguity, architectural decisions, contract changes, cross-boundary coordination, or elevated rework risk.

This ADR does not create a third lane. OpenKit will preserve the hard split and instead make the quick lane more capable.

### 4. Prioritize execution quality over additional ceremony

The next improvements should favor:

- better runtime behavior
- better discipline inside existing roles
- better test coverage of the workflow system

OpenKit should not respond to current gaps by adding more roles, more stages, or more mandatory artifacts before the runtime and execution model are stronger.

## Consequences

### Positive consequences

- OpenKit gains a more useful fast path for real daily work
- users get clearer separation between light delivery and full delivery
- the kit becomes easier to trust as a reusable operating system rather than just a set of documents
- workflow behavior becomes more testable and less dependent on prompt luck

### Required follow-on work

This decision implies future updates to:

- `context/core/workflow.md`
- `agents/` role contracts, especially `MasterOrchestrator`, `FullstackAgent`, and `QAAgent`
- `commands/` entry behavior and quick-lane semantics
- `.opencode/` runtime and workflow-state support where needed
- hook/bootstrap behavior in `hooks/`
- workflow-level tests in `.opencode/tests/` or adjacent test locations
- onboarding and product documentation in `README.md` and supporting docs

### Constraints

- `Quick Task+` must not become a silent version of `Full Delivery`
- escalation boundaries must stay explicit
- the repository must remain honest about tooling that does not yet exist
- improvements should stay compatible with the current file-backed workflow-state model unless an intentional breaking change is documented
- command names, workflow-state enums, and user-facing terminology must be clarified deliberately rather than drifting during implementation

## Alternatives Considered

### 1. Keep the current quick lane and only improve runtime

Rejected because it fixes runtime weaknesses without addressing the practical gap between tiny tasks and full-delivery work.

### 2. Add a third lane between quick and full

Rejected for now because it adds conceptual overhead, more routing rules, and more maintenance burden before OpenKit has fully hardened the current two-lane model.

### 3. Push more work into `Full Delivery`

Rejected because it would preserve quality at the cost of speed and would make the system less attractive for everyday use.

### 4. Loosen quick mode informally without changing its contract

Rejected because it would create hidden behavior drift, inconsistent routing, and ambiguous expectations for future contributors.
