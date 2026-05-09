# Multi-Session Workflow Isolation — Design

- **Date:** 2026-05-09
- **Status:** Approved (brainstorming output)
- **Owner:** Solution Lead (TBD at planning time)
- **Lane target:** Full Delivery (cutover release)
- **Implementation plan:** see `docs/superpowers/plans/2026-05-09-multi-session-isolation.md` (created next)

## 1. Problem Statement

OpenKit currently keeps a single `active_work_item_id` in `.opencode/work-items/index.json` and a single top-level mirror at `.opencode/workflow-state.json`. When a user opens multiple terminal tabs against the same repository to develop multiple features in parallel, every tab reads and writes the same global "active" pointer and the same mirror file. Workflow state collides across tabs: the tab that wrote last becomes the apparent active session for everyone, advancing stages and approvals in tabs that did not request them.

The kit must let a single repository host several concurrent OpenKit sessions — each pinned to its own work item, its own workflow state, and (for full/migration lanes) its own git worktree — without touching the state of other sessions.

## 2. Goals

- One open tab = one OpenKit session = one work item, isolated end-to-end.
- Full and migration lanes always operate inside a dedicated managed worktree; quick lane stays on the repo root but still has its own per-session state.
- Crash-tolerant: a tab that exits abnormally is detectable and recoverable from any other tab.
- A `/finish` flow that squash-merges the worktree's feature branch into its target branch, removes the worktree, and closes the session.
- Cross-session visibility (`openkit dashboard`, `openkit sessions list`) so a user can see all active, orphan, and recently closed sessions on the repo.
- Migration from the current single-active model is a one-shot cutover with a rollback script.

## 3. Non-Goals

- No change to the workflow stage FSM, gate registry, or transaction-log layer in `src/runtime/state/`. These continue to be the canonical writer for per-item state.
- No reworking of the worktree-manager primitives in `src/global/worktree-manager.js`. The new layer wraps and feeds it; it does not replace it.
- No new lane semantics. Quick / full / migration definitions in `context/core/workflow.md` remain authoritative.
- No daemon process. Sessions stay file-backed; cross-session coordination uses atomic file writes and heartbeat files only.
- No remote-collaboration support (multiple humans, multiple machines). Scope is single user, single host.

## 4. Concepts and Invariants

### 4.1 Three concepts kept separate

| Concept | Meaning | Lifetime | Identity |
| --- | --- | --- | --- |
| Session | A running tab/process executing `openkit run` | Launch → tab close, `/finish`, or `abandon` | `OPENKIT_SESSION_ID` (`s_` prefix + 6 random hex chars, e.g. `s_8f3a2c`) |
| Work item | A unit of work in one lane | Created → `done` or `abandoned` | `work_item_id` (lane-prefixed slug, e.g. `full-payments-refactor`, `quick-2026-05-09-fix-typo`) |
| Worktree | An isolated git worktree for full/migration | Created with work item → removed on `/finish` | filesystem path under `<repo>/.claude/worktrees/<work_item_id>` |

### 4.2 Invariants

1. One session is bound to exactly one work item for its entire lifetime. The binding is immutable.
2. One work item has at most one active session at any moment. Resume re-binds the same `session_id` to the same work item.
3. Every full/migration work item has exactly one worktree. Quick work items have no worktree.
4. Repo root hosts only quick sessions or "no session". Tabs that invoke `/delivery` or `/migrate` always create a new worktree.
5. The global `active_work_item_id` field disappears from `work-items/index.json`. "Active" is a per-session concept resolved via `OPENKIT_SESSION_ID`.
6. All workflow state mutation continues to flow through `WorkflowStateManager`. The new resolver `(session_id) → (work_item_id, baseDir)` sits above the manager and only changes which `(workItemId, baseDir)` the manager is constructed with.

## 5. On-disk Layout

