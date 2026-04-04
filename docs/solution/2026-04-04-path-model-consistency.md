# Solution Package: Path Model Consistency Fix

## Upstream Reference

Root cause analysis from full-lane failure diagnostics. This is a targeted internal fix, not a product-scoped feature — no separate scope package is required.

---

## 1. Root Cause Summary

The repository defines three distinct path roots:

| Root | Semantic | Source |
|---|---|---|
| `projectRoot` | The user's repository (`.git` / `package.json` root) | `resolveProjectRoot()` |
| `runtimeRoot` | Where workflow state is stored (`…/.opencode`) | `resolveRuntimeRoot()` — strips two dir levels from `resolveStatePath()` |
| `kitRoot` | Where kit assets live (agents, skills, templates, hooks) | `resolveKitRoot()` — defaults to `projectRoot` when `OPENKIT_KIT_ROOT` is unset |

In **local development** (no global kit), all three collapse to the same directory, so confusion is invisible. In **global-kit mode** (`OPENKIT_KIT_ROOT` or `OPENCODE_HOME` set), the three diverge and the following inconsistencies cause failures:

### Bug 1 — `ensureWorkItemStoreReady` returns `runtimeRoot` but callers name it `projectRoot`

```js
// workflow-state-controller.js:299-320
function ensureWorkItemStoreReady(customStatePath) {
  const runtimeRoot = resolveRuntimeRoot(customStatePath)   // ← resolves runtime root
  const projectRoot = resolveProjectRoot(customStatePath)    // ← resolves project root
  …
  bootstrapRuntimeStore(runtimeRoot)
  return runtimeRoot    // ← RETURNS runtimeRoot
}
```

The function **returns `runtimeRoot`**, but its 17 call sites all assign the result to `const projectRoot`. When the two roots differ, every downstream use of that `projectRoot` is actually operating against the runtime state directory, not the user's repository.

**Impact:** artifact scaffolding writes `docs/scope/…` into the workspace state tree instead of the user's project. Artifact validation reads from the wrong directory. Task board paths point to the wrong `.opencode/work-items/`.

### Bug 2 — `readManagedState` propagates the wrong root

`readManagedState` (line 342) calls `ensureWorkItemStoreReady` and stores the result as `projectRoot`, then passes it to `readWorkItemIndex`, `readWorkItemState`, `validateManagedState`, and `validatePrimaryArtifactContracts`. All of those use the root for both **state file I/O** (correct to use `runtimeRoot`) and **artifact file existence checks** (must use `projectRoot`).

### Bug 3 — `artifact-scaffolder.js` writes output relative to whichever root it receives

```js
// artifact-scaffolder.js:101
const outputDir = path.join(projectRoot, config.outputDir)
```

Caller `autoScaffoldPrimaryArtifactIfNeeded` (line 1676) passes the `projectRoot` from `mutate()`, which flows from `readManagedState`, which flows from `ensureWorkItemStoreReady` — so it's actually `runtimeRoot`. Scaffolded artifacts land in the wrong tree.

### Bug 4 — `linkArtifact` and `scaffoldAndLinkArtifact` resolve `projectRoot` independently

Both call `resolveProjectRoot(customStatePath)` directly (lines 3683, 3789), bypassing the `readManagedState` / `ensureWorkItemStoreReady` path. This means they may resolve a *different* `projectRoot` than the one used by `autoScaffoldPrimaryArtifactIfNeeded` inside `advanceStage`, leading to artifact path mismatches.

### Bug 5 — `getRuntimeStatus` and `runDoctor` are the only places that correctly separate all three roots

These functions (lines 3229-3285, 3296-3413) resolve `projectRoot`, `runtimeRoot`, and `kitRoot` independently and use each for its correct purpose. But the rest of the controller conflates them.

---

## 2. Minimal Architectural Changes Needed

### 2a. Introduce a resolved path context object

Instead of letting every function resolve roots ad hoc, create a single factory that resolves all three roots once and returns a frozen context:

