---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-943
feature_slug: normalize-direct-scan-tools
owner: ProductLead
approval_gate: product_to_solution
handoff_rubric: pass
---

# Scope Package: Normalize Direct Scan Tools

OpenKit should make direct rule/security scan tooling predictable for Fullstack, Code Reviewer, and QA during required full-delivery gates: when Semgrep-backed scan tooling is available, the stage owner can invoke the direct OpenKit tools, the invocation is logged, and the resulting evidence has grouped triage and validation-surface labels; when direct tooling is genuinely unavailable, substitute/manual override paths remain explicit caveats rather than hidden gate bypasses.

## Goal

- Normalize direct `tool.rule-scan` and `tool.security-scan` availability and usability across Fullstack, Code Reviewer, and QA contexts that need scan evidence for full-delivery handoffs.
- Ensure scan attempts, direct successes, substitute scans, and manual overrides are visible in invocation logs and workflow evidence.
- Require structured scan evidence with grouped triage, finding classification, false-positive rationale, override caveats, validation-surface labels, and artifact references where available.
- Preserve existing scan gates, classification requirements, issue routing, and the separation between OpenKit runtime/tooling validation and target-project app-native validation.

## Target Users

- **Fullstack Agent:** needs a dependable pre-review scan path and handoff evidence before requesting Code Review.
- **Code Reviewer:** needs direct rule/security scan evidence or explicit fallback caveats before approving `fullstack_to_code_review` / routing to QA.
- **QA Agent:** needs inspectable scan evidence, grouped triage, and residual-risk caveats before recommending `qa_to_done`.
- **Maintainers:** need a stable scan-tool contract that avoids rescue scripts, ad hoc wrappers, stale-process surprises, and unlogged direct-tool failures.

## Problem Statement

After FEATURE-942 and FEATURE-944, repeated full-delivery work still hit direct scan/evidence friction: Fullstack, Code Reviewer, and QA sometimes could not call direct `tool.rule-scan` / `tool.security-scan` from their role/session namespace, invocations were not visible in the invocation log, or evidence lacked the grouped triage structure required by workflow gates. Agents compensated with substitute Semgrep CLI runs, manual overrides, rescue scripts, or bootstrapped wrappers even when Semgrep was otherwise available. OpenKit needs a normalized product contract for direct scan-tool availability, invocation logging, evidence shape, stale-runtime caveats, and validation-surface labeling so required gates remain trustworthy without weakening fallback semantics for genuine unavailability.

## In Scope

- Normalize the expected direct invocation path for `tool.rule-scan` and `tool.security-scan` in Fullstack, Code Reviewer, and QA role/session contexts for full-delivery scan gates.
- Require direct scan attempts and results to be recorded in an invocation log or equivalent inspectable runtime record when the tool surface is reached.
- Require evidence records and human-facing reports to preserve direct-tool, substitute-scan, and manual-override distinctions.
- Require grouped triage summaries for scan findings: blocking, true-positive, non-blocking noise, false-positive, follow-up, and unclassified counts.
- Require false-positive rationale and manual override caveats to remain visible in Code Review, QA, closeout, and workflow-state read models.
- Require stale runtime/tool process caveats when a newly implemented or packaged direct scan tool may not be visible until OpenCode/OpenKit runtime processes are restarted, reloaded, or reinstalled.
- Require validation-surface labels on scan evidence: direct scan behavior as `runtime_tooling`, stored workflow/evidence read models as `compatibility_runtime`, docs/runbooks as `documentation`, package/global install checks as `global_cli` where touched, and app-native validation as `target_project_app` only when a real target project defines it.
- Preserve substitute Semgrep CLI scans and manual override semantics for genuine direct-tool unavailability, unusable output, or explicitly authorized operational exceptions.
- Keep this work aligned with FEATURE-939 scan evidence requirements while focusing this feature on direct-tool normalization and gate evidence consistency.

## Out of Scope

