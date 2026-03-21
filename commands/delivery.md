---
description: "Starts the Full Delivery lane for feature work and higher-risk changes."
---

# Command: `/delivery`

Use `/delivery` when work needs the full lane from the start or when quick work has already escalated.

## Preconditions

- The request satisfies one or more full-lane triggers in `context/core/workflow.md`
- If this is resumed work, escalation context or the current full stage must be read from workflow state before continuing

## Canonical docs to load

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/approval-gates.md`
- `.opencode/workflow-state.json` when resuming

## Expected action

- `MasterOrchestrator` records `mode = full` and `mode_reason`
- Initialize `full_intake`
- Route to the PM agent to begin the full-delivery chain defined in `context/core/workflow.md`
- Track approval gates in workflow state before each stage advance

## Rejection or escalation behavior

- If the command is entered from an active quick context, preserve escalation metadata while moving into `full_intake`
- If required full-mode context is missing or state is contradictory, stop at intake and report the mismatch instead of skipping a stage
- Do not create a new lane, new stage, or alternate full-entry chain outside the canonical workflow doc