```
<repo>/.opencode/
├── workflow-state.json              ← legacy stub after migration (see §5.5)
├── workflow-state.json.legacy.<ts>  ← rotated copies, capped at 10
├── work-items/
│   ├── index.json                   ← schema v3
│   ├── <work_item_id>/
│   │   ├── state.json               ← canonical per-item state (unchanged)
│   │   ├── tasks.json
│   │   ├── tool-invocations.json
│   │   └── state-transitions.log
│   └── ...
└── sessions/                        ← new
    ├── index.json
    └── <session_id>/
        ├── meta.json                ← write-once session metadata
        ├── heartbeat.json           ← {pid, last_beat_at}
        └── workflow-state.json      ← per-session compatibility mirror
```

Worktrees stay at `<repo>/.claude/worktrees/<work_item_id>/`. Each worktree contains its own `.opencode/` tree (already true today via worktree manager). Inside a worktree, a session's `sessions/<session_id>/` lives under `<worktreePath>/.opencode/sessions/`. Quick sessions live under `<repoRoot>/.opencode/sessions/`.

### 5.1 `sessions/index.json` (new)

```json
{
  "schema": "openkit/sessions-index@1",
  "sessions": [
    {
      "session_id": "s_8f3a2c",
      "work_item_id": "full-payments-refactor",
      "lane": "full",
      "worktree_path": "/Users/.../open-kit/.claude/worktrees/full-payments-refactor",
      "repo_root": "/Users/.../open-kit",
      "pid": 48211,
      "status": "active",
      "started_at": "2026-05-09T10:12:00Z",
      "last_seen_at": "2026-05-09T10:45:13Z"
    }
  ],
  "updated_at": "2026-05-09T10:45:13Z"
}
```

- `status ∈ {active, orphan, closed}`.
  - `active`: heartbeat fresh (`last_beat_at >= now - 10 minutes`) and PID alive (`process.kill(pid, 0)` succeeds).
  - `orphan`: heartbeat stale or PID dead and work item not yet `done`.
  - `closed`: session exited cleanly via signal handler or `/finish`.
- `worktree_path` is `null` for quick lane.
- `repo_root` records the originating repository so a session created from a worktree still resolves the right index when scanned from elsewhere.
- The file is the only writer-shared session document. Every mutation uses the atomic write protocol in §5.6.

### 5.2 `sessions/<id>/meta.json` (new)

```json
{
  "schema": "openkit/session-meta@1",
  "session_id": "s_8f3a2c",
  "work_item_id": "full-payments-refactor",
  "lane": "full",
  "repo_root": "/Users/.../open-kit",
  "worktree_path": "/Users/.../.claude/worktrees/full-payments-refactor",
  "target_branch": "main",
  "feature_branch": "openkit/full-payments-refactor",
  "started_at": "2026-05-09T10:12:00Z"
}
```

Written once at session creation. Never mutated afterwards. `feature_branch` and `target_branch` are the source of truth used by `/finish`.

### 5.3 `sessions/<id>/heartbeat.json` (new)

```json
{ "pid": 48211, "last_beat_at": "2026-05-09T10:45:13.482Z" }
```

Overwritten by the owning process every 60 seconds. Only the owning process writes this file.

### 5.4 `work-items/index.json` schema v3 (modified)

Before (v2):
```json
{ "active_work_item_id": "feature-001", "work_items": [...] }
```

After (v3):
```json
{
  "schema": "openkit/work-items-index@3",
  "work_items": [
    {
      "work_item_id": "full-payments-refactor",
      "feature_id": "FEATURE-002",
      "feature_slug": "payments-refactor",
      "lane": "full",
      "status": "in_progress",
      "current_session_id": "s_8f3a2c",
      "state_path": ".opencode/work-items/full-payments-refactor/state.json",
      "created_at": "2026-05-09T10:12:00Z"
    }
  ]
}
```

- `current_session_id` is `null` when the work item is orphan, abandoned, or done.
- `status ∈ {in_progress, orphan, done, abandoned}`.
- `lane` is the canonical field; `mode` (current v2 field) maps to `lane` during migration.
- The root no longer has `active_work_item_id`.