```js
// runtime-paths.js — new export
export function resolvePathContext(customStatePath, env = process.env) {
  const projectRoot = resolveProjectRoot(customStatePath, env)
  const runtimeRoot = resolveRuntimeRoot(customStatePath, env)
  const kitRoot = resolveKitRoot(projectRoot, env)
  const statePath = resolveStatePath(customStatePath, env)

  return Object.freeze({ projectRoot, runtimeRoot, kitRoot, statePath })
}
```

### 2b. Fix `ensureWorkItemStoreReady` to return a path context, not a bare string

Return `{ projectRoot, runtimeRoot }` or the full path context so callers can use the correct root for each operation.

### 2c. Split state I/O from artifact I/O in `readManagedState` / `persistManagedState`

- Work-item state reads/writes → use `runtimeRoot`
- Artifact existence checks and scaffolding → use `projectRoot`
- Template resolution → use `kitRoot`

### 2d. Thread the path context through `mutate` / `mutateWorkItem`

Instead of each function resolving roots independently, pass the resolved context from the entry point down.

---

## 3. Exact Files and Functions to Change

### `.opencode/lib/runtime-paths.js`

| Function | Change |
|---|---|
| *(new)* `resolvePathContext` | Add factory that returns `{ projectRoot, runtimeRoot, kitRoot, statePath }` as a frozen object |

### `.opencode/lib/workflow-state-controller.js`

| Function | Change |
|---|---|
| `ensureWorkItemStoreReady` (L299) | Return `{ projectRoot, runtimeRoot }` instead of just `runtimeRoot`. Continue bootstrapping against `runtimeRoot`. |
| `readManagedState` (L342) | Destructure `{ projectRoot, runtimeRoot }` from `ensureWorkItemStoreReady`. Use `runtimeRoot` for `readWorkItemIndex` and `readWorkItemState`. Pass `projectRoot` for artifact validation. Return both in the context. |
| `persistManagedState` (L361) | Same split: state I/O uses `runtimeRoot`, artifact validation and compatibility mirror use their respective roots. |
| `readWorkItemContext` (L518) | Same destructure pattern as `readManagedState`. |
| `mutate` (L1734) | Receives both roots from `readManagedState`, passes both into context for mutator callbacks. |
| `mutateWorkItem` (L1752) | Same. |
| `autoScaffoldPrimaryArtifactIfNeeded` (L1676) | Accept `{ projectRoot, kitRoot }` explicitly instead of using only `projectRoot` (which was actually `runtimeRoot`). |
| `advanceStage` (L3524) | Use `projectRoot` from the context for artifact scaffolding, `runtimeRoot` for board reads. |
| `linkArtifact` (L3679) | Use `resolvePathContext` instead of bare `resolveProjectRoot`. |
| `scaffoldAndLinkArtifact` (L3736) | Use `resolvePathContext` instead of bare `resolveProjectRoot` + ad-hoc `process.env.OPENKIT_KIT_ROOT`. |
| `getRuntimeStatus` (L3229) | Already mostly correct; adopt `resolvePathContext` for consistency. |
| `runDoctor` (L3296) | Same. |
| `validatePrimaryArtifactContracts` (L1269) | Accept `projectRoot` explicitly; must be the user's project root, not the runtime root. |
| `getRegistry` (L832) | Uses `resolveProjectRoot` directly; switch to `resolvePathContext` to keep all resolution centralized. |
| `getInstallManifest` (L852) | Same. |
| `listWorkItems` (L1798) | Destructure from `ensureWorkItemStoreReady`. |
| `startTask` (L3431) | Destructure from `ensureWorkItemStoreReady`. |
| `getTaskAgingReport` (L1994) | Destructure from `ensureWorkItemStoreReady`. |
| All release-related functions (L2376-2638) | Use `resolvePathContext` for path resolution consistency. |

### `.opencode/lib/artifact-scaffolder.js`

| Function | Change |
|---|---|
| `scaffoldArtifact` (L84) | No interface change needed, but **document the contract**: `projectRoot` must be the user's repository root, `kitRoot` must be the kit asset root. Callers are responsible for passing the correct values. |
| `resolveTemplateCandidatePaths` (L59) | Already correct — uses both `projectRoot` and `kitRoot`. No change. |

### `.opencode/lib/work-item-store.js`

