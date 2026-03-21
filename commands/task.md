---
description: "Default entry command. Lets the Master Orchestrator classify work into Quick Task or Full Delivery."
---

# Command: `/task`

Use `/task` when the user wants the default entrypoint and expects the Master Orchestrator to choose the lane.

## Preconditions

- A user request exists with enough information to summarize the initial goal, scope, and risk
- If the workflow is resuming, the current workflow state must be readable before rerouting

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/project-config.md`
- `.opencode/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator chooses `quick` or `full` using the canonical workflow rules
- Record `mode` and `mode_reason` in workflow state
- If the task enters the quick lane, initialize quick intake context and continue through the canonical quick stage chain
- If the task enters the full lane, initialize `full_intake` and route to the PM agent

## Rejection or escalation behavior

- If the request is ambiguous but still complete enough to open work safely, route it to `Full Delivery` per `context/core/workflow.md`
- If the request is too incomplete to open even `full_intake`, stop at intake and ask for clarification instead of guessing
- If the quick lane is not appropriate under `context/core/workflow.md`, route directly to the full lane

## Validation guidance

- Use `node .opencode/workflow-state.js status` or `node .opencode/workflow-state.js show` to inspect resumable state before rerouting when needed
- Use `node .opencode/workflow-state.js validate` if the saved state looks stale or manually edited
- Do not imply repo-native app build, lint, or test commands exist when this repository has not defined them