- Implementing code, choosing internal APIs, prescribing storage schemas, or selecting exact implementation architecture.
- Syntax-outline path-resolution fixes or syntax-tool behavior changes covered by FEATURE-944.
- Semgrep no-`var` rule tuning or quality rule precision fixes covered by FEATURE-942.
- Replacing Semgrep with another scanner, adding hosted scanning services, or requiring network-only rule packs for standard gate evidence.
- Weakening scan gates, making scan classification optional, or treating noisy findings as passable without grouped triage.
- Creating new workflow lanes, stage names, approval gates, or role responsibilities.
- Treating OpenKit runtime/tool scans, workflow-state checks, or CLI checks as target-project application build/lint/test validation.
- Adding or claiming target-project app-native validation commands unless the target project actually defines them.
- Solving all stale-session/runtime hot-reload behavior; this scope requires honest caveats and validation, not necessarily live hot-reload.

## Users And User Journeys

1. **As a Fullstack Agent, I want to run direct rule/security scans before review handoff when Semgrep-backed tooling is available, so that my handoff evidence does not depend on rescue scripts or unstated substitute commands.**
2. **As a Code Reviewer, I want direct scan tools to be callable or to fail with structured unavailability details, so that I can make a scope/code-quality gate decision without guessing whether scan evidence exists.**
3. **As a QA Agent, I want scan evidence to include grouped triage and caveats, so that I can verify closure readiness without re-triaging raw scan walls or hidden manual overrides.**
4. **As a Maintainer, I want direct scan invocation attempts to be logged and surface-labeled, so that runtime/tool registration, packaging drift, stale processes, and fallback usage are diagnosable.**

## Main Flows

- **Direct scan available:** stage owner invokes `tool.rule-scan` or `tool.security-scan`; the tool runs, records an invocation, returns structured status/findings, and produces evidence with grouped triage and `runtime_tooling` labels.
- **Direct scan unavailable:** stage owner attempts or checks the direct tool; the result states `unavailable`, `degraded`, or `not_configured` with known reason; allowed substitute Semgrep evidence or manual override is recorded separately with limitations.
- **Review/QA evidence consumption:** Code Reviewer or QA reads direct/substitute/manual evidence; grouped finding classifications and artifact refs support pass/fail or rework routing.
- **Stale runtime/tool process:** a newly added or changed direct scan tool is not visible in an already-running session; the evidence/report identifies stale runtime or tool registration as a caveat and directs maintainers to refresh the appropriate runtime/global install surface.

## Product And Business Rules

### Scan Availability And Role Coverage

- Fullstack, Code Reviewer, and QA must have a documented direct scan path for required full-delivery scan evidence when Semgrep-backed OpenKit scan tooling is available in the runtime.
- A role/session namespace that requires scan evidence must not silently omit `tool.rule-scan` or `tool.security-scan`; if the direct tool cannot be provided, the status must be visible as `unavailable`, `degraded`, or `not_configured` with a known reason where available.
- Direct tool behavior must be consistent enough across Fullstack, Code Reviewer, and QA that a scan available to one required gate owner is not unexpectedly missing for another without an explicit capability-status explanation.
- Direct scan tools may use Semgrep-backed implementation details, but the product requirement is the OpenKit direct tool contract, not a mandate that agents call Semgrep CLI first.

### Invocation Logging

- Every reached direct scan-tool invocation attempt must leave an inspectable invocation record or equivalent runtime evidence including tool id, actor/role when known, stage or workflow context when known, target scope summary, start/end or recorded timestamp where available, result state, and error/unavailability summary when applicable.
- Invocation logging must distinguish a tool not registered in the role namespace from a registered tool that ran and failed.
- Substitute Semgrep CLI scans and manual overrides must be logged or recorded separately from direct-tool invocations; they must not be backfilled as direct-tool successes.
- Reports may summarize high-volume scan data, but raw output or detailed artifacts should remain referenced when available.

### Structured Evidence And Grouped Triage

