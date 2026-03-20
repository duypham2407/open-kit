# Session Resume Protocol

Use this file when continuing work that may have started in a previous session.

## Required Read Order

1. `AGENTS.md`
2. `context/navigation.md`
3. `.opencode/workflow-state.json`
4. The artifact referenced by the current stage
5. Any related QA issues or approval notes

## Resume Rules

- Trust repository state over memory.
- If `status` is `blocked`, do not continue implementation until the blocker is understood.
- If an approval gate is still `pending`, do not silently skip to the next stage.
- If the referenced artifact file is missing, report the mismatch and repair the docs/state before proceeding.

## Status Values

- `idle`: no active feature is currently being executed
- `in_progress`: work is active in the current stage
- `blocked`: work cannot continue without input or repair
- `done`: the feature has completed the active workflow
