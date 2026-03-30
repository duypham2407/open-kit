# OpenKit Completion Roadmap

Status: proposed maintainer roadmap

## Purpose

This document defines the completion roadmap for OpenKit after the workflow kernel and hybrid runtime foundation became materially real.

It is specifically about how OpenKit should absorb the remaining strengths of the OMOA-inspired runtime direction without losing OpenKit's existing identity:

- workflow and governance first
- explicit file-backed state
- inspectable approvals, artifacts, issues, and evidence
- additive runtime growth beside the workflow kernel
- clean-room implementation only

This roadmap is not a license to replace the workflow kernel with a runtime-first shell.

## Current Position

OpenKit is already strong in these areas:

- mode-aware workflow kernel for `quick`, `migration`, and `full`
- explicit stage, approval, issue, and evidence handling
- file-backed work-item storage under `.opencode/work-items/`
- task-board-aware full-delivery execution
- migration slice board support and readiness gating
- release and hotfix governance
- runtime doctor and global doctor visibility
- global install, launch, and upgrade path via `openkit`
- additive runtime foundation under `src/runtime/`

OpenKit is still materially behind the stronger OMOA-style runtime in these areas:

- config depth and config migration richness
- model routing, categories, and fallback chains
- hook-system breadth and lifecycle control
- tool depth, especially LSP, AST-aware rewriting, browser automation, and session tooling
- autonomous continuation discipline and persistent execution tasking
- compatibility-layer breadth for external OpenCode-adjacent surfaces
- general product polish around orchestration ergonomics

## Strategic Goal

OpenKit is considered complete when it satisfies all of the following together:

1. The workflow kernel is fully authoritative and semantically closed for the three workflow modes.
2. The additive runtime foundation has real, operator-usable implementations for its advertised capability families.
3. The `openkit` product path is strong enough that typical operators do not need low-level kernel commands for common flows.
4. The runtime absorbs the practical strengths of the OMOA-inspired direction while preserving OpenKit's workflow-law model.

## Non-negotiable Architecture Rules

Every phase below must obey these rules:

1. `.opencode/workflow-state.js` and `.opencode/lib/*` remain the workflow kernel.
2. `context/core/workflow.md` remains the canonical semantics contract.
3. Runtime automation may not silently advance workflow stages, close issues, approve gates, or declare work complete.
4. Categories, specialists, hooks, and continuation systems are additive execution aids, not substitutes for workflow modes.
5. Read-only doctor and observability paths must remain non-mutating.
6. Docs must only describe behavior the checked-in runtime actually enforces.

## Workstreams

The remaining completion work is organized into six workstreams.

### Workstream A: Runtime Capability Maturation

Goal:

- turn capability families that are currently still described as `planned` or `foundation` into clearly active, tested, observable runtime behavior

Key targets:

- MCP platform
- background execution
- category routing
- specialist agents
- recovery stack

Required deliverables:

- implementation in `src/runtime/`
- capability doctor visibility
- tests proving behavior, not just metadata presence
- docs reflecting actual runtime status

Acceptance criteria:

- capability registry no longer overstates or understates shipped runtime behavior
- `openkit doctor` and runtime/global doctor can explain whether each major capability family is active, degraded, disabled, or misconfigured

### Workstream B: Config, Model, and Category System

Goal:

- make the runtime config and model/category system product-grade and flexible enough to compete with stronger external harnesses

Key targets:

- richer multi-level runtime config
- partial-invalid config tolerance
- legacy-key migration
- file-backed prompt references
- per-agent and per-category fallback model chains
- capability-aware model normalization

Required deliverables:

- expanded schema and validation under `src/runtime/config/`
- effective config inspection surface
- richer model diagnostics under `src/runtime/models/`
- category and specialist resolution rules that stay distinct from workflow mode selection

Acceptance criteria:

- invalid sections can degrade gracefully without collapsing the whole runtime when safe to do so
- model resolution trace is inspectable in doctor or equivalent runtime diagnostics
- per-agent and per-category fallback behavior is test-covered and documented

### Workstream C: Hook Engine Expansion

Goal:

- make OpenKit's lifecycle hook system deep enough to support discipline, recovery, context control, and operator ergonomics at runtime

Priority hook families:

- session hooks
- tool guard hooks
- transform hooks
- continuation hooks
- skill hooks
- notification hooks

Priority behavior to absorb next:

- recovery and continuation reminders
- tool-output truncation and context control
- write guards and safer file mutation preconditions
- richer context and rules injection
- background completion notifications
- comment-quality and anti-slop guards
- slash-command triggering and resume helpers

Acceptance criteria:

- hooks are grouped and documented by responsibility
- each high-value hook has tests and a failure-safe execution path
- disabling hooks through config is explicit and observable

### Workstream D: Tooling Depth

Goal:

- close the biggest practical gap with stronger harnesses by adding richer execution and inspection tools

Priority tool families:

- LSP tools
- AST-aware search and replace tools
- browser automation tools
- session history and session analysis tools
- safer editing path, including optional hash-anchored editing if the clean-room design is good enough

Implementation rule:

