---
description: "Default entry command. Lets the Master Orchestrator classify work into Quick Task, Migration, or Full Delivery."
---

# Command: `/task`

Use `/task` when the user wants the default entrypoint and expects the Master Orchestrator to choose the lane.

## Global OpenKit path rule

- In globally installed OpenKit sessions, do not assume the target repository contains `AGENTS.md`, `context/`, `docs/`, or `.opencode/` from the OpenKit kit.
- Resolve canonical OpenKit docs under the absolute kit root from `OPENKIT_KIT_ROOT`. For example, `context/core/workflow.md` means `${OPENKIT_KIT_ROOT}/context/core/workflow.md`.
- Resolve workflow state from `OPENKIT_WORKFLOW_STATE`, not from the target repository, unless you are intentionally operating inside the OpenKit repository itself.
- For workflow-state CLI operations in global mode, use `node "${OPENKIT_KIT_ROOT}/.opencode/workflow-state.js" --state "${OPENKIT_WORKFLOW_STATE}" <command>`.
- Use the target repository only for product/application code, local build tooling, and project-specific docs.

## Preconditions

- A user request exists with enough information to summarize the initial goal, scope, and risk
- If the workflow is resuming, the current workflow state must be readable before rerouting

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/lane-selection.md`
- `context/core/project-config.md`
- `.opencode/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator chooses `quick`, `migration`, or `full` using the canonical workflow rules
- Record `mode` and `mode_reason` in workflow state
- If the task enters the quick lane, initialize quick intake context and continue through the canonical quick stage chain
- If the task enters the migration lane, initialize `migration_intake` and continue through the canonical migration stage chain
- If the task enters the full lane, initialize `full_intake` and route to the PM agent
- When choosing migration, prefer a behavior-preserving path that decouples blockers before changing the stack broadly
- Use the lane tie-breaker from `context/core/workflow.md`: product ambiguity goes to `full`, compatibility uncertainty with preserved behavior goes to `migration`, and only bounded low-risk work goes to `quick`

## Rejection or escalation behavior

- If the request is ambiguous because product behavior, requirements, or acceptance are unclear, route it to `Full Delivery` per `context/core/workflow.md`
- If the request is uncertain mainly because of upgrade or compatibility risk while the target behavior is already known, route it to `Migration`
- If the request is too incomplete to open even `full_intake`, stop at intake and ask for clarification instead of guessing
- If the quick lane is not appropriate under `context/core/workflow.md`, route directly to the migration or full lane that best matches the request

## Validation guidance

- Use the workflow-state utility against `OPENKIT_WORKFLOW_STATE` to inspect resumable state before rerouting when needed
- Use the workflow-state utility against `OPENKIT_WORKFLOW_STATE` to validate stale or manually edited state when needed
- Do not imply repo-native app build, lint, or test commands exist when this repository has not defined them
