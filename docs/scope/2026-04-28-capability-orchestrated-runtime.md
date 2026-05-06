---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-953
feature_slug: capability-orchestrated-runtime
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
source_context:
  - User-approved brainstorm direction: Governed Autonomous Capability Runtime
  - Existing capability platform work: FEATURE-941, FEATURE-947, FEATURE-949, FEATURE-950, FEATURE-960
  - Canonical workflow and runtime-surface contracts under context/core/
---

# Scope Package: Capability-Orchestrated Runtime

OpenKit should become a governed autonomous capability runtime that registers available MCPs and skills by default as metadata, ranks the best capability path for the active task, selectively loads only the skills or tools that are eligible and useful, and leaves visible evidence and caveats for every capability decision while preserving workflow approvals, policy gates, secret redaction, and target-project validation separation.

## Goal

- Make OpenKit capability use proactive enough that agents do not manually rediscover the same MCP, skill, tool, and validation options on every task.
- Keep autonomy governed: capability ranking, selective skill loading, local tool use, external MCP use, browser MCP use, and mutating actions must be bounded by explicit policy, status, role/stage, and evidence rules.
- Improve operator trust through a readiness dashboard and an evidence/caveat ledger that show what was available, selected, skipped, blocked, stale, external, browser-backed, mutating, or target-project-app unavailable.
- Preserve the current `quick`, `migration`, and `full` workflow contract; capability orchestration informs work but does not replace lane selection, stage ownership, approval gates, code review, QA, or explicit verification evidence.

## Target Users

- **OpenKit operator:** wants OpenKit to use the right built-in capabilities automatically enough to reduce manual setup/discovery, while still showing readiness and safety caveats.
- **In-session agent:** needs ranked capability guidance and selective skill loading without full catalog prompt bloat or hidden external execution.
- **Product Lead, Solution Lead, Fullstack Agent, Code Reviewer, QA Agent, and Quick Agent:** need capability decisions to respect their role/stage responsibilities.
- **Security-conscious operator:** needs mutating, destructive, external, browser, and credentialed capabilities to remain policy-gated and redacted.
- **Maintainer/reviewer/QA owner:** needs inspectable evidence proving capability decisions are explainable, bounded, and validated on the correct surface.

## Problem Statement

OpenKit now has bundled MCPs, custom MCP management, skill metadata, capability routing, session-start guidance, policy-gated commands, scan evidence conventions, and validation-surface vocabulary. These surfaces are useful, but agents still need too much manual decision-making to know which capability to use, when a skill is safe to load, when an MCP is merely metadata or missing configuration, and what evidence or caveat should be recorded. Without governed orchestration, capability growth risks becoming either underused or overtrusted. OpenKit needs a product-level runtime behavior where capabilities are registered by default, ranked automatically, used selectively, and governed by explicit status, safety, externality, evidence, and validation boundaries.

## In Scope

### Registered-By-Default Capability Metadata

- Register bundled MCPs, custom MCPs, runtime tools, bundled skills, and metadata-only skills as capability metadata by default for inventory, ranking, and readiness purposes.
- Registration must distinguish bundled MCPs, custom MCPs, runtime tools, skill metadata, install-bundled skills, metadata-only skills, and unavailable/stub skill records.
- Registration must not mean skill-body loading, MCP tool execution, browser automation, external provider calls, workflow mutation, or user approval bypass.
- Registered capability entries must carry enough user-visible state to support ranking and dashboard output: capability family, surface, status, freshness, caveats, policy labels, external/browser/local/mutating risk labels where relevant, and next actions.

### Automatic Capability Ranking

