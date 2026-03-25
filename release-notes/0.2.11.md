## What's changed

- Add dynamic model variant discovery for `openkit configure-agent-models --interactive`.
- Use `opencode models --verbose` as the runtime source of truth for model variants instead of relying on provider-only hardcoded mappings.
- Detect model-level `variants` from OpenCode runtime output and offer a numbered variant picker only when the selected model exposes variant metadata.
- Persist per-agent `variant` selections alongside the exact `provider/model` choice.
- Respect runtime model metadata more closely, including cases where variants differ by model rather than by provider family.
- Add regression coverage for:
  - parsing verbose model output
  - interactive variant selection
  - launch-time config layering with saved variants

## Published package

- npm: `@duypham93/openkit@0.2.11`
