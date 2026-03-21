---
artifact_type: specification
version: 1
status: draft
feature_id: FEATURE-002
feature_slug: openkit-evolution-direction
source_brief: docs/briefs/2026-03-21-openkit-evolution-direction.md
owner: BAAgent
approval_gate: ba_to_architect
---

# Spec: OpenKit Improvement Analysis

## Summary

This specification turns the current repository analysis into a structured development artifact for the next phase of OpenKit.

It is a proposed future-state specification, not a description of the repository's already-active workflow contract. Until follow-on architecture and implementation work lands, the current authoritative workflow remains the `Quick Task` and `Full Delivery` contract defined in `context/core/workflow.md`.

OpenKit already has a strong workflow concept: a mode-aware software team with explicit roles, approval gates, workflow state, and artifact outputs. The next phase is not to expand ceremony, but to strengthen the kit where it is still comparatively weak:

- runtime enforcement and installability
- execution discipline inside the workflow
- workflow-level verification
- productization and onboarding
- quick-lane capability for realistic daily work

This spec also defines the direction for `Quick Task+`, an evolution of the current quick lane that remains fast while supporting a wider range of bounded, low-risk work.

## User Stories

### US-001: Turn analysis into a durable development artifact
As an OpenKit maintainer, I want the repository analysis captured as a formal spec, so that future architecture and planning work can build on a stable reference instead of conversational memory.

**Acceptance Criteria**
- Given the repository needs follow-on design work, when maintainers review this spec, then they can understand the key strengths, weaknesses, and priorities without reading the original chat analysis.
- Given future work needs traceable rationale, when maintainers move into architecture or planning, then this spec can serve as an input artifact.

**Edge Cases**
- The analysis drifts into vague opinion without linking back to observable repository realities.
- The artifact repeats repository docs without generating actionable development direction.

### US-002: Compare OpenKit against its two source influences
As an OpenKit maintainer, I want a structured comparison with `OpenAgentsControl` and `superpowers`, so that I can decide what to borrow deliberately instead of blending ideas implicitly.

**Acceptance Criteria**
- Given the repository is shaped by two influences, when the spec is reviewed, then the analysis clearly separates what OpenKit should learn from `OpenAgentsControl` versus what it should learn from `superpowers`.
- Given improvements are prioritized, when a maintainer reads the comparison, then they can identify concrete mechanisms to adopt rather than abstract inspiration.

**Edge Cases**
- The comparison praises both references without identifying where OpenKit is materially weaker.
- The comparison recommends importing patterns that conflict with OpenKit's current hard-split workflow contract.

### US-003: Define the direction of `Quick Task+`
As an OpenKit maintainer, I want the quick lane expanded into `Quick Task+`, so that the kit can handle more realistic daily work without pushing medium-weight tasks into either an underspecified quick path or an overly heavy full-delivery path.

**Acceptance Criteria**
- Given current quick mode is narrow, when maintainers review this spec, then the document defines what `Quick Task+` should handle, what it should still reject, and how it remains distinct from `Full Delivery`.
- Given future implementation work, when maintainers move into architecture and planning, then they can use this spec as the baseline for changing lane behavior, commands, roles, and state rules.

**Edge Cases**
- `Quick Task+` becomes a hidden third of the full pipeline rather than a genuinely lighter lane.
- The quick lane becomes so flexible that escalation boundaries stop being reliable.

### US-004: Provide a BA-ready input for architecture follow-on
As an OpenKit maintainer, I want this spec to serve as a formal input to architecture and planning, so that runtime hardening and quick-lane evolution can be designed deliberately instead of being implemented ad hoc.

**Acceptance Criteria**
- Given this document is reviewed by architecture and planning roles, when they use it as an input, then it clearly distinguishes current repository reality from proposed future changes.
- Given the proposed direction affects commands, roles, hooks, docs, tests, and workflow state, when maintainers review the spec, then they can see that follow-on architecture work is required before implementation.

