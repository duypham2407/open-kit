---
description: "Default entry command. Lets the Master Orchestrator classify work into Quick Task, Migration, or Full Delivery."
---

# Command: `/task`

Use `/task` when the user wants the default entrypoint and expects the Master Orchestrator to choose the lane.

Default-path rule:

- Treat `/task` as the safest first command unless the lane is already obvious.
- Prefer telling the user the next action after routing, not only the chosen lane name.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.

## Preconditions

- A user request exists with enough information to summarize the initial goal, scope, and risk
- If the workflow is resuming, the current workflow state must be readable before rerouting

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator chooses `quick`, `migration`, or `full` using the canonical workflow rules
- Record `mode` and `mode_reason` in workflow state
- Tell the user the next action after routing:
  - quick -> confirm the bounded checklist and verification path
  - migration -> capture preserved invariants and baseline evidence before upgrade slices
  - full -> initialize full intake and route into the full artifact chain
- If the task enters the quick lane, initialize quick intake context and continue through the canonical quick stage chain
- If the task enters the migration lane, initialize `migration_intake` and continue through the canonical migration stage chain
- If the task enters the full lane, initialize `full_intake` and route to `Product Lead`
- Keep `Master Orchestrator` procedural: route, dispatch, record state, and ask for missing context, but do not define scope or solution content locally
- When choosing migration, prefer a behavior-preserving path that decouples blockers before changing the stack broadly
- Use the lane tie-breaker from `context/core/workflow.md`: product ambiguity goes to `full`, compatibility uncertainty with preserved behavior goes to `migration`, and only bounded low-risk work goes to `quick`

## Rejection or escalation behavior

- If the request is ambiguous because product behavior, requirements, or acceptance are unclear, route it to `Full Delivery` per `context/core/workflow.md`
- If the request is uncertain mainly because of upgrade or compatibility risk while the target behavior is already known, route it to `Migration`
- If the request is too incomplete to open even `full_intake`, stop at intake and ask for clarification instead of guessing
- If the quick lane is not appropriate under `context/core/workflow.md`, route directly to the migration or full lane that best matches the request

## Validation guidance

- Use `node .opencode/openkit/workflow-state.js status` or `node .opencode/openkit/workflow-state.js show` to inspect resumable state before rerouting when needed
- Use `node .opencode/openkit/workflow-state.js validate` to validate stale or manually edited state when needed
- Do not imply repo-native app build, lint, or test commands exist when this repository has not defined them

## Example transcript

```text
User: /task replace the deprecated helper in one module without changing behavior
OpenKit: I am treating /task as the default entrypoint and classifying the work first.
OpenKit: The dominant uncertainty is low and local, so I am routing this to Quick Task.
OpenKit: Next action: confirm the bounded checklist and verification path, then continue into quick_build.
```