- Rank candidate capabilities for the active request using observable product signals such as task intent, current lane/mode, current stage, current role/owner, capability status, skill maturity, support level, trigger match, recommended MCP readiness, external/browser/mutating risk, freshness, and validation-surface fit.
- Ranking output must be explainable: users and reviewers can see why a capability was recommended, skipped, downgraded, blocked, or marked unavailable.
- Ranking must prefer available, stable, local, non-mutating, role-appropriate, stage-appropriate capabilities before preview, external, browser, mutating, not-configured, degraded, compatibility-only, or metadata-only paths unless the task explicitly requires the latter.
- Ranking must never treat missing keys, disabled MCPs, placeholders, stale snapshots, unsupported dependencies, or metadata-only skills as fully usable capability readiness.

### Selective Skill Loading

- Load skill bodies only when a ranked, eligible skill is needed for the current task or stage; do not load the entire skill catalog into startup or normal request context.
- Keep metadata-only skill records discoverable and rankable as metadata, but not loadable until a real bundled or user-accessible skill body exists.
- If a metadata-only or unavailable skill is the best semantic match, the runtime/user experience must show that it is not loadable and offer safe fallback guidance instead of pretending it was used.
- Selective loading must preserve role boundaries: Product Lead gets scope/requirements skills, Solution Lead gets design/planning skills, Fullstack gets implementation/debugging skills, Code Reviewer gets review/scan skills, QA gets verification/evidence skills, and Quick Agent stays single-owner in quick mode.

### Safe Local Tool Use

- Prefer safe local OpenKit/runtime tools and repository-local built-in tools for codebase inspection, workflow state, evidence capture, graph/syntax/AST/search, scan, and project-native validation probes when they are available and appropriate.
- Local read-only or diagnostic actions may be recommended or used only when they fit the current role/stage and report their validation surface honestly.
- Local mutating actions, file writes, command execution, package operations, git operations, release/deploy operations, and destructive/system-impacting commands must stay governed by existing safety protocol and command permission policy.
- OpenKit runtime/tooling checks must not be presented as target-project application build/lint/test proof.

### Conditional External And Browser MCP Use

- External, networked, provider-backed, browser, and remote/custom MCP capabilities may be recommended or used only when they are relevant to the task, enabled for the active scope, configured with required secrets or dependencies, permitted by policy, and accompanied by visible caveats.
- Browser MCPs and browser verification may assist implementation, debugging, or QA evidence, but they do not declare QA complete by themselves.
- External research or documentation MCPs must not be called merely to rank capabilities or refresh readiness unless the user/task or a governed health-check path explicitly warrants it.
- All external/browser outputs must preserve secret redaction, provider payload sanitization, stale/freshness labels, and validation-surface labels.

### Policy Gates For Mutating Or Dangerous Capabilities

- Apply explicit policy gates before capabilities that can mutate files, workflow state, task boards, configs, secrets, browser state, repository state, releases, deployments, databases, or local system state.
- Dangerous command categories from the command permission policy remain confirmation-required or explicitly degraded/unsupported where upstream OpenCode cannot prove enforcement.
- Git capability use must preserve existing git safety protocol: no commit, amend, destructive git, or force-push behavior without explicit user intent and the existing safety checks.
- Policy-gated capabilities must report blocked, needs-confirmation, degraded, unsupported-granularity, or unavailable states without silently downgrading safety.

### Evidence/Caveat Ledger

- Maintain an inspectable capability decision ledger for ranked, selected, loaded, executed, skipped, blocked, degraded, stale, and failed capability decisions.
- Ledger entries must include the capability identity/family, action type, decision outcome, reason, caveats, freshness, policy gate result where relevant, validation surface, and artifact/evidence references where available.
- Ledger entries must not contain raw secrets, tokens, headers, cookies, env dumps, provider payloads, or sensitive target-project data.
- Ledger evidence must help Code Reviewer and QA verify that capability orchestration followed product rules without requiring them to reconstruct hidden runtime behavior.

### Readiness Dashboard

