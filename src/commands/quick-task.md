---
description: "Starts the Quick Task lane with Quick Agent as the single owner from intake through verification."
---

# Command: `/quick-task`

Use `/quick-task` for daily, bounded work where the problem is small in scope and behavior is mostly clear.

## What this command does

1. Bootstraps quick workflow state with `lane=quick` and the user's request as `description`.
2. Binds the session to **Quick Agent** at `quick_intake`.
3. Quick Agent performs intake bookkeeping, advances to `quick_plan`, and runs the brainstorm-then-plan flow.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for shared runtime-path, verification, and tool-substitution rules.
- Follow `.opencode/openkit/context/core/tool-substitution-rules.md` when reading or searching code.

## Preconditions

- A user request exists with enough text to bootstrap (description is non-empty).
- The user picked the quick lane explicitly. If brainstorm reveals the work is bigger, Quick Agent reports the mismatch to the user and asks before switching lanes.

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/context/core/code-quality.md`
- `.opencode/openkit/workflow-state.json` after bootstrap

## Stage chain

```
quick_intake (Quick Agent) → quick_plan (Quick Agent: brainstorm + plan) → quick_implement → quick_test → quick_done
```

`quick_intake` is Quick Agent owned and ephemeral. It records the request context, advances to `quick_plan`, and never becomes a separate handoff.

## Quick Agent behavior during `quick_plan`

During `quick_plan`: brainstorm to confirm understanding, then present 3 options by default (or fewer with explicit justification), wait for user option selection, produce execution plan, and require separate plan confirmation before `quick_implement`.

## Lane authority

User picked `/quick-task`. Lane is locked unless brainstorm reveals scope is cross-boundary, in which case Quick Agent asks the user (y/n) before switching to `/delivery`.

## Validation guidance

- Use real app build/test/lint commands per `context/core/project-config.md`.
- Use `node .opencode/openkit/workflow-state.js validate` for state integrity, not as a substitute for app testing.

## Example transcript

```text
User: /quick-task fix the CSV export that drops the header row
QuickAgent: Bootstrapping quick workflow.
QuickAgent: Let me read the export logic. (reads code)
QuickAgent: 1) Is the missing header on all formats or just one?
User: Just CSV.
QuickAgent: 2) The fix should preserve the existing column order, right?
User: Yes.
QuickAgent: Brainstorm summary written. Here are 3 options:
  A: Off-by-one fix in the slice (low effort, low risk)
  B: Rewrite with streaming (medium, medium)
  C: Header template (high, low)
  I recommend A.
User: Go with A.
QuickAgent: Plan. Confirm?
User: Yes.
QuickAgent: Done. Tests pass. Summary: ...
```
