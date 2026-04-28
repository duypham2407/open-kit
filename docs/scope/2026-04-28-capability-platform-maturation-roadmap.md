---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-950
feature_slug: capability-platform-maturation-roadmap
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - Brainstorm outcome: Capability Platform Maturation Roadmap
  - Phase order: MCP / Extensibility Platform Hardening -> Code Intelligence Hardening -> Capability-Aware Orchestration
---

# Scope Package: Capability Platform Maturation Roadmap

OpenKit should mature in a capability-first direction by hardening the existing MCP/extensibility surfaces first, then hardening code-intelligence surfaces, and only then making orchestration capability-aware, so that future workflow power remains inspectable, reliable, and under explicit product control instead of growing as opaque capability sprawl.

## Goal

- Evolve OpenKit toward a capability-first product direction without changing the current three-lane workflow contract.
- Increase inspectability, reliability, diagnostics, validation, and operator/maintainer clarity across the capability surfaces OpenKit already has or has started to expose.
- Require each phase to leave inspectable outputs in documentation and in runtime, test, or diagnostic surfaces where those surfaces already exist or are explicitly being hardened.
- Preserve explicit product control so capability growth remains understandable, governable, and reviewable.

## Non-Goals

- Do not create new workflow lanes, runtime modes, or a replacement workflow contract beyond `quick`, `migration`, and `full`.
- Do not treat each phase as a separate product line, standalone commercial surface, or independent roadmap with conflicting priorities.
- Do not promise undocumented live parallel behavior, hidden background execution guarantees, or unrestricted orchestration autonomy.
- Do not expand OpenKit into broad speculative capability sprawl unrelated to hardening, inspectability, diagnostics, validation, or role-safe orchestration.
- Do not turn this Product Lead scope package into solution design for storage models, APIs, implementation classes, algorithms, or library choices.
- Do not claim target-project application validation where the repository or target project does not define app-native commands.

## Target Users

- **OpenKit operator:** needs capability surfaces that are understandable to install, configure, diagnose, run, and trust.
- **OpenKit maintainer:** needs hardening work to leave clear docs, diagnostics, evidence, and current-versus-planned boundaries.
- **In-session delivery agents:** need capability availability, limitations, and orchestration boundaries to be explicit so they do not guess or overclaim behavior.
- **Solution Lead, Code Reviewer, and QA Agent:** need inspectable acceptance surfaces that keep future capability-aware work auditable and safe.

## Problem Statement

OpenKit is growing beyond a narrow workflow kit into a broader capability platform with MCP surfaces, runtime tooling, code intelligence, and orchestration aids. Those surfaces now need an explicit maturation path. Without ordered hardening, OpenKit risks adding capability breadth faster than it improves reliability, diagnostics, validation, and operator clarity. That would make future orchestration harder to trust, harder to review, and easier to overstate. The product needs one roadmap feature that first hardens extensibility, then code intelligence, and only then allows capability-aware orchestration on top of inspectable foundations.

## In Scope

### Phase 1 — MCP / Extensibility Platform Hardening

- Harden the existing MCP and extensibility surfaces so operators and maintainers can understand what is bundled, custom, available, unavailable, degraded, preview-only, compatibility-only, or not configured.
- Strengthen inspectable configuration, diagnostics, health, setup, and evidence surfaces for bundled and custom extensibility paths.
- Clarify operator and maintainer expectations for configuration, readiness, status, safety boundaries, and validation surfaces related to MCP and adjacent extensibility capabilities.
- Improve reliability and observability of the extensibility control plane before downstream capability layers depend on it.

### Phase 2 — Code Intelligence Hardening

- Harden code-intelligence surfaces that OpenKit already exposes or documents, including graph, syntax, AST, semantic search, dependency, and related diagnostic capabilities.
- Improve inspectability of capability readiness, indexing state, degraded behavior, fallback behavior, and evidence quality for code-intelligence tools.
- Improve operator and maintainer clarity around what code-intelligence surfaces can be trusted, when they are partial, and how their evidence should be interpreted.
- Ensure code-intelligence hardening builds on Phase 1 capability and extensibility foundations rather than bypassing them.

### Phase 3 — Capability-Aware Orchestration

- Make orchestration capability-aware only after extensibility and code-intelligence foundations are hardened enough to support safe, inspectable decisions.
- Improve product-level expectations for how capability state informs routing, recommendations, diagnostics, readiness, coordination, and evidence.
- Preserve explicit workflow and role boundaries while making capability-aware orchestration more inspectable to operators and maintainers.
- Require orchestration outputs to expose capability assumptions, caveats, and evidence rather than hiding them behind automation.

## Out of Scope

