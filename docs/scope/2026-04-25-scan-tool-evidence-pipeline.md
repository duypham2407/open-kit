---
artifact_type: scope_package
version: 1
status: draft
feature_id: FEATURE-939
feature_slug: scan-tool-evidence-pipeline
owner: ProductLead
approval_gate: product_to_solution
---

# Scope Package: Scan Tool Evidence Pipeline

## Goal

Standardize OpenKit scan-tool evidence so Code Reviewer and QA can invoke rule/security scans when available, capture inspectable evidence, classify noisy findings and false positives, apply gates consistently, and report manual overrides clearly without blurring OpenKit runtime/tool validation with target-project application validation.

## Target Users

- Code Reviewer agents that must use rule and security scan evidence before finalizing review output.
- QA agents that must verify scan evidence before recommending closure.
- Fullstack agents that need clear pre-review scan expectations before handoff.
- Master Orchestrator and operators that rely on stage gates, policy readiness, and closeout summaries to decide whether a full-delivery item can advance.
- Maintainers who tune OpenKit runtime tools, bundled scan rules, agent instructions, and workflow-state evidence contracts.

## Problem Statement

FEATURE-938 exposed that OpenKit's scan/tool evidence path is not trustworthy enough for routine delivery gates: the quality scan produced 2,301 warnings that QA had to manually triage as non-blocking noise, the security scan reported a test-fixture placeholder as a false positive, and direct `tool.rule-scan` / `tool.security-scan` calls were unavailable in the QA tool namespace, forcing substitutes and manual overrides. OpenKit needs a product-level evidence pipeline that makes scan availability, evidence capture, finding classification, gate behavior, override usage, and reporting surfaces explicit and inspectable while preserving current lane semantics and role boundaries.

## In Scope

- Define desired behavior for direct rule/security scan invocation from the roles and stages that require scan evidence, especially Code Reviewer and QA.
- Define how scan evidence must be captured and labeled when a scan runs, fails, is unavailable, or is substituted.
- Define how noisy quality findings should be summarized, grouped, triaged, and reported without hiding the raw scan artifact.
- Define how false positives, including test-fixture security findings, should be classified and documented.
- Define gate behavior for successful scans, blocking findings, non-blocking noisy findings, false positives, unavailable tools, and manual overrides.
- Define manual override clarity requirements so an override is visibly different from successful direct tool evidence.
- Define reporting expectations for Code Reviewer output, QA artifacts, runtime/workflow-state inspection, closeout summaries, and operator/maintainer documentation where relevant.
- Preserve the separation between OpenKit runtime/tool scan evidence and target-project application build/lint/test validation.
- Preserve existing Quick Task, Migration, and Full Delivery lane semantics, approval gates, role boundaries, and current workflow-state vocabulary.

## Out of Scope

- Implementing code, choosing storage schemas, changing specific tool APIs, selecting exact rule pack algorithms, or prescribing the internal architecture.
- Replacing Semgrep with another scanner or adding a hosted/external scanning service dependency.
- Requiring network-dependent upstream rule packs for required gate evidence.
- Assuming target-project app-native build, lint, test, package-manager, CI, or deployment commands exist.
- Treating OpenKit runtime scans as proof that a target application passed its own validation.
- Fixing Code Reviewer empty-output or reviewer-agent reliability issues except where they directly affect scan evidence routing, availability reporting, or gate evidence visibility.
- Introducing a new lane, runtime mode, stage name, approval gate family, or unrestricted parallel execution behavior.
- Requiring all quality scans to return zero warnings before work can advance.
- Suppressing all warnings by default or hiding full scan output from maintainers.

## User Stories And BDD Acceptance Criteria

### Story 1 — Direct scan invocation availability

As a Code Reviewer or QA Agent, I want `tool.rule-scan` and `tool.security-scan` to be callable or to fail with structured availability information, so that I can satisfy evidence gates without guessing whether the scan tool exists in my namespace.

#### AC1.1 Required scan tools are available where gates require them

- **Given** a full-delivery work item is in a stage where Code Reviewer or QA must gather scan evidence
- **And** the local OpenKit runtime can provide the required scan tooling
- **When** the stage owner invokes the required rule and security scan tools
- **Then** the tools are directly callable from that role's session context
- **And** each invocation returns an inspectable result state instead of an empty or silent response.

#### AC1.2 Unavailable scan tools fail visibly

