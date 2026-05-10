## [Subagent 1] — Runtime + Workflow Core

### Critical

- [1-C-1] Three divergent FSM transition tables cause advance-stage to accept/block different paths depending on which layer is consulted — `src/runtime/workflow/state-machine.js:29-57` vs `src/runtime/state/transition-engine.js:37-65`
  - Description: `tool.advance-stage` (`src/runtime/tools/workflow/advance-stage.js:59`) calls `isValidTransition` from `state-machine.js` for the FSM check, but `workflowKernel.advanceStage()` (line 178) re-validates inside `WorkflowStateManager.advanceStage()` which uses `TransitionEngine` from `transition-engine.js`. These two tables disagree on at least six transitions, so a transition that `advance-stage` considers valid will be rejected by `WorkflowStateManager`, producing an unrecoverable "failed to persist" error visible to the model with no meaningful guidance.
  - Evidence/repro:
    - `state-machine.js:32` — `full_solution: ['full_implementation']` (no backward to `full_product`)
    - `transition-engine.js:49` — `full_solution: ['full_implementation', 'full_product']` (backward allowed)
    - `state-machine.js:34` — `full_code_review: ['full_qa', 'full_implementation', 'full_solution', 'full_product']`
    - `transition-engine.js:51` — `full_code_review: ['full_qa', 'full_implementation']` (only 2 targets)
    - `state-machine.js:35` — `full_qa: ['full_done', 'full_implementation', 'full_solution', 'full_product']`
    - `transition-engine.js:52` — `full_qa: ['full_done', 'full_implementation']` (only 2 targets)
    - `state-machine.js:54` — `migration_code_review: ['migration_verify', 'migration_upgrade', 'migration_strategy']`
    - `transition-engine.js:61` — `migration_code_review: ['migration_verify', 'migration_upgrade']` (missing strategy)
  - Suggested fix: Merge the two tables into a single authoritative source imported by both `advance-stage.js` and `WorkflowStateManager`.

- [1-C-2] `tool.workflow-state` MCP schema advertises `command` enum but the handler ignores `command` entirely and only supports `workItemId` — `src/mcp-server/tool-schemas.js:297-310` vs `src/runtime/tools/workflow/workflow-state.js:23-48`
  - Description: The MCP schema (line 297–310) lists `command: enum ['status', 'show', 'doctor', 'metrics']` as the input parameter, but the handler in `workflow-state.js` (lines 25–39) reads only `workItemId` and calls either `getWorkItem()` or `getState()`. Any model calling `{ command: 'show' }` or `{ command: 'doctor' }` receives an unstructured `null` result with no error indication. This is a contract mismatch that constitutes a silent broken tool on the main workflow read path.
  - Evidence/repro: Schema line 297: `'tool.workflow-state': { inputSchema: { properties: { command: { enum: ['status', 'show', ...] } } } }`. Handler line 23: `const normalizedInput = ...` then immediately checks `'workItemId' in normalizedInput` — `command` is never read.
  - Suggested fix: Either remove the `command` property from the schema and document the `workItemId` parameter instead, or implement the `command` dispatch in the handler.

### High

- [1-H-1] `safeCall` in `workflow-kernel.js` silently swallows all throws from every controller call, making write failures invisible to callers — `src/runtime/workflow-kernel.js:150-155`
  - Description: The `safeCall` wrapper returns `null` for any exception from the `src/openkit-runtime/lib` controller. Functions like `startBackgroundRun`, `completeBackgroundRun`, `claimTask`, `setTaskStatus` all route through `safeCall` and return `null` on failure, with no error surfaced to the tool or to the model. A SQLite lock, disk full, or malformed JSON in the controller will produce a null return that callers treat as a no-op.
  - Evidence/repro: `src/runtime/workflow-kernel.js:150-155`: `function safeCall(fn, fallback) { try { return fn(); } catch { return fallback; } }`. Lines 190–229 show all critical write operations routing through `safeCall(..., null)`.
  - Suggested fix: Log the swallowed exception at minimum and propagate a structured error object so tool handlers can surface the failure to the model.