### 5.5 Top-level `.opencode/workflow-state.json` after cutover

- Runtime no longer writes business state into this file.
- On startup, if the file exists and its `schema` is not `openkit/legacy-stub@1`, the runtime rotates it: `mv workflow-state.json workflow-state.json.legacy.<ISO>`.
- After rotation, the runtime writes a stub:
  ```json
  { "schema": "openkit/legacy-stub@1", "note": "session state moved to .opencode/sessions/<id>/workflow-state.json" }
  ```
- Rotation cap: keep at most **10** files matching `workflow-state.json.legacy.*`. Older files are deleted oldest-first.
- Logging: print one warning per process (`OK1234 Legacy mirror rotated to ...`).

### 5.6 Atomic write protocol

Applies to `sessions/index.json` and `work-items/index.json` (both shared writers). Per-session files (`meta.json`, `heartbeat.json`, the per-session mirror) are owner-only writers and do not need locking.

Steps:
1. Acquire advisory lock on the target file. Implementation: `proper-lockfile` (npm) or a `.lock` sentinel with `O_EXCL` create/retry. Lock timeout 2 seconds; on timeout throw `IndexLockTimeoutError`.
2. Read current contents.
3. Parse, mutate in memory.
4. Stringify and write to `<file>.tmp.<pid>.<rand>`.
5. `fs.renameSync(<tmp>, <file>)` (atomic on POSIX/macOS, the only supported platforms).
6. Release lock.

Retry policy: lock acquisition retries up to 20 times at 100ms intervals before timing out.

## 6. Session Lifecycle

```
        ┌──────────┐
        │  launch  │
        └────┬─────┘
             │  generate session_id, write meta, append to sessions/index.json
             ▼
        ┌──────────┐
   ┌───►│  active  │───── heartbeat every 60s
   │    └────┬─────┘
   │         │ heartbeat stale > 10 min OR PID dead
   │         ▼
   │    ┌──────────┐    openkit sessions resume <id>
   └────│  orphan  │────────────────────────────────► active
        └────┬─────┘
             │ openkit sessions abandon <id>
             ▼  (work_item.status = abandoned, sessions entry removed)

  active or orphan ── /finish ──► closed
                                 (work_item.status = done, retained 7 days)
```

Cleanup of `closed` entries: any read of `sessions/index.json` triggers a sweep removing entries whose `last_seen_at < now - 7 days` and whose `status = closed`. Same pass marks stale `active` entries as `orphan`.

### 6.1 Resolver

New module `src/runtime/sessions/session-resolver.js`. API:

```js
resolveSession({ env, repoRoot }) → {
  sessionId,
  workItemId,
  lane,
  baseDir,        // <worktreePath>/.opencode for full/migration; <repoRoot>/.opencode for quick
  mirrorPath,     // <baseDir>/sessions/<sessionId>/workflow-state.json
  worktreePath,   // null for quick
}
```

Resolution order:
1. Read `OPENKIT_SESSION_ID` from environment. Required. Missing → `SessionRequiredError` with remediation hint pointing at `openkit run`.
2. Read `<baseDir>/sessions/<sessionId>/meta.json` to obtain `work_item_id`, `lane`, `worktree_path`.
3. Cross-check `work-items/index.json`: that work item must have `current_session_id === sessionId`. Mismatch → `SessionStateMismatchError`.
4. Construct `WorkflowStateManager({ workItemId, baseDir })` as today.

The resolver does not mutate state. It is read-only.

### 6.2 Launcher

`openkit run` creates a new session:
1. Generate `session_id` (6 hex chars, prefixed `s_`).
2. Determine lane and work item:
   - No args → present lane menu (existing behavior). User picks `/quick-task | /migrate | /delivery`.
   - `--resume <session_id>` → branch into resume flow (§6.5).
