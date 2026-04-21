---
artifact_type: qa_report
version: 1
status: draft
feature_id: FEATURE-936
feature_slug: worktree-ux-selection-retention
source_plan: docs/solution/2026-04-19-worktree-ux-selection-retention.md
owner: QAAgent
approval_gate: qa_to_done
---

# QA Report: Worktree UX Selection and Retention

## Overall Status
- PASS

## Verification Scope

- Verified explicit worktree mode behavior for `new`, `reuse`, `reopen`, and `none`
- Verified retained worktree behavior remains separate from task completion and launcher exit
- Verified `.env` propagation safety behavior for `none`, `symlink`, and `copy`
- Verified retained-context messaging across launcher, runtime summary, workflow-state CLI, and session-start surfaces

## Observed Result

- Repeated retained launches no longer fail when previously propagated env files already match the selected retained mode
- Explicit `reuse` and `reopen` now produce distinct blocked outcomes when used against the wrong work-item lifecycle state
- `copy` mode warning is visible before retained-context launch lines, satisfying the operator warning contract
- Cleanup remains an explicit compatibility action instead of a hidden side effect of task completion

## Behavior Impact

- Improves operator control over retained context without broadening OpenKit into a general workspace-management system
- Reduces surprise in follow-up fix flows and preserves expected same-lineage context between runs
- Keeps secret/config handling bounded and explicit while preserving safer `symlink` preference and no silent overwrite/downgrade rules

## Spec Compliance

| Acceptance Criteria | Result | Notes |
| --- | --- | --- |
| AC-2 / AC-3 / AC-4 / AC-5 | PASS | Explicit `new`, `reuse`, `reopen`, and `none` behaviors are surfaced and blocked when unsatisfied rather than silently substituted |
| AC-6 / AC-19 | PASS | Same-lineage retained worktree reuse/reopen behavior is preserved and unavailable-target handling is explicit |
| AC-8 / AC-9 / AC-10 | PASS | Task completion and launcher exit no longer imply cleanup; explicit cleanup command remains separate |
| AC-11 / AC-12 / AC-13 / AC-14 / AC-15 / AC-18 | PASS | Env propagation remains opt-in with `none` / `symlink` / `copy`, no silent downgrade, and conflict-safe handling |
| AC-16 / AC-17 | PASS | Prompting stays scoped to launch-time choice resolution instead of recurring during internal workflow progression |

## Quality Checks

- Code review rerun passed after retained-context rework
- Launcher and env propagation rework remained bounded to the approved scope and solution slices
- Session-start and workflow-state surfaces remained truthful after retained-worktree wording changes

## Test Evidence

- `node --test tests/global/worktree-env.test.js tests/runtime/launcher.test.js`
- `node --test tests/cli/openkit-cli.test.js`
- `node --test tests/cli/run-options.test.js .opencode/tests/work-item-store.test.js .opencode/tests/workflow-state-controller.test.js .opencode/tests/workflow-state-cli.test.js .opencode/tests/session-start-hook.test.js`

## Recommended Route

- Approve `qa_to_done` and close the full-delivery work item

## Issues

- None blocking at QA closeout

## Conclusion

QA passed for FEATURE-936. The implementation behavior matches the approved scope and solution closely enough for full-delivery closure.
