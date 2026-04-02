# Kit Internals

This directory is the maintainer-facing deep map of how OpenKit works today.

Use it when you need one place that explains the kit from broad architecture
down to runtime bootstrap, managers, tools, hooks, skills, MCPs, specialists,
and semantic-search internals.

This directory is a synthesis layer. It does not replace canonical workflow,
governance, or operator docs, but it gives maintainers a consolidated map of
the system so future development can move faster.

## Reading Order

1. `01-system-overview.md`
2. `02-runtime-bootstrap-flow.md`
3. `03-runtime-capabilities-and-managers.md`
4. `04-tools-hooks-skills-and-mcps.md`
5. `05-semantic-search-and-code-intelligence.md`

## Scope

These docs summarize:

- the high-level OpenKit architecture
- the runtime bootstrap sequence
- category, model, specialist, manager, tool, and hook layers
- command, skill, and MCP loading
- semantic search, project graph, and code intelligence internals

## Canonical Sources To Cross-Check

- `AGENTS.md`
- `context/navigation.md`
- `context/core/workflow.md`
- `context/core/project-config.md`
- `src/runtime/index.js`
- `src/runtime/create-managers.js`
- `src/runtime/tools/tool-registry.js`
- `src/runtime/capability-registry.js`

## Boundary Note

If any document in this directory drifts from code reality, trust the checked-in
runtime source and update these docs.
