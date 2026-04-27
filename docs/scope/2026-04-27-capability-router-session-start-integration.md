---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-949
feature_slug: capability-router-session-start-integration
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - FEATURE-941 MCP + Skills Capability Pack
  - FEATURE-945 Interactive MCP Setup Wizard
  - FEATURE-947 Standardize Bundled Skill Metadata
  - FEATURE-948 Custom MCP Add And Import
---

# Scope Package: Capability Router Session-Start Integration

OpenKit should integrate capability-router guidance into session-start and runtime guidance so agents begin each session with a compact, role/stage-aware view of relevant skills, MCPs, capability-router tools, skill-index tools, and MCP health tools while preserving context economy, explicit activation, secret safety, validation-surface honesty, and existing workflow role boundaries.

## Goal

- Add compact capability-router guidance to session-start/runtime guidance so agents can decide when to call capability router, skill-index, and MCP health tools.
- Make recommendations sensitive to current lane, stage, role/owner, and capability state without changing lane/stage semantics.
- Preserve context economy by summarizing relevant capability groups and caveats instead of dumping full MCP or skill catalogs into prompts.
- Preserve lazy activation: guidance may recommend capabilities, but it must not load skills, execute MCPs, or perform hidden tool calls on behalf of an agent.
- Preserve prior FEATURE-941/945/947/948 secret, status, metadata, custom MCP, and validation-surface boundaries.

## Non-Goals

- Do not create a marketplace, installer, remote registry, provider onboarding flow, keychain, password-manager integration, or secret-sync feature.
- Do not load all skill bodies, all skill metadata records, all MCP entries, or all custom MCP definitions into session-start prompts.
- Do not automatically activate skills or MCPs based only on router guidance.
- Do not change `quick`, `migration`, or `full` lane semantics, stage names, approval gates, escalation rules, workflow-state enums, or role ownership.
- Do not encourage Master Orchestrator implementation work, QA work by non-QA roles, Product Lead technical design ownership, or Solution Lead product-scope rewriting.
- Do not add or claim target-project application build, lint, test, smoke, or regression validation.
- Do not weaken FEATURE-941/945/948 secret storage, placeholder, redaction, scope, or direct OpenCode caveat rules.

## Target Users

- **In-session agent:** needs a short, trustworthy reminder of relevant capability routes without spending context on full catalogs.
- **Master Orchestrator:** needs workflow-control guidance that does not imply business analysis, implementation, review, or QA ownership.
- **Role agents:** Product Lead, Solution Lead, Fullstack Agent, Code Reviewer, QA Agent, and Quick Agent need stage-appropriate capability suggestions that respect their responsibilities.
- **OpenKit operator:** expects `openkit run` sessions and doctor/runtime summaries to explain capability readiness and setup gaps without leaking secrets.
- **Maintainer/reviewer:** needs observable rules proving router guidance is advisory, compact, metadata-backed, and validation-surface honest.

## Problem Statement

FEATURE-941, FEATURE-945, FEATURE-947, and FEATURE-948 made bundled MCPs, custom MCPs, MCP setup, and skill metadata more visible, but session-start guidance still risks two bad outcomes: agents either miss relevant capability-router/skill-index/MCP-health tools, or prompts become bloated with full catalogs and hidden activation behavior. OpenKit needs a compact session-start and runtime guidance layer that helps each role know which capability discovery path to call next, while keeping routing advisory, explicit, role-boundary-safe, secret-safe, and honest about unavailable or stale runtime state.

## In Scope

- Add or update session-start/runtime guidance that summarizes capability-router availability and when to use it.
- Provide compact role/stage-aware capability summaries for the active workflow context, including current lane/mode, stage, and owner when known.
- Provide compact guidance for when to call:
  - capability router tools or runtime capability inventory tools
  - skill-index or skill metadata lookup tools
  - MCP health, doctor, or status tools
  - workflow-state/runtime-summary tools when capability readiness depends on current workflow state