**Edge Cases**
- Readers interpret this spec as an immediate contract update instead of a proposal.
- The document implies implementation readiness without enough architecture follow-through.

## Current State Assessment

OpenKit is already ahead of a prompt-only system in several important ways.

### What is already strong

- `README.md` clearly positions OpenKit as a mode-aware software team with two workflow lanes.
- `context/core/workflow.md` defines a hard split between `Quick Task` and `Full Delivery`, including approval gates, stage sequences, feedback loops, and escalation rules.
- `.opencode/opencode.json` establishes a runtime manifest with explicit agent, skill, command, artifact, hook, and state locations.
- `.opencode/workflow-state.js` provides a file-backed workflow-state interface rather than relying on purely conversational memory.
- `hooks/session-start` already injects a meta-skill and emits resume hints based on workflow state.
- `.opencode/tests/workflow-state-controller.test.js` and `.opencode/tests/session-start-hook.test.js` show that parts of the operating layer are already testable.

### Where the current model is still weaker

- The repository is stronger as a workflow architecture than as an installable product.
- Runtime discoverability is still lighter than the workflow contract itself.
- Role boundaries are defined, but execution discipline is not yet equally enforced in every path.
- Workflow-state behavior is tested more than end-to-end workflow behavior.
- The current quick lane is likely too narrow for a large share of real daily engineering tasks.

## Comparative Analysis

### What OpenKit should borrow from `OpenAgentsControl`

Based on the current checked-in reference materials, `OpenAgentsControl` is strongest where workflow theory meets operational packaging.

OpenKit should borrow these ideas:

- versioned component registration for agents, skills, context, and commands
- stronger install/setup/update mechanics
- runtime status, cleanup, and diagnostics commands
- more explicit context-discovery and context-root conventions
- a clearer operational lifecycle beyond static repository docs

Why this matters:

- OpenKit already has a clearer lane model than many agent frameworks, but that value drops if installation, upgrade, and inspection remain manual.
- A reusable kit needs to be deployable into real repositories with less setup ambiguity.

### What OpenKit should borrow from `superpowers`

Based on the current checked-in reference materials, `superpowers` is strongest where behavior is enforced through reusable procedures rather than described aspirationally.

OpenKit should borrow these ideas:

- stronger bootstrap enforcement at session start
- more rigid execution discipline for planning, debugging, verification, and review
- workflow-level tests that validate actual behavior rather than only local utilities
- clearer contribution and quality expectations for behavior-shaping assets
- stronger subagent execution patterns for task-oriented implementation

Why this matters:

- OpenKit already defines a team structure, but it needs more force in the day-to-day behaviors that make the structure reliable.
- Without stronger behavioral discipline, the system risks falling back to helpful improvisation.

## Gap Analysis

### Gap 1: Runtime productization is behind workflow design

OpenKit currently documents the operating model better than it operationalizes installation, diagnostics, update behavior, and reusable deployment.

Implications:

- setup friction remains higher than necessary
- environmental drift is harder to detect
- users may understand the intended workflow without being sure the runtime is correctly configured

### Gap 2: Bootstrap and enforcement are still relatively light

OpenKit has a session-start hook and a meta-skill, but the current bootstrap still leaves a large share of discipline to agent interpretation.

Implications:

- skill usage may be inconsistent
- runtime status may be opaque at session start
- behavior can vary more than the repo's operating-system framing suggests

### Gap 3: Quick mode is too small for practical daily work

The current quick lane is intentionally conservative, but the likely result is that many legitimate daily tasks do not fit well into either existing lane.

Implications:

- users may overload quick mode informally
- users may overuse full-delivery mode for medium work
- the lane split may remain conceptually clean but practically awkward

### Gap 4: Workflow verification is incomplete

The repository validates important state logic, but it does not yet fully validate the observable behavior of the kit as a workflow system.

Implications:

- regressions in routing, bootstrap behavior, lane selection, or artifact flow may be missed
- future contributors may change docs and runtime surfaces without enough behavioral evidence

### Gap 5: Product documentation is accurate but still thin in operational depth

