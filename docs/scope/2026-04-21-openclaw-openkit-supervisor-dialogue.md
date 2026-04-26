# OpenClaw OpenKit Supervisor Dialogue Scope

## Goal

Create an event-driven supervisor dialogue path where OpenClaw can observe OpenKit workflow progress, send suggestions or attention signals back to OpenKit, and participate in delivery oversight without gaining authority to execute code or mutate workflow state.

The integration must preserve the OpenKit authority boundary: OpenClaw may dialogue, notify, and propose, but only OpenKit tools, agents, and workflow-state commands may perform code changes, task transitions, approvals, issue routing, or evidence recording.

## In Scope

- Durable per-work-item supervisor session storage under the managed `.opencode/work-items/<work_item_id>/` runtime store.
- Supervisor session, checkpoint, outbound event, inbound message, and adjudication records with stable schema names and sequence cursors.
- Normalized outbound events emitted after successful OpenKit authority writes, including stage, approval, blocker, attention, verification, pause, and work-item-blocked signals.
- A runtime supervisor dialogue manager that can inspect pending outbound events, dispatch them through an OpenClaw adapter, and process inbound messages.
- A transport adapter that supports command and HTTP-style configuration while degrading safely when unconfigured.
- Inbound adjudication that records suggestions, acknowledgements, and attention requests while rejecting or quarantining requests that attempt direct execution or workflow mutation.
- Anti-loop controls using message IDs, proposal keys, and bounded checkpoint state.
- Runtime summary exposure sufficient for operators and QA to inspect supervisor session health.
- Dedicated tests for store behavior, event delivery, degraded mode, inbound adjudication, dedupe, and authority-boundary enforcement.

## Out of Scope

- Hosted OpenClaw service provisioning, credentials management, or a required network dependency.
- Allowing OpenClaw to invoke shell commands, edit files, approve gates, transition workflow stages, mutate task boards, or write workflow state.
- Introducing a new OpenKit lane, mode, stage, approval gate family, or workflow-state enum family.
- Replacing existing full-delivery role ownership, QA gates, or code-review gates.
- Building a conversational UI beyond durable transcript and runtime bridge surfaces.
- Retrofitting historical work items outside the active feature unless they naturally receive new supervisor events after this feature lands.

## Acceptance Criteria Matrix

| ID | Acceptance Criteria | Validation |
| --- | --- | --- |
| AC1 | Each supervised work item has a durable session record using schema `openkit/supervisor-session@1` with work item, session, provider, transport health, delivery mode, degraded mode, attention, timestamps, and detach reason fields. | `.opencode/tests/supervisor-dialogue-store.test.js` |
| AC2 | Checkpoints use schema `openkit/supervisor-checkpoint@1` and track outbound/inbound cursors plus bounded dedupe lists for message IDs and proposal keys. | `.opencode/tests/supervisor-dialogue-store.test.js` |
| AC3 | OpenKit emits outbound schema `openkit/supervisor-event@1` only after successful authority writes, with origin `openkit`, event sequence, cursor, summary, details, and observed event types such as `stage_changed`, `approval_changed`, `verification_signal`, `issue_or_blocker_signal`, `work_item_blocked`, `human_attention_needed`, and `work_item_paused`. | `.opencode/tests/supervisor-dialogue-store.test.js`, targeted workflow controller tests |
| AC4 | Runtime bridge delivery is disabled/degraded by default when no OpenClaw transport is configured and does not fail runtime bootstrap. | `tests/runtime/openclaw-supervisor-dialogue.test.js`, `tests/runtime/runtime-bootstrap.test.js` |
| AC5 | Configured command or HTTP transport can receive pending outbound events and advance delivery checkpoints only after successful delivery. | `tests/runtime/openclaw-supervisor-dialogue.test.js` |
| AC6 | Inbound OpenClaw messages are normalized and adjudicated into safe dispositions without direct workflow mutation or code execution. | `tests/runtime/openclaw-supervisor-dialogue.test.js` |
| AC7 | Duplicate inbound messages and repeated proposal keys are idempotently ignored and captured in checkpoint dedupe state. | `tests/runtime/openclaw-supervisor-dialogue.test.js`, `.opencode/tests/supervisor-dialogue-store.test.js` |
| AC8 | Runtime summary surfaces show supervisor session health and attention/degraded status for operators and QA. | `tests/runtime/openclaw-supervisor-dialogue.test.js` |

## Authority Boundary

OpenClaw is a supervisor and dialogue participant only. It can receive OpenKit events, submit suggestions, request attention, acknowledge progress, and report concerns. It cannot call tools, edit files, transition stages, approve gates, change task status, record evidence, or close issues. Any inbound request that implies execution or workflow mutation must be recorded as rejected or human-attention-required for OpenKit operators to adjudicate.

## Evidence Basis

This scope was reconstructed during FEATURE-937 reconciliation from the managed work item state, task board, existing evidence entries, and surviving schema descriptions. The original scope artifact was missing from the repository at reconciliation time.