- Include status and caveat handling for `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, `not_configured`, and user-facing needs-key/missing-key conditions.
- Include custom MCP visibility from FEATURE-948 as custom/origin-labeled summary information where relevant, without mixing custom entries into bundled catalog ownership.
- Include stale-runtime/snapshot caveats when guidance is based on cached, last-known, or unverified runtime state.
- Update relevant operator/maintainer documentation and guidance surfaces so humans and agents understand advisory router behavior and validation boundaries.
- Validate that session-start/runtime guidance does not leak raw secrets, does not expose full catalogs by default, and does not claim target application validation.

## Out of Scope

- Creating new MCP definitions, custom MCP lifecycle commands, key setup commands, installer flows, or marketplace acquisition paths.
- Changing the bundled MCP catalog, custom MCP storage model, secret-store location, profile materialization semantics, or direct OpenCode behavior except for documentation/guidance caveats if needed.
- Changing bundled skill instruction content or broad skill metadata beyond what is necessary for guidance to consume already-approved metadata.
- Running capability health probes that require external network/provider calls automatically at every session start unless the final solution explicitly scopes them as existing lightweight status reads and labels their validation surface.
- Making router output authoritative over role judgment, workflow approvals, or stage gates.
- Adding target-project application commands or treating OpenKit runtime/CLI checks as target-project application evidence.

## Users And User Journeys

1. **As an in-session agent, I want a compact session-start capability summary, so that I know which discovery tools to call without reading full catalogs.**
2. **As Master Orchestrator, I want only workflow-control capability guidance, so that I route, record, and dispatch without being nudged into implementation, review, QA, or product authorship.**
3. **As Product Lead in `full_product`, I want scope-writing and product-context capability guidance, so that I can define requirements without receiving implementation instructions.**
4. **As Solution Lead in `full_solution` or migration strategy, I want design and validation-planning capability guidance, so that I can choose appropriate technical discovery tools without changing product scope.**
5. **As Fullstack Agent, Code Reviewer, or QA Agent, I want role-specific capability suggestions, so that implementation, review, and verification tools are recommended only in the stages where my role owns that work.**
6. **As an OpenKit operator, I want unavailable/degraded/needs-key capability caveats visible at startup, so that I can run the right setup or health command without exposing secrets.**
7. **As a maintainer, I want router guidance to be testable and bounded, so that future capability growth does not bloat prompts or hide activation behavior.**

## Business Rules

### Context Economy And Summary Shape

- Session-start/runtime guidance must be compact by default: it may show grouped capability status, the most relevant role/stage suggestions, and explicit next-action commands/tools, but it must not print one line per skill or MCP across the full catalog.
- Detailed skill, MCP, or capability catalogs must require an explicit follow-up call to skill-index, MCP inventory/health, or capability-router tools.
- Compact summaries must include enough information for next action: relevant category, status/caveat, why it is relevant to the current role/stage, and which explicit tool/command to call for details.
- When many capabilities match, guidance must prioritize a bounded relevant subset and provide an overflow/detail instruction rather than dumping all matches.
- Summary wording must distinguish recommendation, current state, and caveat; it must not imply a capability has already been used unless it actually ran.

### Lazy Activation And Advisory Routing

- Router guidance is advisory. It may recommend that an agent call a capability-router, skill-index, MCP health, or other runtime tool, but it must not secretly call tools or load skills into the prompt.
- Session-start must not auto-load skill bodies based only on metadata matches.
- Session-start must not execute MCP-backed tools merely because an MCP is recommended for a role/stage.
- If a skill or MCP is selected later, that activation must remain visible through the normal explicit tool/skill call path and be attributable in the conversation or runtime evidence.
- Router output must not override workflow approvals, stage readiness, or role responsibility; it can inform the role, not act as the role.

### Role And Stage Awareness

- Guidance must use current OpenKit mode/lane and stage vocabulary only; it must not introduce, rename, remove, or reinterpret workflow stages.
- Guidance must be safe for unknown or missing workflow state: it should fall back to generic capability-discovery guidance with a stale/unknown-state caveat rather than guessing a role or stage.
- Master Orchestrator guidance must stay procedural: workflow-state/status/readiness and dispatch-oriented capabilities only; it must not recommend implementation, technical design, code review, or QA execution as Master-owned work.
- Product Lead guidance must focus on scope, business rules, acceptance criteria, and approved context reads; it must not encourage implementation or technical architecture decisions.
- Solution Lead guidance must focus on solution design, sequencing, validation planning, and capability discovery needed for design; it must not rewrite approved product scope without routing a requirement gap.
- Fullstack Agent guidance may recommend implementation aids only during implementation-owned stages.
- Code Reviewer guidance may recommend review, scan, diff, dependency, and scope-compliance aids only for review-owned work.
- QA Agent guidance may recommend verification, evidence, browser, scan, and health tools only for QA/verification-owned work.
- Quick Agent guidance must respect quick-lane single-owner semantics and must not introduce Product Lead, Solution Lead, Code Reviewer, or QA Agent handoffs into quick mode.
- Migration guidance must preserve migration semantics: baseline, compatibility, parity, staged upgrade, review, and verification guidance instead of full-delivery task-board assumptions.

### Capability Status, Caveats, And Custom MCP Visibility

- Guidance must use existing capability status vocabulary consistently: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`.
- User-facing needs-key/missing-key caveats must map to `not_configured` or an equivalent explicit caveat and must never treat placeholders as usable keys.
- Disabled capabilities must be shown as disabled/needs-action where relevant, not silently hidden if they explain why a route is unavailable.
- Custom MCPs from FEATURE-948 must be visible as custom/origin-labeled capability context when relevant, but must not be merged into bundled MCP ownership or shown as bundled defaults.
- Guidance must distinguish bundled MCPs, custom MCPs, runtime tools, skills, and workflow/compatibility tools when those distinctions matter for setup or ownership.
- Optional, preview, experimental, compatibility-only, or degraded capabilities must carry visible caveats before they are recommended as normal routes.
- If a capability-router, skill-index, or MCP health surface itself is unavailable or degraded, session-start guidance must say so and point to the safest fallback instead of pretending the route exists.

