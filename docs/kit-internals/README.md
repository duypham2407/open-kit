# Kit Internals

This directory is the maintainer-facing deep map of how OpenKit works today.

Use it when you need one place that explains the kit from broad architecture
down to runtime bootstrap, managers, tools, hooks, skills, MCPs, specialists,
and semantic-search internals.

This directory is a synthesis layer. It does not replace canonical workflow,
governance, or operator docs, but it gives maintainers a consolidated map of
the system so future development can move faster.

## Scope

These docs summarize:

- the high-level OpenKit architecture
- the runtime bootstrap sequence
- category, model, specialist, manager, tool, and hook layers
- command, skill, and MCP loading
- semantic search, project graph, and code intelligence internals

## Cross-Reference: Doc Sections To Implementation Files

Use this table to jump from a documentation topic to the canonical source file.

| Topic | Doc Section | Primary Source Files |
|---|---|---|
| Bootstrap entry | `02` sect 1 | `src/runtime/index.js` |
| Config creation | `02` sect 3 step 1 | `src/runtime/create-runtime-config.js` |
| Capability registry | `03` sect 1-2 | `src/runtime/capability-registry.js` |
| Manager creation & wiring | `03` sect 3-5 | `src/runtime/create-managers.js` |
| SyntaxIndexManager | `03` sect 4 | `src/runtime/managers/syntax-index-manager.js` |
| ProjectGraphManager | `03` sect 4, `05` sect 2 | `src/runtime/managers/project-graph-manager.js` |
| SessionMemoryManager | `03` sect 4, `05` sect 2 | `src/runtime/managers/session-memory-manager.js` |
| EmbeddingIndexer | `03` sect 4, `05` sect 2 | `src/runtime/analysis/embedding-indexer.js` |
| Embedding providers | `05` sect 2 | `src/runtime/analysis/embedding-provider.js` |
| ProjectGraphDb (SQLite) | `05` sect 3 | `src/runtime/analysis/project-graph-db.js` |
| Chunk extraction | `05` sect 2 | `src/runtime/analysis/code-chunk-extractor.js` |
| Import-graph builder | `05` sect 2 | `src/runtime/analysis/import-graph-builder.js` |
| Call-graph builder | `05` sect 2 | `src/runtime/analysis/call-graph-builder.js` |
| Reference tracker | `05` sect 2 | `src/runtime/analysis/reference-tracker.js` |
| Tool registry | `04` sect 1-3 | `src/runtime/tools/tool-registry.js`, `src/runtime/create-tools.js` |
| Semantic search tool | `05` sect 5-6 | `src/runtime/tools/graph/semantic-search.js` |
| Graph navigation tools | `04` sect 3 | `src/runtime/tools/graph/` (9 files) |
| Syntax tools | `04` sect 3 | `src/runtime/tools/syntax/` (3 files) |
| AST tools | `04` sect 3 | `src/runtime/tools/ast/` (4 files) |
| Codemod tools | `04` sect 3 | `src/runtime/tools/codemod/` (2 files) |
| Hook assembly | `04` sect 4 | `src/runtime/create-hooks.js` |
| Tool guard hooks | `04` sect 4 | `src/runtime/hooks/tool-guards/` (7 files) |
| Session hooks | `04` sect 4 | `src/runtime/hooks/session/` (2 files) |
| Skill loading | `04` sect 5 | `src/runtime/skills/` (5 files) |
| Specialist agents | `04` sect 8 | `src/runtime/specialists/` (8 files) |
| MCP platform | `04` sect 7 | `src/runtime/mcp/` (10 files) |
| Runtime commands | `04` sect 6 | `src/runtime/commands/` |
| Context injection | `04` sect 9 | `src/runtime/context-injection.js` |
| Embedding index tool | `05` sect 7 | `src/runtime/tools/analysis/embedding-index.js` |
| Tool enforcement plugin | `04` sect 4 | `.opencode/plugins/tool-enforcement.js` |
| Bash guard hook | `04` sect 4 | `src/runtime/hooks/tool-guards/bash-guard-hook.js` |
| OpenCode config | `01` sect 4 | `.opencode/opencode.json` |
| Workflow state | `01` sect 4 | `.opencode/workflow-state.js`, `.opencode/workflow-state.json` |

## Reading Order

1. `01-system-overview.md` — architecture, surfaces, design intent
2. `02-runtime-bootstrap-flow.md` — step-by-step bootstrap sequence
3. `03-runtime-capabilities-and-managers.md` — capability registry & manager layer
4. `04-tools-hooks-skills-and-mcps.md` — tools, hooks, skills, MCPs, specialists
5. `05-semantic-search-and-code-intelligence.md` — project graph, chunks, embeddings, retrieval
6. `06-developer-quickstart.md` — run tests, use MockEmbeddingProvider, index a repo
7. `07-operator-runbook.md` — install, configure embedding, verify, index
8. `08-troubleshooting.md` — inspect DB, force re-index, debug search results
9. `09-dataflow-and-diagrams.md` — indexing & query flow diagrams with code pointers

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
