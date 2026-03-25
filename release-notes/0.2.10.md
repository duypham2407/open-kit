## What's changed

- Add official per-agent model overrides for OpenKit sessions.
- Add `openkit configure-agent-models` to inspect available OpenCode models and persist exact `provider/model` selections for individual agents.
- Add `openkit configure-agent-models --interactive` for a guided terminal flow that lets operators:
  - choose an agent
  - inspect provider-qualified models from OpenCode
  - narrow models by provider or search text
  - save or clear overrides without editing config files by hand
- Apply saved agent-model overrides automatically during `openkit run` by layering them into the OpenCode config for the launched session.
- Add docs and regression coverage for:
  - global agent-model persistence
  - interactive setup flow
  - launch-time config injection
  - install-bundle and workflow command consistency

## Published package

- npm: `@duypham93/openkit@0.2.10`
