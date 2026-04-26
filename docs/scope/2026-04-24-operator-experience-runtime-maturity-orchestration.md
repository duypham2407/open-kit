---
artifact_type: scope_package
version: 1
status: draft
feature_id: FEATURE-938
feature_slug: operator-experience-runtime-maturity-orchestration
owner: ProductLead
approval_gate: product_to_solution
---

# Scope Package: Operator Experience, Runtime Maturity, and Execution Orchestration Roadmap

## Goal

Define a three-phase strategic roadmap that makes OpenKit easier to understand and operate first, then standardizes runtime/tooling maturity, then deepens execution orchestration only after the operator and runtime foundations are inspectable and validated.

## Target Users

- Operators who install, launch, inspect, resume, upgrade, and uninstall OpenKit across repositories.
- Maintainers who evolve OpenKit workflow behavior, runtime tools, CLI surfaces, and documentation.
- Delivery agents who rely on clear lane, artifact, validation, and handoff expectations while working inside an OpenKit session.

## Problem Statement

OpenKit already spans a global CLI product path, in-session workflow commands, and a checked-in compatibility runtime kit. The next roadmap needs to reduce operator confusion across those surfaces, make runtime and tooling maturity visible and standard, and only then add deeper orchestration so future execution improvements build on clear, validated foundations instead of adding hidden complexity.

## Strategic Phase Order

1. **Phase 1 — Operator experience clarity:** make the install, launch, inspect, resume, upgrade, uninstall, lane-selection, and artifact expectations obvious from the operator-facing surfaces.
2. **Phase 2 — Runtime/tooling maturity standardization:** make runtime health, command reality, tool availability, degraded capability states, validation evidence, and compatibility boundaries consistently inspectable.
3. **Phase 3 — Deeper execution orchestration:** deepen multi-role and task-level orchestration only after Phase 1 and Phase 2 acceptance criteria are met.

## In Scope

### Phase 1 — Operator Experience Clarity

- Clarify the preferred operator path: global install, doctor, run, upgrade, and uninstall.
- Clarify how in-session commands route work across `/task`, `/quick-task`, `/migrate`, and `/delivery`.
- Clarify the relationship between the global CLI path, in-session command path, and compatibility runtime path.
- Clarify what artifacts operators should expect by lane and stage, including scope, solution, task, migration, QA, and verification artifacts.
- Clarify what operators should do when app-native build, lint, or test commands are absent.

### Phase 2 — Runtime/Tooling Maturity Standardization

- Standardize product-level expectations for runtime health checks, resume summaries, workflow-state inspection, stage readiness, and validation evidence.
- Standardize how OpenKit reports available, unavailable, degraded, preview-only, or compatibility-only tooling.
- Standardize the distinction between OpenKit runtime/CLI validation and target-project application validation.
- Standardize inspectable outcomes for workflow state, work-item state, active artifact links, task-board readiness, release readiness, issue tracking, and verification evidence where those surfaces already exist.
- Standardize documentation expectations so command-reality docs stay aligned with implemented runtime and CLI behavior.

### Phase 3 — Deeper Execution Orchestration

- Define product expectations for deeper full-delivery orchestration after the operator and runtime foundations are mature enough to support it.
- Clarify when task boards, task ownership, safe parallel zones, sequential constraints, QA ownership, integration checks, and issue routing should be visible to operators and maintainers.
- Preserve existing role boundaries while making future execution orchestration more inspectable.
- Define product-level expectations for orchestration evidence without prescribing the implementation design.

## Out of Scope

- Implementing code, changing runtime behavior, or choosing technical architecture in this Product Lead artifact.
- Adding roadmap features outside the three ordered phases in this scope package.
- Adding a new workflow lane, runtime mode, command family, or renamed lane enum.
- Assuming application-native build, lint, test, package manager, CI, or deployment commands exist for target projects.
- Redesigning OpenCode itself or replacing OpenCode-owned permission behavior.
- Making migration mode use full-delivery task boards by default.
- Enabling unrestricted parallel execution or background execution beyond explicitly validated runtime capabilities.
- Defining implementation-specific data schemas, storage locations, APIs, libraries, or algorithms for Solution Lead.
- Creating launch marketing, pricing, analytics dashboards, personas, or rollout plans unrelated to the three phases.

## User Stories

### Phase 1 — Operator Experience Clarity

