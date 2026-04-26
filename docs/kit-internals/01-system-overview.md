# System Overview

This document explains OpenKit at the highest level: what it is, which runtime
surfaces exist, and how the main layers fit together.

## 1. What OpenKit Is

OpenKit is a mode-aware workflow kit layered over OpenCode. It provides:

- workflow lanes: `quick`, `migration`, `full`
- role prompts and commands
- install and launch orchestration
- a capability runtime under `src/runtime/`
- a checked-in compatibility runtime under `.opencode/`
- a global install path under the OpenCode home directory

In practice, the kit has two important identities at once:

1. an authoring repository that contains the source of truth for prompts,
   commands, skills, docs, hooks, and runtime code
2. a managed runtime kit that is materialized into the OpenCode home directory
   and used by operators via `openkit run`

## 2. Major Surface Areas

### A. Authoring surfaces

- `agents/`
- `commands/`
- `skills/`
- `context/`
- `hooks/`
- `src/runtime/`
- `.opencode/`
- `docs/`

### B. Managed runtime surfaces

- global kit under `OPENCODE_HOME/kits/openkit`
- workspace runtime state under `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode`
- project compatibility shim under `projectRoot/.opencode`

### C. Operator entrypoints

- `npm install -g @duypham93/openkit`
- `openkit doctor`
- `openkit run`
- `openkit upgrade`
- `openkit uninstall`

`openkit install` remains a manual/compatibility setup helper, not the preferred operator onboarding step.

## 3. High-Level Architecture

```text
Authoring repository
  agents/ commands/ skills/ context/ hooks/ .opencode/ src/runtime/ docs/
        |
        v
npm package @duypham93/openkit
        |
        v
openkit doctor / openkit run
        |
        v
Managed kit materialized under OPENCODE_HOME/kits/openkit
        |
        v
Runtime bootstrap from src/runtime/
  config -> capabilities -> skills -> categories -> specialists
         -> managers -> model runtime -> MCP platform -> hooks -> tools
         -> commands -> context injection -> runtime interface
        |
        v
OpenCode launched with OpenKit-managed environment and workflow state
```

## 4. Core Runtime Layers

### Workflow and compatibility layer

- `.opencode/`
- `.opencode/workflow-state.js`
- `.opencode/lib/*`

Purpose:
- maintain workflow-state compatibility
- power workflow CLI inspection and mutation
- preserve authoring and diagnostics surfaces

### Capability runtime layer

- `src/runtime/`

Purpose:
- bootstrap modern runtime capabilities
- register managers, tools, hooks, MCPs, categories, skills, and specialists
- expose runtime metadata and environment values

### Global lifecycle layer

- `src/global/`
- `src/cli/`

Purpose:
- install the kit globally
- provision tooling and runtime dependencies
- launch OpenCode with the right environment
- repair and diagnose setup

## 5. Current Design Intent

OpenKit currently prefers:

- explicit workflow ownership
- additive compatibility rather than destructive replacement
- local-first runtime surfaces where possible
- degradation instead of hard failure when optional capabilities are missing
- documentation-first maintainability as the kit grows

Runtime and docs should describe command/tool state with the shared vocabulary: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`. Validation evidence should name the actual surface checked: `global_cli`, `in_session`, `compatibility_runtime`, `runtime_tooling`, `documentation`, or `target_project_app`.

Execution orchestration stays conservative: full-delivery task boards are full-only, migration coordination remains parity-oriented, and `parallel_mode: none` means sequential work even when ready rows are visible.

## 6. Where To Go Next

- For bootstrap order: `02-runtime-bootstrap-flow.md`
- For capabilities and managers: `03-runtime-capabilities-and-managers.md`
- For tools, hooks, skills, commands, and MCPs: `04-tools-hooks-skills-and-mcps.md`
- For code intelligence and semantic search: `05-semantic-search-and-code-intelligence.md`
