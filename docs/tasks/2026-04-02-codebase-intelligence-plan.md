# Codebase Intelligence Pipeline — Detailed Plan

> This document records the full analysis, completed work, and plans for subsequent phases of the Codebase Intelligence system in OpenKit.
> Purpose: allow continuing work on another device without losing context.

**Repo:** `open-kit` (at `/home/duypham/Projects/open-kit`)
**Branch:** `main`
**Base commit:** `72f2ac6 feat: add tool enforcement and AST foundation for codebase intelligence`
**Last updated:** 2026-04-02

---

## 1. Architecture Overview

### 1.1 Objective

Build a persistent import/symbol graph (SQLite-backed) for the OpenKit runtime, enabling:

- Cross-file dependency analysis (import graph)
- Symbol lookup (function, class, variable) across the entire project
- Background indexing that does not block session startup
- LSP-like navigation tools integration
- Semantic memory / search for agent context

### 1.2 Phase Overview

| Phase | Name                      | Status            | Description                                                        |
|-------|---------------------------|-------------------|--------------------------------------------------------------------|
| 0     | AST Foundation            | **COMPLETED**     | Tree-sitter parsing, SyntaxIndexManager, tool enforcement          |
| 1     | Tool Enforcement          | **COMPLETED**     | OpenCode plugin & kit-internal tool guards                         |
| 2     | Import Graph + DB         | **COMPLETED**     | SQLite DB, import-graph builder, manager, tools, background index  |
| 3     | Advanced Symbol Index     | NOT STARTED       | Rich symbol metadata, cross-file type inference, call graph        |
| 4     | Navigation Tools          | NOT STARTED       | Go-to-definition, find-references via graph DB                     |
| 5     | LSP Integration           | NOT STARTED       | Bridge graph DB with LSP protocol for editor integration           |
| 6     | Semantic Memory/Search    | NOT STARTED       | Embedding-based code search, context-aware agent memory            |

---

## 2. Completed Work

### 2.1 Phase 0 & 1 — AST Foundation + Tool Enforcement (before this session)

Committed in `72f2ac6`. Includes:

- `SyntaxIndexManager` (`src/runtime/managers/syntax-index-manager.js`) — tree-sitter parse cache
- Tool enforcement surfaces (OpenCode plugin & kit-internal guards)
- AST-based JSON/JSONC search (`src/runtime/tools/ast/ast-search.js`)
- AST tooling status checker (`src/runtime/tools/ast/ast-tooling-status.js`)

### 2.2 Phase 2 — Import Graph + Persistent DB (2 most recent sessions)

#### 2.2.1 Newly created files (untracked)

```
src/runtime/analysis/project-graph-db.js       — SQLite wrapper, schema, prepared statements
src/runtime/analysis/import-graph-builder.js    — AST-based import/export/symbol extractor
src/runtime/managers/project-graph-manager.js   — High-level coordinator (index + query)
src/runtime/tools/graph/import-graph.js         — tool.import-graph
src/runtime/tools/graph/find-dependencies.js    — tool.find-dependencies
src/runtime/tools/graph/find-dependents.js      — tool.find-dependents
src/runtime/tools/graph/find-symbol.js          — tool.find-symbol
hooks/graph-indexer.js                          — Background indexer (detached process)
tests/runtime/graph-db.test.js                  — ProjectGraphDb unit tests
tests/runtime/graph-tools.test.js               — Graph tool-level tests (22 tests)
tests/runtime/import-graph-builder.test.js      — Import graph builder tests
tests/runtime/project-graph-manager.test.js     — ProjectGraphManager tests
```

#### 2.2.2 Modified files

```
AGENTS.md                                — Added runtime analysis layer description
context/core/project-config.md           — Added project graph DB notes
hooks/session-start.js                   — Spawn detached graph-indexer
package.json                             — Added better-sqlite3 dependency
package-lock.json                        — Lock file update
src/global/doctor.js                     — Added isBetterSqliteAvailable check
src/global/tooling.js                    — Added isBetterSqliteAvailable() helper
src/runtime/create-managers.js           — Create ProjectGraphManager, pass mode
src/runtime/create-runtime-interface.js  — Expose graph summary in runtimeState
src/runtime/tools/tool-registry.js       — Register 4 graph tools
src/runtime/tools/ast/ast-grep-search.js — FIX: import isAstGrepAvailable from correct module
src/runtime/tools/ast/ast-search.js      — FIX: revert execute to sync for JSON path
tests/runtime/module-boundary.test.js    — FIX: expect "module" instead of "commonjs"
```