- **Given** a required scan tool is not registered, not configured, missing dependencies, or unavailable in the current role namespace
- **When** Code Reviewer or QA attempts to collect required scan evidence
- **Then** the output identifies the tool as `unavailable`, `degraded`, or `not_configured` using OpenKit's standard capability vocabulary
- **And** the output includes the reason or limitation known at the time
- **And** the output points to the fallback or manual-override path instead of pretending the scan succeeded.

### Story 2 — Evidence capture and inspectability

As a delivery agent, I want every scan run or scan substitute to create inspectable evidence, so that stage gates and later QA reports do not depend on unstated conversation context.

#### AC2.1 Successful scan evidence is captured

- **Given** a rule scan or security scan runs successfully
- **When** the agent records handoff, review, QA, or closeout evidence
- **Then** the evidence identifies the validation surface as OpenKit `runtime_tooling` or `compatibility_runtime`, as applicable
- **And** the evidence identifies the tool, scan kind, target scope summary, rule/config source, result state, finding counts, severity or category summary, triage summary, and available output artifact references
- **And** the evidence is visible through the normal workflow evidence/reporting surfaces used for the active lane.

#### AC2.2 Substitute scan evidence is captured separately from direct tool evidence

- **Given** direct `tool.rule-scan` or `tool.security-scan` invocation is unavailable
- **And** an agent runs an allowed substitute scan path
- **When** the agent records evidence
- **Then** the evidence states that the direct tool was unavailable
- **And** the substitute evidence names what actually ran and what surface it validates
- **And** the substitute evidence is not reported as a successful direct tool invocation.

### Story 3 — Noisy quality finding triage

As a QA Agent or maintainer, I want high-volume quality findings to be grouped and classified, so that noisy scan output does not drown out actual blockers.

#### AC3.1 High-volume warnings are summarized before gate decisions

- **Given** a quality scan returns a large number of warnings, including cases similar to FEATURE-938's 2,301 warning scan
- **When** Code Reviewer or QA reports scan evidence
- **Then** the human-facing report groups findings by rule, severity or category, and relevance to the changed work
- **And** the report identifies which groups are blocking, non-blocking noise, or require follow-up
- **And** the report links or references the full raw output artifact when available
- **And** the report does not require users to read an untriaged wall of raw scan output to understand the gate decision.

#### AC3.2 Non-blocking noise remains traceable

- **Given** a finding group is classified as non-blocking noise
- **When** the work item advances
- **Then** the report records why the group did not block the stage
- **And** the finding group remains traceable for future rule tuning or maintenance follow-up.

### Story 4 — False-positive classification

As a maintainer, I want false positives to carry explicit rationale, so that real security issues are not dismissed casually and test-fixture placeholders do not block unrelated delivery.

#### AC4.1 False positives require contextual rationale

- **Given** a scan finding is classified as a false positive
- **When** Code Reviewer or QA records the classification
- **Then** the record includes the rule or finding identity, affected file or area, relevant context, false-positive rationale, behavior or security impact assessment, and whether follow-up is recommended
- **And** the classification is visible in the scan evidence report.

#### AC4.2 Test-fixture security placeholders can be non-blocking only with evidence

- **Given** a security scan flags a placeholder or fixture value, such as a token-looking string in a test fixture
- **When** an agent classifies the finding as a false positive
- **Then** the report explains why the value is not a real secret or exploitable security issue
- **And** the report distinguishes test-fixture context from production/runtime code context
- **And** the stage may advance only if no unclassified or true-positive security finding remains.

### Story 5 — Gate behavior and manual override clarity

As Master Orchestrator or an operator, I want scan gates to distinguish successful evidence, classified non-blockers, blockers, unavailable tools, and manual overrides, so that stage advancement is auditable.

#### AC5.1 Gate decisions use classified scan outcomes

- **Given** a stage transition requires scan evidence
- **When** scan evidence is evaluated
- **Then** the gate can pass when required scans ran or approved substitutes exist, all findings are classified, and no blocking or true-positive security finding remains unresolved
- **And** the gate must not pass when required scan evidence is missing, a required tool failed without substitute evidence or override, or a blocking finding remains unresolved.

#### AC5.2 Manual overrides are visibly exceptional

