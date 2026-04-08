---
artifact_type: solution_package
version: 1
status: draft
feature_id: FEATURE-006
feature_slug: kit-path-tooling-enforcement
source_scope_package: docs/scope/2026-04-04-kit-path-tooling-enforcement.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Kit Path & Tooling Enforcement

## Chosen Approach

Fix the three scoped problems through three sequential slices that share no code surfaces and can each be validated independently before moving to the next.

1. **Doctor contract-consistency** — narrowest fix, fastest to validate, unblocks clean doctor output for the other two slices.
2. **Path resolution correctness** — core infrastructure fix that corrects project-root derivation for artifact scaffold, validation, and compatibility mirror.
3. **Tool-substitution enforcement wiring** — the enforcement infrastructure already exists in two layers (OpenCode plugin + kit guard hook). The remaining work is connecting the enforcement level to mode/env, exposing it in doctor output, and adding moderate/permissive mode support to the existing plugin.

This order is chosen because:
- Slice 1 eliminates the one current doctor error, giving a clean baseline for post-fix doctor validation in slices 2 and 3.
- Slice 2 fixes the root cause of scaffold misplacement; it is the highest-impact fix but also the highest-risk because it changes path derivation used throughout the controller.
- Slice 3 is the largest new-behavior surface but has the lowest integration risk because the guard-hook and plugin mechanisms are already implemented and tested — the gap is wiring and mode-awareness, not new architecture.

## Impacted Surfaces

### Slice 1 — Doctor contract-consistency
- `.opencode/lib/contract-consistency.js` — the `getContractConsistencyReport` function
- `.opencode/tests/workflow-contract-consistency.test.js` — existing test suite

### Slice 2 — Path resolution
- `.opencode/lib/runtime-paths.js` — `resolveProjectRoot`, `resolvePathContext`
- `.opencode/lib/workflow-state-controller.js` — `ensureWorkItemStoreReady`, `readManagedState`, `persistManagedState`, `autoScaffoldPrimaryArtifactIfNeeded`, `validateManagedState`, `validatePrimaryArtifactContracts`, any function that passes `projectRoot` downstream
- `.opencode/lib/artifact-scaffolder.js` — `scaffoldArtifact` (already correctly uses the `projectRoot` parameter it receives; the bug is upstream in what value the caller passes)
- `.opencode/tests/runtime-paths.test.js` — existing path-resolution tests
- `.opencode/tests/artifact-scaffolder.test.js` — existing scaffold tests
- `.opencode/tests/workflow-state-controller.test.js` — existing controller tests

### Slice 3 — Enforcement wiring
- `.opencode/plugins/tool-enforcement.js` — the OpenCode plugin (currently hardcoded `strict`)
- `src/runtime/hooks/tool-guards/bash-guard-hook.js` — the kit guard hook (already accepts `enforcementLevel` parameter)
- `src/runtime/hooks/index.js` — `createToolGuardHooks` (wires enforcement level from config/env)
- `src/runtime/doctor.js` or `src/runtime/doctor/workflow-doctor.js` — expose enforcement level in doctor output
- `.opencode/tests/bash-guard-hook.test.js` — existing guard hook tests
- `.opencode/tests/tool-enforcement-plugin.test.js` — existing plugin tests
- `tests/runtime/bash-guard-hook.test.js` — existing runtime guard hook tests

## Boundaries And Components

### Path Model (unchanged)
The three-root path model is correct by design and must not change:
- `projectRoot` — the operator's actual project tree (where artifacts land)
- `runtimeRoot` — the managed workspace root (where state files live)
- `kitRoot` — the kit source tree (where templates live)

### Enforcement Model (unchanged architecture, new wiring)
The two-layer enforcement architecture is already implemented:
- **Layer 1 (OpenCode plugin):** `.opencode/plugins/tool-enforcement.js` runs inside the OpenCode Bun runtime. It intercepts `bash` tool calls and `grep`/`glob` default-tool calls before they reach the agent. This is the primary enforcement surface for agent-facing interception.
- **Layer 2 (Kit guard hook):** `src/runtime/hooks/tool-guards/bash-guard-hook.js` runs inside the kit's own Node.js runtime. It guards kit-registered tools via `wrapToolExecution.guardHooks`. This is the secondary enforcement surface for kit-internal tools.