- Required scan evidence must include direct tool status, substitute status if any, evidence type, target scope, finding counts, classification summary, false-positive summary, manual-override caveats, validation-surface labels, and artifact references where available.
- Finding classifications must use the existing categories: `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, and `unclassified`.
- Human-facing Code Review and QA reports must group findings by rule, severity/category, and relevance to the changed work before making a gate recommendation.
- A gate must not pass with unclassified findings that could affect blocking/security disposition unless the issue is explicitly routed and recorded as unresolved risk by the appropriate owner.
- False-positive classifications require rule/finding id, file or area, context, behavior/security impact assessment, rationale, and follow-up decision.

### Substitute And Manual Override Semantics

- Substitute Semgrep CLI scans remain valid only when direct OpenKit scan tooling is genuinely unavailable, degraded beyond usable evidence, stale/unregistered in the active session, or explicitly routed as an operational exception.
- Manual overrides are exceptional and must include target stage, unavailable/degraded direct tool, reason, actor when known, substitute evidence ids or artifact refs if any, substitute limitations, and caveat.
- Manual overrides must not be used merely to avoid triaging noisy but usable findings.
- Direct successful evidence, substitute evidence, and manual override evidence must remain visibly different in workflow state, Code Review output, QA reports, and closeout summaries.

### Stale Runtime / Tool Process Caveats

- If a direct scan tool is implemented or packaged but an existing OpenCode/OpenKit session cannot see it, evidence must classify the condition as stale runtime/tool registration or packaging drift rather than claiming the tool does not exist globally.
- Stale-process caveats must identify the likely affected surface when known: in-session tool namespace, checked-in authoring runtime, compatibility runtime, global installed kit, or packaged CLI surface.
- Stale-process caveats are not gate bypasses; they may justify substitute evidence or manual override only when direct invocation is genuinely unavailable in the active session and the caveat remains visible downstream.

### Validation-Surface Labels

- Direct `tool.rule-scan` / `tool.security-scan` behavior validates the `runtime_tooling` surface.
- Evidence stored, summarized, or read through workflow-state records validates the `compatibility_runtime` surface.
- Operator, maintainer, workflow, runbook, or scope/solution/QA artifact updates validate the `documentation` surface.
- Package/global install checks validate the `global_cli` surface only when those surfaces are touched.
- Target-project application validation is `target_project_app` only when the target project defines and runs app-native build, lint, test, smoke, or regression commands; OpenKit scan evidence must not be reported as target app validation.

## Acceptance Criteria Matrix

### Direct Tool Availability And Usability

- **Given** a full-delivery Fullstack, Code Reviewer, or QA context requires scan evidence **and** Semgrep-backed OpenKit scan tooling is available, **when** the role invokes `tool.rule-scan`, **then** the direct tool is callable from that role/session context and returns structured status instead of an empty or silent response.
- **Given** a full-delivery Fullstack, Code Reviewer, or QA context requires scan evidence **and** Semgrep-backed OpenKit scan tooling is available, **when** the role invokes `tool.security-scan`, **then** the direct tool is callable from that role/session context and returns structured status instead of an empty or silent response.
- **Given** a required direct scan tool is missing from a role/session namespace, **when** the stage owner attempts to collect scan evidence, **then** the outcome identifies whether the tool is unregistered, unavailable, degraded, not configured, or stale in the active session instead of requiring a rescue script to discover the failure.
- **Given** one required role can call a direct scan tool while another cannot, **when** evidence is reported, **then** the discrepancy is visible with role/session context and capability status rather than hidden behind substitute evidence.

### Invocation Logging

- **Given** a direct scan-tool invocation reaches the OpenKit runtime, **when** the invocation completes, fails, times out, or returns findings, **then** an invocation log or equivalent runtime evidence records tool id, scan kind, actor/role when known, stage/work item when known, target scope summary, result state, timestamp, and artifact refs or error summary where available.
- **Given** a scan tool is not registered in the active role namespace, **when** the direct tool cannot be invoked, **then** the evidence records namespace/tool availability failure separately from a tool execution failure.
- **Given** a substitute Semgrep CLI scan runs, **when** evidence is recorded, **then** the substitute command is identified as substitute evidence and is not represented as a successful direct `tool.rule-scan` or `tool.security-scan` invocation.

### Structured Evidence And Grouped Triage

- **Given** direct or substitute scan output contains findings, **when** Code Review or QA reports the evidence, **then** findings are grouped by rule and severity/category with counts for `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, and `unclassified`.
- **Given** a scan returns high-volume warnings, **when** a gate decision is made, **then** the human-facing report includes grouped triage and artifact refs rather than requiring readers to inspect an untriaged raw output wall.
- **Given** a finding is classified as false positive, **when** evidence is recorded, **then** the rationale includes rule/finding id, file or area, context, impact assessment, rationale, and follow-up decision.
- **Given** required scan evidence contains unclassified findings with possible blocking or security impact, **when** the stage owner attempts to pass the gate, **then** the gate is blocked or the issue is explicitly routed as unresolved risk; it is not silently ignored.

