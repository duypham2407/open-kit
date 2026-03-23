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
- `context/core/lane-selection.md`
- `context/core/project-config.md`
- `.opencode/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator confirms quick eligibility
- Record `mode = quick` and `mode_reason`
- Initialize `quick_intake`, prepare the quick intake context, then advance to `quick_plan`
- Once the required `quick_plan` context is ready, route into `quick_build` with the Fullstack Agent
- Create an optional task card only when traceability is genuinely useful
- Reject quick entry if compatibility or modernization risk is the dominant reason the user asked for the work

## Rejection or escalation behavior

- If the request does not meet quick criteria, reject quick entry and reroute through `migration_intake` or `full_intake` based on the canonical workflow rules
- If the command explicitly asks for quick mode but the routing profile would classify the work as `migration` or `full`, reject quick admission instead of silently keeping the wrong lane
- If an escalation condition appears during the quick loop, the Master Orchestrator must switch the work into `full_intake`
- If useful for operator clarity, explain that the work now belongs in Full Delivery without redefining the command surface

## Validation guidance

- Keep quick-task validation short and real, following `context/core/project-config.md`
- If no app-native test or lint command exists, document the manual or artifact-based verification path clearly
- Use `node .opencode/workflow-state.js validate` only for workflow-state checks, not as a substitute for application testing
