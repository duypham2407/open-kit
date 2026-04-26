---
artifact_type: scope_package
version: 1
status: approval_ready
feature_id: FEATURE-940
feature_slug: openclaw-openkit-dialogue-v2
owner: ProductLead
approval_gate: product_to_solution
lane: full
stage: full_product
supersedes: FEATURE-937
---

# Scope Package: OpenClaw OpenKit Dialogue V2

## Goal

Deliver a clean, inspectable redo of direct OpenClaw ↔ OpenKit supervisor dialogue so OpenClaw can observe OpenKit workflow activity, acknowledge progress, report concerns, and propose next steps while OpenKit remains the only authority that mutates workflow state, executes code, records evidence, or advances approvals.

## Target Users

- OpenKit operators who need visibility into whether supervisor dialogue is active, degraded, or requesting attention.
- OpenKit delivery agents and reviewers who need supervisor suggestions available as auditable context without granting them execution authority.
- QA agents who need evidence that the dialogue path preserves OpenKit authority boundaries and is reviewable after FEATURE-937 artifact loss.
- Maintainers who need a stable runtime/tooling contract for supervisor events, inbound proposals, dedupe, degraded mode, and reporting.

## Problem Statement

FEATURE-937 established the intent for an event-driven OpenClaw supervisor integration, but artifact loss and a code-review bypass made it unsuitable as the delivery source of truth. FEATURE-940 must restate the product behavior from clean scope, preserve only the historical evidence that is still useful, and require downstream solution, implementation, review, and QA to prove the OpenClaw dialogue path without weakening OpenKit's existing workflow authority model.

## Historical And Superseded Context

- FEATURE-937 is historical evidence only; FEATURE-940 scope is the delivery source of truth.
- Historical intent to preserve: event-driven supervisor dialogue where OpenClaw can observe, dialogue, propose, and acknowledge while only OpenKit executes code or changes workflow state.
- Historical slices to consider downstream as evidence, not fixed implementation: durable supervisor store/session summary; normalized supervisor events after authority writes; runtime bridge/OpenClaw adapter; inbound adjudication and anti-loop controls.
- Historical schema contract names observed and allowed as externally inspectable record contracts: `openkit/supervisor-session@1`, `openkit/supervisor-checkpoint@1`, and `openkit/supervisor-event@1`.
- FEATURE-937 artifact loss and review bypass are explicit quality risks; FEATURE-940 must leave product scope, solution package, implementation evidence, code review, and QA evidence inspectable.

## In Scope

- OpenKit-owned supervisor dialogue behavior for a work item in the existing `full` delivery lane.
- Durable, inspectable records for supervisor session state, outbound supervisor events, inbound OpenClaw messages, inbound proposal dispositions, delivery progress, and dedupe decisions.
- Outbound OpenKit event behavior after successful OpenKit authority writes, including workflow stage changes, approval changes, issue/blocker signals, verification signals, task or work-item blocked signals, pause/resume or attention signals, and supervisor health changes where applicable.
- Inbound OpenClaw dialogue behavior for acknowledgements, proposals, concerns, and human-attention requests.
- Authority-boundary adjudication that rejects or quarantines inbound requests attempting direct execution, code changes, workflow mutation, approval changes, evidence recording, or issue closure.
- Anti-loop and dedupe behavior for repeated outbound events, duplicate inbound messages, and repeated proposals with the same intent and target.
- Degraded/offline OpenClaw behavior where OpenKit continues operating, reports supervisor unavailability honestly, and keeps pending or skipped dialogue state auditable.
- Operator, reviewer, and QA reporting expectations for session health, degraded state, pending supervisor dialogue, rejected or duplicate inbound messages, and unresolved attention requests.
- Validation and reporting boundaries for OpenKit runtime/tooling surfaces, including use of the FEATURE-939 scan/tool evidence pipeline downstream.

## Out of Scope