### Gate Preservation And Fallback Semantics

- **Given** direct scan tooling is available and produces usable output, **when** required scan evidence is needed, **then** agents use or cite direct tool evidence rather than defaulting to rescue scripts, ad hoc wrappers, or manual overrides.
- **Given** direct scan tooling is genuinely unavailable, stale in the active process, or degraded beyond usable evidence, **when** substitute Semgrep evidence or manual override is used, **then** the evidence includes direct-tool status, substitute/manual details, limitations, actor when known, and downstream caveats.
- **Given** a manual override is requested only because findings are noisy, **when** the scan output is otherwise usable, **then** the override does not satisfy acceptance until findings are grouped and classified or the issue is routed.
- **Given** scan evidence supports a full-delivery handoff, **when** the gate passes, **then** the record shows no unresolved blocking or true-positive security finding remains unaddressed.

### Stale Runtime And Packaging Caveats

- **Given** a direct scan tool has been added or changed but a running session cannot see the tool, **when** scan evidence is collected, **then** the report labels the condition as stale runtime/tool registration or packaging drift with the affected surface when known.
- **Given** a stale-process caveat is used to justify substitute evidence, **when** downstream Code Review, QA, or closeout evidence is produced, **then** the caveat remains visible and does not become a direct-tool success claim.
- **Given** package/global install surfaces are changed to ship the direct scan tools, **when** validation is reported, **then** package/global checks are labeled `global_cli` and are separate from in-session runtime-tool validation.

### Validation-Surface Separation

- **Given** direct OpenKit scan tools run, **when** evidence is reported, **then** the validation surface is labeled `runtime_tooling`.
- **Given** scan evidence is stored or read through workflow state, **when** the evidence is reported, **then** the validation surface is labeled `compatibility_runtime` and does not claim fresh direct tool execution.
- **Given** docs or runbooks are updated, **when** validation is reported, **then** the validation surface is labeled `documentation`.
- **Given** no target-project app-native build, lint, or test command is defined, **when** scan evidence exists, **then** target-project application validation is marked unavailable and OpenKit scan evidence is not substituted for it.

## Edge Cases

- Semgrep is installed and usable, but `tool.rule-scan` or `tool.security-scan` is missing from one role/session namespace.
- The direct tool is registered but returns empty output, malformed JSON, partial output, non-zero exit, timeout, or parser errors.
- A running OpenCode session has stale tool registration after the checked-in runtime or global kit has been updated.
- The checked-in authoring runtime and globally installed OpenKit package expose different scan-tool behavior or rule-pack versions.
- Fullstack produces substitute evidence before Code Reviewer has direct tool access, or Code Reviewer has direct evidence but QA sees stale/unavailable tooling.
- Scan targets include docs-only changes, generated files, fixtures, binary files, unsupported languages, deleted files, or an empty changed-file set.
- A quality scan returns high-volume warnings after FEATURE-942 tuning due to another rule or broader target scope.
- A security scan flags a test fixture, placeholder, metadata field, or generated artifact that resembles a secret.
- Invocation logs contain high-volume or sensitive raw scan detail that should be summarized in reports and referenced via artifacts instead of pasted wholesale.
- Workflow-state evidence exists from a previous attempt and may be stale relative to a new direct scan attempt.

## Error And Failure Cases

- A required full-delivery scan gate advances with no direct scan evidence, no substitute evidence, and no explicit manual override caveat.
- A report claims direct `tool.rule-scan` or `tool.security-scan` succeeded when only Semgrep CLI, a rescue script, or a wrapper ran.
- A direct tool namespace failure is hidden by a substitute scan with no direct-tool availability status.
- Invocation attempts are not logged or cannot distinguish missing namespace registration from tool execution failure.
- Findings are reported as a raw wall of output without grouped classification or gate rationale.
- False positives are labeled without rule/file/context/impact/rationale.
- Manual override is used to avoid triaging noisy but usable scan output.
- Stale runtime/tool process caveats disappear from downstream QA or closeout evidence.
- OpenKit scan, workflow-state, or CLI evidence is claimed as target-project application build/lint/test validation.
- The solution weakens scan gates, removes classification requirements, or changes role ownership to work around tool availability friction.