The gap is that Layer 1 hardcodes `resolveEnforcementLevel()` to always return `'strict'` instead of consulting the active mode or `OPENKIT_ENFORCEMENT_LEVEL` env var.

## Interfaces And Data Contracts

### Enforcement Level Resolution
```
resolveEnforcementLevel(env):
  1. If env.OPENKIT_ENFORCEMENT_LEVEL is set and valid, use it.
  2. Else if env.OPENKIT_MODE === 'migration', use 'moderate'.
  3. Else use 'strict' (default for quick and full).
```

### Doctor Enforcement Section
```
Enforcement:
  tool_substitution_level: strict | moderate | permissive
  source: mode_default | env_override
  blocked_commands: grep, find, cat, head, tail, sed, awk, echo, wc, ls
```

### Contract-Consistency Check Changes
The failing check `"workflow contract states full delivery owns execution task boards"` must match the canonical wording in `workflow.md` line 112: `"task boards belong only to full-delivery work items"`. The fix adds a pattern that matches this exact phrasing. The check must also stop concatenating text from pruned `docs/specs/` and `docs/plans/` files.

## Risks And Trade-offs

### Risk 1: Path-resolution regression in local-only mode
**Probability:** Medium. **Impact:** High.
**Mitigation:** The existing `runtime-paths.test.js` and `workflow-state-controller.test.js` tests provide regression coverage for local-only mode. The fix must preserve the identity case where `runtimeRoot === projectRoot`. Add explicit test cases for the three-root divergence scenario.

### Risk 2: Plugin enforcement level resolution depends on env vars not available in all contexts
**Probability:** Low. **Impact:** Medium.
**Mitigation:** The OpenCode plugin runs in the Bun runtime with access to `process.env`. `OPENKIT_MODE` is already injected by `openkit run`. If the env var is missing, the default remains `strict`, which is the safe direction.

### Risk 3: Doctor check regex becomes too loose after fix
**Probability:** Low. **Impact:** Low.
**Mitigation:** The fix should add a pattern matching the canonical wording exactly, not replace existing patterns. The test suite verifies both passing and failing cases.

### Risk 4: Guard hook enforcement blocks legitimate piped grep usage
**Probability:** Already handled. The existing allowlist checks the command prefix first. `git log | grep pattern` starts with `git`, which is allowlisted. The scope package edge case is already covered by the current implementation.

## Recommended Path

### Do not change
- The three-root path model
- The guard-hook architecture in `wrap-tool-execution.js`
- The MCP server tool registration flow
- The `AGENTS.md` or `tool-substitution-rules.md` documented rules

### Do change
- How `resolveProjectRoot` handles the `customStatePath` parameter when global env vars are present
- How `contract-consistency.js` builds `taskBoardContractText` and what patterns it matches
- How the OpenCode plugin resolves enforcement level (from hardcoded to env-aware)
- Doctor output to include enforcement level section

## Implementation Slices

### Slice 1: Doctor Contract-Consistency Alignment

**Goal:** Fix the one failing doctor check and remove stale file references.

**Files:**
- `.opencode/lib/contract-consistency.js` (lines 55–77, 157–166)
- `.opencode/tests/workflow-contract-consistency.test.js`

**Changes:**
1. Remove or guard the `fullDeliverySpecPath` and `fullDeliveryPlanPath` references (lines 55–66). These files (`docs/specs/2026-03-21-...` and `docs/plans/2026-03-21-...`) were pruned. The check should not silently weaken when these files are absent. Two options:
   - **Recommended:** Remove these paths from `taskBoardContractText` and `compatibilityText` entirely. The canonical workflow.md and session-resume.md are sufficient sources of truth. If the check cannot pass from those two files alone, the check's patterns need updating, not the file list.
   - Alternative: Make the check warn (not error) when supplementary files are missing.

2. Add a regex pattern to the `"workflow contract states full delivery owns execution task boards"` check (line 157–166) that matches the canonical wording in `workflow.md`:
   ```
   /task boards? belong only to full[- ]delivery work items/i
   ```
   This matches the actual text at line 112 of `workflow.md`: `"task boards belong only to full-delivery work items"`.

