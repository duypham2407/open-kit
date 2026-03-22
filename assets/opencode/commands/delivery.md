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
- `context/core/project-config.md`
- `.opencode/workflow-state.json` when resuming

For operator checks, use the current workflow-state utility surface: `status`, `doctor`, `show`, and `validate`.

## Expected action

- The Master Orchestrator records `mode = full` and `mode_reason`
- Initialize `full_intake`
- Route to the PM Agent to begin the Full Delivery chain defined in `context/core/workflow.md`
- Track approval gates in workflow state before each stage advance

## Rejection or escalation behavior

- If the command is entered from an active quick context, preserve escalation metadata while moving into `full_intake`
- If required full-mode context is missing or state is contradictory, stop at intake and report the mismatch instead of skipping a stage
- Do not create a new lane, new stage, or alternate full-entry chain outside the canonical workflow doc

## Validation guidance

- Use `node .opencode/workflow-state.js show` or `node .opencode/workflow-state.js validate` when resumable full-mode state needs confirmation
- Keep implementation and QA validation honest to the repository's actual tooling
- Do not overstate automation when the repository still lacks app-native build, lint, or test commands