### Secret Safety And Redaction

- Raw secrets, tokens, API keys, bearer values, cookies, provider credentials, env dumps, and raw provider payloads must never appear in session-start guidance, runtime summaries, doctor output, workflow-state evidence, docs examples, or logs.
- Key state may be shown only as redacted states such as missing, present-redacted, needs key, or not configured.
- Placeholder values must not be presented as actual configured secrets.
- Custom MCP summaries must not print raw command env values, raw auth headers, URL credentials, token-like query values, or imported global secret material.
- If a health/status source returns sensitive data, guidance must sanitize or summarize it before display or persistence.

### Stale Runtime And Snapshot Caveats

- Session-start guidance must make clear when capability status is a startup snapshot, cached read model, or last-known health result.
- If capability state could have changed since startup, guidance must include a refresh path such as calling capability router, skill-index, MCP health, runtime-summary, or doctor tooling as appropriate.
- If no fresh runtime state is available, guidance must report unknown/unavailable state rather than inventing availability.
- Stale state must not block normal work by itself, but it must prevent claims that a capability is currently healthy unless a current check has run.

### Validation-Surface Honesty

- Capability guidance and health checks validate OpenKit surfaces only; they must not be described as target-project application build/lint/test validation.
- `runtime_tooling` evidence may prove capability router, skill-index, MCP health, runtime summary, and related OpenKit tools behave as expected.
- `compatibility_runtime` evidence may prove workflow-state/readiness/evidence records and mirror behavior, not target application behavior.
- `global_cli` evidence may prove `openkit run`, session-start hook behavior, and `openkit doctor`/CLI health behavior when those product surfaces are affected.
- `documentation` evidence may prove docs/help/runbooks accurately explain behavior and boundaries.
- `target_project_app` remains unavailable unless a separate target project defines app-native build, lint, test, smoke, or regression commands.

## Acceptance Criteria Matrix

### Session-Start Compact Guidance

