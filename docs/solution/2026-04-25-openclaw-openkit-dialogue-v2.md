---
artifact_type: solution_package
version: 1
status: ready
feature_id: FEATURE-940
feature_slug: openclaw-openkit-dialogue-v2
source_scope_package: docs/scope/2026-04-25-openclaw-openkit-dialogue-v2.md
owner: SolutionLead
approval_gate: solution_to_fullstack
lane: full
stage: full_solution
supersedes: FEATURE-937
parallel_mode: none
---

# Solution Package: OpenClaw OpenKit Dialogue V2

## Source Scope And Approval Context

- Upstream approved scope: `docs/scope/2026-04-25-openclaw-openkit-dialogue-v2.md`.
- Current lane/stage: `full` / `full_solution` for `FEATURE-940`.
- Approval context: `product_to_solution` is approved; this package is the `solution_to_fullstack` handoff artifact.
- Historical context: `FEATURE-937` is superseded evidence only. Its reconstructed code may be inspected, retained, refined, or replaced only when it satisfies this FEATURE-940 package and the approved scope. It is not delivery proof.

## Chosen Approach

Retain and refine the reconstructed supervisor-dialogue implementation instead of replacing it wholesale.

This is enough because the current repository already has the right primitive seams:

- durable supervisor dialogue store: `.opencode/lib/supervisor-dialogue-store.js`
- workflow-state mutation hook for stage/approval/evidence/issue events: `.opencode/lib/workflow-state-controller.js`
- runtime manager and OpenClaw transport adapter: `src/runtime/managers/supervisor-dialogue-manager.js`, `src/runtime/supervisor/*.js`
- runtime config defaults/schema and runtime summary exposure
- focused tests in `tests/runtime/openclaw-supervisor-dialogue.test.js` and `.opencode/tests/supervisor-dialogue-store.test.js`
- FEATURE-939 scan/tool evidence pipeline for review and QA gates

The implementation should harden those seams so the observable contract is complete: outbound events happen only after successful OpenKit authority writes, inbound OpenClaw messages are normalized and adjudicated without mutation, duplicates/loops are suppressed but audited, degraded/offline state is visible without blocking OpenKit, and review/QA can inspect the results with correct validation-surface labels.

## Tooling Used To Ground This Plan

- `tool.runtime-summary`: succeeded and confirmed active work item `feature-940`, `full_solution`, missing task board, and `parallel_mode: none`.
- `tool.semantic-search`: available but returned keyword-mode/low recall for supervisor dialogue; fallback file reads and targeted grep were used.
- `tool.find-symbol`: available but returned no `SupervisorDialogueManager` / `SupervisorDialogueStore` matches because the graph index did not include these newer files.
- `tool.import-graph` / dependency graph: graph summary worked, but target supervisor files were `not-indexed` and index mutation was `read-only`; fallback reads/grep were used.
- `tool.syntax-outline` / AST search: path handling was degraded for this session (`invalid-path`/`missing-file` on existing files); fallback `Read`, `Glob`, and `Grep` were used.

These degraded tool results are not blockers for the solution, but Code Reviewer and QA must report direct/substitute/manual scan evidence through the FEATURE-939 evidence format rather than hiding tool limitations.

## Dependencies

- No new npm package dependency is required.
- No hosted OpenClaw service, account setup, credential manager, CI service, or required network dependency is introduced.
- Existing Node.js runtime remains sufficient.
- Supervisor dialogue remains disabled/unconfigured by default in runtime config.
- Existing environment variables remain sufficient: `OPENKIT_PROJECT_ROOT`, `OPENKIT_WORKFLOW_STATE`, `OPENKIT_KIT_ROOT`, `OPENCODE_HOME`, and existing OpenKit runtime config loading.
- Target-project app validation remains out of scope and unavailable unless a target project defines app-native commands.

## Impacted Surfaces And Exact File Targets

### Durable store and workflow-state authority writes

- `.opencode/lib/supervisor-dialogue-store.js`
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/lib/runtime-summary.js`
- `.opencode/workflow-state.js`
- `.opencode/tests/supervisor-dialogue-store.test.js`
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/workflow-state-cli.test.js`

### Runtime bridge, adapter, normalization, adjudication

- `src/runtime/managers/supervisor-dialogue-manager.js`
- `src/runtime/supervisor/outbound-dispatcher.js`
- `src/runtime/supervisor/openclaw-adapter.js`
- `src/runtime/supervisor/message-normalizer.js`
- `src/runtime/supervisor/inbound-adjudicator.js`
- `src/runtime/create-managers.js`
- `src/runtime/create-runtime-interface.js`
- `tests/runtime/openclaw-supervisor-dialogue.test.js`