- Provide an operator/maintainer-facing readiness view that summarizes capability families, status distribution, stale/unknown state, policy-gated capabilities, metadata-only/unavailable skills, external/browser readiness, custom/bundled separation, and target-project validation availability.
- The dashboard must use existing status vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`.
- Dashboard output must include refresh/next-action guidance and must distinguish startup snapshots, cached/read-model state, and fresh checks.
- Dashboard output must avoid full raw catalog dumps by default while making detailed inventory reachable through explicit follow-up surfaces.

### Target-Project Validation Separation

- Preserve `target_project_app` as a separate validation surface that applies only when the target project defines app-native build, lint, test, smoke, or regression commands/config.
- Capability ranking, MCP readiness, browser checks, OpenKit doctor, workflow-state checks, scan tooling, package checks, and documentation checks must never be reported as target-project application validation.
- When target-project app-native validation is absent, the runtime, dashboard, ledger, handoffs, and QA artifacts must mark it unavailable rather than substituting OpenKit runtime proof.

## Non-Goals

- Do not add a new workflow lane, runtime mode, role, stage, approval gate, or replacement workflow contract.
- Do not make Master Orchestrator own product scope, technical design, implementation, review, QA, or evidence judgment.
- Do not build generalized self-directed agent autonomy that invents tasks, approves gates, closes work, or mutates project state without the current workflow owners.
- Do not auto-load every skill, dump full catalogs into prompts, or execute MCP-backed tools just because metadata matches.
- Do not create a marketplace, remote capability registry, provider onboarding business flow, team sharing model, or cloud secret-sync feature.
- Do not loosen secret storage/redaction rules or treat placeholders as configured credentials.
- Do not bypass OpenCode prompts through a prompt broker, pseudo-terminal auto-confirm layer, or hidden approval-memory feature.
- Do not claim target-project application validation from OpenKit capability, runtime, package, or documentation checks.

## Out of Scope

- Low-level architecture, data model, algorithm, module, storage, or library choices for implementing ranking, dashboards, ledgers, gates, or capability envelopes.
- Changing the bundled MCP catalog membership, custom MCP lifecycle semantics, secret backend precedence, or skill metadata schema except where Solution Lead finds a narrow additive change necessary to satisfy this scope.
- Adding new external providers, browser providers, MCP servers, or skill bodies as part of this scope unless Solution Lead identifies them as already approved dependencies needed for acceptance.
- Implementing new target-project build, lint, test, smoke, or regression commands for arbitrary target applications.
- Replacing existing code review, QA, scan triage, workflow-state, or approval-gate evidence requirements.
- Making direct OpenCode launches equivalent to `openkit run` for OpenKit-managed secret loading or capability orchestration.

## Main Flows

### User Stories

1. **As an OpenKit operator, I want capabilities to be registered and summarized by default, so that I can see what OpenKit can use without editing config or reading every catalog file.**
2. **As an in-session agent, I want OpenKit to rank relevant capabilities automatically, so that I can choose or receive the right skill/tool path without manual rediscovery.**
3. **As a role agent, I want only the necessary skill bodies loaded for my current task, so that context stays focused and role boundaries are preserved.**
4. **As a security-conscious operator, I want dangerous or mutating capabilities to be policy-gated, so that capability orchestration cannot silently delete, publish, force-push, or mutate state.**
5. **As a user working on a project, I want external and browser MCP use to be conditional and visible, so that network/browser actions happen only when useful, configured, and safe.**
6. **As a maintainer, I want metadata-only skills to remain discoverable but not loadable, so that unavailable guidance is not mistaken for shipped functionality.**
7. **As a Code Reviewer or QA Agent, I want a capability evidence/caveat ledger, so that I can verify what the runtime recommended, loaded, skipped, blocked, or executed.**
8. **As an operator or maintainer, I want a readiness dashboard, so that I can diagnose capability setup, stale state, policy gates, and missing target-project validation quickly.**

### User / Operator Experience

- On install, upgrade, or `openkit run`, the operator can inspect a capability readiness summary without manually opening catalog files.
- At session start, OpenKit remains compact: it can summarize capability readiness and route hints, but detailed inventory and skill bodies require explicit follow-up or governed selective loading.
- During a task, the in-session experience presents ranked capability choices or selected capabilities with reasons, caveats, and policy status rather than opaque automation.
- If a capability is unavailable, not configured, metadata-only, disabled, stale, preview, external, browser-backed, or policy-gated, the user sees a next action instead of a false success.
- If a mutating/dangerous capability requires confirmation or is blocked, the user sees the gate outcome before the action proceeds.
- Operators can use the readiness dashboard to answer: what can OpenKit use locally, what requires secrets or dependencies, what is browser/external, what is policy-gated, what is stale, what is metadata-only, and whether target-project validation exists.

## Business Rules

### Capability Registration And Status

1. Capability registration is metadata readiness, not activation.
2. Registered capabilities must preserve family and ownership distinctions, including bundled MCP, custom MCP, runtime tool, skill, metadata-only skill, browser capability, external capability, policy-gated capability, and target-project validation probe.
3. Use the existing runtime state vocabulary exactly: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, `not_configured`.
4. Skill maturity (`stable`, `preview`, `experimental`) must remain separate from runtime capability state.
5. Metadata-only, stub, absent-file, or install-unbundled skills must never be represented as stable loadable runtime skills.
6. Secret/key state may be reported only as redacted presence, missing, needs-key, or not-configured caveats.

### Ranking And Selection

1. Ranking must be explainable and bounded; it must expose reasons and caveats for top recommendations and important exclusions.
2. Ranking must consider current mode, stage, role, task intent, capability status, maturity/support, policy risk, local/external/browser class, freshness, and validation-surface fit.
3. Ranking must prefer local, available, stable, non-mutating, role/stage-appropriate capabilities unless the task explicitly requires a riskier or external path.
4. Ranking must not execute provider calls, browser automation, mutating tools, or skill-body loads merely to compute the ranking.
5. Capability orchestration may recommend a fallback when the best semantic match is unavailable, metadata-only, disabled, or not configured, but it must not silently substitute an unrelated capability as if it were equivalent.

### Selective Loading And Execution

1. Skill bodies load only after selection criteria pass; full skill catalogs must not be loaded by default.
2. Selective skill loading must be visible in the ledger or conversation/runtime evidence.
3. A loaded skill does not imply any recommended MCP is configured or executed; recommended MCP caveats remain visible.
4. MCP/tool execution remains explicit and governed by capability status, role/stage fit, and policy gates.
5. Browser and external capabilities require relevance plus readiness; they are not default background actions.

### Governance And Safety

1. Mutating/dangerous capabilities require policy gate evaluation before use.
2. Confirmation-required command categories must preserve FEATURE-960 safety expectations and upstream-degraded caveats.
3. Capability orchestration must never approve workflow gates, mark QA complete, close unresolved issues, or mutate work-item state outside existing owner authority.
4. All capability outputs must preserve secret redaction and provider payload sanitization.
5. Stale or cached capability state must be labeled and must include a refresh path.

### Evidence, Dashboard, And Validation

1. Every selected, loaded, skipped, blocked, degraded, or failed capability decision that affects work should leave inspectable evidence or caveat output.
2. The readiness dashboard is a diagnostic/readiness surface, not proof that a recommended capability has run.
3. The evidence/caveat ledger is review and QA support, not a replacement for app-native tests, code review, or QA judgment.
4. Validation claims must identify the actual surface validated: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, `package`, or `target_project_app`.
5. If no target-project app-native validation exists, the dashboard, ledger, QA report, and handoff must say `target_project_app` validation is unavailable.

## Acceptance Criteria Matrix

### AC1 — Capabilities Register By Default As Metadata

- **Given** OpenKit has bundled MCPs, custom MCPs, runtime tools, bundled skills, and metadata-only skill records
- **When** capability readiness is initialized or inspected
- **Then** those capabilities are discoverable as metadata with family, ownership, status, surface, freshness, caveats, and next-action information
- **And** registration does not load skill bodies, execute MCPs, call providers, run browser automation, or mutate workflow state.

### AC2 — Registration Distinguishes Capability Families

- **Given** bundled, custom, skill, metadata-only, browser, external, local, policy-gated, and target-project validation capabilities are present
- **When** inventory, ranking, dashboard, or ledger output references them
- **Then** the output distinguishes their family and ownership clearly
- **And** custom MCPs are not presented as bundled defaults.

### AC3 — Ranking Produces Explainable Recommendations

- **Given** an in-session request has task intent, role, lane, and stage context
- **When** capability ranking runs
- **Then** it returns a bounded ordered set of candidate capabilities with reasons and caveats
- **And** it explains why unavailable, not-configured, degraded, preview, compatibility-only, metadata-only, or policy-gated matches were skipped or downgraded.

### AC4 — Ranking Respects Role And Stage Boundaries

- **Given** the active role is Product Lead, Solution Lead, Fullstack Agent, Code Reviewer, QA Agent, Master Orchestrator, or Quick Agent
- **When** capability recommendations are produced
- **Then** recommended skills/tools match that role's current responsibilities
- **And** recommendations do not assign implementation, product scope, technical design, review, QA, or approval authority to the wrong role.

### AC5 — Ranking Prefers Safer Local Available Capabilities

- **Given** both safe local available capabilities and external/browser/mutating/preview alternatives could apply
- **When** the task does not require the riskier alternative
- **Then** ranking prefers stable local non-mutating capabilities first
- **And** riskier alternatives remain visible only as caveated options or next actions where useful.

### AC6 — Metadata-Only Skills Are Discoverable But Not Loadable

- **Given** a metadata-only, stub, absent-file, or install-unbundled skill semantically matches a request
- **When** capability ranking or selection evaluates it
- **Then** the skill may appear with metadata-only/unavailable caveats
- **And** it is not loaded as a skill body
- **And** the output offers a safe fallback or next action.

### AC7 — Selective Skill Loading Avoids Prompt Bloat

- **Given** many skills are registered
- **When** a task begins or session-start guidance is displayed
- **Then** OpenKit does not load the full skill catalog or all skill bodies
- **And** only selected eligible skill bodies are loaded after the selection criteria pass.

### AC8 — Skill Loading Is Visible And Attributable

- **Given** a skill body is selectively loaded for a task
- **When** reviewers inspect the conversation, runtime evidence, or ledger
- **Then** they can identify which skill was loaded, why it was selected, and any MCP/status caveats that remained.

### AC9 — Safe Local Tool Use Reports Real Surfaces

- **Given** a local OpenKit/runtime tool is recommended or used for workflow state, code intelligence, scan, evidence, or project-native validation probing
- **When** its result is reported
- **Then** the result labels the correct validation surface
- **And** OpenKit runtime/tooling evidence is not labeled as target-project application build/lint/test evidence.

### AC10 — Mutating Capabilities Are Policy-Gated

- **Given** a capability can mutate files, configs, secrets, workflow state, task boards, browser state, repository state, releases, deployments, databases, or local system state
- **When** the runtime considers using it
- **Then** a policy gate is evaluated before use
- **And** blocked, confirmation-required, degraded, unsupported, or approved outcomes are visible before the action proceeds.

### AC11 — Dangerous Command Safety Is Preserved

- **Given** a ranked capability would invoke delete/data-loss commands, destructive git, force push, publish/deploy/release, database destructive, or privileged/system-impacting operations
- **When** policy support is available
- **Then** the command remains confirmation-required
- **And** when upstream support is degraded or too coarse, the limitation is visible and not treated as safe automation.

### AC12 — External MCP Use Is Conditional

- **Given** an external or provider-backed MCP such as documentation, web search, public code search, or a remote custom MCP could help the task
- **When** ranking or selection evaluates it
- **Then** it is recommended or used only if relevant, enabled, configured, policy-allowed, and caveated
- **And** missing keys, placeholders, disabled state, network/provider risk, or not-configured state prevents false readiness claims.

### AC13 — Browser MCP Use Is Conditional And Non-Authoritative

- **Given** a browser MCP or browser verification capability is available
- **When** implementation, debugging, or QA work considers using it
- **Then** browser use is recommended or executed only when a browser-relevant task exists and readiness conditions are met
- **And** browser evidence does not by itself mark QA complete or replace app-native validation.

### AC14 — Policy Blocks And Skips Produce Next Actions

- **Given** a capability is blocked by policy, missing configuration, missing dependencies, stale state, disabled scope, unavailable metadata, or safety risk
- **When** output reports the decision
- **Then** the user receives a concise reason and next action
- **And** no hidden fallback claims the blocked capability succeeded.

### AC15 — Evidence/Caveat Ledger Records Capability Decisions

- **Given** capability orchestration ranks, selects, loads, executes, skips, blocks, degrades, or fails a capability decision that affects work
- **When** evidence is inspected
- **Then** an inspectable ledger or equivalent evidence output records capability identity, decision outcome, reason, caveats, freshness, policy gate outcome where relevant, validation surface, and artifact/evidence refs where available.

### AC16 — Ledger And Outputs Redact Sensitive Data

- **Given** secrets, tokens, auth headers, cookies, env vars, provider payloads, browser data, or custom MCP auth placeholders may be present
- **When** dashboard, ledger, ranking, doctor, runtime summary, docs examples, or workflow artifacts are produced
- **Then** raw sensitive values do not appear
- **And** key state is represented only as redacted/missing/not-configured/needs-key style caveats.

### AC17 — Readiness Dashboard Summarizes Capability Health

- **Given** an operator or maintainer wants capability readiness
- **When** they inspect the readiness dashboard or equivalent summary
- **Then** it shows capability family summaries, status distribution, policy-gated items, metadata-only/unavailable skills, external/browser readiness, stale/unknown state, custom/bundled separation, and next actions
- **And** it uses the standard capability status vocabulary.

### AC18 — Dashboard Distinguishes Fresh, Cached, And Stale State

- **Given** capability status may come from startup snapshots, cached read models, or fresh checks
- **When** the readiness dashboard or runtime summary displays status
- **Then** freshness is visible
- **And** a refresh path is provided where current readiness is required.

### AC19 — Detailed Inventory Requires Explicit Follow-Up

- **Given** the capability catalog is large
- **When** startup guidance, default dashboard, or ranking output is displayed
- **Then** the output stays bounded and summary-oriented
- **And** detailed skill/MCP/tool inventory is available only through explicit follow-up surfaces.

### AC20 — Target-Project Validation Remains Separate

- **Given** OpenKit capability checks, MCP health, browser checks, scan tools, workflow-state checks, package checks, or documentation checks pass
- **When** validation evidence is summarized
- **Then** those checks are labeled with their actual OpenKit validation surface
- **And** they are not reported as target-project app-native build/lint/test validation.

### AC21 — Missing App-Native Validation Is Reported As Unavailable

- **Given** a target project has no declared build, lint, test, smoke, or regression command/config
- **When** dashboard, ledger, QA, or handoff output discusses target-project validation
- **Then** `target_project_app` validation is explicitly marked unavailable
- **And** OpenKit runtime or CLI checks are not substituted as equivalent evidence.

### AC22 — Degraded Or Missing Capability Metadata Fails Safely

- **Given** capability metadata, skill metadata, MCP readiness, workflow state, or policy state is missing, malformed, stale, or unreadable
- **When** capability orchestration runs
- **Then** it reports degraded/unavailable/unknown state with safe fallback guidance
- **And** it does not invent readiness or proceed through hidden risky actions.

### AC23 — Workflow Contract Is Preserved

- **Given** capability orchestration is active
- **When** work proceeds through quick, migration, or full delivery
- **Then** existing lane/stage names, stage owners, approval gates, escalation rules, review, QA, and evidence expectations remain intact
- **And** capability orchestration does not approve gates or mark work complete.

### AC24 — Operator Documentation Explains Governed Autonomy

- **Given** an operator or maintainer reads updated guidance for this feature
- **When** they look for capability orchestration behavior
- **Then** docs explain registered-by-default metadata, ranking, selective skill loading, local/external/browser conditions, policy gates, metadata-only handling, evidence/caveat ledger, readiness dashboard, redaction, stale-state caveats, and target-project validation separation.

## Edge Cases

- Workflow state is missing, points to a done item, has unknown role/stage, or conflicts with the current request.
- Capability metadata and runtime readiness disagree, such as a skill recommending a disabled/not-configured MCP.
- The top semantic skill match is metadata-only, preview, experimental, compatibility-only, absent from the install bundle, or missing its backing MCP.
- A capability is locally available but stale, unindexed, read-only, partially degraded, or unable to validate the requested language/project type.
- External MCP is configured but offline, rate-limited, disabled in the active scope, missing a key, or returning sensitive provider errors.
- Browser MCP is installed but no relevant app/browser context exists, dependencies are missing, or automation would affect user state.
- A local tool is normally safe but the requested operation would mutate files, workflow state, git state, or external resources.
- Command permission policy cannot express a dangerous operation precisely because upstream matching is too broad or too narrow.
- Readiness dashboard shows too much information as catalogs grow and risks becoming a full catalog dump.
- Ledger evidence grows large enough that reviewers need summaries with artifact references rather than raw event walls.
- Target-project validation probes are unavailable even though OpenKit runtime checks are healthy.

## Error And Failure Cases

- Capability registration fails: report unavailable/degraded metadata state and continue with safe generic guidance.
- Ranking cannot determine role/stage/task intent: report unknown context and avoid role-specific or risky recommendations.
- Selective skill loading targets an unavailable/metadata-only skill: do not load; record skipped/unavailable with fallback guidance.
- Policy gate denies or cannot verify a mutating/dangerous capability: do not execute silently; report blocked/degraded/needs-confirmation state.
- External/browser MCP readiness cannot be verified: do not claim current external/browser availability; report stale/unavailable/degraded state.
- Redaction cannot be guaranteed for a capability output: fail closed for that detail and show a sanitized error.
- Dashboard or ledger cannot persist or display evidence: report missing evidence surface and do not claim the capability decision is review-ready.
- Target-project app validation is requested but no app-native commands/config exist: report unavailable `target_project_app` validation.

## Risks And Constraints

- **Over-automation risk:** ranking and selective loading could be mistaken for permission to execute tools or mutate state; policy gates and visible evidence are required.
- **False readiness risk:** registered metadata could be confused with configured/available capability; status, freshness, and caveats must remain prominent.
- **Prompt/context bloat risk:** capability catalogs are large; default outputs must stay bounded and detail paths explicit.
- **Safety risk:** local tools, browser automation, git, package, deploy, release, and custom MCP capabilities can have side effects; mutating/dangerous actions must remain governed.
- **Privacy/security risk:** external and browser MCPs can expose context or secrets; conditional use, redaction, and provider-payload sanitization are non-negotiable.
- **Validation confusion risk:** operators and agents may overclaim OpenKit runtime readiness as target-project app validation; surface labels must be repeated in dashboard, ledger, QA, and handoff outputs.
- **Schema/status drift risk:** adding new capability concepts could fragment status vocabulary; this scope requires reusing existing states unless a later approved scope changes them.
- **Current-vs-planned risk:** the feature must not claim capabilities are available before implementation and validation make them inspectable.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `global_cli` | Validate operator-visible readiness behavior where product CLI surfaces are affected, including `openkit run`, `openkit doctor`, capability readiness summaries, and policy/degraded caveats. |
| `in_session` | Validate ranked capability guidance, selective skill loading behavior, role/stage guardrails, explicit capability use, and bounded default output in active OpenKit sessions. |
| `runtime_tooling` | Validate capability inventory/router/health/skill-index/MCP/readiness/ledger behavior, status vocabulary, metadata-only handling, safe local tooling, external/browser caveats, policy-gate reporting, and redaction. |
| `compatibility_runtime` | Validate workflow-state/status/resume/evidence surfaces can expose capability decisions, ledgers, caveats, and unavailable target-project validation without mutating workflow authority. |
| `documentation` | Validate operator, maintainer, governance, and runbook docs explain governed autonomy, ranking, selective loading, policy gates, dashboard, ledger, status vocabulary, redaction, stale-state caveats, and validation-surface separation. |
| `package` | Validate any shipped capability metadata, bundled skill metadata, install-bundle assets, policy files, or dashboard/ledger docs remain synchronized with source and exclude generated secret/runtime artifacts. |
| `target_project_app` | Available only when the target project declares real app-native build/lint/test/smoke/regression commands or config; otherwise explicitly unavailable and not replaceable by OpenKit capability checks. |

## Success Signal

- OpenKit can start and operate with capabilities registered by default as metadata, rank and select the right capability path for the active work, load only necessary eligible skills, gate mutating/dangerous/external/browser capabilities, and show a readiness dashboard plus evidence/caveat ledger that lets operators, reviewers, and QA understand what happened without overclaiming target-project validation or bypassing workflow authority.

## Open Questions

- Assumption: “Autonomous” in this feature means governed capability ranking, recommendation, selective loading, and safe execution support; it does not mean self-directed task creation, gate approval, or unrestricted background execution.
- Assumption: registered-by-default capability metadata can be read without external provider calls, browser automation, or skill-body loading.
- Assumption: existing status vocabulary and validation-surface labels remain canonical.
- Assumption: metadata-only skills remain discoverable but unavailable until a real skill body is shipped or otherwise accessible.
- Open question for Solution Lead: define the exact ranking weights and summary limits while preserving product requirements for explainability, bounded output, and safer-local preference.
- Open question for Solution Lead: determine which runtime or CLI surfaces should display the readiness dashboard and ledger summaries while avoiding duplicate sources of truth.
- Open question for Solution Lead: define the smallest acceptable evidence/caveat ledger granularity that satisfies review/QA without creating noisy event dumps.
- Open question for Solution Lead: determine how policy gates integrate with upstream OpenCode permission limitations and existing command safety protocols without introducing a prompt broker.

## Handoff Notes For Solution Lead

- Preserve the current three-lane workflow contract and role/stage ownership; capability orchestration must stay advisory/governed except where an explicitly selected safe capability is used inside the owning role's work.
- Treat registration, ranking, selective loading, policy gating, dashboard, and ledger behavior as product requirements; choose implementation details separately.
- Preserve prior MCP/skill work: secret redaction, custom/bundled separation, status vocabulary, metadata-only skill caveats, session-start boundedness, and target-project validation separation.
- Solution design must explicitly plan validation by surface and must not use OpenKit runtime or CLI evidence as target-project app-native validation.
- Code Review should check scope compliance first against acceptance criteria around no hidden activation, metadata-only handling, policy gates, external/browser conditions, ledger evidence, readiness dashboard, and validation-surface honesty.
- QA should require evidence that governed autonomy remains bounded: no full catalog prompt dumps, no hidden skill/MCP execution for ranking, no silent dangerous/mutating actions, no raw secrets, no role/gate authority bypass, and no target-project validation overclaim.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business rules, user/operator experience, acceptance criteria, edge/failure cases, risks, validation expectations, open questions, and Solution Lead handoff notes for `product_to_solution` review.