- **Given** an OpenKit session starts with capability metadata available, **when** session-start guidance is produced, **then** it includes compact grouped capability guidance and explicit next-action tools without printing the full skill catalog or full MCP catalog.
- **Given** many skills or MCPs match the current context, **when** session-start guidance is produced, **then** it shows only a bounded relevant subset or grouped summary and points to skill-index/capability-router/MCP-health tools for details.
- **Given** no capability metadata is available, **when** session-start guidance is produced, **then** it reports capability guidance as unavailable or degraded and provides a safe fallback path without inventing capability status.
- **Given** a user wants detailed capability inventory, **when** they follow the summary's detail path, **then** the detailed catalog is retrieved by an explicit follow-up tool/command rather than preloaded into session-start prompt text.

### Advisory And Lazy Activation Behavior

- **Given** a role/stage has recommended skills, **when** session-start guidance is generated, **then** no skill body is loaded automatically solely because of that recommendation.
- **Given** a role/stage has recommended MCP-backed tools, **when** session-start guidance is generated, **then** no MCP tool is executed automatically solely because of that recommendation.
- **Given** the router recommends a capability, **when** an agent chooses to use it, **then** the use occurs through an explicit visible skill/tool call and remains attributable.
- **Given** router guidance conflicts with workflow role boundaries, **when** the guidance is inspected, **then** the role boundary wins and the guidance does not assign work to the wrong role.

### Role/Stage-Aware Recommendations

- **Given** current owner is `MasterOrchestrator`, **when** session-start guidance is produced, **then** recommendations are limited to orchestration/status/dispatch/readiness surfaces and do not tell Master to implement, review, QA, or author scope/solution content.
- **Given** current stage is `full_product` and owner is `ProductLead`, **when** guidance is produced, **then** it recommends product-scope and acceptance-definition aids without implementation instructions.
- **Given** current stage is `full_solution` and owner is `SolutionLead`, **when** guidance is produced, **then** it recommends solution design, sequencing, capability discovery, and validation-planning aids without rewriting product scope.
- **Given** current stage is `full_implementation`, **when** guidance is produced for Fullstack Agent, **then** implementation-support tools may be suggested and QA/review ownership remains separate.
- **Given** current stage is `full_code_review`, **when** guidance is produced for Code Reviewer, **then** review/scan/scope-compliance aids may be suggested and implementation ownership is not reassigned to Code Reviewer except through findings routed by workflow.
- **Given** current stage is `full_qa`, **when** guidance is produced for QA Agent, **then** verification/evidence aids may be suggested and QA completion still requires actual validation evidence.
- **Given** mode is `quick`, **when** guidance is produced, **then** it respects Quick Agent single-owner quick-lane semantics and does not introduce full-delivery handoffs.
- **Given** mode is `migration`, **when** guidance is produced, **then** it emphasizes baseline, compatibility, parity, staged upgrade, review, and verification surfaces rather than full-delivery task-board assumptions.

### Status, Caveats, And Custom MCP Visibility

- **Given** a relevant capability is `available`, **when** guidance lists it, **then** the output may recommend it without setup caveats while still requiring explicit use.
- **Given** a relevant capability is `unavailable`, `degraded`, `preview`, `compatibility_only`, or `not_configured`, **when** guidance lists it, **then** the output includes the status and a concise caveat or next action.
- **Given** an MCP requires a missing key, **when** guidance mentions that MCP or an associated skill, **then** it shows needs-key/not-configured state without printing placeholders as secrets or treating them as configured.
- **Given** custom MCP entries exist, **when** guidance includes MCP context, **then** custom entries are labeled as custom/origin-specific and are not presented as bundled defaults.
- **Given** no custom MCP entries exist, **when** guidance includes MCP context, **then** it does not imply custom MCPs are configured.
- **Given** the capability router, skill-index, or MCP health tool is itself unavailable or degraded, **when** guidance is produced, **then** it reports that route's limitation and names the safest fallback or diagnostic path.

### Secret Safety And Redaction