### Runtime config, optional OpenKit-owned tooling, and MCP schema if needed

- `src/runtime/runtime-config-defaults.js`
- `src/runtime/config/schema.js`
- `src/runtime/types.js`
- `src/runtime/tools/tool-registry.js` (only if adding an OpenKit-owned supervisor dialogue runtime tool)
- `src/runtime/tools/supervisor/supervisor-dialogue.js` (create only if the implementation chooses a runtime tool for operator/QA receive/dispatch/summary actions)
- `src/mcp-server/tool-schemas.js` (only if that runtime tool is exposed to OpenKit agents; do **not** expose any authority-mutating action)
- `tests/runtime/runtime-config-loader.test.js`
- `tests/runtime/runtime-bootstrap.test.js`
- `tests/mcp-server/mcp-server.test.js` (only if MCP exposure changes)

### Documentation, reporting, and QA artifacts

- `context/core/project-config.md`
- `context/core/runtime-surfaces.md`
- `docs/operator/supported-surfaces.md`
- `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
- `docs/templates/qa-report-template.md` (add supervisor dialogue evidence prompts if current template is insufficient)
- `docs/qa/2026-04-25-openclaw-openkit-dialogue-v2.md` (create during QA, not implementation)
- `AGENTS.md` only if current-state command/tool facts change.

### Existing scan/evidence pipeline surfaces to use, not redesign

- `src/runtime/tools/audit/rule-scan.js`
- `src/runtime/tools/audit/security-scan.js`
- `src/runtime/tools/audit/scan-evidence.js`
- `.opencode/lib/scan-evidence-summary.js`
- `context/core/approval-gates.md`
- `docs/templates/qa-report-template.md`

## Authority-Boundary Design

OpenClaw is an advisory supervisor only.

Allowed OpenClaw behaviors:

- observe outbound OpenKit workflow events
- acknowledge received events
- send advisory proposals, concerns, observations, and human-attention requests
- be unavailable or degraded without blocking OpenKit

Forbidden OpenClaw behaviors:

- execute shell commands
- call OpenKit tools as an authority actor
- edit files or create commits
- mutate workflow state or task boards
- transition stages or approve gates
- record verification evidence
- close, resolve, or update issues
- mark review, QA, or the feature complete

Implementation rule: inbound OpenClaw messages may write only to the supervisor dialogue record and related supervisor health/read-model fields. They must not call workflow-state mutators such as `setApproval`, `advanceStage`, `recordVerificationEvidence`, `recordIssue`, `updateIssueStatus`, `createTask`, `setTaskStatus`, or any execution/edit surface. If an inbound message mixes safe advisory text with an unsafe mutation/execution request, unsafe authority-boundary handling wins.

## Interfaces And Data Contracts

### Store location

Supervisor dialogue records remain per work item:

```text
.opencode/work-items/<work_item_id>/supervisor-dialogue.json
```

For globally managed sessions, the runtime root may be under OpenCode home. Reporting must preserve the path-model split from `context/core/runtime-surfaces.md` and must not treat project-local `.opencode` as the only source of truth.

### Existing schemas to preserve

Preserve the externally inspectable schema names already allowed by the approved scope:

- `openkit/supervisor-session@1`
- `openkit/supervisor-checkpoint@1`
- `openkit/supervisor-event@1`

Additive fields are allowed. Do not rename these schemas without a separate approved compatibility decision.

### Outbound event record

Each outbound event must include, at minimum:

```js
{
  schema: 'openkit/supervisor-event@1',
  event_id,
  event_seq,
  work_item_id,
  origin: 'openkit',
  event_type,
  created_at,
  state_cursor,
  summary,
  details,
  delivery_status: 'pending' | 'delivered' | 'failed' | 'skipped',
  delivered_at: string | null,
  last_delivery_attempt_at: string | null,
  last_delivery_error: string | null,
  delivery_attempts: [/* compact attempt records */]
}
```

Current code has event identity and sequencing but should be refined to make per-event delivery status auditable instead of relying only on `last_delivered_outbound_seq`.

### Inbound message and adjudication record

Each inbound OpenClaw record must preserve both raw and normalized data:

```js
{
  schema: 'openkit/supervisor-inbound-message@1',
  origin: 'openclaw',
  message_id,
  message_seq,
  work_item_id,
  type,
  intent,
  target,
  body,
  severity,
  created_at,
  received_at,
  proposal_key,
  raw
}
```

Adjudications must make authority and actionability explicit:

```js
{
  message_id,
  message_seq,
  proposal_key,
  disposition:
    'recorded_suggestion' |
    'acknowledged' |
    'concern_recorded' |
    'attention_required' |
    'duplicate_ignored' |
    'invalid_rejected' |
    'rejected_authority_boundary',
  actionable: false,
  reason,
  authority_boundary: 'openkit_only_mutates_state_and_executes_code',
  duplicate_of: string | null,
  created_at,
  details
}
```

No adjudication disposition is an approval, task assignment, verification result, issue closure, or stage transition.

### Stable dedupe keys

- Duplicate message: exact `message_id` repeat.
- Repeated proposal pressure: stable key derived from normalized target + normalized intent/action class + normalized subject, not raw message body alone.
- A repeated proposal with different wording but the same target and intent must not create a second actionable attention item.
- Duplicate/repeated messages must still leave an audit record showing that a repeat occurred.

### Runtime config

Keep `supervisorDialogue.enabled` defaulting to `false` and `openclaw.transport` defaulting to `unconfigured`.

Supported transport states remain intentionally small:

- `unconfigured`
- `http`
- `command`

If the implementation adds optional tuning, keep it bounded to non-authority concerns such as delivery timeout, max pending events, or dedupe window. Do not add credentials, background worker requirements, or a hosted-service dependency as part of FEATURE-940.

## Recommended Path

Execute all slices sequentially with TDD for every runtime/controller/CLI behavior change.

Reasoning:

- The feature touches shared workflow authority surfaces, runtime config, store contracts, runtime manager behavior, and review/QA evidence. Parallel implementation would risk inconsistent authority boundaries or read models.
- Current code is close enough to retain/refine, but it has important gaps: per-event delivery status, task-board event coverage, missing-minimum inbound validation, repeated-proposal dedupe that currently includes body text, and limited operator/QA read-model detail.
- The runtime task board is currently missing for `feature-940`; it must be created before the actual `solution_to_fullstack` approval gate can advance.

## Implementation Slices

### [ ] Slice 1: Harden supervisor dialogue store contracts

- **Executable slice name**: `TASK-F940-STORE`
- **Files**:
  - `.opencode/lib/supervisor-dialogue-store.js`
  - `.opencode/tests/supervisor-dialogue-store.test.js`
- **Goal**: make durable outbound, inbound, adjudication, dedupe, and delivery-state records sufficient for audit/review/QA.
- **Dependencies**: none.
- **TDD expectations**:
  - First add failing tests for per-event `delivery_status`, delivery attempts, failed/skipped delivery visibility, invalid inbound disposition, authority-boundary disposition metadata, duplicate message identity, repeated proposal key with different body text, and audit-preserving duplicate records.
  - Then update store functions minimally until those tests pass.
- **Validation Command**:
  - `node --test ".opencode/tests/supervisor-dialogue-store.test.js"`
- **Details**:
  - Retain current schema constants and store path.
  - Replace or supplement checkpoint-only delivered cursor with per-event status fields.
  - Add explicit invalid/minimum-information handling instead of silently defaulting every missing target/intent/body into a safe suggestion.
  - Make repeated proposal keys stable for same target/intent pressure even when wording changes.
  - Ensure acknowledgement records cannot enqueue outbound events by themselves.

### [ ] Slice 2: Emit outbound events only after successful OpenKit authority writes

- **Executable slice name**: `TASK-F940-AUTHORITY-EVENTS`
- **Files**:
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/lib/supervisor-dialogue-store.js`
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/supervisor-dialogue-store.test.js`
- **Goal**: ensure outbound supervisor events are recorded after successful authoritative OpenKit writes and never for failed/rejected writes.
- **Dependencies**: `TASK-F940-STORE`.
- **TDD expectations**:
  - Add failing controller tests for successful `setApproval`, `advanceStage`, `recordVerificationEvidence`, `recordIssue`, issue-status changes, and task-board status/blocker changes creating outbound events only after the underlying write succeeds.
  - Add failing tests proving validation failures do not append success events.
  - Add a failing test proving supervisor event append failure degrades supervisor reporting without rolling back or falsely failing the already-successful OpenKit authority write.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`
  - `node --test ".opencode/tests/supervisor-dialogue-store.test.js"`