#### 2.2.3 Technical details per component

**A. ProjectGraphDb** (`src/runtime/analysis/project-graph-db.js`)

- SQLite via `better-sqlite3` (native module, WAL journal mode)
- Schema with 3 tables:
  - `nodes(id, path UNIQUE, kind, mtime)` — file nodes
  - `edges(from_node, to_node, edge_type, line)` — import relationships
  - `symbols(id, node_id, name, kind, is_export, line)` — symbol declarations
- 5 indexes: `idx_nodes_path`, `idx_edges_from`, `idx_edges_to`, `idx_symbols_node`, `idx_symbols_name`
- Prepared statements for all operations
- `indexFile()` — transactional upsert (node + replace edges + replace symbols)
- `stats()` returns `{ nodes, edges, symbols }` counts
- DB path: `<runtimeRoot>/.opencode/project-graph.db` (or `:memory:` for tests)

**B. Import Graph Builder** (`src/runtime/analysis/import-graph-builder.js`)

- Uses `SyntaxIndexManager.readFile()` (tree-sitter) to parse
- Extracts:
  - Static imports (`import x from '...'`)
  - `require()` calls
  - Re-exports (`export { x } from '...'`)
  - Dynamic imports (`import('...')`)
  - Export declarations (function, class, variable, default)
- Resolves relative specifiers to absolute paths (tries exact, then adds extensions, then index.js)
- Returns `{ filePath, mtime, imports[], symbols[] }`

**C. ProjectGraphManager** (`src/runtime/managers/project-graph-manager.js`)

- Constructor accepts `{ projectRoot, runtimeRoot, syntaxIndexManager, dbPath?, mode? }`
- `mode = 'read-only'` — does not create DB (important for doctor/bootstrap read-only)
- Methods:
  - `indexFile(filePath)` — index 1 file (skip if mtime unchanged)
  - `indexProject({ maxFiles })` — index entire project (listProjectFiles)
  - `getDependencies(filePath, { depth })` — BFS forward dependencies
  - `getDependents(filePath, { depth })` — BFS reverse dependencies
  - `findSymbol(name)` — search symbol by name
  - `getGraphSummary()` — node/edge/symbol counts
  - `describe()` — status + DB path + indexing state
  - `dispose()` — close DB connection

**D. Graph Tools** (`src/runtime/tools/graph/`)

| Tool ID                  | File                    | Description                                     |
|--------------------------|-------------------------|-------------------------------------------------|
| `tool.import-graph`      | `import-graph.js`       | Index/status/summary/index-file actions         |
| `tool.find-dependencies` | `find-dependencies.js`  | Forward deps of 1 file (depth supported)        |
| `tool.find-dependents`   | `find-dependents.js`    | Reverse deps (who imports this file)            |
| `tool.find-symbol`       | `find-symbol.js`        | Find symbol by name across the entire project   |

All tools:
- Return `{ status: 'unavailable' }` when manager is not available
- Validate input (filePath/name required)
- Support string input shorthand
- Registered in `tool-registry.js`, family = `'graph'`

**E. Background Indexing**

- `hooks/session-start.js` spawns detached process `hooks/graph-indexer.js`
- `graph-indexer.js` dynamically imports managers from the kit root
- Fire-and-forget: does not block session startup, silently exits on error
- Indexes up to 2000 files per run

**F. Doctor Integration**

- `src/global/doctor.js` imports `isBetterSqliteAvailable` from tooling
- Warning message: `"better-sqlite3 native module is not available; project graph / import-graph tools will be degraded."`
- Remediation: `"Run npm install -g @duypham93/openkit to rebuild native addons."`

#### 2.2.4 Bugs fixed in this session

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `ast-grep-search.js` SyntaxError | Imported `isAstGrepAvailable` from `./ast-tooling-status.js` (not exported) | Changed import to `../../../global/tooling.js`; fixed call signature `{ env: process.env }` |
| `ast-search.js` tests fail | `execute` became `async` when adding tree-sitter, tests called without `await` | Reverted `execute` to sync; tree-sitter branch uses `.then()` instead of `await` |
| `runtime-bootstrap` read-only creates `.opencode/` | `ProjectGraphManager` always created DB file | Added `mode` param; skip DB when `mode === 'read-only'` |
| `ensure-install` workspaces dir created | Doctor → bootstrap read-only → ProjectGraphManager created DB | Same `mode` fix as above |
| `module-boundary.test.js` expects commonjs | Old test not updated after ESM migration | Changed expected value from `"commonjs"` to `"module"` |