3. Update the existing test to verify the check passes with the canonical wording and fails when the relevant text is removed.

**Validation:**
```bash
node --test ".opencode/tests/workflow-contract-consistency.test.js"
npm run verify:governance
```

**Acceptance criteria covered:** AC-8, AC-9

---

### Slice 2: Path Resolution Correctness

**Goal:** Ensure `readManagedState` and all downstream consumers resolve `projectRoot` correctly in global mode, so auto-scaffold writes artifacts to the operator's project tree.

**Files:**
- `.opencode/lib/runtime-paths.js` — `resolveProjectRoot` (lines 41–55)
- `.opencode/lib/workflow-state-controller.js` — `ensureWorkItemStoreReady` (lines 296–322), `readManagedState` (lines 343–362), `persistManagedState` (lines 364–451), `validateManagedState` (lines 706–755), `autoScaffoldPrimaryArtifactIfNeeded` (lines 1681–1714)
- `.opencode/tests/runtime-paths.test.js`
- `.opencode/tests/artifact-scaffolder.test.js`
- `.opencode/tests/workflow-state-controller.test.js`

**Root Cause Analysis:**
The current `resolveProjectRoot` at line 41 correctly uses `OPENKIT_PROJECT_ROOT` if set (line 42). When not set but global mode is detected (line 47), it falls back to `detectProjectRoot(process.cwd())`. The problem path is when `customStatePath` is set but global-mode env vars are absent — line 51 derives the project root as `path.dirname(path.dirname(path.resolve(customStatePath)))`, which computes the parent of the `.opencode` directory containing the state file. In managed mode, the state file lives under `OPENCODE_HOME/workspaces/<id>/openkit/.opencode/`, so this derivation returns the workspace root, not the actual project root.

**Fix strategy:**
1. In `resolveProjectRoot`: when `customStatePath` is set, always check global-mode indicators (`OPENKIT_KIT_ROOT`, `OPENCODE_HOME`, `OPENKIT_GLOBAL_MODE`) before falling back to the directory-derivation path. The current code at lines 47-48 already does this, but the condition is narrower than needed — it gates on `OPENKIT_GLOBAL_MODE === "1" || OPENKIT_KIT_ROOT || OPENCODE_HOME`. Verify that this condition is sufficient. If `customStatePath` points into a managed workspace, the cwd-based detection at line 48 should find the project root by walking up from `process.cwd()` to the nearest `.git` or `package.json`.

2. Verify that `ensureWorkItemStoreReady` passes the `pathContext` from `resolvePathContext` unchanged. The current code at line 298 calls `resolvePathContext(customStatePath)` and destructures `projectRoot` and `runtimeRoot` from it. This should already be correct if `resolvePathContext` returns the right `projectRoot`. Trace the actual flow.

3. Verify that `autoScaffoldPrimaryArtifactIfNeeded` receives the correct `projectRoot` from its callers. The function itself uses `projectRoot` correctly — the bug is in what `projectRoot` is passed in.

4. Verify that `persistManagedState` writes the compatibility mirror to the correct location. The `writeCompatibilityMirror` at line 407 uses `runtimeRoot`, which is correct — the mirror lives in the runtime root.

5. Add test cases for the three-root divergence scenario:
   - Set `OPENKIT_PROJECT_ROOT=/home/user/project`, `OPENKIT_KIT_ROOT=/usr/lib/openkit`, and let `customStatePath` point to a workspace root that differs from both.
   - Assert that `resolveProjectRoot` returns the project root, not the workspace root.
   - Assert that `scaffoldArtifact` receives and uses the project root.
   - Assert that artifact paths in state are relative to the project root.

**Local-only mode preservation:**
When `runtimeRoot === projectRoot` (no global env vars, no managed workspace), the fix must be a no-op. The existing directory-derivation path at line 51 is correct for this case. Add a regression test to verify.

**Validation:**
```bash
node --test ".opencode/tests/runtime-paths.test.js"
node --test ".opencode/tests/artifact-scaffolder.test.js"
node --test ".opencode/tests/workflow-state-controller.test.js"
```

Post-fix integration check:
```bash
node .opencode/workflow-state.js doctor
openkit doctor
```

**Acceptance criteria covered:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7