- **Details**:
  - Keep OpenKit workflow mutations as the only source of authority. The supervisor event is a post-write observation, not part of the authority decision.
  - Current `mutate` / `mutateWorkItem` already appends events after `persistManagedState`; retain this ordering but make supervisor append best-effort and visibly degraded on append failure.
  - Extend event mapping beyond stage/approval/evidence/new-issue deltas to include relevant issue status changes, task-board status/blocker changes, blocked/unblocked or pause/resume signals, and human-attention signals where current state supports them.
  - Do not add new workflow lanes, stages, approvals, or enum families.

### [ ] Slice 3: Complete OpenClaw runtime bridge and inbound adjudication

- **Executable slice name**: `TASK-F940-RUNTIME-BRIDGE`
- **Files**:
  - `src/runtime/managers/supervisor-dialogue-manager.js`
  - `src/runtime/supervisor/outbound-dispatcher.js`
  - `src/runtime/supervisor/openclaw-adapter.js`
  - `src/runtime/supervisor/message-normalizer.js`
  - `src/runtime/supervisor/inbound-adjudicator.js`
  - `src/runtime/tools/tool-registry.js` (only if adding an OpenKit-owned supervisor tool)
  - `src/runtime/tools/supervisor/supervisor-dialogue.js` (create only if needed for OpenKit-owned operator/QA receive/dispatch/summary actions)
  - `src/mcp-server/tool-schemas.js` (only if exposing that OpenKit-owned runtime tool)
  - `tests/runtime/openclaw-supervisor-dialogue.test.js`
  - `tests/mcp-server/mcp-server.test.js` (only if MCP exposure changes)
