# Manual QA Checklist — Multi-Session Workflow Isolation (v0.7.0)

**Spec:** `docs/superpowers/specs/2026-05-09-multi-session-isolation-design.md`
**Plan:** `docs/superpowers/plans/2026-05-09-multi-session-isolation.md`
**Cutover release:** v0.7.0
**Schema:** `openkit/sessions-index@1`, `openkit/work-items-index@3`, `openkit/legacy-stub@1`

This document is the operator-driven smoke pass that complements the
automated `verify:all` test suite. The automated suite exercises the
unit and integration layers; this checklist exists for the few user
journeys that depend on real terminals, real `kill -9`, real wall-clock
heartbeats, and real upgrades from a v2 layout.

Run this on a sacrificial repository (or a clean clone). Do not run it
against a production work tree — the kill scenarios assume it is safe to
SIGKILL the harness.

## How to use this document

For each scenario:
1. Follow the **Steps** in order.
2. Confirm the **Expected** observations.
3. Tick the **Pass / Fail** column.
4. Capture supporting evidence (paths, console screenshots, JSON
   excerpts) in the **Evidence** column. Reference filenames inside
   `docs/superpowers/qa/evidence/2026-05-09/` if attaching artifacts.

Re-run any scenario that fails after the underlying bug is fixed; do
not silently re-pass on the next attempt.

| Scenario | Pass / Fail | Evidence |
| --- | --- | --- |
| 1. Two-tab concurrent work item development |  |  |
| 2. Three-tab lane separation (banner + statusline) |  |  |
| 3. Orphan recovery after crash (`kill -9`) |  |  |
| 4. `/finish` for `quick` lane |  |  |
| 5. `/finish` for `full` lane |  |  |
| 6. `/finish` for `migration` lane |  |  |
| 7. Migration from v2 to v3 |  |  |
| 8. `openkit dashboard` view |  |  |
| 9. `openkit doctor` checks |  |  |
| 10. Session-bound slash rejection |  |  |

---

## 1. Two-tab concurrent work item development

Confirms the first-class invariant: two tabs may hold two different
work items in the same repo without colliding on `active_work_item_id`
or on `src/openkit-runtime/workflow-state.json`.

### Steps

1. In **tab A**: `openkit run` from the repo root, then run `/quick-task`
   and let the agent bind a small work item (e.g. `tweak-readme`).
2. In **tab B**: open a **separate terminal** in the same repo. Run
   `openkit run` again, then run `/delivery` and bind a different work
   item (e.g. `add-login-flow`).
3. While both tabs are alive, in a third shell run:
   - `openkit sessions list`
   - `cat .opencode/sessions/index.json`
   - `cat .opencode/work-items/index.json`
4. In **tab A**, advance one stage. In **tab B**, advance one stage.
5. Re-run `openkit sessions list` and the dashboard.

### Expected

- Two distinct `s_<6hex>` session IDs in `sessions/index.json`, each
  with `status: "active"` and a recent `last_seen_at`.
- `work-items/index.json` has `schema: "openkit/work-items-index@3"`.
  Two work items, each with a different `current_session_id` matching a
  live session.
- The legacy stub at `src/openkit-runtime/workflow-state.json` is the
  `openkit/legacy-stub@1` shape (or absent / rotated). Crucially, no
  `active_work_item_id` field anywhere in v3 layout.
- Stage advancement in tab A only mutates the per-session mirror under
  `OPENKIT_WORKFLOW_STATE` for tab A. Tab B's stage is unchanged.

---

## 2. Three-tab lane separation (banner + statusline)

Confirms session-start banner (spec §7.3) and statusline tag (spec §7.4)
are correctly scoped per `OPENKIT_SESSION_ID`.

### Steps

1. Open three terminals in the same repo. In each, run `openkit run`.
2. In tab 1 run `/quick-task`; in tab 2 run `/delivery`; in tab 3 run
   `/migrate`.
3. Read the session-start banner that prints when each session starts.
4. Inspect the statusline tag in each tab.

### Expected

- Each tab's banner shows a different `s_<id>`, the correct `lane=`
  value (`quick`, `full`, `migration`), and the correct work item slug.
- Statusline tags differ across tabs: `[s_<id> · <lane> · <stage>]`.
- No tab shows another tab's session ID.

---