- Any new OpenKit lane, mode, stage, gate family, approval family, or workflow-state enum family.
- Allowing OpenClaw to execute shell commands, call OpenKit tools, edit files, mutate workflow state, transition stages, approve gates, change task-board status, record verification evidence, close issues, or mark QA complete.
- Hosted OpenClaw service provisioning, OpenClaw account setup, credential lifecycle management, or requiring a network dependency for normal OpenKit operation.
- A chat UI or rich conversational product surface beyond inspectable dialogue records and runtime/operator reporting.
- Replaying, migrating, or repairing all historical FEATURE-937 state as part of this feature.
- Treating FEATURE-937 implementation artifacts as accepted code or bypassing FEATURE-940 solution, implementation, code review, or QA gates.
- Proving downstream target-project application builds, lint, tests, or product behavior; this feature validates OpenKit runtime/tooling behavior only.

## Main Flows

1. **Outbound observation flow**
   - OpenKit completes an authoritative workflow action.
   - OpenKit records an outbound supervisor event only after that action succeeds.
   - OpenClaw receives or can later receive the event according to supervisor availability.
   - Operators and QA can inspect whether the event is pending, delivered, failed, skipped, or degraded.

2. **Inbound proposal flow**
   - OpenClaw sends a proposal, acknowledgement, concern, or attention request.
   - OpenKit normalizes the inbound dialogue into an auditable record.
   - OpenKit assigns a safe disposition without performing the proposed action automatically.
   - A human/operator or OpenKit agent may choose to act later through existing OpenKit commands and gates.

3. **Authority-boundary rejection flow**
   - OpenClaw sends a request that implies execution or workflow mutation.
   - OpenKit records the request and rejects or quarantines it as outside OpenClaw authority.
   - No workflow state, code, task board, evidence, issue, stage, or approval is mutated by the inbound request itself.

4. **Degraded supervisor flow**
   - OpenClaw is not configured, unreachable, unavailable, or returns an invalid response.
   - OpenKit continues normal workflow operation.
   - Supervisor health is reported as degraded/offline/unavailable with enough context for review and QA.
   - Pending outbound events and inbound-processing failures remain inspectable.

## User Stories And BDD Acceptance Criteria

### Story 1 — Observe OpenKit workflow progress

As an OpenClaw supervisor, I want to receive OpenKit workflow progress events, so that I can monitor delivery and provide supervisory feedback without needing direct workflow authority.

**Acceptance criteria**

- **Given** an OpenKit workflow action succeeds for an active work item  
  **When** the action is relevant to supervisor observation, such as a stage change, approval change, verification signal, issue/blocker signal, work-item blocked signal, pause/resume signal, or attention signal  
  **Then** OpenKit must make an outbound supervisor event available with the work item identity, event identity, event type, origin `openkit`, timestamp, summary, and enough context for a reviewer to understand what changed.
- **Given** an OpenKit workflow action fails or is rejected  
  **When** supervisor event handling runs  
  **Then** OpenKit must not emit an outbound supervisor event that represents the failed action as successful.
- **Given** OpenClaw is unavailable when an outbound event is created  
  **When** an operator or QA inspects supervisor status  
  **Then** the event must be visible as pending, failed, skipped, or otherwise undelivered without blocking normal OpenKit workflow progress.

### Story 2 — Preserve OpenKit authority

As an OpenKit operator, I want OpenClaw suggestions to be advisory only, so that OpenKit remains the sole authority for code execution and workflow state changes.

**Acceptance criteria**

- **Given** OpenClaw sends a proposal to change code, run a command, advance a stage, approve a gate, update a task, record evidence, close an issue, or mark QA complete  
  **When** OpenKit receives the inbound message  
  **Then** OpenKit must record the inbound message and assign a rejected or human-attention disposition  
  **And** OpenKit must not perform the requested mutation or execution automatically.
- **Given** an OpenKit operator decides to act on an OpenClaw proposal  
  **When** the operator proceeds  
  **Then** the action must happen through existing OpenKit lanes, stages, commands, role owners, and approval gates.
- **Given** OpenClaw sends an acknowledgement or non-mutating observation  
  **When** OpenKit receives it  
  **Then** OpenKit may record it as dialogue context without changing workflow state beyond the supervisor dialogue record itself.