- **Goal**: make command/http delivery, inbound message capture, normalization, adjudication, and degraded/offline handling complete without giving OpenClaw authority.
- **Dependencies**: `TASK-F940-STORE`, `TASK-F940-AUTHORITY-EVENTS`.
- **TDD expectations**:
  - Add failing runtime tests for command/http unavailable, timeout, invalid response, partial delivery, successful delivery, OpenClaw response containing acknowledgements/proposals, read-only manager behavior, unsafe mixed inbound requests, invalid inbound payloads, and no workflow-state mutation from inbound messages.
  - If adding a runtime tool, test that it exposes only OpenKit-owned `summary`, `dispatchPending`, and `receiveInbound` style actions and no execution/workflow mutation action.
- **Validation Command**:
  - `node --test "tests/runtime/openclaw-supervisor-dialogue.test.js"`
  - `node --test "tests/mcp-server/mcp-server.test.js"` if MCP/tool schema changes
  - `npm run verify:runtime-foundation`
- **Details**:
  - `OpenClawAdapter` may call an HTTP endpoint or command transport only when configured/enabled; otherwise it returns structured disabled/unconfigured/degraded results.
  - If OpenClaw delivery returns acknowledgement/proposal data, the manager normalizes and adjudicates it as inbound dialogue; it must not execute or mutate workflow.
  - Read-only runtime mode must not write supervisor stores or dispatch outbound events.
  - The bridge must never treat OpenClaw output as an approval, test result, issue closure, task assignment, or command to run.

### [ ] Slice 4: Expose operator/reviewer/QA read models and config health