## 3. Orphan recovery after crash

Confirms the heartbeat / orphan-scanner contract from spec §6.3 / §6.4
and the resume contract from §6.5.

### Steps

1. Start a session in **tab A** (`/delivery`). Note its session ID:
   `s_<a>`.
2. Capture the PID:
   `cat .opencode/sessions/<id>/heartbeat.json`.
3. From a **third shell**, kill the tab A harness hard:
   `kill -9 <pid>`. Close tab A's terminal window so no replacement
   process binds the session.
4. **Wait at least 10 minutes** so `last_seen_at` exceeds
   `ORPHAN_THRESHOLD_MS` (10 minutes). Do not interact with the
   session in the meantime. (If you need to compress the wait,
   manually edit `heartbeat.json` to backdate `last_seen_at` by 11
   minutes — flag this in evidence as an artificial clock skew.)
5. From any other tab run `openkit sessions list`.
6. Run `openkit sessions resume <id>` from a fresh tab.
7. Confirm the work item, stage, and worktree are intact.

### Expected

- After step 5, the killed session shows `status: "orphan"`.
- The work item still references that session as `current_session_id`
  until you resume or abandon.
- Step 6 prints export lines for `OPENKIT_SESSION_ID`,
  `OPENKIT_WORKFLOW_STATE`, etc.; once `eval`'d, the new shell can
  advance the stage with no loss of state.
- The worktree at `meta.worktree_path` is unchanged.

---

## 4. `/finish` — quick lane

Confirms spec §6.8 quick branch.

### Steps

1. In a clean tab run `/quick-task` and walk it through to the
   `quick_verified` gate. Approve the gate.
2. Run `/finish`.
3. After it returns, inspect:
   - `openkit sessions show <id>`
   - `cat .opencode/work-items/index.json`
   - `git status`

### Expected

- `/finish` reports the work item as closed; no merge happens (quick
  lane is repo-root, no worktree).
- `work_items[<id>].status === "done"`, `current_session_id` cleared.
- `sessions/index.json` shows that session as `status: "closed"`.
- No git operation occurred (no new commit, no branch deletion, no
  worktree removal).

---

## 5. `/finish` — full lane

Confirms spec §6.8 full branch (`git merge --squash`, branch + worktree
cleanup) and refusal modes.

### Steps

1. Start `/delivery`, bind a work item, let it create a worktree under
   `.claude/worktrees/<slug>` on branch `openkit/<slug>`. Implement a
   trivial change. Approve the `qa_to_done` gate.
2. **Refusal probe — dirty worktree:** in the worktree, leave a
   modified-but-uncommitted file. Run `/finish`. Confirm it refuses
   with `OK_FINISH_WORKTREE_DIRTY` and that no state mutates. Commit
   the file, then continue.
3. **Refusal probe — wrong target branch:** in the repo root, check
   out a branch other than `meta.target_branch`. Run `/finish`. Confirm
   it refuses with `OK_FINISH_REPO_WRONG_BRANCH`. Switch back to the
   target branch.
4. Run `/finish` for real.
5. Inspect:
   - The repo root `git log --oneline -1` for the squash-merge commit.
   - `git worktree list` to confirm removal.
   - `git branch` to confirm `openkit/<slug>` is gone.
   - `openkit sessions show <id>` shows `closed`.
   - `work-items/index.json` shows `status: "done"`.

### Expected

- A single new squash-merge commit on the target branch with subject
  matching `full(<slug>): <summary>`.
- Worktree directory removed; feature branch deleted.
- Session closed; work item done.
- Refusal probes leave indexes and git state untouched.

---

## 6. `/finish` — migration lane

Confirms spec §6.8 migration branch.

### Steps

1. Start `/migrate`, bind a work item, walk it to `migration_verified`,
   approve. Make a trivial change in the worktree.
2. Run `/finish`.

### Expected

- A single squash-merge commit on the target branch with subject
  `migration(<slug>): <summary>`.
- Worktree, feature branch, session, and work item all closed
  identically to the full case.

---

## 7. Migration from v2 to v3

Confirms spec §8.1–§8.3.

### Steps

1. Stand up a sacrificial repo on the **previous** OpenKit release
   (v0.6.0) with at least one in-flight work item and a managed
   worktree. Verify `src/openkit-runtime/workflow-state.json` has v2 shape and
   `src/openkit-runtime/work-items/index.json` lacks the v3 `schema` field.
