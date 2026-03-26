---
description: "Starts the Full Delivery lane for feature work and higher-risk changes."
---

# Command: `/delivery`

Use `/delivery` when work needs the full lane from the start or when quick or migration work has already escalated.

## Shared prompt contract

- Follow `.opencode/openkit/context/core/prompt-contracts.md` for the shared runtime-path and verification rules.

## Preconditions

- The request satisfies one or more full-lane triggers in `context/core/workflow.md`
- If this is resumed work, escalation context or the current full stage must be read from workflow state before continuing

## Canonical docs to load

- `.opencode/openkit/AGENTS.md`
- `.opencode/openkit/context/navigation.md`
- `.opencode/openkit/context/core/workflow.md`
- `.opencode/openkit/context/core/lane-selection.md`
- `.opencode/openkit/context/core/approval-gates.md`
- `.opencode/openkit/context/core/project-config.md`
- `.opencode/openkit/context/core/runtime-surfaces.md`
- `.opencode/openkit/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator records `mode = full` and `mode_reason`
- Tell the user the next action in full-delivery language: initialize intake, then route into the artifact and approval chain
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

- Use `node .opencode/openkit/workflow-state.js show` or `node .opencode/openkit/workflow-state.js validate` when resumable full-mode state needs confirmation
- Keep implementation and QA validation honest to the repository's actual tooling
- Do not overstate automation when the repository still lacks app-native build, lint, or test commands

## Example transcript

```text
User: /delivery add a new approval workflow for enterprise billing
OpenKit: This belongs in Full Delivery because the work changes product behavior and needs deliberate definition across requirements and architecture.
OpenKit: Next action: initialize full_intake and route to the PM Agent for the brief.
```