- **Given** a synthetic real-looking secret exists in local MCP config, custom MCP config, env, fixture, or health response, **when** session-start guidance, runtime summaries, doctor output, workflow evidence, docs examples, and logs are inspected, **then** the raw value does not appear.
- **Given** key state is displayed, **when** guidance renders it, **then** the output uses redacted/missing/not-configured labels only and no prefixes, suffixes, hashes, env dumps, or raw provider payloads.
- **Given** a custom MCP definition includes placeholder-backed env/header needs, **when** guidance mentions the custom MCP, **then** it displays only placeholder/redacted readiness and not raw values.

### Stale Runtime And Validation-Surface Boundaries

- **Given** capability guidance is based on cached or startup-snapshot data, **when** it is displayed, **then** it includes a stale/snapshot caveat and a refresh path.
- **Given** a fresh MCP health or capability-router check has not run, **when** guidance discusses readiness, **then** it avoids claiming current health beyond the available snapshot.
- **Given** OpenKit runtime/CLI capability checks pass, **when** evidence is reported, **then** it labels the evidence as `runtime_tooling`, `compatibility_runtime`, `global_cli`, `documentation`, or `package` as appropriate and not `target_project_app`.
- **Given** no target project app-native commands exist, **when** validation is summarized, **then** target-project application validation is explicitly marked unavailable.

### Documentation And Operator Guidance

- **Given** maintainers inspect docs for this capability, **when** they read operator/maintainer guidance, **then** they can identify advisory router behavior, lazy activation, compact summary expectations, role/stage boundaries, status vocabulary, custom MCP visibility, stale-runtime caveats, and validation-surface boundaries.
- **Given** docs include examples of session-start guidance, **when** examples mention keys, MCPs, custom MCPs, or health output, **then** examples use redacted placeholders and do not include raw secrets or full catalogs.
- **Given** `openkit run` or hooks are affected by the final implementation, **when** product CLI help/docs are inspected, **then** they accurately describe session-start capability guidance without implying automatic skill/MCP execution.

## Edge Cases And Risks

- Workflow state is missing, stale, malformed, points to a done item, or has an unknown owner/stage.
- Capability metadata exists but skill metadata and MCP health data disagree.
- Skill metadata recommends an MCP that is disabled, custom-only, missing, degraded, or needs a key.
- Custom MCP config is present but invalid, disabled, conflicted with bundled ids, or not materialized for the active scope.
- Startup happens offline or with provider/network dependencies unavailable.
- Capability health checks are expensive or slow; eager checks could harm startup performance or consume context.
- Session-start output grows as catalogs grow unless bounded summary rules are enforced.
- Router language could accidentally sound mandatory or imply hidden execution.
- Role/stage mapping could accidentally encourage Master implementation, Product Lead technical design, or QA by the wrong role.
- Startup snapshot can become stale after the operator changes MCP config, secrets, install bundle, or workflow state mid-session.
- Redaction can fail if provider errors echo headers, query strings, env, or command arguments.
- Agents may misinterpret OpenKit capability readiness as proof of target-project app health unless validation-surface labels stay explicit.

## Error And Failure Cases

- If capability-router metadata cannot be loaded, guidance must report unavailable/degraded router guidance and continue with safe generic instructions.
- If skill-index metadata cannot be loaded, guidance must avoid skill-specific recommendations and point to the diagnostic path.
- If MCP health/status cannot be read, guidance must report unknown/unavailable MCP readiness and must not claim current MCP health.
- If workflow state cannot identify mode/stage/owner, guidance must avoid role-specific claims and display a stale/unknown workflow-state caveat.
- If custom MCP metadata is invalid or unsafe to display, guidance must summarize the issue without raw config or secret values.
- If a capability summary would exceed the compact guidance boundary, output must collapse to grouped counts/categories and explicit detail commands.
- If redaction cannot be guaranteed for a detail source, guidance must fail closed for that detail and show a sanitized error.
- If product CLI/session-start hook changes fail during `openkit run`, the session must not falsely claim capability guidance was initialized successfully.

## Open Questions And Assumptions