The repository is honest about current capabilities, but some support areas remain placeholders or high-level stubs.

Implications:

- future maintainers may need to infer too much from scattered files
- the kit remains easier to understand for its author than for new adopters

## Quick Task+ Specification Direction

### Goal

`Quick Task+` is the proposed evolution of the current quick lane. It should become a fast lane for bounded daily work that is more capable than the current quick path while remaining substantially lighter than `Full Delivery`.

Until the core workflow documents and runtime surfaces are updated, `Quick Task+` should be treated as a design target rather than a live repository contract.

### What `Quick Task+` should handle

`Quick Task+` is intended for small-to-medium work where the goal is mostly clear and risk is still low enough to avoid the full artifact chain.

Expected examples:

- localized bug fixes
- refactors with narrow scope
- command, hook, state, or documentation improvements with limited blast radius
- workflow and runtime hygiene work across one tightly related area
- small enhancements that do not require architecture or product discovery

### What `Quick Task+` may add relative to the current quick lane

`Quick Task+` may include a modest increase in structure such as:

- a better quick intake brief
- a lightweight implementation checklist or mini-plan
- a short review or QA loop with explicit evidence
- an optional lightweight artifact for traceability
- clearer rules for when to stop and escalate

The goal is to increase useful capacity, not to reproduce the full-delivery chain in miniature.

### What `Quick Task+` must still reject

`Quick Task+` must escalate or defer when work involves:

- high ambiguity in requirements
- architecture or design trade-offs that need deliberate exploration
- contracts, schemas, permissions, auth, billing, or security model changes
- multiple loosely related subsystems
- elevated rework risk that justifies full-delivery artifacts

### Relationship to `Full Delivery`

`Full Delivery` remains the lane for heavy work, including feature development, architecture-heavy changes, high-risk tasks, and work that benefits from durable handoffs across PM, BA, Architect, Tech Lead, Fullstack, and QA.

The quick lane becomes stronger, but the hard split remains.

### Follow-on dependency

This specification is not sufficient on its own to implement the direction. Architecture follow-on is required to define the concrete impact on commands, state shape, role contracts, hooks, tests, and migration behavior.

## Recommended Improvement Roadmap

### Near-term priorities

- align the skill/bootstrap model with the actual OpenCode runtime and tool surface
- strengthen session-start behavior with better runtime guidance and status visibility
- add status, doctor, setup, and related operational commands
- formalize `Quick Task+` semantics in workflow docs and agent contracts
- fix obvious mismatches between current instructions and current runtime assumptions

### Medium-term priorities

- update commands, roles, and workflow-state support for `Quick Task+`
- add workflow-level tests for lane selection, escalation, approvals, resume behavior, and artifact routing
- strengthen execution discipline in planning, debugging, review, and verification skills
- deepen governance and operations documentation beyond stub-level guidance

### Later priorities

- introduce component registration or profile-driven installation concepts
- improve update/versioning and reusable distribution mechanics
- add richer operational observability for the kit as a product surface
- refine extension mechanisms for future agents, skills, commands, and templates

## Non-Functional Requirements

- Improvements must preserve clarity of lane selection.
- Runtime changes must remain explicit and inspectable.
- The repository must remain honest about what tooling actually exists.
- New quick-lane capabilities must improve usefulness without creating hidden workflow ambiguity.
- Future tests should verify real observable behavior, not only internal implementation details.

## Out of Scope

- Defining the exact final workflow-state schema changes for `Quick Task+`
- Writing the full architecture for runtime productization
- Implementing new install/update infrastructure in this spec itself
- Adding a third operating lane
- Replacing the hard-split workflow model with a single adaptive pipeline

## Open Questions

- Should `Quick Task+` introduce one new named stage or remain within the current quick stage count with richer semantics?
- What is the lightest useful artifact model for quick-mode traceability?
- Which runtime diagnostics should be mandatory versus optional in the first productization phase?
- How much of `superpowers`-style rigid enforcement should be embedded directly in OpenKit versus referenced through imported skills?