3. For full/migration:
   - Compute `feature_branch = openkit/<work_item_id>` and `target_branch = currentBranchOfRepoRoot`.
   - Create worktree via `worktree-manager.js`. The branch is created off the current `HEAD` of the repo root, matching today's behavior.
   - Inject `OPENKIT_SESSION_ID` into worktree env propagation.
4. For quick: no worktree. `worktree_path = null`.
5. Write `sessions/<session_id>/meta.json` (write-once).
6. Atomic update `sessions/index.json`: append entry with `status = active`.
7. Atomic update `work-items/index.json`: append work item with `current_session_id = session_id`.
8. Spawn the user shell with env vars:
   - `OPENKIT_SESSION_ID`
   - `OPENKIT_WORK_ITEM_ID`
   - `OPENKIT_PROJECT_ROOT` (worktree path, or repo root for quick)
   - `OPENKIT_REPOSITORY_ROOT` (always repo root)
   - `OPENKIT_WORKFLOW_STATE` (per-session mirror path)

### 6.3 Heartbeat

Owning process writes `sessions/<id>/heartbeat.json` every 60s. Implementation: a `setInterval` registered when the runtime root finishes bootstrap. On `SIGINT`/`SIGTERM`/`process.exit`, the signal handler updates `sessions/index.json` setting the entry's `status = closed` (best-effort; if the process is killed -9 the orphan scanner takes over).

### 6.4 Orphan scanner

The scanner runs lazily, not as a daemon. It executes whenever:
- Any CLI command reads `sessions/index.json` (`list`, `show`, `resume`, `abandon`, `kill`, `dashboard`, launcher).
- `openkit doctor` runs.

For each `active` entry:
- If `now - last_seen_at > 10 minutes` → mark `orphan`.
- Else read `heartbeat.json`; if `now - last_beat_at > 10 minutes` → mark `orphan`.
- Else `process.kill(pid, 0)` — if it throws `ESRCH` → mark `orphan`.

When an entry transitions to `orphan`, the scanner also updates `work-items/index.json`: set `current_session_id = null`, `status = orphan`. This second write happens under the work-items lock.

The same scanner pass also deletes `closed` entries older than 7 days.

### 6.5 Resume

`openkit sessions resume <session_id>`:
1. Load `sessions/<id>/meta.json`. Missing → `SessionNotFoundError`.
2. Validate worktree exists at `meta.worktree_path` (full/migration). Missing → `WorktreeMissingError`, recommend `abandon`.
3. Validate the worktree's current branch matches `meta.feature_branch`. Mismatch → refuse; user must reconcile manually.
4. Atomic update `sessions/index.json`: `status = active`, `pid = newPid`, `last_seen_at = now`.
5. Atomic update `work-items/index.json`: `current_session_id = session_id`, `status = in_progress`.
6. Spawn shell with env vars as in §6.2 step 8.

### 6.6 Abandon

`openkit sessions abandon <session_id>`:
1. Set `work_items[*].status = abandoned`, `current_session_id = null`. State.json is preserved on disk for audit.
2. Delete `sessions/<session_id>/` directory.
3. Remove entry from `sessions/index.json`.
4. If a worktree exists, prompt `keep | remove`. Choosing `remove` runs `worktree-manager.js` clean check. If the worktree is dirty, refuse unless the user passes `openkit sessions abandon <id> --force-remove-dirty`. The flag applies only to worktree removal, not to the abandon decision itself.

### 6.7 Kill

`openkit sessions kill <session_id>` is for tabs that have hung but whose process is still alive. It does not abandon the work item.
1. Read PID from `sessions/<id>/heartbeat.json`. PID dead → recommend `abandon` instead.
2. Send `SIGTERM`. Wait 3 seconds.
3. If still alive, send `SIGKILL` and wait for `process.kill(pid, 0)` to return `ESRCH` (poll up to 5 seconds).
4. Only after the PID is confirmed dead, mark `sessions/index.json` entry `status = orphan` and clear `work_items[*].current_session_id`. The user can then `resume` or `abandon`.
5. `--abandon` flag combines kill + abandon in one command.