| Function | Change |
|---|---|
| All functions that accept `projectRoot` | Rename parameter to `storeRoot` in JSDoc/comments to clarify this is the root of the `.opencode/work-items/` tree (which is `runtimeRoot`, not necessarily `projectRoot`). No logic change needed. |

---

## 4. Path Invariants That Must Hold

These are the rules the fix must enforce and tests must verify:

1. **`projectRoot` always points to the user's repository root** — the directory containing `.git` or `package.json`. Artifacts under `docs/`, `release-notes/`, and user-facing files are resolved relative to `projectRoot`.

2. **`runtimeRoot` always points to the directory containing `.opencode/work-items/`** — where workflow state, task boards, migration slices, and background runs live. In local mode, `runtimeRoot === projectRoot`. In global mode, `runtimeRoot` is under `OPENCODE_HOME/workspaces/<id>/openkit`.

3. **`kitRoot` always points to the directory containing kit assets** — `agents/`, `skills/`, `hooks/`, `docs/templates/`. In local mode, `kitRoot === projectRoot`. In global mode, `kitRoot` is `OPENKIT_KIT_ROOT`.

4. **Artifact scaffolding always writes to `projectRoot`** — `docs/scope/`, `docs/solution/`, `docs/tasks/` are user-facing artifact directories.

5. **Template resolution always starts from `projectRoot`, then falls back to `kitRoot`** — the existing `resolveTemplateCandidatePaths` already does this correctly.

6. **State I/O always uses `runtimeRoot`** — `readWorkItemState`, `writeWorkItemState`, `readWorkItemIndex`, `writeWorkItemIndex`, `writeCompatibilityMirror`, task board and migration slice reads/writes.

7. **Compatibility mirror (`workflow-state.json`) lives under `runtimeRoot`** — this is already correct via `resolveStatePath`.

8. **No function should assign `runtimeRoot` to a variable named `projectRoot`** — this is the direct cause of the confusion and must never happen after the fix.

9. **Registry and install-manifest are resolved from `kitRoot` for kit metadata, from `projectRoot` for project-local overrides** — the current `getManifestPaths` function already takes a root argument; callers must pass the correct one.

10. **`resolvePathContext` is the single resolution entry point for any function that needs more than one root** — prevents ad-hoc resolution that can get out of sync.

---

## 5. Targeted Tests to Add

### `.opencode/tests/runtime-paths.test.js` (new file)

| Test | Purpose |
|---|---|
| `resolvePathContext returns distinct roots when OPENKIT_KIT_ROOT is set` | Verify the three roots diverge correctly under global-kit env |
| `resolvePathContext collapses all three roots in local mode` | Verify backwards compatibility when no env vars are set |
| `resolvePathContext returns frozen object` | Verify `Object.isFrozen()` to prevent accidental mutation |

### `.opencode/tests/workflow-state-controller.test.js` (existing file, add cases)

| Test | Purpose |
|---|---|
| `ensureWorkItemStoreReady returns runtimeRoot and projectRoot separately` | Verify the return shape change |
| `startTask in global-kit mode scaffolds artifacts into projectRoot not runtimeRoot` | Set `OPENKIT_KIT_ROOT` env, create a temp project and a separate temp runtime dir; verify `docs/scope/` lands in the project dir |
| `advanceStage with auto-scaffold writes to projectRoot` | Same env setup; verify the auto-scaffolded solution package file exists in the project tree |
| `linkArtifact resolves existence checks against projectRoot` | Verify that artifact existence is checked against the user's project, not the state directory |
| `readManagedState propagates correct projectRoot for artifact validation` | Mock a state where artifacts are linked with project-relative paths; verify validation reads from projectRoot |

### `.opencode/tests/artifact-scaffolder.test.js` (existing file, add cases)

| Test | Purpose |
|---|---|
| `scaffoldArtifact writes output under projectRoot regardless of kitRoot` | Pass distinct `projectRoot` and `kitRoot`; verify output file is under `projectRoot` |
| `scaffoldArtifact reads templates from kitRoot when missing from projectRoot` | Verify fallback template resolution |

### Reproduction script (optional, not a test)