- [1-H-2] `gate-requirements.js` and `gate-registry.js` define two completely separate and partially incompatible gate systems that are both live on the `advance-stage` path — `src/runtime/workflow/gate-requirements.js:8-58` vs `src/runtime/state/gate-registry.js:17-93`
  - Description: `advance-stage.js` calls `checkGateRequirements` (from `gate-requirements.js`) first (line 74), then calls `workflowKernel.advanceStage()` which re-checks gates via `GateRegistry` inside `WorkflowStateManager` (line 253 of `workflow-state-manager.js`). The two systems use different gate IDs (`'quick_intake→quick_plan'` vs `'quick.understanding_confirmed'`), different authority strings, and different persistence mechanisms. A gate passed in `gate-requirements.js` may still block in `GateRegistry` because the gate was never written to `state.gates`.
  - Evidence/repro: `gate-requirements.js:10`: `'quick_intake→quick_plan': { requires: ['user_understanding_confirmed'] }`. `gate-registry.js:19`: `'quick.understanding_confirmed': { authority: 'user' }`. Different keys; confirming one does not satisfy the other.
  - Suggested fix: Designate one gate system as authoritative and remove or proxy the other; the `EVIDENCE_TO_GATE` map in `advance-stage.js:131-143` partially bridges them but does not fully reconcile.

- [1-H-3] `tool.bootstrap-workflow` is registered in the runtime tool registry but absent from `TOOL_SCHEMAS` in the MCP server, making it unreachable via MCP for any orchestrator agent — `src/runtime/tools/tool-registry.js:68` vs `src/mcp-server/tool-schemas.js`
  - Description: `createBootstrapWorkflowTool` is registered at line 68 of `tool-registry.js`. Because `'tool.bootstrap-workflow'` has no entry in `TOOL_SCHEMAS`, it is filtered out of `mcpTools` at `index.js:149` (`if (!schema) continue`). The `MasterOrchestrator` role depends on this tool to start any lane; if it is unreachable via MCP the agent has no path to bootstrap a workflow.
  - Evidence/repro: `src/mcp-server/index.js:149`: `const schema = TOOL_SCHEMAS[id]; if (!schema) continue;`. `grep "tool.bootstrap-workflow" src/mcp-server/tool-schemas.js` returns no output.
  - Suggested fix: Add a `'tool.bootstrap-workflow'` entry to `TOOL_SCHEMAS` with the correct `inputSchema` matching `{ lane, description, featureSlug?, archivePrior? }`.

### Medium

- [1-M-1] `advance-stage` handler accepts `gateOverrides` input parameter, but it is not documented in the MCP schema — `src/mcp-server/tool-schemas.js:338-361` vs `src/runtime/tools/workflow/advance-stage.js:8`
  - Description: The handler signature destructures `gateOverrides = {}` and merges it with `evidence` before all gate checks. The MCP schema lists only `targetStage`, `evidence`, and `handoffContext`. Models cannot discover `gateOverrides` and cannot use it to bypass stuck gate checks via MCP.
  - Evidence/repro: `advance-stage.js:8`: `* Input: { targetStage, evidence?, handoffContext?, gateOverrides? }`. `tool-schemas.js:344-360`: only 3 properties, no `gateOverrides`.

- [1-M-2] `quick_intake → quick_plan` gate in `gate-requirements.js` requires `user_understanding_confirmed` but neither `transition-engine.js` nor `WorkflowStateManager.advanceStage()` know about this gate — `src/runtime/workflow/gate-requirements.js:10-12`
  - Description: The `quick_intake→quick_plan` gate is defined only in `gate-requirements.js`, which is consulted by `advance-stage.js`. The `GateRegistry` has no corresponding gate for this transition. A model providing `evidence: { understanding_confirmed: true }` will pass `gate-requirements.js` but `WorkflowStateManager` will see no gate obstacle and advance freely — making the gate semantically dead in the persistence layer.
  - Evidence/repro: `gate-registry.js:19-25`: `'quick.understanding_confirmed': { stage: 'quick_plan', targetStage: 'quick_implement' }` — this is `plan→implement`, not `intake→plan`.

