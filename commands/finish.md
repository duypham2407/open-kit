---
description: "Finish the current session: squash-merge the feature branch back into the target branch (full / migration), or close out the work item (quick), then update both indexes."
---

# Command: `/finish`

- Follow `.opencode/openkit/context/core/prompt-contracts.md`.
- Follow `.opencode/openkit/context/core/runtime-surfaces.md` so finish operates from explicit workflow-state surfaces only.
- Use this command when the lane gate has been approved and you want to land the session back onto the target branch.

## What this command does

`/finish` thinly wraps `openkit finish`, which resolves the current session from `OPENKIT_SESSION_ID` and dispatches to `finishSession` per spec §6.8.

Per lane:

- **quick** — verify the `quick_verified` gate is approved, mark `work_item.status=done`, mark `session.status=closed`. No git op.
- **full** — verify the `qa_to_done` gate, validate worktree (exists, on `feature_branch`, clean) and repo root (on `target_branch`), then `git merge --squash <feature_branch>` + `git commit -m "full(<slug>): <summary>"` in the repo root, remove the worktree, delete the feature branch, and close indexes.
- **migration** — same as full but verifies the `migration_verified` gate and writes a `migration(<slug>): <summary>` commit.

## Preconditions

- `OPENKIT_SESSION_ID` is set in the env (the runtime injects this — `/finish` does not start a session).
- The lane's final gate has been approved in workflow state.
- For full / migration: the repo root is checked out on `meta.target_branch` and the worktree is on `meta.feature_branch` with no uncommitted changes.

## Failure modes (none of which mutate state)

- `OK_FINISH_GATE_NOT_MET` — finish refuses until the lane gate is approved.
- `OK_FINISH_WORKTREE_MISSING` / `OK_FINISH_WORKTREE_DIRTY` / `OK_FINISH_BRANCH_MISMATCH` / `OK_FINISH_REPO_WRONG_BRANCH` — operator must reconcile manually before re-running `/finish`.
- `OK_FINISH_MERGE_CONFLICT` — `git merge --squash` produced conflicts. The worktree, feature branch, and session are left in place; resolve in the repo root and re-run `/finish`.

## Lane authority

`/finish` is invoked only after the lane gate has been approved. It does not change branches automatically — switch the repo root to the target branch first.

## Example

```text
User: /finish
Assistant: $ openkit finish
Finished session s_full01. Squash-merged full lane into target branch as: full(login-flow): add login flow
Worktree: removed. Work item login-flow marked done.
```
