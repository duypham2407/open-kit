# OpenClaw OpenKit Supervisor Dialogue Solution

## Recommended Path

Restore FEATURE-937 as a minimal, file-backed supervisor dialogue subsystem that is event-driven, disabled/degraded by default, and strictly subordinate to OpenKit authority. The implementation should use the existing managed work-item store and runtime manager bootstrap rather than introducing a new lane, stage, queue service, or hosted dependency.

Outbound supervisor events are appended only after successful OpenKit state mutations. A runtime manager can then deliver pending events through a configured OpenClaw adapter and record delivery progress in a checkpoint. Inbound messages are normalized and adjudicated into durable transcript records; they never execute code or mutate workflow state directly.

## Impacted Surfaces

- `.opencode/lib/supervisor-dialogue-store.js`: Durable session, checkpoint, outbound, inbound, and adjudication store.
- `.opencode/lib/workflow-state-controller.js`: Post-mutation event emission from OpenKit authority points.
- `.opencode/lib/runtime-summary.js`: Supervisor session summary for operators and QA.
- `.opencode/workflow-state.js`: CLI inspection surface for supervisor session state if needed.
- `src/runtime/managers/supervisor-dialogue-manager.js`: Runtime bridge manager for dispatch and inbound processing.
- `src/runtime/supervisor/openclaw-adapter.js`: Safe command/HTTP adapter for OpenClaw delivery.
- `src/runtime/supervisor/outbound-dispatcher.js`: Pending event delivery and checkpoint advancement.
- `src/runtime/supervisor/inbound-adjudicator.js`: Authority-boundary enforcement for inbound messages.
- `src/runtime/supervisor/message-normalizer.js`: Canonical inbound message shape and proposal key derivation.
- `src/runtime/create-managers.js`: Manager construction and registry entry.
- `src/runtime/create-runtime-interface.js`: Runtime summary exposure.
- `src/runtime/runtime-config-defaults.js` and `src/runtime/config/schema.js`: Optional supervisor config with safe defaults.
- `.opencode/tests/supervisor-dialogue-store.test.js`: Store unit tests.
- `tests/runtime/openclaw-supervisor-dialogue.test.js`: Runtime integration tests.

## Implementation Slices

| Slice | Name | Work |
| --- | --- | --- |
| S1 | Durable supervisor store and session summary | Create a per-work-item store with schemas `openkit/supervisor-session@1`, `openkit/supervisor-checkpoint@1`, and `openkit/supervisor-event@1`; expose session summary and bounded dedupe state. |
| S2 | Emit normalized supervisor events from authority points | Hook successful workflow-state mutations and append normalized events for stage changes, approvals, evidence, issues/blockers, pauses, and attention signals. |
| S3 | Runtime bridge manager and OpenClaw adapter | Add a manager that can list pending outbound events, deliver via command or HTTP transport, and degrade safely when unconfigured. |
| S4 | Inbound adjudication and anti-loop controls | Normalize inbound messages, reject direct execution/mutation requests, record safe suggestions/attention requests, and maintain dedupe message/proposal checkpoints. |

## Validation Matrix

| Validation | Purpose |
| --- | --- |
| `node --test .opencode/tests/supervisor-dialogue-store.test.js tests/runtime/openclaw-supervisor-dialogue.test.js` | Dedicated FEATURE-937 store and runtime bridge validation. |
| `node --test .opencode/tests/workflow-state-controller.test.js .opencode/tests/workflow-state-cli.test.js tests/runtime/runtime-bootstrap.test.js tests/runtime/mcp-dispatch.test.js tests/runtime/runtime-platform.test.js` | Regression coverage for touched workflow/runtime surfaces when feasible. |
| `npm run verify:runtime-foundation` | Bootstrap, manager, and runtime foundation regression check. |
| `npm run verify:governance` | Governance/documentation contract regression when docs or workflow surfaces are restored. |
| `node .opencode/workflow-state.js validate` | Managed workflow-state validity after reconciliation evidence is recorded. |

## Integration Checkpoint

The integration checkpoint is satisfied when the dedicated FEATURE-937 tests pass, runtime bootstrap succeeds with the supervisor manager present but disabled by default, workflow-state validation passes, and reconciliation evidence is recorded on work item `feature-937`. At that point the work item should remain in `full_qa` for QA validation rather than being advanced to done by implementation.

## Design Notes

- The durable store lives in the same managed runtime root as work-item state, avoiding a hosted queue or service dependency.
- Session health separates `transport_health` from `degraded_mode` so unconfigured transport is observable but non-fatal.
- Delivery checkpoints only advance after adapter success. Failed or unavailable delivery keeps events pending and records degraded health.
- Inbound adjudication records OpenClaw dialogue as transcript data. OpenKit operators or agents must still use normal OpenKit commands to act on any suggestion.
- Anti-loop controls are intentionally simple: message IDs dedupe exact repeats, proposal keys dedupe repeated proposals with the same intent and target.

## Reconciliation Note

This solution package was reconstructed during FEATURE-937 reconciliation from the managed task board, prior evidence entries, and surviving schema descriptions because the original repository artifact was missing.