- **Executable slice name**: `TASK-F940-REPORTING`
- **Files**:
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/workflow-state.js`
  - `src/runtime/create-runtime-interface.js`
  - `src/runtime/create-managers.js`
  - `src/runtime/runtime-config-defaults.js`
  - `src/runtime/config/schema.js`
  - `src/runtime/types.js`
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `.opencode/tests/workflow-state-cli.test.js`
  - `tests/runtime/runtime-bootstrap.test.js`
  - `tests/runtime/runtime-config-loader.test.js`
- **Goal**: make supervisor health, delivery state, inbound dispositions, authority rejections, duplicate outcomes, and attention needs visible in existing status/resume/runtime surfaces.
- **Dependencies**: `TASK-F940-RUNTIME-BRIDGE`.
- **TDD expectations**:
  - Add failing CLI/runtime summary tests for `status`, `resume-summary --json`, and runtime interface output showing supervisor health, pending/delivered/failed/skipped counts, last adjudication, rejection counts, duplicate counts, and attention state.
  - Add config tests proving disabled/unconfigured supervisor dialogue is valid and non-fatal.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node --test "tests/runtime/runtime-bootstrap.test.js"`
  - `node --test "tests/runtime/runtime-config-loader.test.js"`
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js resume-summary --json`
- **Details**:
  - Keep reporting under existing workflow/runtime surfaces; do not add a chat UI or new lane command family.
  - Label read-model evidence as `compatibility_runtime` or `runtime_tooling`, not `target_project_app`.
  - If no supervisor store exists yet, report the session as absent/unavailable rather than throwing.

### [ ] Slice 5: Review/QA evidence, docs, and final verification path

- **Executable slice name**: `TASK-F940-EVIDENCE-QA`
- **Files**:
  - `docs/templates/qa-report-template.md`
  - `docs/qa/2026-04-25-openclaw-openkit-dialogue-v2.md` (created by QA)
  - `context/core/project-config.md`
  - `context/core/runtime-surfaces.md`
  - `docs/operator/supported-surfaces.md`
  - `docs/kit-internals/04-tools-hooks-skills-and-mcps.md`
  - `tests/runtime/audit-tools.test.js` only if scan evidence behavior is touched
  - `.opencode/tests/workflow-state-controller.test.js`
  - `.opencode/tests/workflow-contract-consistency.test.js`
- **Goal**: make downstream implementation handoff, code review, and QA evidence inspectable under FEATURE-940 and FEATURE-939 rules.
- **Dependencies**: all prior slices.
- **TDD expectations**:
  - If docs/governance tests cover template/agent/reporting contracts, write failing tests before changing them.
  - Do not change scan/tool evidence behavior unless a failing test proves the gap.
- **Validation Command**:
  - `npm run verify:governance`
  - `node --test "tests/runtime/audit-tools.test.js"` if audit tool behavior changes
  - `node --test ".opencode/tests/workflow-contract-consistency.test.js"`
  - `npm run verify:all` for final integration
  - `node .opencode/workflow-state.js validate`
  - `node .opencode/workflow-state.js show-policy-status`
  - `node .opencode/workflow-state.js show-invocations feature-940`
- **Details**:
  - QA report must include a dedicated supervisor dialogue evidence section in addition to the existing scan/tool evidence section.
  - Code review must verify scope compliance before quality and must use FEATURE-939 scan evidence fields.
  - QA must demonstrate at least one safe inbound proposal, one rejected authority-boundary request, one duplicate/repeated proposal outcome, one degraded/offline OpenClaw outcome, and one outbound event created only after a successful OpenKit authority write.

## Dependency Graph

Sequential chain:

```text
TASK-F940-STORE
  -> TASK-F940-AUTHORITY-EVENTS
  -> TASK-F940-RUNTIME-BRIDGE
  -> TASK-F940-REPORTING
  -> TASK-F940-EVIDENCE-QA
