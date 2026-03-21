---
description: "Starts the Quick Task lane for narrow, low-risk work."
---

# Command: `/quick-task`

Use `/quick-task` when the user wants to enter the quick lane directly for bounded small-to-medium work that stays within the quick-lane limits, remains lower risk, and uses a short verification path.

## Preconditions

- The request must satisfy quick-lane criteria in `context/core/workflow.md`
- If work is resuming, the current state must be compatible with continuing quick work or starting a new task

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `.opencode/workflow-state.json` when resuming

## Expected action

- `MasterOrchestrator` confirms quick eligibility
- Record `mode = quick` and `mode_reason`
- Initialize `quick_intake`, prepare the quick intake context, then advance to `quick_plan`
- Once the required `quick_plan` context is ready, route into `quick_build` with `FullstackAgent`
- Create an optional task card only when traceability is genuinely useful

## Rejection or escalation behavior

- If the request does not meet quick criteria, reject quick entry and reroute through `full_intake`
- If an escalation condition appears during the quick loop, `MasterOrchestrator` must switch the work into `full_intake`
- If useful for operator clarity, explain that the work now belongs in full-delivery handling without redefining the command surface