```bash
# Simulate global-kit mode to reproduce the original failure:
export OPENKIT_KIT_ROOT=/tmp/kit-root
export OPENCODE_HOME=/tmp/opencode-home
node .opencode/workflow-state.js start-task full FEATURE-999 repro-test "Reproduce path bug"
# Expected: artifacts land in project dir, not in /tmp/opencode-home/workspaces/…
```

---

## 6. Risk Notes

| Risk | Mitigation |
|---|---|
| **Return-type change in `ensureWorkItemStoreReady` breaks 17 call sites** | This is the bulk of the work. Each call site must be updated to destructure `{ projectRoot, runtimeRoot }` or just `runtimeRoot` depending on what it actually needs. Mechanical but high surface area. |
| **Tests rely on `projectRoot === runtimeRoot`** | All existing tests run in local mode (temp dirs). They will continue to pass because both roots collapse to the same value. New tests must exercise the divergent case. |
| **`work-item-store.js` takes `projectRoot` as its first argument everywhere** | The parameter is semantically `storeRoot` (where `.opencode/work-items/` lives). Renaming the parameter is safe because it's positional and callers already pass the correct value. The rename is a clarity improvement, not a behavior change. |
| **`autoScaffoldPrimaryArtifactIfNeeded` is called from inside `advanceStage`'s mutator callback** | The mutator callback receives `context` from `readManagedState`. After the fix, `context` must carry both `projectRoot` and `runtimeRoot`. The `projectRoot` from context is used for scaffolding. |
| **Release-store functions resolve `projectRoot` independently** | These must use `resolvePathContext` for consistency, but release artifacts are currently stored under `.opencode/releases/` (state directory), not under `docs/`. So they correctly need `runtimeRoot`. The variable name should be fixed to avoid confusion. |
| **No test framework is repo-native** | Tests use `node:test` (Node.js built-in). Run with `node --test .opencode/tests/runtime-paths.test.js` etc. This is already the existing pattern. |

---

## Implementation Slices

### Slice 1: Add `resolvePathContext` to `runtime-paths.js`

- **Files:** `.opencode/lib/runtime-paths.js`
- **Goal:** Single factory function that resolves all three roots from one entry point
- **Validation:** `node --test .opencode/tests/runtime-paths.test.js` (new test file)

### Slice 2: Fix `ensureWorkItemStoreReady` and propagate through `readManagedState` / `persistManagedState`

- **Files:** `.opencode/lib/workflow-state-controller.js`
- **Goal:** All 17 call sites of `ensureWorkItemStoreReady` receive correctly-named roots; state I/O uses `runtimeRoot`, artifact validation uses `projectRoot`
- **Validation:** `node --test .opencode/tests/workflow-state-controller.test.js`

### Slice 3: Fix scaffold and link entry points

- **Files:** `.opencode/lib/workflow-state-controller.js` (`scaffoldAndLinkArtifact`, `linkArtifact`, `autoScaffoldPrimaryArtifactIfNeeded`)
- **Goal:** Artifact files are created in the user's project tree, not the state tree
- **Validation:** New divergent-root test cases in existing test files

## Dependency Graph

- Slice 1 must complete before Slice 2 (Slice 2 uses the new `resolvePathContext`)
- Slice 2 must complete before Slice 3 (Slice 3 depends on the corrected context shape)
- Critical path: Slice 1 → Slice 2 → Slice 3 (sequential)

## Validation Matrix

| Acceptance Target | Validation Path |
|---|---|
| Three roots are resolved independently | `node --test .opencode/tests/runtime-paths.test.js` |
| Existing local-mode behavior unchanged | `node --test .opencode/tests/workflow-state-controller.test.js` (all existing tests must still pass) |
| Artifact scaffolding writes to correct tree in global mode | New divergent-root test in `workflow-state-controller.test.js` |
| No function assigns `runtimeRoot` to a variable named `projectRoot` | Manual grep / code review |

## Integration Checkpoint

- After Slice 2, run the full existing test suite to confirm no regressions before proceeding to Slice 3.
- After Slice 3, run all tests plus the new divergent-root tests to confirm end-to-end correctness.
