# Session Resume Protocol

Use this file when continuing work that may have started in a previous session.

## Required Read Order

1. `AGENTS.md`
2. `context/navigation.md`
3. `.opencode/workflow-state.json`
4. Determine `mode` and `current_stage`
5. Read the mode-appropriate artifact or task context
6. Read any related QA issues, approval notes, or escalation metadata

## Mode-Aware Resume Rules

### Quick Task

If `mode` is `quick`:

- read the quick task card if `artifacts.task_card` is present
- if there is no task card, use workflow state plus the latest conversation or commit context as the working brief
- if `current_stage` is `quick_verify`, inspect the latest QA Lite evidence before continuing

### Full Delivery

If `mode` is `full`:

- read the artifact referenced by the current stage when it exists
- if `current_stage` is `full_qa`, read the current QA report and related plan first
- preserve the approval-gate context before advancing or rerouting

## General Resume Rules

- Trust repository state over memory.
- If `status` is `blocked`, do not continue implementation until the blocker is understood.
- If an approval gate for the active mode is still `pending`, do not silently skip to the next stage.
- If the referenced artifact file is missing, report the mismatch and repair the docs/state before proceeding.
- If `escalated_from` is `quick`, resume from the current full-delivery stage, not from the abandoned quick stage.
- Use `.opencode/workflow-state.js show` or `.opencode/workflow-state.js validate` when explicit state inspection helps resume work.

## Status Values

- `idle`: no active feature is currently being executed
- `in_progress`: work is active in the current stage
- `blocked`: work cannot continue without input or repair
- `done`: the feature has completed the active workflow