---

### Slice 3: Tool-Substitution Enforcement Wiring

**Goal:** Connect the enforcement level to mode and environment, add moderate/permissive support to the OpenCode plugin, and expose enforcement level in doctor output.

**Files:**
- `.opencode/plugins/tool-enforcement.js` — `resolveEnforcementLevel` (line 149–151)
- `src/runtime/hooks/tool-guards/bash-guard-hook.js` — already supports `enforcementLevel` parameter
- `src/runtime/hooks/index.js` — `createToolGuardHooks` (ensure enforcement level flows from config/env)
- `src/runtime/doctor.js` or `src/runtime/doctor/workflow-doctor.js` — new enforcement section
- `.opencode/tests/tool-enforcement-plugin.test.js`
- `.opencode/tests/bash-guard-hook.test.js`
- `tests/runtime/bash-guard-hook.test.js`

**Changes:**

1. **Plugin enforcement-level resolution** (`.opencode/plugins/tool-enforcement.js`):
   Replace the hardcoded `resolveEnforcementLevel()` at line 149–151 with mode-aware resolution:
   ```javascript
   function resolveEnforcementLevel() {
     const envLevel = process.env.OPENKIT_ENFORCEMENT_LEVEL;
     if (envLevel && ['strict', 'moderate', 'permissive'].includes(envLevel)) {
       return envLevel;
     }
     if (process.env.OPENKIT_MODE === 'migration') {
       return 'moderate';
     }
     return 'strict';
   }
   ```

2. **Plugin moderate/permissive behavior** (`.opencode/plugins/tool-enforcement.js`):
   The `tool.execute.before` handler currently always throws on match. Update it to:
   - `strict`: throw (block) — current behavior, unchanged.
   - `moderate`: log a warning via `console.warn` but do not throw. The warning must include the suggestion text.
   - `permissive`: no-op, return immediately after allowlist check.

   Note: The `BLOCKED_DEFAULT_TOOLS` map (blocking `grep` and `glob` default tools entirely) remains strict regardless of enforcement level. This is by design — these blocks redirect to kit tools, not to OS commands. Only the bash command interception follows the three-level model.

3. **Kit guard hook wiring** (`src/runtime/hooks/index.js` → `createToolGuardHooks`):
   Verify that the `createBashGuardHook` call receives the enforcement level from config or env. The guard hook already accepts `{ enforcementLevel }`. The wiring function should read `config.toolGuards?.enforcementLevel` first, then fall back to `process.env.OPENKIT_ENFORCEMENT_LEVEL`, then mode-derived default.

4. **Doctor enforcement section** (`src/runtime/doctor.js` or `src/runtime/doctor/workflow-doctor.js`):
   Add a new section to doctor output:
   ```
   Tool Enforcement:
     level: strict (mode_default) | moderate (env_override) | permissive (env_override)
     blocked_categories: search, file-discovery, file-read, file-read-partial, text-transform, file-write, line-count, directory-list
     plugin_active: true | false (based on whether .opencode/plugins/tool-enforcement.js exists)
     guard_hook_active: true | false (based on whether bash-guard-hook is in registered hooks)
   ```

5. **Tests:**
   - Add test cases for moderate and permissive modes in the plugin test.
   - Add test cases for env var override in the plugin test.
   - Verify existing strict-mode tests still pass.
   - Add a doctor output test that checks for the enforcement section.

**Validation:**
```bash
node --test ".opencode/tests/tool-enforcement-plugin.test.js"
node --test ".opencode/tests/bash-guard-hook.test.js"
node --test "tests/runtime/bash-guard-hook.test.js"
openkit doctor
```

**Acceptance criteria covered:** AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18

## Dependency Graph

```
Slice 1 (doctor fix) → Slice 2 (path fix) → Slice 3 (enforcement wiring)
```

All three slices are sequential. Rationale:
- Slice 1 unblocks a clean `openkit doctor` baseline, which is used as a validation step in slices 2 and 3.
- Slice 2 fixes core path infrastructure. If this fix changes how `resolvePathContext` works, it could theoretically affect how the plugin or guard hook resolve paths. Sequencing removes that risk.
- Slice 3 depends on a working doctor to verify its own doctor-section addition.