### Story 3 — Review inbound proposals safely

As an OpenKit delivery agent, I want inbound OpenClaw proposals normalized and categorized, so that I can evaluate them without deciphering raw supervisor messages or risking accidental execution.

**Acceptance criteria**

- **Given** OpenClaw sends a proposal with a target work item and stated intent  
  **When** OpenKit records the inbound message  
  **Then** the proposal must have an inspectable disposition such as advisory proposal, acknowledgement, concern, human-attention request, duplicate ignored, invalid rejected, or authority-boundary rejected.
- **Given** an inbound proposal is missing the minimum information needed to identify its target or intent  
  **When** OpenKit processes it  
  **Then** OpenKit must record it as invalid or human-attention-required  
  **And** no workflow mutation or code execution may occur.
- **Given** a proposal is categorized as advisory  
  **When** the next OpenKit owner reviews the work item  
  **Then** the proposal must be visible as context without being treated as an approval, task assignment, issue closure, or verification result.

### Story 4 — Prevent loops and duplicates

As an OpenKit maintainer, I want dedupe and anti-loop controls for supervisor dialogue, so that repeated events or proposals do not create runaway dialogue or repeated workflow pressure.

**Acceptance criteria**

- **Given** the same inbound OpenClaw message is received more than once with the same message identity  
  **When** OpenKit processes the repeat  
  **Then** OpenKit must classify the repeat as duplicate ignored and must not create a second actionable proposal.
- **Given** OpenClaw sends repeated proposals with the same intent and target but different message identities  
  **When** OpenKit detects the repeated proposal key  
  **Then** OpenKit must keep the repeated proposal from creating duplicate actionable attention items while preserving an audit record that a repeat was received.
- **Given** OpenKit sends an outbound event and OpenClaw acknowledges it  
  **When** that acknowledgement is recorded  
  **Then** the acknowledgement must not trigger a new outbound event loop unless a distinct OpenKit-owned workflow action occurs.

### Story 5 — Operate safely when OpenClaw is degraded or offline

As an OpenKit operator, I want supervisor dialogue to degrade safely when OpenClaw is unavailable, so that OpenKit workflows remain usable and the gap is visible.

**Acceptance criteria**

- **Given** OpenClaw is not configured  
  **When** OpenKit starts or a work item emits supervisor-relevant events  
  **Then** OpenKit must report supervisor dialogue as unavailable or degraded without failing normal runtime startup or workflow operations.
- **Given** OpenClaw becomes unreachable after dialogue has started  
  **When** OpenKit attempts dialogue delivery or receives no valid response  
  **Then** OpenKit must preserve inspectable health and delivery status  
  **And** OpenKit must continue existing workflow stages, gates, and validation processes.
- **Given** OpenClaw recovers after being unavailable  
  **When** dialogue resumes  
  **Then** OpenKit must avoid replaying duplicates as new actionable proposals and must keep delivery state auditable.

### Story 6 — Audit supervisor dialogue during review and QA

As a code reviewer or QA agent, I want supervisor dialogue and decisions to be auditable, so that I can verify the feature did not bypass OpenKit authority or review gates.

**Acceptance criteria**

- **Given** FEATURE-940 reaches code review  
  **When** the reviewer inspects the feature  
  **Then** there must be evidence of product scope compliance, authority-boundary enforcement, duplicate handling, degraded/offline handling, and scan/tool evidence from the FEATURE-939 pipeline where applicable.
- **Given** FEATURE-940 reaches QA  
  **When** QA validates the feature  
  **Then** QA must be able to report supervisor session health, outbound event behavior, inbound proposal dispositions, rejected authority-boundary attempts, dedupe outcomes, and degraded/offline behavior.
- **Given** validation evidence is reported  
  **When** the report references OpenKit runtime/tooling checks  
  **Then** it must label the validation surface as OpenKit runtime/tooling, compatibility runtime, global CLI, documentation, or unavailable target-project app validation as appropriate.

### Story 7 — Keep target-project validation boundaries honest

