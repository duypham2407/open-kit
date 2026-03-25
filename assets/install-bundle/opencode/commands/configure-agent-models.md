---
description: "Inspect OpenCode models and assign provider-specific models to OpenKit agents."
---

# Command: `/configure-agent-models`

Use `/configure-agent-models` when you want to configure an exact provider-qualified OpenCode model for one or more OpenKit agents.

## Purpose

- show the exact model ids OpenCode currently knows about via `opencode models`
- let the operator choose a precise `provider/model` pair when multiple providers expose similar model names
- persist agent-specific model overrides for future `openkit run` sessions

## Recommended operator flow

1. Run `openkit configure-agent-models --list` to inspect current overrides.
2. Run `openkit configure-agent-models --interactive` if you want a guided terminal flow.
3. Or run `openkit configure-agent-models --models` / `openkit configure-agent-models --models <provider>` to inspect the available OpenCode models yourself.
4. Save the choice with `openkit configure-agent-models --agent <agent-id> --model <provider/model>`.
5. Start a new session with `openkit run`.

## Notes

- Model ids must use the exact `provider/model` format that OpenCode reports.
- `--interactive` is the fastest path when the same model family appears under multiple providers and you want to browse exact choices before saving.
- If no override is set for an agent, OpenCode falls back to the global/default model behavior.
- Use `openkit configure-agent-models --agent <agent-id> --clear` to remove a saved override.