### 6.8 Finish

`/finish` (slash command inside a tab) and `openkit finish` (CLI from outside) share one implementation.

Quick lane:
1. Verify quick lane completion gate per `context/core/workflow.md` (`quick_verified`).
2. Set work item `status = done`, session `status = closed`. No git operation.

Full or migration lane:
1. Verify final lane gate has passed (`qa_to_done` for full, `migration_verified` for migration). Refuse otherwise.
2. Read `meta.json` to obtain `feature_branch`, `target_branch`, `worktree_path`. These are the source of truth — no inference from current shell state.
3. Validate that the worktree at `meta.worktree_path` still exists. Missing → refuse with clear error.
4. Validate that the worktree's current branch matches `meta.feature_branch` (`git -C <worktree_path> rev-parse --abbrev-ref HEAD`). Mismatch → refuse.
5. Validate worktree clean: `git -C <worktree_path> status --porcelain` must be empty.
6. Validate the repository root is on `meta.target_branch` (`git -C <repo_root> rev-parse --abbrev-ref HEAD`). Mismatch → refuse; do not change the user's branch automatically.
7. Run `git -C <repo_root> merge --squash <meta.feature_branch>` then `git -C <repo_root> commit -m "<lane>(<slug>): <summary>"`. The summary draws from the lane's primary artifact (scope or solution package).
8. On merge conflict: leave the worktree, the feature branch, and the session in place; surface the conflict and abort. The user resolves manually and reruns `/finish`.
9. On merge success: remove the worktree via `worktree-manager.js`, then `git branch -D <meta.feature_branch>`.
10. Set work item `status = done`. Set session `status = closed`. Atomic update both indexes.

## 7. CLI and Slash Surface

### 7.1 CLI (under `openkit`)

| Command | Purpose |
| --- | --- |
| `openkit sessions list [--status active\|orphan\|closed\|all]` | Default lists active + orphan. |
| `openkit sessions show <id>` | Detailed view: meta, heartbeat, current stage. |
| `openkit sessions resume <id>` | Re-attach to orphan or accidentally-closed session. |
| `openkit sessions abandon <id>` | Mark abandoned and clean up. |
| `openkit sessions kill <id> [--abandon]` | Force-stop a hung session. |
| `openkit sessions downgrade-index` | Maintainer-only rollback (see §8.4). |
| `openkit dashboard` | Cross-session colored summary. |
| `openkit finish` | Equivalent of `/finish` slash; runs against current `OPENKIT_SESSION_ID`. |

### 7.2 Slash commands (in-tab)

| Slash | Behavior |
| --- | --- |
| `/quick-task` | Bind work item to the active session. Repo root, no worktree. |
| `/migrate` | Mandatory worktree creation, bind work item to session. |
| `/delivery` | Mandatory worktree creation, bind work item to session. |
| `/finish` | Run finish flow on the current session. |

If a tab has already bound a work item and the user invokes a second lane slash, the command is rejected with `SessionAlreadyBoundError` and a message: "Session is bound to work item X (lane=full). Open a new tab for a different work item."

### 7.3 Session-start hook

`hooks/session-start*` prints a banner when `OPENKIT_SESSION_ID` is set:

```
┌─ OpenKit Session s_8f3a2c ──── lane=full ──── work-item=full-payments-refactor
│  worktree: .claude/worktrees/full-payments-refactor (branch openkit/full-payments-refactor)
│  stage: full_implementation
└─ /finish when done  •  Ctrl-D exits and leaves session active
```

When `OPENKIT_SESSION_ID` is unset, the existing legacy banner runs.

### 7.4 Statusline

The statusline plugin appends a tag of the form `[s_8f3a2c · full · full_implementation]` whenever `OPENKIT_SESSION_ID` is set.

### 7.5 `openkit doctor`