- **Given** a required scan tool is genuinely unavailable or cannot produce usable output
- **When** an operator or agent records a manual override to unblock the pipeline
- **Then** the override names the target stage, unavailable tool, reason for unavailability, substitute evidence used if any, limitations of the substitute, and the owner or actor responsible for the override where available
- **And** the override remains visible as a caveat in downstream review, QA, and closeout reporting
- **And** the override is not used merely to avoid triaging noisy findings.

### Story 6 — Reporting surfaces

As an operator or maintainer, I want scan evidence to appear consistently in review, QA, runtime inspection, and closeout surfaces, so that I can audit why a gate passed or failed.

#### AC6.1 Code review and QA reports include a scan evidence section

- **Given** Code Reviewer or QA produces a stage output
- **When** scan evidence was required, attempted, substituted, or overridden
- **Then** the report includes a dedicated scan/tool evidence section
- **And** the section includes direct tool status, substitute status if any, finding counts, classification summary, false-positive summary, manual override caveats, and artifact references where available.

#### AC6.2 Runtime and operator surfaces preserve the validation-surface split

- **Given** an operator inspects workflow state, policy readiness, runtime summaries, closeout summaries, or maintained operator documentation
- **When** scan evidence is shown
- **Then** OpenKit rule/security scan evidence is labeled as OpenKit runtime/tool evidence
- **And** target-project application build/lint/test validation is shown separately or marked unavailable when the target project does not define it.

### Story 7 — Target-project validation remains distinct

As a delivery agent, I want OpenKit scan evidence to stay separate from target app validation, so that I do not accidentally claim an application build, lint, or test pass that never ran.

#### AC7.1 OpenKit scans do not replace app-native validation

- **Given** a target project has no declared app-native build, lint, or test commands
- **When** rule/security scan evidence exists for OpenKit runtime or tooling surfaces
- **Then** the work item may report that OpenKit runtime/tool scan evidence exists
- **And** it must still report target-project app-native validation as unavailable
- **And** it must not substitute OpenKit scans for app build, lint, or test evidence.

#### AC7.2 Future app-native commands remain independent

- **Given** a target project later defines real build, lint, test, smoke, or regression commands
- **When** delivery evidence is recorded
- **Then** those app-native commands remain the validation source for target-project behavior
- **And** rule/security scan evidence remains an OpenKit runtime/tooling or code-audit evidence source, not a replacement for app-native validation.

## Business Rules

1. OpenKit continues to expose only the existing operating lanes: Quick Task, Migration, and Full Delivery.
2. Full Delivery continues to use the existing stage and owner model: Product Lead defines scope, Solution Lead defines technical direction, Fullstack implements, Code Reviewer reviews, QA verifies, and Master Orchestrator routes/records gates.
3. Required rule/security scan evidence is OpenKit runtime/tool evidence unless a target project explicitly defines its own separate scan command.
4. Target-project app validation remains separate and may be claimed only when the target project defines and runs app-native validation commands.
5. `tool.rule-scan` and `tool.security-scan` must be directly callable from every role context that requires them when local dependencies and runtime registration support scanning.
6. Scan availability states must use OpenKit's standard capability vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, or `not_configured`.
7. A direct tool invocation, substitute command, and manual override are three different evidence types and must not be reported as the same thing.
8. Human-facing reports must summarize high-volume scan findings; full raw output should remain inspectable through artifacts or references when available.
9. Non-blocking quality noise can pass a gate only after it is grouped and classified with a rationale.
10. Security findings must be classified before closure. True-positive security findings block handoff or closure until resolved or explicitly routed as unresolved risk by the appropriate workflow owner.
11. False-positive classifications require evidence and rationale; a bare label of `false positive` is not sufficient.
12. Manual overrides are allowed only for genuine tool unavailability, unusable tool output, or explicitly authorized operational exceptions; they are not a substitute for classification.
13. Manual overrides must remain visible in downstream artifacts and closeout summaries as caveats.
14. Scan-gate behavior must preserve existing approval gates and must not allow agents to bypass Product Lead, Solution Lead, Code Reviewer, or QA responsibilities.
15. Required scan behavior must not depend on hosted services or network-only upstream rule packs.
16. Product and documentation language must distinguish current implemented behavior from planned future behavior.

## Edge Cases