- As an operator, I want a clear preferred path for installing, checking, launching, upgrading, and uninstalling OpenKit, so that I can start and maintain OpenKit without guessing which command surface to use.
- As an operator, I want OpenKit surfaces to explain the difference between product CLI commands, in-session workflow commands, and compatibility runtime commands, so that I use the right surface for the question I am answering.
- As a delivery agent, I want lane and artifact expectations to be explicit before work starts, so that every stage leaves inspectable context for the next owner.

### Phase 2 — Runtime/Tooling Maturity Standardization

- As an operator, I want runtime health and resume information to report the real state of the current workspace, so that I can decide the next safe action without reading internal files by hand.
- As a maintainer, I want tool availability and degraded capability states to be reported consistently, so that documentation and validation claims match what the runtime can actually do.
- As a delivery agent, I want validation expectations to distinguish OpenKit runtime/CLI validation from target-project app validation, so that I do not invent build, lint, or test evidence.

### Phase 3 — Deeper Execution Orchestration

- As a maintainer, I want deeper orchestration expectations to preserve role boundaries and stage gates, so that new coordination behavior does not blur Product Lead, Solution Lead, Fullstack, Code Reviewer, QA, and Master Orchestrator responsibilities.
- As a delivery agent, I want task ownership, dependencies, safe parallel areas, QA ownership, integration checks, and unresolved issues to be inspectable when orchestration uses them, so that parallel or multi-step work can be resumed safely.
- As an operator, I want deeper orchestration to activate only after operator clarity and runtime/tooling maturity are satisfied, so that additional workflow power does not increase operational ambiguity.

## Business Rules

1. The roadmap order is mandatory: Phase 1 precedes Phase 2, and Phase 2 precedes Phase 3.
2. Phase 3 work must not be presented as ready until the Phase 1 and Phase 2 acceptance criteria are satisfied or explicitly marked as deferred blockers.
3. OpenKit must continue to present three operating lanes only: Quick Task, Migration, and Full Delivery.
4. `Quick Task+` remains the successor semantics of the existing `quick` lane and must not be introduced as a fourth runtime mode.
5. The preferred product path must remain the global CLI path: `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall`.
6. In-session workflow commands must remain distinct from product CLI commands and compatibility runtime commands.
7. Compatibility runtime commands must remain available for state inspection and maintainer diagnostics, not marketed as the primary operator product path.
8. Product and documentation language must distinguish current behavior from planned behavior.
9. OpenKit runtime/CLI validation may be required where OpenKit surfaces exist; target-project application validation may be required only when the target project defines relevant commands.
10. No roadmap artifact may claim app-native build, lint, test, CI, package-manager, or deployment support unless supporting repository files or target-project commands exist.
11. Runtime/tooling maturity must report unavailable, degraded, preview-only, and compatibility-only states honestly.
12. Artifact expectations must stay lane-aware: quick task cards are optional, migration solution/report artifacts are migration-oriented, full delivery has scope and solution packages, and QA artifacts belong to full delivery after implementation and review.
13. Full-delivery task boards belong only to full-delivery work items unless a later approved scope changes that rule.
14. Migration remains behavior-preserving and sequential by default; migration slice boards, when present, are strategy-driven and parity-oriented.
15. Master Orchestrator remains a procedural controller and must not own business scope, technical solution, implementation, review, or QA judgment.
16. Product Lead scope packages must stay product/behavior oriented and leave implementation design to Solution Lead.
17. Verification claims must be backed by inspectable evidence or explicitly state the missing validation path.

## Acceptance Criteria

### Phase 1 — Operator Experience Clarity

#### AC1.1 Preferred Operator Path Is Explicit

- **Given** an operator is trying to install or launch OpenKit
- **When** they read the roadmap-derived operator guidance or use the relevant operator-facing surface
- **Then** the preferred path identifies `npm install -g @duypham93/openkit`, `openkit doctor`, `openkit run`, `openkit upgrade`, and `openkit uninstall`
- **And** the guidance does not present repository-local compatibility commands as the preferred end-user install path.

#### AC1.2 Runtime Surface Boundaries Are Understandable

- **Given** an operator needs to know whether to use the CLI, an in-session command, or the compatibility runtime
- **When** they inspect the roadmap-derived guidance
- **Then** the product CLI path answers install, health, launch, upgrade, and uninstall questions
- **And** the in-session path answers lane selection and team workflow questions
- **And** the compatibility runtime path answers workflow-state and maintainer-diagnostic questions.