```

Critical path: durable contract → authority write observation → bridge/adjudication → read models → review/QA evidence.

No slice should run in parallel unless this solution package is revised and a safe parallel zone is approved. Shared surfaces are too tightly coupled for honest parallelism in the current plan.

## Parallelization Assessment

- parallel_mode: `none`
- why: shared workflow-state controller, supervisor store, runtime manager, and reporting surfaces must remain consistent; dedupe/authority semantics are cross-cutting and unsafe to split without integration risk.
- safe_parallel_zones: []
- sequential_constraints:
  - `TASK-F940-STORE -> TASK-F940-AUTHORITY-EVENTS -> TASK-F940-RUNTIME-BRIDGE -> TASK-F940-REPORTING -> TASK-F940-EVIDENCE-QA`
- integration_checkpoint: after `TASK-F940-EVIDENCE-QA`, run final targeted supervisor tests, governance checks, `npm run verify:all`, workflow-state validation, and scan/tool evidence policy checks before requesting Code Reviewer.
- max_active_execution_tracks: `1`

## Task Board Recommendation

The runtime currently reports `taskBoardPresent: false` for `feature-940`. A valid full-delivery task board is required before `solution_to_fullstack` can be approved or `full_implementation` can begin.

Recommended executable task names:

| Task ID | Title | Kind | Depends On | Primary Artifact Refs |
| --- | --- | --- | --- | --- |
| `TASK-F940-STORE` | Harden supervisor dialogue store contracts | `implementation` | none | `.opencode/lib/supervisor-dialogue-store.js`, `.opencode/tests/supervisor-dialogue-store.test.js` |
| `TASK-F940-AUTHORITY-EVENTS` | Emit supervisor events after authority writes | `implementation` | `TASK-F940-STORE` | `.opencode/lib/workflow-state-controller.js`, `.opencode/lib/supervisor-dialogue-store.js`, `.opencode/tests/workflow-state-controller.test.js` |
| `TASK-F940-RUNTIME-BRIDGE` | Complete OpenClaw runtime bridge and adjudication | `implementation` | `TASK-F940-AUTHORITY-EVENTS` | `src/runtime/managers/supervisor-dialogue-manager.js`, `src/runtime/supervisor/`, `tests/runtime/openclaw-supervisor-dialogue.test.js` |
| `TASK-F940-REPORTING` | Expose supervisor health and dialogue read models | `implementation` | `TASK-F940-RUNTIME-BRIDGE` | `.opencode/lib/runtime-summary.js`, `.opencode/workflow-state.js`, `src/runtime/create-runtime-interface.js`, runtime config files |
| `TASK-F940-EVIDENCE-QA` | Prepare review/QA evidence and documentation surfaces | `verification` | `TASK-F940-REPORTING` | `docs/templates/qa-report-template.md`, `docs/qa/2026-04-25-openclaw-openkit-dialogue-v2.md`, governance/docs tests |

Recommended command sequence for the orchestrator or operator after this solution is accepted:

```text
node .opencode/workflow-state.js set-parallelization none "FEATURE-940 supervisor dialogue touches shared workflow/runtime authority surfaces; execute sequentially." "After TASK-F940-EVIDENCE-QA, run supervisor tests, scan/tool evidence gates, npm run verify:all, and workflow-state validation." 1
node .opencode/workflow-state.js create-task feature-940 TASK-F940-STORE "Harden supervisor dialogue store contracts" implementation
node .opencode/workflow-state.js create-task feature-940 TASK-F940-AUTHORITY-EVENTS "Emit supervisor events after authority writes" implementation
node .opencode/workflow-state.js create-task feature-940 TASK-F940-RUNTIME-BRIDGE "Complete OpenClaw runtime bridge and adjudication" implementation
node .opencode/workflow-state.js create-task feature-940 TASK-F940-REPORTING "Expose supervisor health and dialogue read models" implementation
node .opencode/workflow-state.js create-task feature-940 TASK-F940-EVIDENCE-QA "Prepare review QA evidence and documentation surfaces" verification
node .opencode/workflow-state.js validate-task-allocation feature-940
```

Current CLI `create-task` support is a minimal task-board initializer and does not encode every dependency/artifact ref shown above. The solution package remains the source of sequencing and artifact ownership unless the task-board runtime is extended or the board is created through a controller path that supports full `depends_on` and `artifact_refs` metadata. With `parallel_mode: none`, only one active execution task should be claimed at a time even if multiple task rows are ready.

## Acceptance-To-Validation Matrix

| AC | Scope Target | Implementation/Test Validation | Review/QA Evidence |
| --- | --- | --- | --- |
| AC1 | Outbound events only after successful OpenKit authority actions, with inspectable identity/origin/type/work item/timestamp/summary/context | `.opencode/tests/workflow-state-controller.test.js`; `.opencode/tests/supervisor-dialogue-store.test.js`; `node .opencode/workflow-state.js resume-summary --json` | Reviewer checks failed writes do not emit success events; QA demonstrates one successful authority write event and one failed/rejected write with no success event. |
| AC2 | OpenClaw cannot execute code or mutate workflow state; unsafe requests recorded/rejected/quarantined | `tests/runtime/openclaw-supervisor-dialogue.test.js`; `.opencode/tests/supervisor-dialogue-store.test.js`; controller tests proving no workflow-state mutator is invoked from inbound path | QA submits unsafe run/approve/evidence/task/issue request and confirms only supervisor record changes. |
| AC3 | Inbound acknowledgements, concerns, proposals, and attention requests normalized with safe dispositions | `tests/runtime/openclaw-supervisor-dialogue.test.js`; `.opencode/tests/supervisor-dialogue-store.test.js` | QA report lists inbound dispositions and confirms advisory context is not an approval/task/evidence result. |
| AC4 | Duplicate messages and repeated proposal keys avoid duplicate actionable items while remaining auditable | `.opencode/tests/supervisor-dialogue-store.test.js`; `tests/runtime/openclaw-supervisor-dialogue.test.js` | QA demonstrates duplicate `message_id` and repeated target/intent proposal with different wording. |
| AC5 | Unconfigured/degraded/offline OpenClaw does not fail startup or block workflow progress and remains visible | `tests/runtime/runtime-bootstrap.test.js`; `tests/runtime/openclaw-supervisor-dialogue.test.js`; `node .opencode/workflow-state.js status`; `resume-summary --json` | QA demonstrates disabled/unconfigured and timeout/error transport while workflow-state validation still passes. |
| AC6 | Reporting exposes session health, delivery state, inbound dispositions, rejected attempts, dedupe outcomes, attention needs | `.opencode/tests/workflow-state-cli.test.js`; `.opencode/lib/runtime-summary.js` read-model tests; `src/runtime/create-runtime-interface.js` tests | QA report includes supervisor session health table and raw artifact refs. |
| AC7 | Delivery includes inspectable scope, solution, implementation evidence, code review, QA, and scan/tool evidence; FEATURE-937 not delivery substitute | This solution path; task-board validation; `node .opencode/workflow-state.js show-policy-status`; `show-invocations feature-940` | Code Reviewer and QA cite FEATURE-940 artifacts only; FEATURE-937 appears only as historical risk context. |
| AC8 | Validation reports distinguish OpenKit runtime/tooling, compatibility runtime, global CLI, documentation, and unavailable target-project app validation | `context/core/runtime-surfaces.md`; `context/core/project-config.md`; `docs/templates/qa-report-template.md`; workflow evidence with `details.validation_surface`; `npm run verify:governance` | QA labels OpenKit tests/scans as `runtime_tooling` or `compatibility_runtime`; target-project app validation is explicitly `unavailable`. |

## Validation Plan

### Slice-level commands

- Store: `node --test ".opencode/tests/supervisor-dialogue-store.test.js"`
- Controller/events: `node --test ".opencode/tests/workflow-state-controller.test.js"`
- Runtime bridge: `node --test "tests/runtime/openclaw-supervisor-dialogue.test.js"`
- Runtime bootstrap/config: `node --test "tests/runtime/runtime-bootstrap.test.js"`; `node --test "tests/runtime/runtime-config-loader.test.js"`; `npm run verify:runtime-foundation`
- MCP/tool schema, only if changed: `node --test "tests/mcp-server/mcp-server.test.js"`
- CLI/read models: `node --test ".opencode/tests/workflow-state-cli.test.js"`; `node .opencode/workflow-state.js validate`; `node .opencode/workflow-state.js resume-summary --json`
- Docs/governance: `npm run verify:governance`; `node --test ".opencode/tests/workflow-contract-consistency.test.js"`

### Final integration commands

- `npm run verify:all`
- `node .opencode/workflow-state.js validate`
- `node .opencode/workflow-state.js show-policy-status`
- `node .opencode/workflow-state.js show-invocations feature-940`
- `node .opencode/workflow-state.js validate-task-allocation feature-940`
- `node .opencode/workflow-state.js integration-check feature-940`

### Scan/tool evidence requirements

- Fullstack must run `tool.rule-scan` on changed files before implementation handoff, or record structured unavailable/degraded direct status plus substitute/manual evidence through FEATURE-939 fields.
- Code Reviewer must run `tool.rule-scan` and `tool.security-scan` on changed files before Stage 2 quality result, or record valid substitute/manual evidence.
- QA must run `tool.rule-scan`, `tool.security-scan`, and `tool.evidence-capture` before PASS/FAIL recommendation, preserving validation-surface labels and classification summaries.
- Unclassified scan groups, unresolved true-positive security findings, or blocking findings must prevent handoff/closure until resolved or routed with approved risk handling.

### Explicit unavailable validation path

- No target-project app build/lint/test command is part of FEATURE-940. Do not report `npm run verify:*`, workflow-state tests, runtime tools, or OpenKit scans as target-project app validation.
- Target-project app validation must be reported as `unavailable` unless a future target project defines app-native commands.

## Review/QA Scan Evidence Plan Using FEATURE-939

Code Review and QA reports must include a `Scan/Tool Evidence` section with:

- direct tool status for `tool.rule-scan` and `tool.security-scan`
- substitute status and limitations when direct tools are unavailable/degraded
- evidence type: `direct_tool`, `substitute_scan`, or `manual_override`
- finding counts and severity/category summary
- classification summary: `blocking`, `true_positive`, `non_blocking_noise`, `false_positive`, `follow_up`, `unclassified`
- false-positive rationale with rule/file/context/rationale/impact/follow-up
- manual override caveats with target stage, unavailable tool, reason, actor, substitute limitations, and caveat
- validation-surface labels: `runtime_tooling`, stored `compatibility_runtime`, `documentation`, `global_cli`, and unavailable `target_project_app`
- artifact refs for raw scan output, workflow evidence IDs, task refs, and QA report

QA must also include a `Supervisor Dialogue Evidence` section showing:

- supervisor health: disabled/unconfigured/degraded/healthy
- outbound event statuses: pending/delivered/failed/skipped
- inbound dispositions: acknowledgement, advisory proposal, concern, attention, invalid, duplicate, rejected authority boundary
- dedupe outcomes and duplicate/repeated proposal evidence
- degraded/offline scenario evidence
- proof that inbound OpenClaw messages did not mutate workflow state beyond the supervisor dialogue record

## Integration Checkpoint

Before requesting Code Reviewer:

1. All sequential tasks are implementation-complete with no active task-board work.
2. Store, controller, runtime, CLI/read-model, and governance tests pass.
3. At least one supervisor event exists from a successful OpenKit authority write in test/fixture evidence.
4. At least one unsafe inbound OpenClaw request is recorded as `rejected_authority_boundary` with no workflow mutation.
5. At least one duplicate or repeated proposal is recorded as `duplicate_ignored` or equivalent dedupe disposition.
6. At least one disabled/unconfigured/offline transport path is visible as degraded/unavailable without failing workflow validation.
7. FEATURE-939 scan evidence is present and classified for changed files.
8. `node .opencode/workflow-state.js validate-task-allocation feature-940` and `integration-check feature-940` are clear or any blocker is explicitly routed.

## Risks And Trade-offs

- **Authority-boundary regression**: adding inbound receive paths can accidentally call workflow mutators. Mitigation: inbound code path may write only supervisor dialogue records; tests must snapshot workflow state before/after unsafe inbound messages.
- **Event append failure after state write**: current append behavior can make a successful authority write look failed if supervisor append throws. Mitigation: make supervisor append best-effort and record degraded supervisor health without rolling back the authority write.
- **Task-board event coverage gap**: current supervisor event builder observes workflow state deltas, while task-board writes live in `tasks.json`. Mitigation: emit task-board-specific supervisor events after successful `withTaskBoard` writes where relevant.
- **Dedupe too narrow**: current proposal key derivation includes body text, so different wording may bypass repeated-proposal controls. Mitigation: derive proposal pressure key from normalized target/intent/action subject, not body alone.
- **Degraded/offline ambiguity**: checkpoint-only pending counts are not enough to distinguish failed/skipped/delivered events. Mitigation: add per-event delivery status and compact delivery attempts.
- **Over-exposing tools to OpenClaw**: adding an operator runtime tool could be misunderstood as OpenClaw authority. Mitigation: keep any tool OpenKit-owned, advisory-only, and non-authority; never expose execution/workflow mutation actions.
- **FEATURE-937 contamination**: reconstructed files may look complete but were not approved under FEATURE-940. Mitigation: require FEATURE-940 tests, review, QA, and scan evidence; cite FEATURE-937 only as historical risk context.
- **Scan noise**: FEATURE-939 quality scan can be high-volume. Mitigation: classify groups and link artifacts; do not use manual override to avoid triaging usable noisy output.

## Rollback Notes

- Supervisor dialogue is disabled by default; operational rollback can set `supervisorDialogue.enabled: false` and leave OpenKit workflow behavior intact.
- Code rollback should remove or revert supervisor event append hooks and runtime bridge changes while preserving workflow-state controller authority semantics.
- Durable store records are additive audit artifacts. Do not delete existing `supervisor-dialogue.json` records during rollback unless explicitly authorized; prefer ignoring disabled dialogue records in read models.
- If a new OpenKit-owned supervisor runtime tool is added and causes issues, disable or remove that tool registration/schema first while retaining store/read-model safety.
- If scan evidence tooling is unavailable during rollback verification, use FEATURE-939 substitute/manual override rules with explicit caveats; do not claim direct scan success.

## Reviewer Focus Points

- Scope compliance: no new lane/mode/stage/gate family and no OpenClaw execution/workflow authority.
- Outbound timing: events are appended only after successful OpenKit authority writes and are not emitted for failed/rejected writes.
- Inbound safety: unsafe mixed messages are rejected/quarantined and cannot call controller mutators or code execution surfaces.
- Dedupe: exact message duplicates and repeated target/intent proposals are idempotent from an actionability perspective but auditable.
- Degraded behavior: disabled/unconfigured/offline supervisor states do not block OpenKit startup, stage/gate flow, or validation commands.
- Read models: status/resume/runtime summaries expose enough supervisor details for QA without dumping raw high-volume records.
- Scan/tool evidence: FEATURE-939 fields are present, classified, and validation surfaces are labeled honestly.
- Tests: runtime/controller/CLI changes follow RED-GREEN-REFACTOR; no production code should be written before a failing test for that behavior.

## Handoff Recommendation

- Solution package status: `ready`.
- `solution_to_fullstack` recommendation: `PASS` for the technical plan, with the operational prerequisite that the recommended sequential task board is created and validated before Master Orchestrator records the approval.
- Preserve for Fullstack: authority boundary, sequential slice order, TDD expectations, runtime-surface labels, and default degraded/offline safety.
- Preserve for Code Reviewer: two-stage review, scope before quality, FEATURE-939 scan evidence, and no reliance on FEATURE-937 as delivery proof.
- Preserve for QA: supervisor dialogue behavior evidence plus scan/tool evidence; no target-project app validation claims.