- [1-M-3] Fresh-project bootstrap: write methods silently fail until bootstrap creates `src/openkit-runtime/` — `src/runtime/workflow-kernel.js:134-148` and `349-360`
  - Description: On a fresh project, `canWriteState` (line 139–148) returns `false` because `path.dirname(statePath)` is `src/openkit-runtime/` which does not exist. `bootstrapWorkflow` itself bypasses this check (delegates to controller which creates the dir), but all other write-path functions (`startBackgroundRun`, `completeBackgroundRun`, etc.) call `canWriteState` and silently no-op until bootstrap completes.
  - Evidence/repro: `workflow-kernel.js:147`: `return fs.existsSync(path.dirname(statePath));`. `startBackgroundRun:186-200`: `if (!canWriteState(customStatePath)) return null;`.

- [1-M-4] `session-start.js` performs blocking synchronous file reads on skill and tool-rule files — `src/hooks/session-start.js:321` and `334`
  - Description: Lines 321 and 334 read `metaSkillPath` and `toolSubstitutionRulesPath` with `fs.readFileSync(..., 'utf8')` synchronously. If the kit root is on a slow mount or the files are large, this adds latency to every session start. No size cap or timeout.

- [1-M-5] FSM asymmetry: `migration_strategy → migration_baseline` allowed in `transition-engine.js` but not `state-machine.js` — `src/runtime/state/transition-engine.js:59` vs `src/runtime/workflow/state-machine.js:52`
  - Description: `transition-engine.js` allows backward rework to baseline; `state-machine.js` only forward to upgrade. The `openkit://available-actions` MCP resource uses `state-machine.js`, so it would never show `migration_baseline` as an option, but `WorkflowStateManager.advanceStage()` would allow it.

### Low

- [1-L-1] No size/timeout guard on synchronous reads in `session-start.js` — `src/hooks/session-start.js:316-344`

- [1-L-2] `TransactionLog.query()` reads entire JSONL into memory; no cap — `src/runtime/state/transaction-log.js:87-108`

- [1-L-3] `captureRevision` uses `JSON.stringify` which drops `undefined` and may differ on float reps — `src/openkit-runtime/lib/state-guard.js:10-28`

- [1-L-4] Dead gate: `quick_intake→quick_plan` in `gate-requirements.js` cannot be satisfied via `EVIDENCE_TO_GATE` — `src/runtime/tools/workflow/advance-stage.js:132`
  - Description: `EVIDENCE_TO_GATE` maps `understanding_confirmed` to `quick.understanding_confirmed` (which is the `plan→implement` gate). The `quick_intake→quick_plan` gate definition is dead code that can never be satisfied via the normal evidence mechanism.

### Notes

- Directories read:
  - `src/openkit-runtime/lib/` — all 20 files
  - `src/runtime/state/` — all files
  - `src/runtime/workflow/` — state-machine, gate-requirements, role-permissions, instruction-loader
  - `src/runtime/workflow-kernel.js`, `project-root.js`
  - `src/runtime/tools/workflow/` — all workflow tools
  - `src/runtime/tools/tool-registry.js`
  - `src/mcp-server/` — index.js, tool-schemas.js, args.js
  - `src/hooks/` — all 4 files
  - `src/runtime/managers/project-graph-manager.js`
  - `src/runtime/analysis/file-watcher.js`
  - `src/runtime/tools/shared/project-file-utils.js`
  - `src/openkit-runtime/lib/policy-engine.js`, `state-guard.js`, `runtime-paths.js`

- Directories skipped (with reason):
  - `node_modules/`, `release-notes/` — out of scope
  - `src/runtime/hooks/*`, `mcp/*`, `specialists/*`, `recovery/*` — partially read; not exhaustive
  - `src/openkit-runtime/lib/workflow-state-controller.js` — too large (69K tokens); only portions read via offset/limit

- Open questions for main agent:
  1. Which FSM table is ground truth — `transition-engine.js` (persistence) or `state-machine.js` (MCP/UI)?
  2. Is `gate-requirements.js` intended to replace `gate-registry.js` (or vice versa)?
  3. Is `tool.bootstrap-workflow` absence from MCP schema (1-H-3) intentional (CLI-only) or omission?
  4. The `quick_intake → quick_plan` gate (1-M-2, 1-L-4) — leftover from `quick_brainstorm` removal?
  5. `quick_brainstorm` confirmed fully absent from all in-scope paths.