As an OpenKit maintainer, I want validation reports to distinguish OpenKit runtime/tooling from target-project applications, so that FEATURE-940 does not falsely claim downstream app build or test coverage.

**Acceptance criteria**

- **Given** downstream implementation or QA runs OpenKit runtime, workflow-state, scan, or CLI checks  
  **When** evidence is recorded  
  **Then** the evidence must not be described as target-project application build, lint, or test proof.
- **Given** a target repository does not define app-native build, lint, or test commands  
  **When** QA reports validation  
  **Then** target-project app validation must be reported as unavailable rather than replaced by OpenKit runtime checks.

## Business Rules

- OpenKit is the sole authority for workflow state mutation, code execution, approvals, evidence recording, issue lifecycle changes, task-board changes, and stage transitions.
- OpenClaw can only observe, dialogue, propose, acknowledge, report concerns, and request human attention.
- Outbound supervisor events must represent successful OpenKit-owned actions only; failed or rejected authority writes must not be reported as successful events.
- Inbound OpenClaw messages must be recorded and adjudicated before they influence any human or agent action.
- Inbound messages that imply direct execution or workflow mutation must be rejected, quarantined, or marked human-attention-required without performing the requested action.
- Repeated inbound messages and repeated proposals must be idempotent from an actionability perspective while remaining auditable.
- Supervisor unavailability must degrade dialogue visibility, not OpenKit workflow execution.
- Dialogue records must include enough identity, timestamp, origin, work-item, event/message type, disposition, and summary information for review and QA to reconstruct what happened.
- FEATURE-940 must use the existing full-delivery lane and approval gates; it must not add a new lane, mode, stage, gate family, or authority model.
- FEATURE-937 artifacts may inform risks and historical intent but must not be treated as accepted delivery artifacts for FEATURE-940.
- Downstream review and QA must use the FEATURE-939 scan/tool evidence pipeline where applicable and classify scan/tool evidence by validation surface.

## Acceptance Criteria Matrix

| ID | Acceptance Criterion | Primary Stories |
| --- | --- | --- |
| AC1 | OpenKit records outbound supervisor events only after successful OpenKit authority actions and includes inspectable event identity, origin, type, work item, timestamp, summary, and context. | Story 1 |
| AC2 | OpenClaw cannot directly execute code or mutate workflow state; any such inbound request is recorded and rejected/quarantined or marked human-attention-required. | Story 2, Story 3 |
| AC3 | Inbound acknowledgements, concerns, proposals, and attention requests are normalized into auditable records with safe dispositions. | Story 3, Story 6 |
| AC4 | Duplicate inbound messages and repeated proposal keys do not create duplicate actionable items and are visible as duplicate/dedupe outcomes. | Story 4 |
| AC5 | OpenClaw unconfigured, degraded, or offline states do not fail OpenKit startup or block normal workflow progress and are visible in operator/QA reporting. | Story 5 |
| AC6 | Supervisor dialogue reporting exposes session health, delivery state, inbound dispositions, rejected authority-boundary attempts, dedupe outcomes, and attention needs. | Story 5, Story 6 |
| AC7 | FEATURE-940 delivery includes inspectable product scope, solution package, implementation evidence, code review, QA evidence, and scan/tool evidence where applicable; FEATURE-937 is not used as a delivery substitute. | Story 6 |
| AC8 | Validation reports distinguish OpenKit runtime/tooling, compatibility runtime, global CLI, documentation, and unavailable target-project app validation; OpenKit checks are not claimed as target-project app builds/tests. | Story 7 |

## Edge Cases