#### AC1.3 Lane And Artifact Expectations Are Inspectable

- **Given** a work item is routed to quick, migration, or full delivery
- **When** an operator or delivery agent checks the roadmap-derived artifact expectations
- **Then** the expected primary artifacts for that lane are listed
- **And** optional artifacts are labeled optional
- **And** full-delivery `product_to_solution` requires a Product Lead scope package before Solution Lead design.

#### AC1.4 Missing App-Native Validation Is Handled Honestly

- **Given** a target project has no declared app-native build, lint, or test command
- **When** a delivery agent records validation expectations or completion evidence
- **Then** the artifact states that app-native validation is unavailable
- **And** it uses available OpenKit runtime/CLI validation only for OpenKit surfaces
- **And** it does not invent target-project validation commands.

### Phase 2 — Runtime/Tooling Maturity Standardization

#### AC2.1 Runtime Health And Resume State Are Standardized

- **Given** an operator needs to understand current OpenKit state
- **When** they use roadmap-derived runtime inspection expectations
- **Then** health, resume, active-work-item, workflow-state, artifact-link, issue, and verification-evidence expectations are named at product level
- **And** the expected output distinguishes blocking issues from informational state.

#### AC2.2 Tool Availability States Are Explicit

- **Given** a runtime tool, graph capability, semantic search capability, browser verification path, background execution surface, or MCP-related surface is unavailable, degraded, preview-only, or compatibility-only
- **When** OpenKit reports or documents that capability
- **Then** the user-facing state identifies the limitation
- **And** the artifact does not imply full availability where dependencies or implementation are incomplete.

#### AC2.3 Command Reality Stays Aligned With Implemented Behavior

- **Given** a CLI command, workflow-state command, runtime tool, or validation path is documented
- **When** maintainers update roadmap-derived docs or artifacts
- **Then** the documentation identifies whether the command currently exists
- **And** any future example command is labeled as illustrative until adopted
- **And** stale commands are treated as documentation defects.

#### AC2.4 Runtime Validation Is Separated From Target-Project Validation

- **Given** OpenKit runtime/CLI surfaces and target-project application surfaces are both present in a workspace
- **When** validation expectations are recorded
- **Then** OpenKit runtime/CLI validation applies to OpenKit install, launch, workflow state, tools, and diagnostics
- **And** target-project validation applies only to commands actually defined by that project
- **And** the evidence names which surface was validated.

### Phase 3 — Deeper Execution Orchestration

#### AC3.1 Orchestration Builds On Completed Foundations

- **Given** Phase 3 planning begins
- **When** Product Lead, Solution Lead, or maintainers assess readiness
- **Then** Phase 1 operator clarity criteria and Phase 2 runtime/tooling maturity criteria are either satisfied or listed as explicit blockers
- **And** Phase 3 scope does not bypass those blockers by adding hidden workflow complexity.

#### AC3.2 Role Boundaries Remain Visible

- **Given** deeper orchestration introduces or expands task ownership, QA ownership, integration checks, issue routing, safe parallel zones, or sequential constraints
- **When** the orchestration is documented or surfaced to operators
- **Then** Product Lead, Solution Lead, Fullstack, Code Reviewer, QA Agent, and Master Orchestrator responsibilities remain distinct
- **And** Master Orchestrator is described as routing and state control only.

#### AC3.3 Task-Level Coordination Is Inspectable When Used

- **Given** a full-delivery work item uses task-level coordination
- **When** an operator or delivery agent checks the work item state or roadmap-derived expectations
- **Then** task owner, task status, artifact references, dependencies or sequential constraints, safe parallel zones when approved, QA owner when assigned, integration readiness, unresolved issues, and verification evidence are inspectable at product level
- **And** the work does not imply unrestricted parallel safety.

#### AC3.4 Migration Orchestration Preserves Migration Semantics

- **Given** a migration work item uses slice tracking or coordination
- **When** its orchestration expectations are documented
- **Then** preserved behavior, baseline evidence, compatibility risk, staged sequencing, rollback checkpoints, parity evidence, and slice verification are emphasized
- **And** full-delivery task-board semantics are not applied by default.

## Edge Cases