- Implementing code or choosing the technical architecture in this Product Lead artifact.
- Splitting this roadmap into separate product approvals for each phase unless a later approved scope intentionally does so.
- Adding a fourth lane, renaming lanes, or redefining stage ownership semantics in `context/core/workflow.md`.
- Promising general autonomous orchestration, generalized background execution, or parallel task behavior beyond what is already documented and validated.
- Replacing existing workflow-state, approval, QA, or review surfaces with undocumented capability-driven shortcuts.
- Expanding into unrelated capability families just because they are technically possible.
- Treating OpenKit runtime checks, documentation checks, or CLI checks as target-project application build/lint/test evidence.

## Strategic Phase Order

1. **Phase 1 — MCP / Extensibility Platform Hardening**
2. **Phase 2 — Code Intelligence Hardening**
3. **Phase 3 — Capability-Aware Orchestration**

Mandatory ordering rules:

- Phase 1 unlocks Phase 2.
- Phase 2 unlocks Phase 3.
- Phase 3 must not be approved as delivery-ready if unresolved Phase 1 or Phase 2 foundation gaps are still hidden or untracked.
- Later phases may reference earlier-phase outputs, but they must not assume a capability foundation that earlier phases have not made inspectable.

## Users And User Journeys

1. **As an operator, I want extensibility surfaces to report real configuration and health state, so that I know what capability setup is ready, missing, degraded, or unsafe.**
2. **As a maintainer, I want code-intelligence tools to expose honest readiness and fallback behavior, so that I can trust or challenge their results based on evidence instead of assumption.**
3. **As an in-session agent, I want capability-aware guidance to be bounded by real capability state, so that I do not route work through unavailable or overclaimed tools.**
4. **As a reviewer or QA owner, I want each phase to leave inspectable artifacts and validation surfaces, so that capability-platform maturity can be verified without rediscovering intent.**
5. **As a Solution Lead, I want a strict phase order and explicit non-goals, so that I can sequence technical work without reopening product scope.**

## Product And Business Rules

1. This is one full-delivery roadmap feature with three strictly ordered phases, not three unrelated features.
2. Phase ordering is mandatory: Phase 1 precedes Phase 2, and Phase 2 precedes Phase 3.
3. A later phase must not depend on undocumented capability behavior from an earlier phase.
4. Each phase must produce inspectable outputs in documentation and in runtime, test, or diagnostic surfaces where applicable to that phase.
5. Inspectability is a product requirement, not an optional implementation nicety.
6. Hardening work must favor clearer operator and maintainer understanding over adding speculative new capability breadth.
7. Capability state must be reported honestly using existing repository vocabulary and current-versus-planned boundaries.
8. OpenKit must continue to operate within the existing lane model: Quick Task, Migration, and Full Delivery only.
9. Product scope must preserve explicit role boundaries; capability-aware orchestration must not make Master Orchestrator, Product Lead, Solution Lead, Code Reviewer, or QA Agent absorb each other's responsibilities.
10. Capability-aware orchestration may make coordination smarter, but it must not hide assumptions, evidence, blockers, or caveats.
11. Validation claims must identify the surface actually validated: product CLI, in-session/runtime tooling, compatibility runtime, documentation/package, or target-project application when that path truly exists.
12. If app-native target-project validation is unavailable, artifacts must say so explicitly instead of substituting OpenKit runtime checks.
13. Full-delivery parallel or task-level coordination behavior must remain conservative and must not be overstated beyond current documented runtime reality.
14. The scope package must remain product-level and leave architecture, data model, and implementation strategy decisions to Solution Lead.

## Acceptance Criteria Matrix

### Phase 1 — MCP / Extensibility Platform Hardening

#### AC1.1 Extensibility Status Is Inspectable

- **Given** an operator or maintainer needs to understand OpenKit extensibility readiness
- **When** they inspect the phase outputs
- **Then** bundled and custom extensibility surfaces expose inspectable status, configuration-readiness, and caveat expectations
- **And** the outputs distinguish usable, missing, degraded, preview, compatibility-only, or not-configured states without implying hidden readiness.

#### AC1.2 Extensibility Diagnostics And Validation Boundaries Are Explicit

- **Given** extensibility diagnostics, doctor flows, readiness checks, or setup guidance are part of the phase outputs
- **When** those outputs are reviewed
- **Then** they state what surface is being validated or diagnosed
- **And** they do not claim target-project application validation unless that path actually exists.

#### AC1.3 Extensibility Hardening Produces Inspectable Product Artifacts