- tools should only ship when they are wired into real commands, skills, or runtime flows, not as isolated demos

Acceptance criteria:

- each tool family has operator-facing documentation
- each tool family has at least one first-class OpenKit workflow using it
- doctors and tests can identify when the relevant runtime dependency is missing or degraded

### Workstream E: Continuation and Persistent Execution Tasking

Goal:

- absorb the strongest continuation and discipline behaviors from the OMOA-inspired direction without compromising workflow-state authority

Boundary rule:

- persistent execution tasking is not the same thing as workflow-state lane ownership or work-item closure state

Key targets:

- file-backed task persistence for execution planning and delegation
- session handoff and resume surfaces
- continuation guards for incomplete delegated work
- bounded autonomous loop mechanisms with explicit stop controls
- richer execution notepads and learnings for multi-step work

Acceptance criteria:

- execution context survives session turnover cleanly
- continuation logic never bypasses approvals or evidence gates
- operators can inspect why work resumed, why it stopped, and what remains

### Workstream F: Compatibility and Product UX

Goal:

- make OpenKit feel more like a complete product harness while preserving its own preferred path and vocabulary

Key targets:

- stronger compatibility loading for external command, skill, and config conventions where appropriate
- richer command system around planning, execution start, handoff, refactor, browser verification, and runtime diagnostics
- clearer onboarding and capability-based recommendations
- more polished doctor, onboarding, and setup flows

Acceptance criteria:

- the preferred `openkit` path covers the common operator journey end to end
- compatibility support is explicit, documented, and diagnosable rather than implicit and surprising

## Recommended Implementation Order

The highest-leverage implementation order is:

1. Config, model, and category system
2. Hook engine expansion
3. Tooling depth
4. Continuation and persistent execution tasking
5. Compatibility and product UX polish

Why this order:

- config and model routing unlock almost every other runtime surface
- hooks provide the discipline layer needed before adding more autonomy
- tooling depth creates the biggest jump in practical operator value
- persistent tasking and continuation become safer once the above are real
- compatibility should come after OpenKit's own native product path is stable enough to preserve identity

## Phased Delivery Plan

### Phase 0: Contract Lock

Deliverables:

- maintain this roadmap
- keep the capability matrix current
- keep the hybrid-runtime RFC current
- define explicit implementation boundaries for what OpenKit will and will not absorb

Success condition:

- maintainers can answer "what are we absorbing, why, and under what constraints?" without relying on oral history

### Phase 1: Capability Activation

Deliverables:

- audit capability registry status values against actual implementation
- complete the weakest still-advertised runtime surfaces
- add doctor visibility for every major runtime family

Success condition:

- capability metadata and runtime reality match

### Phase 2: Config and Model Routing

Deliverables:

- richer runtime config schema
- legacy key migration
- partial-invalid section handling
- prompt file loading
- fallback model chains
- capability-aware model normalization and diagnostics

Success condition:

- runtime configuration is strong enough to support varied operator and agent setups without code edits

### Phase 3: Hook Expansion

Deliverables:

- stronger session, guard, transform, continuation, and notification hooks
- explicit hook registry behavior and docs
- per-hook tests and disable paths

Success condition:

- OpenKit's runtime behavior is materially more disciplined and self-protective during long-running sessions

### Phase 4: Toolchain Upgrade

Deliverables:

- LSP tools
- AST-aware tools
- browser automation product path
- session tools
- optional safer editing path

Success condition:

- OpenKit can support advanced execution and refactor workflows without relying only on generic shell plus grep patterns

### Phase 5: Persistent Continuation Layer

Deliverables:

- file-backed execution task system
- better handoff and resume flows
- bounded continuation engine
- stronger interruption recovery

Success condition:

- the system can continue substantial work across sessions without losing execution context or violating workflow governance

### Phase 6: Productization and Compatibility

Deliverables:

- richer command system
- compatibility loading and conflict diagnostics
- improved onboarding and operator recommendations
- release, upgrade, and docs hardening

Success condition:

- OpenKit is a stable, externally usable product kit rather than only a strong authoring repository

## Completion Checklist

OpenKit is considered complete only when all of the following are true together:

- workflow kernel semantics are complete, explicit, and enforced for `quick`, `migration`, and `full`
- runtime capability registry reflects real behavior rather than aspiration
- config and model routing are powerful enough for real operator customization
- the hook engine is broad enough to support discipline, context control, recovery, and notifications
- the tool layer includes first-class support for browser, session, LSP, AST, and safer editing workflows
- persistent continuation and execution tasking work across sessions without violating kernel authority
- compatibility surfaces are explicit, additive, and diagnosable
- `openkit run`, `openkit doctor`, onboarding, and release flows are polished enough for regular external use
- maintainers can verify all of the above through automated tests and doctor surfaces

## Maintainer Rule

Whenever a roadmap item is implemented, maintainers must update all three of the following together:

1. runtime behavior
2. tests and diagnostics
3. docs that claim the behavior exists

OpenKit should finish as a stronger product because its runtime absorbed the best external ideas while staying faithful to explicit workflow law, not because it accumulated an ungoverned pile of features.