#### 2.2.5 Test results

- **256 tests passing, 0 failures** (runtime + install + global + cli + release)
- 2 test files timeout due to pre-existing Node v24 process-isolation issue (not a regression):
  - `tests/global/doctor.test.js` — passes with `--experimental-test-isolation=none` (~122s)
  - `tests/cli/openkit-cli.test.js` — pre-existing hang, unrelated to Phase 2

#### 2.2.6 How to run tests

```bash
# All runtime tests (including graph tests)
node --test tests/runtime/*.test.js

# Graph tests only
node --test tests/runtime/graph-db.test.js
node --test tests/runtime/import-graph-builder.test.js
node --test tests/runtime/project-graph-manager.test.js
node --test tests/runtime/graph-tools.test.js

# Full suite (minus 2 timeout files)
node --test tests/runtime/*.test.js tests/install/*.test.js \
  tests/global/ensure-install.test.js tests/global/agent-models.test.js \
  tests/global/config-validation.test.js tests/cli/install.test.js \
  tests/cli/onboard.test.js tests/cli/release-cli.test.js \
  tests/cli/configure-agent-models.test.js tests/release/*.test.js

# Doctor + CLI tests (need isolation=none due to slowness)
node --experimental-test-isolation=none --test tests/global/doctor.test.js
```

---

## 3. Plan for Subsequent Phases

### 3.1 Phase 3 — Advanced Symbol Index

**Objective:** Enriched symbol metadata to support navigation and type-aware search.

**Specific work:**

1. **Expand `symbols` table schema:**
   - Add column `signature TEXT` — function signature / type annotation
   - Add column `doc_comment TEXT` — nearest JSDoc / TSDoc comment
   - Add column `scope TEXT` — module / class / function scope
   - Add column `start_line INTEGER`, `end_line INTEGER` — full range

2. **Create `references` table:**
   ```sql
   CREATE TABLE IF NOT EXISTS references (
     id        INTEGER PRIMARY KEY AUTOINCREMENT,
     symbol_id INTEGER NOT NULL,
     node_id   INTEGER NOT NULL,  -- file containing the reference
     line      INTEGER NOT NULL,
     column    INTEGER NOT NULL DEFAULT 0,
     kind      TEXT    NOT NULL DEFAULT 'usage',  -- usage | assignment | type-reference
     FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
     FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
   );
   ```

3. **Expand `import-graph-builder.js`:**
   - Extract JSDoc comments near declarations
   - Extract function parameter types / return types (if TS annotations exist)
   - Track identifier usages (references) — this is the most complex part
   - Extract class members (methods, properties)

4. **Add `call_graph` table:**
   ```sql
   CREATE TABLE IF NOT EXISTS call_graph (
     caller_symbol_id INTEGER NOT NULL,
     callee_name      TEXT    NOT NULL,
     callee_node_id   INTEGER,  -- NULL if not yet resolved
     line             INTEGER NOT NULL,
     FOREIGN KEY (caller_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
   );
   ```

5. **Tests:**
   - Unit tests for extended schema
   - Tests for JSDoc extraction
   - Tests for reference tracking
   - Tests for call graph

**Files to modify:**
- `src/runtime/analysis/project-graph-db.js` — schema migration + new prepared statements
- `src/runtime/analysis/import-graph-builder.js` — extract richer metadata

**Files to create:**
- `src/runtime/analysis/reference-tracker.js` — identifier usage tracker
- `src/runtime/analysis/call-graph-builder.js` — call graph extractor
- `tests/runtime/reference-tracker.test.js`
- `tests/runtime/call-graph.test.js`

**Estimate:** 2-3 sessions

---

### 3.2 Phase 4 — Navigation Tools

**Objective:** Go-to-definition, find-references, prepare-rename via graph DB (no LSP server required).

**Specific work:**

1. **Create `tool.graph-goto-definition`:**
   - Input: `{ filePath, line, column }` or `{ symbol: 'functionName' }`
   - Look up symbol at position, find definition in DB
   - Fallback: if symbol is not in DB, suggest indexing
   - Output: `{ definitions: [{ path, line, column, kind }] }`

2. **Create `tool.graph-find-references`:**
   - Input: `{ symbol, scope? }`
   - Look up all references from the `references` table
   - Group by file, sort by line
   - Output: `{ references: [{ path, line, column, kind }], totalCount }`

3. **Create `tool.graph-call-hierarchy`:**
   - Input: `{ symbol }` + `{ direction: 'incoming' | 'outgoing' }`
   - Incoming: who calls this symbol
   - Outgoing: what this symbol calls
   - BFS depth support