Add five checks:
- `sessions-index-readable` — index parses.
- `legacy-mirror-rotation` — at most 10 `.legacy.*` files; rotation succeeded.
- `orphan-sessions-count` — warn if more than 5 orphan entries.
- `worktree-orphan-mismatch` — every OpenKit worktree on disk has a matching session entry; otherwise list as orphan worktree.
- `pid-cleanup` — for `active` entries with fresh heartbeat, PID is alive.

## 8. Migration

One-shot cutover, shipped in **v0.7.0**. No dual-write phase.

### 8.1 Trigger

Runtime startup detects state needing migration:
- `work-items/index.json` lacks `schema` or has `schema != "openkit/work-items-index@3"` → migrate index.
- `.opencode/workflow-state.json` exists and `schema != "openkit/legacy-stub@1"` → rotate mirror.
- `.opencode/sessions/` does not exist → create empty `sessions/index.json`.

Migration is idempotent. Running twice is a no-op on a v3 layout.

### 8.2 Index migration v2 → v3

For each entry in `work_items[]`:
- Ensure `lane`. If absent, copy from `mode`.
- Ensure `status`. If `done`, keep. Otherwise set to `orphan` (since the v2 model could not distinguish active sessions, any in-flight item becomes orphan).
- Add `current_session_id = null`.
- Drop unrecognized top-level fields except `schema` and `work_items`.

Write back with `schema = "openkit/work-items-index@3"`. Drop `active_work_item_id` from the root.

### 8.3 Worktree auto-reconciliation

After index migration, scan `git worktree list --porcelain` for OpenKit-managed worktrees (path under `.claude/worktrees/`, or matched by `.opencode/lib/work-item-store.js` records).

For each managed worktree:
- If its `lineage_key` matches a v3 work item with `status != done`, create a synthetic orphan session entry. The synthetic ID intentionally diverges from the runtime convention to make it identifiable: `session_id = s_orphan_<short_hash_of_workItemId>` (8 hex chars). Other fields: `pid = null`, `status = orphan`, `last_seen_at = migration_timestamp`, `worktree_path` set, `repo_root` set. The user sees it in `openkit dashboard` and can resume or abandon.
- If no work item matches, log a warning. Do not delete the worktree automatically.

### 8.4 Rollback

`openkit sessions downgrade-index` (maintainer-only, undocumented for end-users):
1. Load v3 `work-items/index.json`.
2. Pick the first `in_progress` work item and set `active_work_item_id = workItemId`. If none, omit the field.
3. Strip `current_session_id`, `lane` (re-emit `mode`), and `status` fields that v2 did not have.
4. Write back without the v3 `schema` field.
5. Restore the most recent `workflow-state.json.legacy.*` to `workflow-state.json` if present.
6. Print a warning describing what was lost (specifically: per-session state is not represented in v2 and will appear inconsistent if multiple sessions had been active).

The rollback script is intended for incident response; it is lossy by design.

## 9. Compatibility Surface

### 9.1 Code that reads `active_work_item_id`

Every read site is replaced with a call to `resolveSession({ env, repoRoot }).workItemId`. Every write site is removed; nothing now writes that field.

The implementation plan enumerates each call site found by `grep -rn "active_work_item_id" src/`.

### 9.2 Top-level mirror

The legacy stub at `.opencode/workflow-state.json` keeps tooling that JSON-parses the file from crashing. New tooling reads the per-session mirror via `OPENKIT_WORKFLOW_STATE` env var (already set by the launcher today).

### 9.3 Worktree manager

`src/global/worktree-manager.js` continues to own worktree create/remove primitives. The new launcher and `/finish` flow call it; the manager itself is unchanged except for accepting `session_id` in metadata records.

### 9.4 WorkflowStateManager

No interface changes. The construction site changes: instead of a global "current work item" being passed, the resolver now returns `(workItemId, baseDir)` and the manager is built per-session.

## 10. Testing Strategy

### 10.1 Unit tests