- Semgrep or its local dependency path is unavailable, but the runtime still registers a scan tool surface.
- A scan tool is available to one role or namespace but unavailable to Code Reviewer or QA.
- A scan invocation returns an empty response, parse failure, timeout, partial output, or non-zero exit status.
- The changed-file set is empty or contains only documentation, fixtures, generated files, binary files, or unsupported file types.
- A quality scan returns thousands of low-severity findings that are unrelated to the feature behavior.
- A bundled quality rule produces broad false positives against normal runtime or test code.
- A security scan flags a placeholder secret, fixture token, example URL, or other test-only value.
- A security scan flags a production/runtime file with a value that looks similar to a fixture placeholder.
- A manual override is needed because direct runtime tools are not callable, but substitute Semgrep evidence is available.
- A manual override is requested after a noisy scan succeeds but before findings are classified.
- A target project has no app-native validation commands while OpenKit runtime tests and scan evidence exist.
- A global OpenKit install and a checked-in authoring repository disagree about available scan tooling or rule pack versions.
- A reviewer-agent reliability problem produces empty review output even though scan evidence exists separately.

## Error And Failure Conditions

- A required scan gate advances with no direct scan evidence, no substitute evidence, and no explicit manual override.
- A report claims `tool.rule-scan` or `tool.security-scan` succeeded when the direct tool was unavailable and only a substitute command ran.
- A manual override omits the unavailable tool, target stage, reason, limitations, or substitute evidence status.
- A high-volume scan is reported only as a raw finding dump with no triage summary or gate rationale.
- A security finding is treated as non-blocking without false-positive rationale or true-positive resolution.
- A finding is labeled false positive without file/context evidence.
- OpenKit runtime/tool scan evidence is presented as target-project application build, lint, or test validation.
- Documentation or reports imply external hosted scanning is required for standard gate evidence.
- Capability output invents non-standard availability states or hides degraded/unavailable status.
- Role boundaries are weakened by making Master Orchestrator classify findings, design the solution, implement fixes, or perform QA judgment.

## Reporting Surface Expectations

- Code Review output should show direct scan status, unavailable/degraded status, finding summary, blocking/non-blocking classification, false-positive rationale, and manual-override caveats before final review recommendation.
- QA output should show scan status, substitute evidence if used, classification summary, artifact references, remaining residual risks, and whether scan evidence supports or blocks the QA route.
- Workflow-state, policy-readiness, runtime-summary, and closeout surfaces should expose enough evidence to tell whether the gate passed through direct invocation, substitute evidence, or manual override.
- Operator and maintainer documentation should describe the scan evidence pipeline using current command/tool reality and standard capability-state vocabulary.
- Any target-project application validation status should appear separately from OpenKit scan/tool evidence.

## Measurable Success Criteria

- Code Reviewer and QA can either invoke the required scan tools directly or receive structured unavailable/degraded/not-configured responses with fallback guidance.
- Every required scan attempt, substitute, or manual override leaves inspectable evidence with surface labels and artifact references where available.
- High-volume quality output is summarized into classified groups in human-facing reports, with raw output still traceable.
- False-positive security findings include rule/file/context/rationale and do not block only when no unclassified or true-positive security issue remains.
- Gate decisions distinguish direct evidence, substitute evidence, non-blocking noise, false positives, blockers, and manual overrides.
- Manual overrides remain visible in review, QA, and closeout reporting and are not used to avoid noisy finding triage.
- OpenKit runtime/tool scan evidence is never presented as target-project app-native build, lint, or test evidence.
- The feature requires no hosted scanning service or network-only rule pack to satisfy standard gate evidence.

## Open Questions

- None blocking for `product_to_solution`. Solution Lead should decide the implementation sequence, exact evidence shape, rule-pack tuning approach, and validation strategy while preserving the product behavior above.

## Handoff Notes For Solution Lead

- Treat the FEATURE-938 QA report as the motivating residual-risk input: noisy quality scan output, a test-fixture security false positive, unavailable direct scan tools in QA, and manual override caveats.
- Keep the solution focused on the scan/tool evidence pipeline. Do not expand into general reviewer-agent reliability unless the change is necessary to make scan evidence available, routed, or reported correctly.
- Preserve the current full-delivery stage order, gate ownership, issue-routing model, and role boundaries.
- Keep scan evidence surface labels explicit: OpenKit `runtime_tooling` / `compatibility_runtime` evidence is not target-project app validation.
- Avoid any design that requires external hosted scanning services or assumes app-native validation commands.
- Map acceptance criteria to concrete artifacts, agent guidance, runtime/tool availability reporting, evidence capture, gate readiness, and QA/reporting updates without prescribing those choices from this scope package.