- The operator starts from a checked-in authoring repository instead of a globally installed session; guidance must identify which surfaces are authoring/compatibility surfaces versus the preferred global product path.
- The operator is in a globally installed session with compatibility files mirrored into the project; guidance must not treat mirrored files as a separate source of truth.
- A target project has no app-native validation commands; validation guidance must state the missing path instead of substituting example commands.
- A target project later adds real build, lint, or test commands; roadmap-derived guidance must allow those commands to become the target-project validation path after documentation is updated.
- Runtime tools exist but dependencies are missing; capability status must show degraded or unavailable state rather than presenting the tool as fully working.
- Semantic search or graph indexing exists but has not been run or is disabled; user-facing guidance must indicate unavailable or degraded results.
- A full-delivery task board exists but safe parallel zones or sequential constraints are incomplete; orchestration guidance must default to conservative coordination.
- Migration work appears large enough for parallel execution; guidance must still preserve migration parity and sequential-default behavior unless a strategy explicitly defines safe slice coordination.
- A user explicitly chooses a lane that appears mismatched; lane-lock behavior must be preserved, with advisory reporting rather than automatic rerouting.

## Error And Failure Conditions

- Operator-facing guidance points users to a command that does not exist.
- Documentation claims global CLI, workflow-state, runtime-tool, or validation behavior that is not implemented.
- Roadmap artifacts blur product CLI, in-session command, and compatibility runtime responsibilities.
- Acceptance or validation language implies target-project build, lint, test, CI, package-manager, or deployment support where none exists.
- Phase 3 orchestration is planned before unresolved Phase 1 or Phase 2 blockers are identified.
- Task-level orchestration hides owner, status, artifact, dependency, QA, issue, or verification state from operators and maintainers.
- Role boundaries are weakened by making Master Orchestrator responsible for scope, solution, implementation, review, or QA judgment.
- A roadmap update introduces a fourth lane or mode without explicit future scope approval.
- Verification evidence is claimed without an inspectable artifact, command result, runtime record, or stated missing validation path.

## Artifact Expectations

- Product Lead scope for this roadmap is recorded in this file: `docs/scope/2026-04-24-operator-experience-runtime-maturity-orchestration.md`.
- Solution Lead must create or refine the corresponding solution package at product level before implementation work begins.
- Future phase-specific work may create narrower scope or solution artifacts only when the phase requires additional approval-ready detail.
- Full Delivery work should keep scope, solution, implementation evidence, code-review findings, QA artifacts, issue state, and verification evidence inspectable through the normal workflow surfaces.
- Documentation updates are expected when command reality, runtime surfaces, validation paths, or artifact expectations change.

## Validation Expectations

- Validate OpenKit product and runtime surfaces with real OpenKit CLI, runtime, workflow-state, or automated repository validation where those commands exist.
- Validate target-project application behavior only with commands actually defined by the target project.
- If no app-native validation command exists, record the missing validation path clearly in the relevant artifact or handoff.
- Record verification evidence in an inspectable form before claiming stage completion.
- Validation language must identify whether evidence applies to the global CLI product path, in-session workflow path, compatibility runtime path, documentation/artifact path, or target-project application path.

## Measurable Success Criteria

- Phase 1 succeeds when the preferred operator path, surface boundaries, lane expectations, artifact expectations, and missing-validation handling are documented and inspectable without requiring maintainers to infer behavior from code.
- Phase 2 succeeds when runtime health, resume state, command reality, tool capability states, validation-evidence expectations, and current-versus-planned distinctions are consistently documented and inspectable.
- Phase 3 is ready to enter solution design only when Phase 1 and Phase 2 success criteria are met or their gaps are explicitly recorded as blockers.
- The product-to-solution handoff succeeds when Solution Lead can map every phase to concrete artifacts, runtime surfaces, or validation paths without rediscovering product intent.
- The scope package remains successful only if it avoids implementation design while still giving binary acceptance criteria for roadmap delivery.

## Open Questions

- None blocking for `product_to_solution`. Solution Lead should identify any implementation sequencing, dependency, or validation feasibility questions in the solution package.

## Handoff Notes For Solution Lead

- Preserve the phase order exactly: operator experience clarity first, runtime/tooling maturity standardization second, deeper execution orchestration third.
- Map acceptance criteria to concrete repository artifacts, documentation updates, runtime/CLI surfaces, and validation commands without adding features outside these phases.
- Keep implementation design out of the Product Lead scope; any architecture, data model, or command-design choices belong in the solution package.
- Treat absent app-native validation commands as a product constraint, not a gap to paper over with guessed commands.
- Ensure any Phase 3 orchestration design keeps full-delivery task boards full-only, migration parity-oriented, and role boundaries inspectable.