| Module | Test file |
| --- | --- |
| `src/runtime/sessions/session-resolver.js` | `tests/runtime/sessions/session-resolver.test.js` |
| `src/runtime/sessions/sessions-index.js` | `tests/runtime/sessions/sessions-index.test.js` |
| `src/runtime/sessions/heartbeat.js` | `tests/runtime/sessions/heartbeat.test.js` |
| `src/runtime/sessions/orphan-scanner.js` | `tests/runtime/sessions/orphan-scanner.test.js` |
| `src/runtime/sessions/legacy-mirror-rotator.js` | `tests/runtime/sessions/legacy-mirror-rotator.test.js` |
| Schema migration v2 → v3 | `tests/runtime/state/index-migration-v2-v3.test.js` |
| Rollback script | `tests/runtime/sessions/downgrade-index.test.js` |
| Finish flow | `tests/runtime/sessions/finish.test.js` |

Each module: happy path, at least two error paths, one race path where shared state applies.

### 10.2 Integration tests

- `tests/integration/sessions-multi-tab.test.js` — fork two child processes; each launches a different lane; assert no cross-talk in indexes or mirrors.
- `tests/integration/orphan-recovery.test.js` — launch, kill -9, advance mock clock past threshold, scan, assert orphan, resume, assert state preserved.
- `tests/integration/finish-flow.test.js` — full flow happy path; variants for dirty worktree refusal, branch mismatch refusal, conflict on merge.
- `tests/integration/sessions-index-lock.test.js` — five concurrent readers and two concurrent writers; no corruption, all complete under 10 seconds.

### 10.3 Migration regression

Fixtures under `tests/fixtures/migration/`:
- `pre-v3-typical/` — v2 index with one active.
- `pre-v3-multiple-workitems/` — v2 with active plus two done.
- `pre-v3-with-worktree/` — has a managed worktree on disk.
- `pre-v3-already-v3/` — already migrated (no-op expected).
- `pre-v3-corrupted/` — JSON parse error path (graceful refuse, clear error).

Tests: `tests/regression/migration-v2-to-v3-fixtures.test.js`, `tests/regression/auto-reconcile-worktree.test.js`.

### 10.4 Doctor tests

`tests/runtime/doctor/sessions-checks.test.js` — one happy and one failure fixture per new check.

### 10.5 Manual QA checklist

Logged in `docs/qa/2026-05-09-multi-session-isolation.md` after implementation:
- Open three tabs; run `/quick-task`, `/delivery`, `/migrate` respectively. Banner and statusline differ across tabs.
- Mid-flight, run `/finish` in one tab; the others are unaffected.
- `kill -9` a tab; after 10 minutes, another tab's `openkit sessions list` shows it as orphan.
- `openkit sessions resume <orphan>` succeeds; state intact.
- `openkit dashboard` shows active, orphan, closed.
- Upgrade from a v2-state repo: migration runs, no work item lost.

### 10.6 Performance baseline

- `sessions/index.json` with ≤ 50 entries: read+parse < 5ms.
- Orphan scan over 50 entries: < 100ms.
- Heartbeat write: < 5ms p99.

## 11. Risk and Open Questions

- **proper-lockfile dependency.** Adds a runtime dep. Acceptable; alternative is a custom flock helper. Decision deferred to implementation plan.
- **macOS sleep / system suspend.** A laptop sleep longer than 10 minutes will mark active sessions as orphan. Acceptable: resume is one command. Document in operator runbook.
- **Worktree path containing whitespace or symlinks.** `worktree-manager.js` already handles these; no new constraint introduced.
- **Synthetic orphan sessions from migration.** Users who had only one active work item see one synthetic orphan after upgrade. Documented in release notes.

## 12. Out of Scope (deferred)

- Multi-machine coordination.
- Persistent daemon for live dashboard.
- Auto-cleanup of `.legacy.*` mirrors based on age (currently count-only).
- Per-session attached tmux/screen integration (today's worktree manager already handles tmux on a best-effort basis; no change here).
