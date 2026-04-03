# Runtime Bootstrap Flow

This document explains the runtime bootstrap sequence that starts from
`src/runtime/index.js` and produces the active OpenKit foundation.

## 1. Bootstrap Entry Point

Primary function:

- `bootstrapRuntimeFoundation()` in `src/runtime/index.js`

This function creates the runtime in the following order:

1. load config
2. resolve capabilities
3. load skills
4. resolve categories
5. create specialists
6. create managers
7. create model runtime
8. register skill MCP bindings
9. create MCP platform
10. create hooks
11. create tools
12. load commands
13. create context injection
14. create runtime interface

## 2. Why Order Matters

The order is deliberate because later layers depend on earlier layers:

- managers depend on config and capabilities
- model runtime depends on categories, specialists, and manager-owned state
- hooks depend on workflow/runtime managers
- tools depend on managers, hooks, model runtime, and MCP platform
- runtime interface summarizes everything after construction

## 3. Step-by-Step Flow

### Step 1: Config

Created by:
- `createRuntimeConfig()`

Outputs:
- merged runtime config
- config source paths
- warnings

Key purpose:
- unify project config, user config, defaults, and runtime feature flags

### Step 2: Capability registry

Created by:
- `listRuntimeCapabilities()`
- `createCapabilityIndex()`

Key purpose:
- define what the runtime claims to support
- let later surfaces expose status metadata consistently

### Step 3: Skill registry

Created by:
- `createSkillRegistry()`

Internals:
- `loadRuntimeSkills()` scans project, project-opencode, and user skill scopes
- `mergeRuntimeSkills()` merges duplicates and produces the active set

### Step 4: Category runtime

Created by:
- `createCategoryRuntime()`

Purpose:
- resolve execution categories distinct from workflow modes

### Step 5: Specialist registry

Created by:
- `createSpecialistRegistry()`

Default specialists:
- oracle
- librarian
- explore
- multimodal-looker
- metis
- momus

### Step 6: Managers

Created by:
- `createManagers()`

This is one of the most important phases because managers hold runtime state,
background services, and analysis surfaces.

### Step 7: Model runtime

Created by:
- `createModelRuntime()`

Purpose:
- resolve models for categories and specialists
- compute fallback chains and execution state
- surface model diagnostics

### Step 8: Skill MCP bindings

Created by:
- `skillMcpManager.registerSkillBindings(skills.skills)`

Purpose:
- connect skill-declared MCP references to runtime-visible bindings

### Step 9: MCP platform

Created by:
- `createMcpPlatform()`

Built-in MCPs:
- `mcp.websearch`
- `mcp.docs-search`
- `mcp.code-search`

Phase-4 behavior updates:

- MCP platform now receives `sessionMemoryManager` during bootstrap
- builtin MCPs are created with executable handlers (not metadata-only)
- external MCP server definitions are normalized from loaded MCP config
- dispatch is asynchronous and supports builtin + external transports with timeout/error boundaries

### Step 10: Hooks

Created by:
- `createHooks()`

Hook groups:
- session hooks
- tool guard hooks
- continuation hooks
- skill hooks

### Step 11: Tools

Created by:
- `createTools()`

Purpose:
- build the tool registry
- wrap tools with execution guards and logging
- summarize tool families for diagnostics

### Step 12: Commands

Created by:
- `loadRuntimeCommands()`

Purpose:
- merge builtin runtime commands with project command markdown files

### Step 13: Context injection

Created by:
- `createContextInjection()`

Purpose:
- provide project agent paths, README path, workflow-state context, and injected rules

### Step 14: Runtime interface

Created by:
- `createRuntimeInterface()`

Purpose:
- summarize the whole runtime foundation in one inspectable object
- provide environment values used by the launcher

## 4. Bootstrap Output

The returned runtime foundation contains:

- config result
- capabilities and capability index
- categories
- specialists
- model runtime
- skills
- commands
- context injection
- managers
- MCP platform
- tools
- hooks
- runtime interface

## 5. Relation To Launch

The global launcher uses this bootstrap result before spawning OpenCode:

- `src/global/launcher.js`

That launcher then exports runtime metadata into environment variables such as:

- `OPENKIT_RUNTIME_FOUNDATION`
- `OPENKIT_RUNTIME_CONFIG_CONTENT`
- `OPENKIT_RUNTIME_CAPABILITIES`
- `OPENKIT_RUNTIME_MCPS`

## 6. Mental Model

The easiest way to think about bootstrap is:

```text
config and capabilities define the allowed runtime shape
managers provide stateful services
hooks constrain behavior
tools expose usable runtime actions
runtimeInterface describes the final assembled system
```
