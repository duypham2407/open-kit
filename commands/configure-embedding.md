---
description: "Inspect and configure the embedding provider for semantic code search."
---

# Command: `/configure-embedding`

Use `/configure-embedding` when you want to set up or inspect the embedding provider used for semantic code search inside an OpenKit session.

## Purpose

- show the current embedding provider configuration for the project
- interactively walk through provider selection, model, dimensions, and API settings
- write the `embedding` section to `.opencode/openkit.runtime.jsonc` in the project root
- enable or disable embedding indexing without touching any other config
- clear the embedding config entirely when switching providers or disabling the feature

## Recommended operator flow

1. Run `openkit configure-embedding --list` to inspect the current config.
2. Run `openkit configure-embedding --interactive` for a guided terminal setup.
3. Or set flags directly: `openkit configure-embedding --provider openai --model openai/text-embedding-3-small --enable`.
4. Restart the runtime with `openkit run` to pick up the new config.
5. Inside a session, use `tool.embedding-index` with `action: index-project` to index the codebase.

## Supported providers

| Provider | Notes |
|---|---|
| `openai` | Requires `OPENAI_API_KEY` env var or `--api-key`. Default model: `openai/text-embedding-3-small` (1536 dims). |
| `ollama` | Local server, no API key needed. Default URL: `http://localhost:11434`. Default model: `ollama/nomic-embed-text` (768 dims). |
| `custom` | Any OpenAI-compatible endpoint. Requires `--base-url`. |

## Options

```
--list                   Show current embedding config
--interactive            Walk through setup interactively (recommended)
--enable                 Set embedding.enabled = true
--disable                Set embedding.enabled = false
--provider <name>        Set provider: openai | ollama | custom
--model <provider/id>    Set model id (e.g. openai/text-embedding-3-small)
--dimensions <n>         Set vector dimensions (must match the model)
--api-key <key>          Set API key (stored in config file, not env var)
--base-url <url>         Set custom base URL (required for custom provider)
--batch-size <n>         Set number of chunks per API call (default 20)
--clear                  Remove the entire embedding section from config
```

## Examples

```sh
# Inspect current config
openkit configure-embedding --list

# Interactive setup (recommended for first-time setup)
openkit configure-embedding --interactive

# OpenAI (using env var for key)
openkit configure-embedding --provider openai --model openai/text-embedding-3-small --enable

# Ollama (local)
openkit configure-embedding --provider ollama --model ollama/nomic-embed-text --dimensions 768 --enable

# Custom endpoint
openkit configure-embedding --provider custom --model my-model --base-url https://my-api.example.com/v1 --enable

# Disable without clearing config
openkit configure-embedding --disable

# Remove all embedding config
openkit configure-embedding --clear
```

## Notes

- Config is written to `.opencode/openkit.runtime.jsonc` in the current working directory (project root).
- Restart `openkit run` after changing config; the runtime reads config at startup.
- Prefer `OPENAI_API_KEY` or `OLLAMA_HOST` environment variables over `--api-key` / `--base-url` when possible; the CLI stores values in plaintext if written to config.
- When embedding is disabled (`enabled: false`), the semantic search tool falls back to keyword search automatically.
- Use `tool.embedding-index` inside a running session to trigger indexing after enabling the provider.
