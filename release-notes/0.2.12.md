## What's changed

- Improve `openkit configure-agent-models --interactive` so variant discovery no longer becomes a hard failure.
- Keep using `opencode models --verbose` as the preferred source for runtime model variant discovery.
- If verbose discovery is unavailable or unusable, automatically fall back to plain `opencode models` output.
- Continue the interactive setup flow in fallback mode so users can still:
  - choose an agent
  - pick a provider
  - pick a model
- Skip the variant picker in fallback mode instead of failing the entire setup.
- Add regression coverage for:
  - dynamic variant discovery from verbose model output
  - fallback to plain model selection when verbose discovery fails
  - persistence behavior when no variant metadata is available

## Published package

- npm: `@duypham93/openkit@0.2.12`