- OpenKit emits multiple supervisor-relevant events for the same work item in rapid succession; ordering and identity must remain inspectable.
- OpenClaw sends an acknowledgement for an unknown, expired, or already-deduped event; OpenKit records the mismatch or duplicate without changing workflow state.
- OpenClaw sends a proposal referencing a missing work item, stale stage, closed issue, or unknown approval gate; OpenKit records it as invalid or human-attention-required without mutation.
- OpenClaw sends the same proposal with different wording but the same target and intent; OpenKit treats it as repeated proposal pressure rather than a new independent action.
- OpenClaw sends a message that mixes safe advisory text with an unsafe execution request; unsafe authority-boundary handling wins, and no execution or mutation occurs.
- Supervisor delivery partially succeeds and then OpenClaw becomes unavailable; OpenKit reports the last known delivery state and does not mislabel undelivered events as delivered.
- Supervisor dialogue is disabled or unconfigured in a valid OpenKit runtime; the feature remains valid if health reporting makes that state explicit and non-fatal.

## Error And Failure Cases

- **OpenClaw unavailable/offline:** report degraded or unavailable supervisor health, preserve pending/failed delivery state where applicable, and continue OpenKit workflow operation.
- **Invalid inbound message:** record invalid disposition with reason visible to reviewers; no workflow mutation or code execution.
- **Authority-boundary violation:** reject/quarantine or mark human-attention-required; no command execution, file change, approval, stage transition, evidence record, task update, or issue closure.
- **Duplicate inbound message:** classify as duplicate ignored; preserve audit trace; no second actionable item.
- **Repeated proposal loop:** classify repeated proposal by stable intent/target; avoid repeated actionable pressure; preserve audit trace.
- **Audit/reporting unavailable:** treat missing supervisor reporting as a blocking product-scope issue for review/QA because authority-boundary behavior must be inspectable.
- **Scan/tool evidence unavailable:** report the direct tool state, substitute evidence or manual override caveat, and validation-surface limitations instead of omitting the gap.

## Measurable Success Signals

- Reviewers can identify every supervisor dialogue action as either outbound OpenKit event, inbound OpenClaw message, adjudication/disposition, dedupe decision, or health/degraded signal.
- QA can demonstrate at least one safe inbound proposal, one rejected authority-boundary request, one duplicate or repeated proposal handling case, and one degraded/offline OpenClaw case.
- No acceptance evidence shows OpenClaw directly executing code, changing workflow state, approving gates, recording verification evidence, or closing issues.
- Runtime/tooling validation evidence is labeled by validation surface, and target-project app validation is explicitly marked unavailable unless a target project defines app-native commands.
- FEATURE-940 reaches code review and QA through the normal full-delivery gates with no code-review bypass and no reliance on FEATURE-937 artifacts as delivery proof.

## Open Questions

- None blocking for Product Lead scope.
- Solution Lead should decide the smallest technical shape that satisfies these observable contracts while keeping OpenClaw disabled/degraded safely when not configured.
- Solution Lead should confirm which existing runtime/operator reporting surfaces are sufficient for supervisor health visibility without adding new workflow lanes, stages, or gates.

## Success Signal

FEATURE-940 is successful when OpenKit can expose auditable supervisor dialogue with OpenClaw while preserving OpenKit as the sole execution and workflow authority, and downstream review/QA can prove outbound events, inbound proposal adjudication, anti-loop/dedupe, degraded/offline behavior, auditability, and validation-surface boundaries from clean FEATURE-940 artifacts.

## Handoff Notes For Solution Lead

- Treat this document, not FEATURE-937, as the approved product source of truth.
- Preserve the authority boundary exactly: OpenClaw observes/dialogues/proposes/acknowledges; OpenKit alone mutates workflow state and executes code.
- Keep scope within existing `full` delivery stages and gates; do not add lane/mode/stage/gate families.
- Use FEATURE-937 only to understand historical risks, observed schema names, and prior intended behavior; do not treat its artifacts or code as reviewed delivery assets.
- Use FEATURE-939 scan/tool evidence pipeline downstream for code review and QA reporting where applicable.
- Define validation against OpenKit runtime/tooling and compatibility/runtime reporting surfaces. Do not claim target-project app build/lint/test validation unless an actual target project supplies those commands.
- Ensure the solution plan includes explicit review and QA evidence for authority-boundary rejection, dedupe/anti-loop, degraded/offline behavior, outbound event timing, inbound proposal disposition, and audit/reporting visibility.
