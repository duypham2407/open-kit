---
description: "Starts the Full Delivery lane for feature work and higher-risk changes."
---

# Command: `/delivery`

Use `/delivery` when work needs the full lane from the start or when quick or migration work has already escalated.

## Global OpenKit path rule

- In globally installed OpenKit sessions, resolve OpenKit-owned docs from `OPENKIT_KIT_ROOT` instead of assuming the target repository contains `AGENTS.md`, `context/`, or `.opencode/`.
- For example, `context/core/workflow.md` means `${OPENKIT_KIT_ROOT}/context/core/workflow.md`.
- Resolve resumable workflow state from `OPENKIT_WORKFLOW_STATE`.
- Use `node "${OPENKIT_KIT_ROOT}/.opencode/workflow-state.js" --state "${OPENKIT_WORKFLOW_STATE}" <command>` for workflow-state checks in global mode.

## Preconditions

- The request satisfies one or more full-lane triggers in `context/core/workflow.md`
- If this is resumed work, escalation context or the current full stage must be read from workflow state before continuing

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/lane-selection.md`
- `context/core/approval-gates.md`
- `context/core/project-config.md`
- `.opencode/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator records `mode = full` and `mode_reason`
- Initialize `full_intake`
- Route to the PM Agent to begin the Full Delivery chain defined in `context/core/workflow.md`
- Track approval gates in workflow state before each stage advance
- Use this lane when the dominant uncertainty is product behavior, requirements, or cross-boundary solution design rather than compatibility modernization

## Rejection or escalation behavior

- If the command is entered from an active quick or migration context, preserve escalation metadata while moving into `full_intake`
- If the command explicitly asks for full mode but the routing profile still shows behavior-preserving modernization with compatibility uncertainty, reject full admission and reroute to migration instead of silently widening the lane
- If required full-mode context is missing or state is contradictory, stop at intake and report the mismatch instead of skipping a stage
- Do not create a new lane, new stage, or alternate full-entry chain outside the canonical workflow doc

## Validation guidance

- Use the workflow-state utility against `OPENKIT_WORKFLOW_STATE` when resumable full-mode state needs confirmation
- Keep implementation and QA validation honest to the repository's actual tooling
- Do not overstate automation when the repository still lacks app-native build, lint, or test commands
