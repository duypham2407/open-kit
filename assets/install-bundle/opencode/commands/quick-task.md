---
description: "Starts the Quick Task lane for daily work. Routes directly to Quick Agent with no intermediary."
---

# Command: `/quick-task`

Use `/quick-task` when the user wants to enter the quick lane directly for daily work. The Quick Agent receives the request directly — Master Orchestrator does not participate.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.

## Preconditions

- A user request exists with enough information to start brainstorming
- If work is resuming, the current state must be compatible with continuing quick work or starting a new task

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/context/core/code-quality.md`
- `.opencode/openkit/workflow-state.json` when resuming
- `.opencode/work-items/` when managed work-item backing state is relevant

## Expected action

- The Quick Agent receives the request directly — no Master Orchestrator involvement
- Record `lane_source = user_explicit`, `mode = quick`, and `mode_reason` in workflow state
- Initialize `quick_intake`, then advance immediately to `quick_brainstorm`
- Follow the single-agent quick pipeline: `quick_brainstorm -> quick_plan -> quick_implement -> quick_test -> quick_done`
- During brainstorm: read the codebase deeply, generate 3 solution options with pros/cons analysis, recommend the best option, and wait for the user to choose
- Create an optional task card only when traceability is genuinely useful

## Lane authority

The user selected `/quick-task` explicitly. This is a **lane lock**.

- No agent may reject, reroute, or override the lane to `migration` or `full`
- If the Quick Agent encounters a problem that exceeds quick-mode boundaries, it reports to the user with options — the user decides whether to switch lanes
- No auto-escalation

## Validation guidance

- Keep quick-task validation real, following `context/core/project-config.md`
- If no app-native test or lint command exists, document the manual or artifact-based verification path clearly
- Use `node .opencode/openkit/workflow-state.js validate` only for workflow-state checks, not as a substitute for application testing

## Example transcript

```text
User: /quick-task fix the CSV export that drops the header row
QuickAgent: Let me read the codebase to understand the export logic...
QuickAgent: I've analyzed the code. Here are 3 options:
  Option A: Fix the off-by-one in the slice() call (low effort, low risk)
  Option B: Rewrite the export function with streaming (medium effort, medium risk)
  Option C: Add a header template system (high effort, low risk)
  I recommend Option A because the root cause is a simple off-by-one error.
User: Go with A.
QuickAgent: Here's the execution plan: [plan]. Confirm?
User: Yes.
QuickAgent: Done. Tests pass. Here's the summary: [summary].
```
