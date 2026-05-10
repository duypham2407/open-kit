---
description: "Inspect OpenCode models and assign provider-specific models to OpenKit agents."
---

# Command: `/configure-agent-models`

Use `/configure-agent-models` when you want to configure an exact provider-qualified OpenCode model for one or more OpenKit agents.

When inspecting repository code or runtime surfaces during model setup, follow `.opencode/openkit/context/core/tool-substitution-rules.md` and prefer kit intelligence tools before basic built-in tools or OS commands.

## Purpose

- show the exact model ids OpenCode currently knows about via `opencode models`
- let the operator choose a precise `provider/model` pair when multiple providers expose similar model names
- persist agent-specific model overrides for future `openkit run` sessions
- let the operator browse providers and models by numbered selection instead of memorizing or typing full ids
- let the operator choose a supported model variant discovered from `opencode models --verbose` when OpenCode exposes it for the selected model

## Recommended operator flow

1. Run `openkit configure-agent-models --list` to inspect current overrides.
2. Run `openkit configure-agent-models --interactive` if you want a guided terminal flow.
3. Or run `openkit configure-agent-models --models` / `openkit configure-agent-models --models <provider>` to inspect the available OpenCode models yourself.
4. Save the choice with `openkit configure-agent-models --agent <agent-id> --model <provider/model>`.
5. Start a new session with `openkit run`.

## Notes

- Model ids must use the exact `provider/model` format that OpenCode reports.
- `--interactive` is the fastest path when the same model family appears under multiple providers and you want a provider picker plus numbered model selection before saving.
- When `opencode models --verbose` exposes variants for the selected model, the interactive flow can also save an agent-level `variant` in addition to the selected `provider/model`.
- If verbose model discovery is unavailable, the interactive flow falls back to plain model selection and skips the variant picker instead of failing the whole setup.
- If no override is set for an agent, OpenCode falls back to the global/default model behavior.
- Use `openkit configure-agent-models --agent <agent-id> --clear` to remove a saved override.