4. **Create `tool.graph-rename-preview`:**
   - Input: `{ symbol, newName }`
   - Find all occurrences (definition + references + imports)
   - Return preview changes per file (do not apply)
   - Output: `{ changes: [{ path, edits: [{ line, oldText, newText }] }] }`

5. **Wiring:**
   - Register tools in `tool-registry.js`
   - Add to `registry.json` metadata

**Files to create:**
- `src/runtime/tools/graph/goto-definition.js`
- `src/runtime/tools/graph/find-references.js`
- `src/runtime/tools/graph/call-hierarchy.js`
- `src/runtime/tools/graph/rename-preview.js`
- `tests/runtime/graph-navigation-tools.test.js`

**Dependencies:** Phase 3 (requires `references` table + call graph)

**Estimate:** 2 sessions

---

### 3.3 Phase 5 — LSP Integration

**Objective:** Bridge graph DB output to LSP protocol format so editor integration can consume it.

**Specific work:**

1. **Create LSP response formatters:**
   - `lsp/formatters.js` — convert graph DB results to LSP protocol JSON
   - `Location`, `LocationLink`, `SymbolInformation`, `WorkspaceEdit` formats

2. **Enhance existing LSP tools:**
   - Currently `tool.lsp-symbols`, `tool.lsp-goto-definition`, etc. in `src/runtime/tools/lsp/` already exist but use regex/tree-sitter directly
   - Add graph DB fallback: if graph data available, use it (faster, cross-file); otherwise fall back to the old method
   - Config flag: `graphBackedLsp: true/false` in runtime config

3. **Incremental index update:**
   - File watcher hook: on file save, re-index single file
   - Debounce logic: avoid re-index spam
   - Stale detection: mark nodes stale when mtime changes

4. **Tests:**
   - LSP format output tests
   - Integration tests: graph-backed vs regex-backed LSP tool output comparison
   - File watcher debounce tests

**Files to create/modify:**
- `src/runtime/analysis/lsp-formatters.js` (new)
- `src/runtime/tools/lsp/*.js` (modify — add graph fallback)
- `src/runtime/analysis/file-watcher.js` (new — incremental updates)
- `tests/runtime/lsp-graph-integration.test.js` (new)

**Dependencies:** Phase 4

**Estimate:** 2-3 sessions

---

### 3.4 Phase 6 — Semantic Memory / Search

**Objective:** Embedding-based code search and context-aware agent memory.

**Specific work:**

1. **Code chunk extraction:**
   - Split files into semantic chunks (function-level, class-level)
   - Each chunk: source code + metadata (file, line range, symbol name, imports)

2. **Embedding storage:**
   - Add `embeddings` table to SQLite:
     ```sql
     CREATE TABLE IF NOT EXISTS embeddings (
       id        INTEGER PRIMARY KEY AUTOINCREMENT,
       node_id   INTEGER NOT NULL,
       chunk_id  TEXT    NOT NULL,
       embedding BLOB    NOT NULL,
       model     TEXT    NOT NULL,
       created   REAL    NOT NULL,
       FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
     );
     ```
   - Vector similarity via brute-force cosine (SQLite custom function) or external vector store

3. **Semantic search tool:**
   - `tool.semantic-search` — input natural language query, embed, find similar chunks
   - Return ranked results with code snippets + graph context (imports, dependents)

4. **Agent context builder:**
   - When agent needs context for a task, query graph + embeddings
   - Return: relevant files + symbols + dependency chain + similar code patterns
   - Budget-aware: respect token limit, prioritize by relevance

5. **Session memory:**
   - Track files the agent has read/modified during the session
   - Persist to graph DB: `session_touches(session_id, node_id, action, timestamp)`
   - Cross-session recall: "this file was modified in a previous session"

**Dependencies:** Phase 3 + embedding model access (can use local model or API)

**Estimate:** 3-4 sessions

---

## 4. Phase Dependency Graph

```
Phase 0 (AST Foundation) ─────────────────────────────┐
Phase 1 (Tool Enforcement) ────────────────────────────┤
                                                       ▼
Phase 2 (Import Graph + DB) ◄━━━━━━━━━ COMPLETED ━━━━━┤
                                                       │
                        ┌──────────────────────────────┘
                        ▼
Phase 3 (Advanced Symbol Index) ◄── Required before Phase 4, 6
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
Phase 4 (Navigation Tools)   Phase 6 (Semantic Memory)
              │                   │
              ▼                   │
Phase 5 (LSP Integration) ◄──────┘ (optional dependency)
```