2. Copy `src/openkit-runtime/` somewhere safe so you can compare before/after.
3. Upgrade to v0.7.0 (`openkit upgrade` or `npm install -g
   @duypham93/openkit@0.7.0`).
4. Run `openkit run` once to trigger startup migration.
5. Inspect:
   - `cat .opencode/work-items/index.json` for
     `schema: "openkit/work-items-index@3"` and `current_session_id`
     fields.
   - `cat .opencode/sessions/index.json` for the synthetic orphan(s).
   - `ls .opencode/workflow-state.json.legacy.*` for the rotated
     mirror.
   - `openkit dashboard` for the synthetic orphan visualization.
6. Run `openkit sessions resume <synthetic_orphan_id>` and confirm the
   pre-existing worktree/state is reachable.

### Expected

- Migration is idempotent — running `openkit run` a second time does
  not add another synthetic orphan or another `.legacy.*` rotation.
- No work item is lost. Each previously in-flight item maps to either
  a synthetic orphan (`s_orphan_<8hex>`) or a `done` item.
- Legacy stub at `src/openkit-runtime/workflow-state.json` has
  `schema: "openkit/legacy-stub@1"` (or is absent if rotation has not
  yet happened in this code path).
- `active_work_item_id` is gone from the v3 index.

---

## 8. `openkit dashboard`

Confirms spec §7.1 dashboard surface.

### Steps

1. With the multi-tab fixture from scenario 1 still alive, run
   `openkit dashboard`.
2. Close one tab cleanly (`/finish` it). Run dashboard again.
3. Force one tab into orphan via scenario 3 steps. Run dashboard
   again.

### Expected

- Active sessions listed with lane, stage, work-item slug, age of last
  heartbeat.
- Orphan sessions listed in a separate section, distinguishable by
  color or section header.
- Closed sessions listed (or hidden behind `--all`, depending on
  current implementation).
- Synthetic orphans show as `s_orphan_*` and are flagged as
  migration-derived.

---

## 9. `openkit doctor` checks

Confirms spec §7.5 — five new checks added to `openkit doctor`.

### Steps

1. Run `openkit doctor` on a healthy repo (no orphans, no extra
   `.legacy.*` files). Confirm all five session checks pass.
2. Force each failure mode in turn and re-run doctor:
   - Corrupt `src/openkit-runtime/sessions/index.json` (e.g. truncate to invalid
     JSON). Doctor should report `sessions-index-readable` as fail.
   - Generate 11+ `src/openkit-runtime/workflow-state.json.legacy.*` files.
     Doctor should report `legacy-mirror-rotation` as warn/fail.
   - Manufacture six orphan entries. Doctor should report
     `orphan-sessions-count` as warn.
   - Add a worktree on disk that has no matching session. Doctor
     should report `worktree-orphan-mismatch`.
   - Mark a session active with a bogus PID (e.g. 1). Doctor should
     report `pid-cleanup`.
3. Restore each fixture and confirm doctor returns to ok.

### Expected

- Each of the five checks has a real id matching the spec:
  `sessions-index-readable`, `legacy-mirror-rotation`,
  `orphan-sessions-count`, `worktree-orphan-mismatch`, `pid-cleanup`.
- Failures cite the offending file/PID so the operator can fix without
  guessing.

---

## 10. Session-bound slash rejection

Confirms spec §7.2 lane-binding contract: a tab already bound to a work
item refuses a second lane slash.

### Steps

1. In a tab, run `/delivery` and bind work item `add-foo`.
2. In the **same tab**, run `/quick-task`.

### Expected

- The second slash is rejected with `SessionAlreadyBoundError` (or the
  current implementation's equivalent error code) and a message of
  the form: `Session is bound to work item add-foo (lane=full). Open a
  new tab for a different work item.`
- No mutation to indexes or workflow state.

---

## Sign-off

| Field | Value |
| --- | --- |
| OpenKit version under test |  |
| Operator |  |
| Date |  |
| Result |  |
| Anomalies / follow-ups |  |

If any scenario fails, file a bug under `bugs/` (or the project's
current incident location) and link it from this row before signing
off. Do not mark v0.7.0 GA without a green pass on every row above.