No parallel execution is blessed for this work item.

## Parallelization Assessment

- parallel_mode: `none`
- why: All three slices share the `.opencode/lib/` surface and the doctor validation path. Slice 2 modifies core path resolution used by the controller, which is imported by nearly every workflow command. Parallel execution would risk integration conflicts.
- safe_parallel_zones: []
- sequential_constraints: [`SLICE-1-DOCTOR → SLICE-2-PATH → SLICE-3-ENFORCEMENT`]
- integration_checkpoint: After each slice, run the slice-specific test commands plus `openkit doctor` to verify no regression.
- max_active_execution_tracks: 1

## Validation Matrix

| Acceptance Target | Validation Path | Slice |
|---|---|---|
| AC-1: Scope scaffold lands in project tree (global mode) | `node --test ".opencode/tests/workflow-state-controller.test.js"` — add three-root divergence test | 2 |
| AC-2: Solution scaffold lands in project tree | Same test file, full_solution stage variant | 2 |
| AC-3: Template found from kitRoot | `node --test ".opencode/tests/artifact-scaffolder.test.js"` — existing test + new kitRoot-only variant | 2 |
| AC-4: Local-only mode no regression | `node --test ".opencode/tests/runtime-paths.test.js"` — explicit identity case | 2 |
| AC-5: Manual scaffold matches auto-scaffold path | `node --test ".opencode/tests/artifact-scaffolder.test.js"` — compare paths | 2 |
| AC-6: Artifact validation resolves against real project root | `node --test ".opencode/tests/workflow-state-controller.test.js"` — linked artifact test | 2 |
| AC-7: Migration mode scaffold correct | Same test file, migration_strategy variant | 2 |
| AC-8: Doctor task-board check passes | `npm run verify:governance` | 1 |
| AC-9: Doctor does not weaken from missing files | `node --test ".opencode/tests/workflow-contract-consistency.test.js"` — explicit absent-file case | 1 |
| AC-10–12: Banned commands blocked in strict mode | `node --test ".opencode/tests/bash-guard-hook.test.js"` — existing tests already cover | 3 |
| AC-13–14: Legitimate commands allowed | Same test file — existing tests already cover | 3 |
| AC-15: Moderate mode warns but allows | `node --test ".opencode/tests/tool-enforcement-plugin.test.js"` — new moderate test | 3 |
| AC-16: Permissive mode no-ops | Same test file — new permissive test | 3 |
| AC-17: Doctor shows enforcement section | `openkit doctor` output inspection + test | 3 |
| AC-18: Env var override reflected | `node --test ".opencode/tests/tool-enforcement-plugin.test.js"` — env var test | 3 |

Full validation after all slices:
```bash
npm run verify:all
openkit doctor
```

## Integration Checkpoint

After all three slices are complete:
1. Run `npm run verify:all` — all existing tests must pass.
2. Run `openkit doctor` — must report 0 errors.
3. Manual smoke test in a fresh global-install session:
   - `openkit run` from a project directory where `OPENKIT_PROJECT_ROOT ≠ OPENKIT_KIT_ROOT`.
   - Trigger `/delivery`, create a work item, advance to `full_product`.
   - Verify the auto-scaffolded scope package lands in the project tree.
   - Verify `openkit doctor` shows the enforcement section with `strict` level.

## Rollback Notes

- **Slice 1** is safe to roll back independently — it only changes regex patterns and file references.
- **Slice 2** should be rolled back as a unit if it introduces path-resolution regressions. The existing test suite provides early detection.
- **Slice 3** is safe to roll back independently — enforcement reverts to the current hardcoded strict behavior.

## Reviewer Focus Points

- **Slice 1:** Verify the new regex pattern matches the exact canonical wording without being so loose that it would pass if the wording were removed.
- **Slice 2:** Verify that the local-only identity case (`runtimeRoot === projectRoot`, no env vars) is preserved exactly. Trace every call site that passes `projectRoot` to `scaffoldArtifact` or `validatePrimaryArtifactContracts`.
- **Slice 3:** Verify that `BLOCKED_DEFAULT_TOOLS` enforcement remains strict regardless of mode. Verify that the `moderate` warning path does not throw or block. Verify that `permissive` truly no-ops.