## Validation Expectations By Surface

| Surface label | Expected validation |
| --- | --- |
| `runtime_tooling` | Validate direct `tool.rule-scan` and `tool.security-scan` behavior from Fullstack, Code Reviewer, and QA-equivalent contexts where feasible; prove structured success/unavailable/degraded/not-configured responses, invocation logging, grouped triage evidence, false-positive/manual-override fields, and no silent empty responses. |
| `compatibility_runtime` | Validate workflow-state/evidence read models preserve scan evidence details: direct status, substitute/manual distinction, invocation refs, grouped classification counts, false-positive rationale, override caveats, validation-surface labels, artifact refs, stale-evidence caveats, and unresolved issue visibility. |
| `documentation` | Validate updated agent, workflow, tool-substitution, operator, maintainer, or runbook docs accurately describe the direct scan path, fallback semantics, stale-process caveats, grouped triage requirements, and target-project validation boundary. |
| `global_cli` | Required only if global package/install surfaces are touched; validate `openkit doctor`, package contents, or equivalent global-kit checks prove direct scan tooling is shipped/registered consistently without conflating global health with target app validation. |
| `target_project_app` | Unavailable unless a target project defines real app-native build, lint, test, smoke, or regression commands; OpenKit scan/runtime/workflow validation must not be reported as target-project app validation. |

## Open Questions And Assumptions

- Assumption: Semgrep-backed scan capability remains the intended local scanner for OpenKit direct scan tools when available; this scope does not require replacing it.
- Assumption: FEATURE-939 defines the broader scan evidence semantics; FEATURE-943 hardens direct availability/usability, invocation logging, and evidence shape across required full-delivery roles.
- Assumption: FEATURE-942 and FEATURE-944 are already complete and should not be re-opened in this feature except as historical motivation.
- Assumption: exact implementation mechanics for role/session namespaces, invocation log storage, and evidence schemas belong to Solution Lead.
- Risk: direct tool availability may differ between checked-in authoring sessions and globally installed OpenKit sessions; validation should explicitly cover or caveat both when touched.
- Risk: existing long-running OpenCode/OpenKit processes may not pick up new tool registrations; the solution must make stale-process caveats visible and not confuse them with product acceptance failure after refresh validation.
- Risk: scan findings may include sensitive-looking data; evidence design should summarize safely and reference artifacts without exposing unnecessary secret-like content.

## Handoff Notes For Solution Lead

- Keep the solution focused on direct scan-tool normalization for Fullstack, Code Reviewer, and QA; do not include syntax-outline fixes from FEATURE-944 or Semgrep no-var rule tuning from FEATURE-942.
- Preserve scan gates: direct availability hardening should reduce rescue-script/manual-override reliance, not weaken classification, review, or QA responsibilities.
- Design validation that proves direct invocation, invocation logging, structured evidence, grouped triage, false-positive rationale, fallback semantics, stale-process caveats, and validation-surface labels.
- Treat target-project app-native validation as unavailable unless a real target project command exists; do not report OpenKit runtime/tooling checks as app build/lint/test evidence.
- If package/global install surfaces are touched, include global package verification and document any stale install/session refresh requirements.
- Ensure downstream Code Review and QA artifacts can consume this evidence without re-discovering whether direct tool, substitute scan, or manual override was used.

## Success Signal

- Fullstack, Code Reviewer, and QA can satisfy required full-delivery scan gates through direct OpenKit scan tools whenever Semgrep-backed tooling is available, with logged invocations and grouped triage evidence; genuine unavailability still uses explicit substitute/manual evidence with visible caveats and no target-project validation overclaim.

## Product Lead Handoff Decision

- **Pass:** this scope package defines the problem, target users, in-scope and out-of-scope boundaries, business rules, acceptance criteria, edge/failure cases, validation surfaces, assumptions/risks, and Solution Lead handoff notes for `product_to_solution` review.
