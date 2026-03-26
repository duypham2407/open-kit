# Architecture Overview

Use this document to understand how the authoring repository becomes the managed OpenKit runtime used by operators.

## End-To-End Flow

```text
Repository authoring sources
  agents/
  commands/
  skills/
  context/
  hooks/
  .opencode/
  docs/
        |
        v
npm package @duypham93/openkit
        |
        v
openkit install-global / openkit run
        |
        v
Managed kit materialized under OpenCode home
  kits/openkit/
  profiles/openkit/
  openkit/agent-models.json
        |
        v
Workspace bootstrap for the current project
  workspaces/<workspace-id>/openkit/.opencode/workflow-state.json
  project/.opencode/openkit/ ... compatibility surface
        |
        v
OpenCode launched with managed profile
  default agent: master-orchestrator
  slash commands drive workflow lanes
```

## Surface Roles

- repository root: authoring source of truth
- `assets/install-bundle/opencode/`: explicit derived bundle boundary for install-time consumers
- global managed kit: preferred operator-facing runtime path
- project-local `.opencode/openkit/`: compatibility surface for docs, workflow tools, and resume-aware runtime wiring
- workspace state under OpenCode home: active workflow-state storage for the current project

## Important Files

- `src/global/materialize.js`: copies managed assets into the OpenCode home directory
- `src/global/launcher.js`: launches OpenCode with managed env and profile wiring
- `src/runtime/opencode-layering.js`: merges managed config with existing OpenCode config inputs
- `.opencode/workflow-state.js`: low-level runtime CLI for state inspection and mutation
- `hooks/session-start.js`: prints runtime status, loads the meta-skill, and emits resume hints

## Design Intent

- keep the lane-based workflow model tool-agnostic
- make the preferred product path global rather than repo-vendored
- preserve a checked-in compatibility runtime for authoring, diagnostics, and tests
- avoid destructive install behavior by using additive metadata and explicit merge policies
