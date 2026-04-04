# Scope Package — Full-Lane Path / Scaffold Fix

**Feature ID:** FIX-PATH-SCAFFOLD  
**Date:** 2026-04-04  
**Status:** Draft

---

## Problem Statement

When OpenKit runs in global/managed mode (where the managed runtime workspace is distinct from the user's project directory), the full-delivery auto-scaffold creates scope and solution package artifacts in the wrong filesystem location. The root cause is that `readManagedState` returns the managed runtime root but labels it `projectRoot`. This mislabelled value then flows into `autoScaffoldPrimaryArtifactIfNeeded`, which uses it as the base for both template lookup and artifact output. As a result, templates are not found (because they live in the kit root or the real project root) and scaffolded files land in the runtime workspace directory instead of the user's project tree.

The manual `scaffold-artifact` command does not share this bug because it independently resolves `projectRoot` via `resolveProjectRoot()`.

**Who is affected:** Any operator using the global OpenKit install (`openkit run`) who triggers a full-delivery work item and advances through `full_intake → full_product` or `full_product → full_solution`.

**Success signal:** Full-delivery auto-scaffold always writes artifacts into the operator's real project tree and always finds templates, regardless of whether the runtime is local-only or global/managed.

---

## In Scope

- Fix the mismatch where `ensureWorkItemStoreReady` returns the runtime root but downstream consumers treat the return value as the project root.
- Ensure `autoScaffoldPrimaryArtifactIfNeeded` receives the actual project root (the user's repository) for artifact output paths and the actual kit root for template resolution.
- Ensure the manual `scaffoldAndLinkArtifact` path and the automatic `advanceStage` path resolve the same three roots (projectRoot, runtimeRoot, kitRoot) consistently.
- Ensure `linkArtifact` stores repo-relative paths against the real project root, not the runtime workspace root.
- Ensure `validatePrimaryArtifactContracts` resolves linked artifact paths against the real project root.
- Ensure `migration_strategy` auto-scaffold (solution_package in migration mode) follows the same corrected path logic.
- Add or extend existing tests to cover the three-root divergence scenario (runtimeRoot ≠ projectRoot ≠ kitRoot) for both auto-scaffold and manual scaffold paths.

## Out of Scope

- Refactoring `resolveProjectRoot` or `resolveRuntimeRoot` beyond what is needed to fix the labelling confusion.
- Changing the quick-lane scaffold path (task_card), which is not affected by this bug.
- Changing the global kit install flow, `openkit run`, or `openkit doctor`.
- Changing the path model itself (the three-root split is correct by design; only the internal labelling and pass-through are wrong).
- Adding new scaffold kinds or artifact types.
- Migration slice board or task board path handling (separate concern).

---

## Business Rules

1. **Artifacts always land in the project tree.** Scaffolded scope and solution packages must be written under the operator's real project root (`docs/scope/`, `docs/solution/`), never under the managed runtime workspace path.
2. **Templates are found from kit root or project root.** Template resolution must search the kit root and the real project root, not the runtime workspace root.
3. **Linked artifact paths are project-relative.** Paths stored in `state.artifacts.*` must be relative to the real project root so they resolve correctly regardless of runtime workspace location.
4. **Manual and automatic scaffold share the same resolution.** The three roots (projectRoot, runtimeRoot, kitRoot) must be resolved identically by `scaffoldAndLinkArtifact` and by `autoScaffoldPrimaryArtifactIfNeeded`.
5. **State storage stays in the runtime root.** Workflow state, work-item state, and the compatibility mirror continue to live under the runtime root. This fix does not move state files.

---

## Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | A full-delivery work item exists and `OPENKIT_KIT_ROOT` and `OPENKIT_PROJECT_ROOT` are set to different directories | `advance-stage full_product` executes | The scope package file is created under `<projectRoot>/docs/scope/`, not under the runtime workspace path |
| AC-2 | Same setup as AC-1, stage is `full_product`, scope_package is linked | `advance-stage full_solution` executes | The solution package file is created under `<projectRoot>/docs/solution/`, not under the runtime workspace path |
| AC-3 | Same setup, templates exist only in `kitRoot` (not in projectRoot) | Auto-scaffold runs for `full_product` or `full_solution` | Template is found from `kitRoot` and scaffold succeeds |
| AC-4 | Local-only mode (no `OPENKIT_KIT_ROOT`, no `OPENCODE_HOME`, runtimeRoot = projectRoot) | `advance-stage full_product` executes | Behavior is identical to today's working local path — no regression |
| AC-5 | Manual `scaffold-artifact scope_package` is invoked in global mode | Scaffold runs | Output path and template resolution match the auto-scaffold path exactly |
| AC-6 | Artifact path stored in `state.artifacts.scope_package` after auto-scaffold in global mode | `validatePrimaryArtifactContracts` runs | Validation resolves the path against the real project root and finds the file |
| AC-7 | Migration mode, `advance-stage migration_strategy` in global mode | Auto-scaffold runs for solution_package | Same correct path behavior as full mode AC-1/AC-2 |

---

## Edge Cases and Failure Modes

- **`OPENKIT_PROJECT_ROOT` not set but `OPENKIT_KIT_ROOT` is set:** `resolveProjectRoot` falls back to `detectProjectRoot(cwd)`. Scaffold must still use that detected project root, not the runtime root.
- **Project root has no `docs/scope/` or `docs/solution/` directory yet:** Scaffold must create the directory under the real project root (current behavior when the root is correct).
- **Artifact already exists at the target path:** Existing guard (`Artifact already exists at '...'`) must still fire against the real project root path.
- **`kitRoot` equals `projectRoot` (checked-in authoring mode):** Template resolution should find templates on the first candidate and not break.
- **`runtimeRoot` equals `projectRoot` (local-only mode):** The fix must be a no-op — all current local-mode behavior is preserved.

---

## Open Questions

1. Should `ensureWorkItemStoreReady` be renamed or restructured to return a richer object (e.g., `{ runtimeRoot, projectRoot }`) to prevent future callers from misinterpreting its return value? Or is a targeted fix inside `readManagedState` sufficient?
2. Should `readManagedState` carry both `projectRoot` and `runtimeRoot` in its return shape so every downstream consumer has unambiguous access to both? (Currently only `projectRoot` is returned, but it holds the wrong value.)

---

## Handoff Notes for Solution Lead

- The root cause is a labelling mismatch in `readManagedState` (line ~344 of `workflow-state-controller.js`): `ensureWorkItemStoreReady` returns `runtimeRoot` but the returned object calls it `projectRoot`.
- The fix surface is narrow: `readManagedState`, `autoScaffoldPrimaryArtifactIfNeeded`, and any caller in `mutate` closures that passes `projectRoot` to scaffold or artifact-validation functions.
- `scaffoldAndLinkArtifact` already resolves `projectRoot` independently and is not broken — use it as the reference for correct behavior.
- Preserve the existing `ensureWorkItemStoreReady` bootstrap side-effects (copying state from project to runtime on first access); just stop using its return value as `projectRoot` for artifact I/O.
- The test gap is the three-root divergence scenario; prioritize a test that sets `OPENKIT_KIT_ROOT`, `OPENKIT_PROJECT_ROOT`, and verifies scaffold output lands in `projectRoot` and template reads come from `kitRoot`.