- Assumption: FEATURE-947 provides structured skill metadata that can be consumed for role/stage-aware guidance without parsing full skill bodies.
- Assumption: FEATURE-948 custom MCP metadata includes enough origin/ownership/status information to show custom entries without mixing them into bundled MCPs.
- Assumption: `needs-key` is a user-facing caveat over the existing `not_configured` status vocabulary, not a new canonical status enum unless Solution Lead explicitly justifies one while preserving current vocabulary.
- Assumption: exact summary size limits and ranking strategy are Solution Lead-owned, but the product requirement is bounded output with no full catalog dumps.
- Open question for Solution Lead: choose the exact session-start/runtime surfaces that own the compact guidance text and decide whether `openkit doctor` needs additive capability-router checks.
- Open question for Solution Lead: define whether startup uses only cached/read-model status or performs any fresh lightweight health checks, while preserving context economy and explicit validation-surface labels.

## Success Signal

- Agents starting an OpenKit session see a compact, role/stage-aware capability guidance snapshot that tells them when to call capability-router, skill-index, and MCP health tools; the guidance remains advisory and lazy, shows unavailable/degraded/needs-key/custom/stale caveats, avoids full catalog dumps and raw secrets, preserves workflow role boundaries, and reports OpenKit capability validation without claiming target-project application validation.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `runtime_tooling` | Validate capability-router, skill-index, runtime-summary, MCP health/status, and session-start guidance helpers produce compact role/stage-aware recommendations; verify advisory wording, lazy activation, status/caveat handling, custom MCP labeling, stale snapshot caveats, and secret redaction. |
| `compatibility_runtime` | Validate workflow-state/status/resume/readiness/evidence records can preserve or expose guidance evidence with correct surface labels; verify missing/stale workflow state is reported honestly and does not mutate lane/stage semantics. |
| `documentation` | Validate operator/maintainer docs, runbooks, and examples explain compact guidance, explicit follow-up tool calls, no automatic skill/MCP activation, role boundaries, custom MCP visibility, stale-runtime caveats, no raw secrets, and target-project validation boundaries. |
| `global_cli` | If session-start hooks, `openkit run`, or `openkit doctor` output are affected, validate product CLI behavior: startup guidance appears when expected, remains compact, does not run hidden skill/MCP actions, labels stale/unavailable capability state, and preserves redaction. If no `openkit doctor` behavior changes, document that doctor-specific validation is not applicable. |
| `package` | If packaged session-start assets, bundled metadata, or install-bundle guidance are affected, validate source/package synchronization so installed users receive the same compact guidance contract. |
| `target_project_app` | Unavailable unless a separate target project defines app-native build/lint/test/smoke commands; OpenKit capability-router, CLI, runtime, hook, MCP, package, or documentation checks must not be reported as target application validation. |

## Handoff Notes For Solution Lead

- Preserve FEATURE-941 secret safety, status vocabulary, MCP scope semantics, and direct OpenCode caveats.
- Preserve FEATURE-945 wizard behavior; this feature may point users to wizard/configure paths but must not create a new setup wizard or secret-management flow.
- Preserve FEATURE-947 skill metadata as the source for role/stage/trigger/recommended-MCP guidance; do not parse or preload full skill bodies into session-start prompts.
- Preserve FEATURE-948 custom MCP ownership/origin labeling, conflict safety, and raw-secret avoidance.
- Design the exact ranking, grouping, and summary-size boundary for compact guidance; make the boundary testable and resilient as catalogs grow.
- Explicitly decide which surfaces are startup-only snapshots versus fresh checks and include stale/refresh messaging in the solution.
- Keep router guidance advisory: no hidden tool calls, no hidden skill activation, and no role-boundary reassignment.
- Plan validation separately for `runtime_tooling`, `compatibility_runtime`, `documentation`, conditional `global_cli`, conditional `package`, and unavailable `target_project_app`.
- Ensure Code Review and QA focus on context economy, lazy activation, role/stage correctness, custom MCP labeling, unavailable/degraded/needs-key/stale caveats, secret redaction, and validation-surface honesty.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, goals/non-goals, users/journeys, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, assumptions/open questions, and Solution Lead handoff notes for `product_to_solution` review.