- **Given** Phase 1 is considered complete
- **When** Product Lead, Solution Lead, Code Reviewer, or QA inspects the resulting surfaces
- **Then** there are inspectable documentation updates and relevant runtime, diagnostic, or test-facing outputs describing how the extensibility platform is hardened
- **And** those outputs are sufficient for downstream work to depend on them without rediscovering product intent.

#### AC1.4 Phase 1 Preserves Control And Safety Boundaries

- **Given** OpenKit adds or clarifies extensibility capability behavior
- **When** the phase outputs are reviewed
- **Then** they preserve explicit setup, configuration, safety, and reporting boundaries
- **And** they do not introduce hidden capability activation, undocumented trust assumptions, or capability sprawl outside the stated scope.

### Phase 2 — Code Intelligence Hardening

#### AC2.1 Code-Intelligence Capability State Is Honest And Inspectable

- **Given** an operator, maintainer, or delivery agent uses or reviews OpenKit code-intelligence surfaces
- **When** Phase 2 outputs are inspected
- **Then** capability readiness, indexing state, degraded or fallback behavior, and known limitations are explicit
- **And** the outputs do not present partial or unavailable results as fully authoritative.

#### AC2.2 Code-Intelligence Evidence Quality Is Clarified

- **Given** code-intelligence outputs are used to inform implementation, review, or QA work
- **When** the phase outputs define their expectations
- **Then** they state how evidence should be interpreted when capabilities are available, degraded, preview-only, or not configured
- **And** they make false confidence harder by exposing caveats and fallback boundaries.

#### AC2.3 Code-Intelligence Hardening Depends On Phase 1 Foundations

- **Given** Phase 2 work is planned or assessed for completion
- **When** dependency expectations are reviewed
- **Then** the outputs explicitly rely on hardened extensibility/control-plane foundations from Phase 1
- **And** they do not bypass unresolved Phase 1 visibility, diagnostics, or validation gaps.

#### AC2.4 Phase 2 Produces Inspectable Runtime Or Documentation Outputs

- **Given** Phase 2 is considered complete
- **When** downstream roles inspect the phase results
- **Then** the repository contains inspectable documentation and relevant runtime, diagnostic, or test-facing outputs describing hardened code-intelligence behavior
- **And** those outputs are clear enough for Solution Lead and QA to verify intended maturity boundaries.

### Phase 3 — Capability-Aware Orchestration

#### AC3.1 Orchestration Depends On Hardened Foundations

- **Given** capability-aware orchestration is proposed for delivery
- **When** readiness is evaluated
- **Then** Phase 1 and Phase 2 completion evidence or explicit blockers are visible
- **And** capability-aware orchestration is not treated as ready on top of hidden or unresolved foundation gaps.

#### AC3.2 Capability Influence On Orchestration Is Inspectable

- **Given** capability state influences routing, recommendations, readiness, coordination, or evidence
- **When** operators or maintainers inspect the orchestration outputs
- **Then** the capability assumptions, caveats, and relevant evidence surfaces are visible
- **And** the product does not hide those decisions behind opaque automation.

#### AC3.3 Workflow And Role Boundaries Are Preserved

- **Given** orchestration becomes capability-aware
- **When** its product behavior is reviewed
- **Then** the current three lanes, stage ownership expectations, approval gates, and role boundaries remain intact
- **And** capability-awareness does not reassign Product Lead, Solution Lead, implementation, review, or QA ownership implicitly.

#### AC3.4 Orchestration Does Not Overpromise Parallelism Or Autonomy

- **Given** orchestration outputs discuss coordination, tasking, readiness, or capability-based recommendations
- **When** they are reviewed
- **Then** they stay within documented runtime reality for task boards, safe parallel zones, sequential constraints, diagnostics, and evidence
- **And** they do not promise undocumented live parallel guarantees or generalized autonomous execution.

## Edge Cases And Risks

- The repository has capability surfaces that exist in partial or preview form; maturity work must not erase those caveats.
- Capability state may differ between global CLI, in-session tooling, and compatibility-runtime views; scope outputs must keep those surfaces distinct.
- Extensibility hardening may expose missing dependencies, missing credentials, or disabled states more visibly than before; the phase must treat that as honest improvement, not failure by definition.
- Code-intelligence surfaces may provide degraded or fallback results when indexes, native dependencies, or optional providers are missing.
- Operators may confuse OpenKit runtime/tooling evidence with target-project application validation unless artifacts label the surface explicitly.
- Capability-aware orchestration can accidentally sound like permission for hidden routing or autonomy unless product language stays explicit.
- A later implementation might try to widen the feature into unrelated capability domains; Solution Lead must guard against this scope creep.
- Phase completion can be overstated if inspectable outputs exist in docs but not in the corresponding runtime, diagnostic, or evidence surfaces that the phase claims to harden.

