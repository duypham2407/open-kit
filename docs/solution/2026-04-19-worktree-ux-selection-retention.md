---
artifact_type: solution_package
version: 1
status: draft
feature_id: FEATURE-936
feature_slug: worktree-ux-selection-retention
source_scope_package: docs/scope/2026-04-19-worktree-ux-selection-retention.md
owner: SolutionLead
approval_gate: solution_to_fullstack
---

# Solution Package: Worktree UX Selection and Retention

## Title

Worktree mode selection, retained reuse/reopen behavior, cleanup separation, and opt-in `.env` propagation for `openkit run` and the workflow-state compatibility surface.

## Dependencies

- No new npm or external package dependency is required. Keep implementation on existing Node built-ins (`fs`, `path`, `readline`) and the existing git CLI calls already concentrated in `src/global/worktree-manager.js`.
- Preserve the current managed location and naming conventions unless a later feature explicitly re-scopes them:
  - per-work-item metadata at `.opencode/work-items/<work_item_id>/worktree.json`
  - managed worktree directory at `.worktrees/<work_item_id>`
  - managed branch naming at `openkit/<workflow_mode>/<work_item_id>`
- Validation must stay on targeted Node tests only. This repository does not define a repo-native build, lint, or umbrella test command for application code.
- Reuse the existing prompt adapter pattern already present in:
  - `src/cli/commands/configure-embedding.js`
  - `src/cli/commands/configure-agent-models.js`
  Do not introduce a new prompt framework for this feature.

## Recommended Path

- Move worktree provisioning out of automatic `startTask()` / `startFeature()` execution and make it a launch-time decision.
- Keep a single retained managed worktree record per `work_item_id`; upgrade `worktree.json` from `openkit/worktree@1` to `openkit/worktree@2` and normalize `@1` on read so existing retained worktrees remain usable.
- Add explicit launcher selections on `openkit run`:
  - `--worktree-mode <new|reuse|reopen|none>`
  - `--env-propagation <none|symlink|copy>`
- Put operator prompting in the CLI command layer and keep the launcher layer non-interactive:
  - `src/cli/commands/run.js` and a small helper own parsing, prompt flow, and prompt minimization.
  - `src/global/launcher.js` owns selection resolution and returns structured outcomes such as `ready`, `prompt_required`, and `blocked`.
- Remove automatic post-run merge/remove from `src/global/launcher.js`; expose cleanup as a separate explicit compatibility action in `.opencode/workflow-state.js`.
- Keep this feature bounded to one retained worktree per lineage. Because path and branch naming stay unchanged, explicit `new` is a valid requested mode but is **blocked** when a retained same-lineage worktree already exists; OpenKit must surface that condition and require the operator to choose reuse/reopen/none or run explicit cleanup first. It must not silently substitute another mode.

This is enough because it fixes the unwanted automation and prompt behavior entirely inside the existing worktree store, launcher, and `openkit run` surfaces without inventing mid-session cwd switching, a generalized workspace catalog, or a branch/layout redesign.

## Impacted Surfaces

### Worktree metadata and read-models
- `.opencode/lib/work-item-store.js`
- `.opencode/lib/runtime-summary.js`

### Workflow controller and explicit cleanup surface
- `.opencode/lib/workflow-state-controller.js`
- `.opencode/workflow-state.js`

### Launcher and worktree behavior
- `src/global/worktree-manager.js`
- `src/global/launcher.js`
- `src/global/worktree-env.js` *(new)*

### CLI parsing and interactive prompting
- `src/cli/commands/run.js`
- `src/cli/commands/run-options.js` *(new)*

### Tests
- `.opencode/tests/work-item-store.test.js`
- `.opencode/tests/workflow-state-controller.test.js`
- `.opencode/tests/workflow-state-cli.test.js`
- `tests/global/worktree-manager.test.js`
- `tests/global/worktree-env.test.js` *(new)*
- `tests/runtime/launcher.test.js`
- `tests/cli/run-options.test.js` *(new)*
- `tests/cli/openkit-cli.test.js`