---

## 5. Patterns & Conventions to Follow

### 5.1 Code Conventions

- ESM modules (not CommonJS)
- Explicit `.js` extensions in imports
- `node:` prefix for Node.js built-ins
- DI seams for testing (constructor injection)

### 5.2 Manager Pattern

```javascript
// Create in src/runtime/create-managers.js
const myManager = new MyManager({ projectRoot, runtimeRoot, mode });

// Return in managers object
return {
  managerList,
  managers: Object.fromEntries(managerList.map(...)),
  myManager,  // direct access
  // ...
};
```

### 5.3 Tool Pattern

```javascript
// Tool factory receives manager
export function createMyTool({ myManager }) {
  return {
    id: 'tool.my-tool',
    name: 'My Tool',
    description: '...',
    family: 'graph',        // group tools by family
    stage: 'foundation',
    status: myManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!myManager?.available) {
        return { status: 'unavailable', reason: '...' };
      }
      // validate input
      // delegate to manager
      return myManager.doSomething(input);
    },
  };
}
```

### 5.4 Tool Registration

- Register in `src/runtime/tools/tool-registry.js`
- Import factory function, call with managers, push to tools array

### 5.5 Test Pattern

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
// ... imports

function makeTempDir() { /* fs.mkdtempSync */ }
function writeFile(dir, relPath, content) { /* fs.mkdirSync + writeFileSync */ }

test('descriptive test name', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  // setup → execute → assert
  manager.dispose();
});
```

### 5.6 DB for tests

- Always use `:memory:` for unit tests (fast, no file creation)
- Call `manager.dispose()` after each test

---

## 6. Important Notes

### 6.1 Not yet committed

All Phase 2 changes have NOT been committed. When continuing on another device:

1. Check `git status` to confirm the working tree
2. Run `node --test tests/runtime/*.test.js` to verify tests pass
3. Commit if you want to save state:
   ```bash
   git add -A
   git commit -m "feat(graph): add persistent project graph DB, import-graph builder, graph tools, and background indexing"
   ```

### 6.2 Pre-existing issues (not regressions)

- `tests/global/doctor.test.js` — timeout with Node v24 process isolation mode. Passes with `--experimental-test-isolation=none`. Root cause: 12 tests each calling `bootstrapRuntimeFoundation` take ~13s, totaling ~122s which exceeds the 120s timeout.
- `tests/cli/openkit-cli.test.js` — hangs when run with `--experimental-test-isolation=none`, fails quickly with process isolation. Pre-existing issue.

### 6.3 Native Dependencies

- `better-sqlite3` is a native module requiring a C++ compiler to build
- Already declared in `package.json`
- `openkit doctor` will warn if not available
- If install fails: `npm rebuild better-sqlite3` or reinstall `npm install -g @duypham93/openkit`

### 6.4 Sync vs Async in Tools

- `ast-search.js` execute MUST be sync for the JSON path (tests call without `await`)
- Tree-sitter path returns Promise via `.then()` (does not use `async` keyword)
- Graph tools use `async execute` because manager methods can be async
- Syntax tools (`tool.syntax-*`) use `async execute`

### 6.5 Read-Only Mode

- `ProjectGraphManager` does NOT create DB when `mode === 'read-only'`
- Doctor bootstrap always uses `mode: 'read-only'`
- Important for `ensure-install` and `runtime-bootstrap` tests to pass

---

## 7. Quick Start for Next Session

```bash
# 1. CD into project
cd /home/duypham/Projects/open-kit

# 2. Verify current state
git status
node --test tests/runtime/*.test.js

# 3. If you want to commit Phase 2 before starting Phase 3
git add -A
git commit -m "feat(graph): add persistent project graph DB, import-graph builder, graph tools, and background indexing"

# 4. Start Phase 3: Advanced Symbol Index
# Read file: src/runtime/analysis/project-graph-db.js (current schema)
# Read file: src/runtime/analysis/import-graph-builder.js (current extractor)
# Begin expanding schema + builder
```

---

## 8. Priority Order If Time Is Limited

If you cannot complete all phases, prioritize in this order:

1. **Phase 3** — Advanced Symbol Index (foundation for everything after)
2. **Phase 4** — Navigation Tools (highest usage value for agents)
3. **Phase 5** — LSP Integration (polish, not required)
4. **Phase 6** — Semantic Memory (advanced, depends on embedding model)

Phase 3 + 4 is enough for a complete and useful codebase intelligence system.