## Error And Failure Cases

- Phase outputs claim a hardened capability surface but leave its status, caveats, or validation boundaries uninspectable.
- Phase 2 proceeds as if Phase 1 is complete while critical extensibility-control-plane gaps remain undocumented.
- Phase 3 introduces orchestration behavior that depends on unavailable, degraded, or undocumented capability assumptions.
- Product artifacts blur current behavior and planned behavior, causing operators or maintainers to overtrust incomplete capability surfaces.
- Orchestration outputs imply unrestricted task parallelism, hidden background execution, or role reassignment that the repository does not actually support.
- Validation claims are reported without naming which surface was actually validated.
- OpenKit runtime or documentation checks are presented as target-project application proof.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `documentation` | Validate that each phase leaves inspectable documentation describing goals, boundaries, status expectations, and current-versus-planned distinctions. |
| `global_cli` | Validate CLI-facing capability setup, health, readiness, or diagnostics only where the relevant product commands exist and are affected by the final solution. |
| `runtime_tooling` | Validate runtime capability, code-intelligence, orchestration-readiness, and diagnostic behaviors only where those in-session/runtime tools actually exist. |
| `compatibility_runtime` | Validate workflow-state, readiness, evidence, and compatibility-mirror surfaces where phase outputs rely on them for inspectability. |
| `package` | Validate packaged/bundled capability metadata or install-surface expectations only if the final solution changes shipped package content or package-facing readiness surfaces. |
| `target_project_app` | Unavailable unless a separate target project defines app-native build/lint/test/smoke commands; OpenKit CLI, runtime, docs, workflow-state, and package checks must not be reported as target-project application validation. |

## Constraints And Assumptions

- The repository's canonical workflow remains the one defined in `context/core/workflow.md`.
- The current live contract continues to support exactly three modes: `quick`, `migration`, and `full`.
- Existing capability-status vocabulary and validation-surface distinctions should be preserved unless a later approved scope explicitly changes them.
- Current repo reality still lacks general target-project app-native validation defaults; this scope therefore requires honest unavailable-path reporting where needed.
- This feature is intended as a roadmap-scale scope package; Solution Lead may sequence implementation across slices, but must preserve the single-feature phase ordering.
- Earlier feature work on MCPs, capability routing, metadata, diagnostics, graph tools, and orchestration surfaces may be reused, but this scope does not assume any unfinished feature is already complete unless its inspectable outputs exist.

## Open Questions And Notable Risks

- Open question for Solution Lead: determine whether this roadmap should map directly onto one implementation program with sub-slices or a staged series of dependent solution/implementation slices under one approved feature umbrella.
- Open question for Solution Lead: define the minimum inspectable runtime, diagnostic, and evidence surfaces required for a phase to count as truly hardened rather than merely documented.
- Notable risk: Phase 3 can easily become too broad unless the final solution constrains capability-aware orchestration to currently real, inspectable runtime surfaces.
- Notable risk: code-intelligence hardening may expose dependency or indexing gaps that make capability maturity look temporarily worse before it becomes clearer; the solution should treat that honesty as expected.

## Success Signal

- OpenKit can describe its capability-platform direction as one ordered roadmap feature where extensibility is hardened first, code intelligence second, and capability-aware orchestration third; each phase leaves inspectable documentation and relevant runtime/diagnostic/evidence outputs; operators and maintainers can tell what is current, what is limited, what is validated, and what later phases are allowed to depend on.

## Handoff Notes For Solution Lead

- Preserve the strict phase order exactly as approved: Phase 1 -> Phase 2 -> Phase 3.
- Keep the feature single and capability-first; do not fragment product intent into unrelated technical epics unless you preserve one canonical roadmap story and dependency chain.
- Preserve the current workflow contract, role boundaries, lane model, and conservative parallelism posture.
- Translate each phase into concrete implementation slices, artifacts, and validation paths without changing the product-level unlock order.
- Make inspectability first-class in the solution: every claimed hardening outcome should map to explicit docs, runtime surfaces, diagnostics, tests, or evidence paths.
- Keep validation-surface honesty explicit, especially the difference between OpenKit runtime/CLI evidence and unavailable `target_project_app` evidence.
- Guard against capability sprawl: if a proposed implementation expands beyond hardening, inspectability, reliability, diagnostics, validation, or role-safe orchestration, route it back as a scope question rather than silently absorbing it.

## Product Lead Handoff Decision

- **Pass:** this scope package is approval-ready for `product_to_solution` because it defines the problem, users, goals, non-goals, strict phase ordering, business rules, per-phase acceptance criteria, risks, validation expectations, and Solution Lead handoff boundaries without dictating implementation design.