## Implementation Slices

### Slice 1: Upgrade retained worktree metadata and decouple work item creation from automatic provisioning
- **Files**:
  - `.opencode/lib/work-item-store.js`
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/tests/work-item-store.test.js`
  - `.opencode/tests/workflow-state-controller.test.js`
- **Goal**: make retained worktree data explicit and backward-compatible, and stop `startTask()` from creating worktrees before the operator has made a launcher choice.
- **Details**:
  - Keep storage in `.opencode/work-items/<work_item_id>/worktree.json`, but normalize reads to this v2 shape:
    - `schema: "openkit/worktree@2"`
    - `work_item_id`
    - `workflow_mode` (`quick` / `migration` / `full`)
    - `lineage_key` (set to `work_item_id` for this feature)
    - `repository_root`
    - `target_branch`
    - `branch`
    - `worktree_path`
    - `created_at`
    - `last_used_at`
    - `env_propagation: { mode, applied_at, source_files }`
  - In `readWorkItemWorktree()`, map legacy `openkit/worktree@1` records by translating `mode -> workflow_mode`, defaulting `lineage_key` to `work_item_id`, and defaulting `env_propagation.mode` to `none`.
  - In `.opencode/lib/workflow-state-controller.js`, remove the unconditional `createManagedWorktree()` call from `startTask()` / `startFeature()`. These flows should create and select the work item state only.
  - If compatibility return fields such as `worktree_status` and `worktree_reason` remain, they should report `not_requested` / `null` when no explicit launch selection happened; they must no longer imply automatic provisioning.
  - Update `.opencode/lib/runtime-summary.js` to treat the stored record as a retained managed worktree read-model, not as proof that the current session is already inside that path.
- **Validation Command**:
  - `node --test ".opencode/tests/work-item-store.test.js"`
  - `node --test ".opencode/tests/workflow-state-controller.test.js"`

### Slice 2: Resolve `new` / `reuse` / `reopen` / `none` at launcher time and keep prompting single-point only
- **Files**:
  - `src/cli/commands/run-options.js` *(new)*
  - `src/cli/commands/run.js`
  - `src/global/launcher.js`
  - `tests/cli/run-options.test.js` *(new)*
  - `tests/runtime/launcher.test.js`
  - `tests/cli/openkit-cli.test.js`
- **Goal**: make `openkit run` the operator-visible decision point for worktree mode and avoid repeated prompts once the choice is supplied.
- **Details**:
  - `src/cli/commands/run-options.js` should own parsing of OpenKit-specific flags and normalize them into one request object:
    - `workItemId`
    - `worktreeMode`
    - `envPropagation`
    - `passthroughArgs`
  - `src/cli/commands/run.js` should:
    - update `runHelp()` with the new flags
    - reuse the existing `io.prompt` / `readline` adapter pattern already used elsewhere in the CLI
    - prompt only when the launcher reports that a real operator choice is still missing
  - `src/global/launcher.js` should resolve modes using the retained worktree record and the current work-item state:
    - `none`: launch repository root; no managed worktree creation, reopen, or env propagation
    - `reuse`: use the retained same-lineage worktree when the record exists, the path exists, and the work item is still in an active same-lineage follow-up context
    - `reopen`: use the same retained record when the work item is being re-entered after a prior run/completion boundary (for this feature, `status === done` or a terminal stage is the concrete reopen signal)
    - `new`: create a fresh worktree only when no retained same-lineage record currently occupies the preserved `.worktrees/<work_item_id>` slot
  - If no explicit mode is supplied, smart defaulting is allowed only when exactly one stored retained worktree for the requested `work_item_id` exists and its path is usable:
    - prefer `reuse` for active same-lineage follow-up work
    - prefer `reopen` for done/resumed same-lineage work
    - otherwise return `prompt_required`
  - If explicit `reuse`, `reopen`, or `new` cannot be satisfied, `src/global/launcher.js` must return a visible blocked result. `src/cli/commands/run.js` may reprompt in interactive mode, but non-interactive mode must exit non-zero. No silent fallback to another worktree mode is allowed.
  - `openkit run` without `--work-item` should remain a repository-root launch. This feature should not invent anonymous retained worktrees.
- **Validation Command**:
  - `node --test "tests/cli/run-options.test.js"`
  - `node --test "tests/runtime/launcher.test.js"`
  - `node --test "tests/cli/openkit-cli.test.js"`

### Slice 3: Add explicit env propagation with `none` / `symlink` / `copy` and no silent downgrade
- **Files**:
  - `src/global/worktree-env.js` *(new)*
  - `src/global/worktree-manager.js`
  - `src/global/launcher.js`
  - `tests/global/worktree-env.test.js` *(new)*
  - `tests/global/worktree-manager.test.js`
  - `tests/runtime/launcher.test.js`
- **Goal**: make `.env` propagation opt-in, conflict-aware, and launcher-visible without expanding this feature into a generalized secret-management system.
- **Details**:
  - Put all `.env` propagation filesystem logic in `src/global/worktree-env.js`, not in `src/global/launcher.js`.
  - Limit candidate source files to repository-root `.env` and `.env.*` files only.
  - Preflight every target path before writing anything. If any target env file already exists in the worktree, return a conflict outcome and write nothing.
  - `symlink` is the preferred mode when the operator wants propagation. If symlink creation is unavailable, unsupported, or unsafe, return a visible `unsupported`/`unsafe` outcome and require the next explicit choice. Do **not** call the copy path automatically.
  - `copy` is allowed only after explicit selection and must emit a concise drift/secret-duplication warning before applying files.
  - `none` is the default when no prior same-lineage retained choice exists. If a retained same-lineage worktree record already contains `env_propagation.mode`, reuse that mode only when the operator is reusing or reopening that same retained worktree.
  - `worktree-mode=none` bypasses the helper completely. If `--env-propagation` is also supplied, surface one visible “not applicable” notice and continue with repository-root launch.
  - Persist the last applied env mode and propagated source file list into the v2 `worktree.json` record so the same-lineage retained context can default intelligently without a second prompt during the same follow-up path.
- **Validation Command**:
  - `node --test "tests/global/worktree-env.test.js"`
  - `node --test "tests/global/worktree-manager.test.js"`
  - `node --test "tests/runtime/launcher.test.js"`

### Slice 4: Separate cleanup from task completion and make retained context observable
- **Files**:
  - `src/global/launcher.js`
  - `src/global/worktree-manager.js`
  - `.opencode/lib/workflow-state-controller.js`
  - `.opencode/workflow-state.js`
  - `.opencode/lib/runtime-summary.js`
  - `.opencode/tests/workflow-state-cli.test.js`
  - `tests/runtime/launcher.test.js`
- **Goal**: stop automatic merge/remove on normal exit and expose an explicit cleanup path that uses the existing backend intentionally.
- **Details**:
  - Remove the `finalizeCompletedWorktree()` automatic call path from `src/global/launcher.js`.
  - Keep the existing merge/remove backend in `src/global/worktree-manager.js`, but expose it only through an explicit operator action such as `cleanup-worktree <work_item_id>` on `.opencode/workflow-state.js`.
  - Add the corresponding controller entrypoint in `.opencode/lib/workflow-state-controller.js`; this should be the only path that calls the destructive merge/remove backend for this feature.
  - Change post-run launcher messaging to report retained context instead of cleanup completion. The message should include:
    - retained worktree path
    - recommended next mode (`reuse` or `reopen`)
    - last applied env propagation mode
    - explicit cleanup instruction: `node .opencode/workflow-state.js cleanup-worktree <work_item_id>`
  - Update runtime summary wording from “active worktree” to “managed worktree” / “retained worktree” where appropriate so `status`, `resume-summary`, and `doctor` stay truthful after automatic cleanup is removed.
  - Update `ensureCleanGitStatus()` error wording in `src/global/worktree-manager.js` so it refers to explicit cleanup rather than automatic cleanup.
- **Validation Command**:
  - `node --test ".opencode/tests/workflow-state-cli.test.js"`
  - `node --test "tests/runtime/launcher.test.js"`

## Validation Matrix

| Target | Primary files | Honest validation path |
| --- | --- | --- |
| `worktree.json` v2 normalization and legacy `@1` compatibility | `.opencode/lib/work-item-store.js` | `node --test ".opencode/tests/work-item-store.test.js"` |
| No automatic worktree creation during `startTask()` / `startFeature()` | `.opencode/lib/workflow-state-controller.js` | `node --test ".opencode/tests/workflow-state-controller.test.js"` |
| Explicit `new` / `reuse` / `reopen` / `none` resolution and same-lineage defaulting | `src/global/launcher.js`, `src/cli/commands/run-options.js` | `node --test "tests/cli/run-options.test.js"` and `node --test "tests/runtime/launcher.test.js"` |
| Operator-facing run help and non-interactive flag path | `src/cli/commands/run.js` | `node --test "tests/cli/openkit-cli.test.js"` |
| Env propagation `none` / `symlink` / `copy`, no silent downgrade, no overwrite | `src/global/worktree-env.js`, `src/global/worktree-manager.js` | `node --test "tests/global/worktree-env.test.js"` and `node --test "tests/global/worktree-manager.test.js"` |
| Cleanup separated from task completion and launcher exit | `src/global/launcher.js`, `.opencode/workflow-state.js` | `node --test ".opencode/tests/workflow-state-cli.test.js"` and `node --test "tests/runtime/launcher.test.js"` |
| Runtime status/read-model wording stays truthful after retention change | `.opencode/lib/runtime-summary.js`, `.opencode/workflow-state.js` | `node --test ".opencode/tests/workflow-state-cli.test.js"` |

Validation note: there is no repo-native build/lint umbrella command for this repository. Fullstack should use the targeted Node test files above and report any uncovered manual edge explicitly instead of inventing a broader command.

## Integration Checkpoint

Before handing to Code Review, verify one retained-context end-to-end flow across the real feature boundary:

1. Create or select a work item without auto-provisioning a worktree.
2. Launch it with `openkit run --work-item <id> --worktree-mode new --env-propagation symlink`.
3. Exit with the work item marked done and confirm the worktree is **retained**, not merged/removed.
4. Relaunch the same work item without an explicit worktree mode and confirm the launcher recommends or defaults to `reopen`/`reuse` based on same-lineage retained context.
5. Invoke the explicit cleanup compatibility command and confirm merge/remove only happens there.

Review must preserve these non-negotiables:
- no automatic cleanup on task completion or normal launcher exit
- no silent mode substitution for explicit `new`, `reuse`, `reopen`, or `none`
- no silent `symlink -> copy` downgrade
- no silent overwrite of existing target env files

## Dependency Graph

- **Execution mode**: sequential only. This feature shares the same store, launcher, and worktree lifecycle surfaces; parallel implementation would create avoidable integration risk.
- **Slice order**:
  - `Slice 1 -> Slice 2` because launch-time mode resolution depends on the v2 metadata contract and on `startTask()` no longer provisioning automatically.
  - `Slice 2 -> Slice 3` because env propagation only runs after the launcher has resolved whether the run is `new`, `reuse`, `reopen`, or `none`.
  - `Slice 2 -> Slice 4` because cleanup separation and retained-context messaging depend on the new launch-time retention contract.
  - `Slice 3 -> Slice 4` because retained post-run messaging should report the final applied env propagation mode.
- **Critical path**: metadata normalization and controller decoupling -> launch selection/prompting -> env propagation -> explicit cleanup/status messaging -> targeted Node tests.
