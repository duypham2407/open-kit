# Codebase Intelligence Pipeline — Kế Hoạch Chi Tiết

> Tài liệu này ghi lại toàn bộ phân tích, công việc đã làm, và kế hoạch các phase tiếp theo cho hệ thống Codebase Intelligence trong OpenKit.
> Mục đích: cho phép tiếp tục công việc trên thiết bị khác mà không mất context.

**Repo:** `open-kit` (tại `/home/duypham/Projects/open-kit`)
**Nhánh:** `main`
**Commit gốc:** `72f2ac6 feat: add tool enforcement and AST foundation for codebase intelligence`
**Ngày cập nhật:** 2026-04-02

---

## 1. Tổng Quan Kiến Trúc

### 1.1 Mục tiêu

Xây dựng một persistent import/symbol graph (SQLite-backed) cho OpenKit runtime, cho phép:

- Phân tích cross-file dependency (import graph)
- Tra cứu symbol (function, class, variable) trên toàn bộ project
- Background indexing không chặn session startup
- Tích hợp LSP-like navigation tools
- Semantic memory / search cho agent context

### 1.2 Tổng quan các Phase

| Phase | Tên                     | Trạng thái       | Mô tả                                                             |
|-------|-------------------------|-------------------|--------------------------------------------------------------------|
| 0     | AST Foundation          | **HOÀN THÀNH**   | Tree-sitter parsing, SyntaxIndexManager, tool enforcement          |
| 1     | Tool Enforcement        | **HOÀN THÀNH**   | OpenCode plugin & kit-internal tool guards                         |
| 2     | Import Graph + DB       | **HOÀN THÀNH**   | SQLite DB, import-graph builder, manager, tools, background index  |
| 3     | Symbol Index Nâng Cao   | CHƯA BẮT ĐẦU     | Rich symbol metadata, cross-file type inference, call graph        |
| 4     | Navigation Tools        | CHƯA BẮT ĐẦU     | Go-to-definition, find-references qua graph DB                     |
| 5     | LSP Integration         | CHƯA BẮT ĐẦU     | Bridge graph DB với LSP protocol cho editor integration             |
| 6     | Semantic Memory/Search  | CHƯA BẮT ĐẦU     | Embedding-based code search, context-aware agent memory            |

---

## 2. Công Việc Đã Hoàn Thành

### 2.1 Phase 0 & 1 — AST Foundation + Tool Enforcement (trước session này)

Đã được commit trong `72f2ac6`. Bao gồm:

- `SyntaxIndexManager` (`src/runtime/managers/syntax-index-manager.js`) — tree-sitter parse cache
- Tool enforcement surfaces (OpenCode plugin & kit-internal guards)
- AST-based JSON/JSONC search (`src/runtime/tools/ast/ast-search.js`)
- AST tooling status checker (`src/runtime/tools/ast/ast-tooling-status.js`)

### 2.2 Phase 2 — Import Graph + Persistent DB (2 session gần nhất)

#### 2.2.1 Files mới tạo (untracked)

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

#### 2.2.2 Files đã sửa (modified)

```
AGENTS.md                                — Thêm mô tả runtime analysis layer
context/core/project-config.md           — Thêm note về project graph DB
hooks/session-start.js                   — Spawn detached graph-indexer
package.json                             — Thêm better-sqlite3 dependency
package-lock.json                        — Lock file update
src/global/doctor.js                     — Thêm isBetterSqliteAvailable check
src/global/tooling.js                    — Thêm isBetterSqliteAvailable() helper
src/runtime/create-managers.js           — Tạo ProjectGraphManager, truyền mode
src/runtime/create-runtime-interface.js  — Expose graph summary vào runtimeState
src/runtime/tools/tool-registry.js       — Đăng ký 4 graph tools
src/runtime/tools/ast/ast-grep-search.js — FIX: import isAstGrepAvailable từ đúng module
src/runtime/tools/ast/ast-search.js      — FIX: revert execute về sync cho JSON path
tests/runtime/module-boundary.test.js    — FIX: expect "module" thay vì "commonjs"
```

#### 2.2.3 Chi tiết kỹ thuật từng component

**A. ProjectGraphDb** (`src/runtime/analysis/project-graph-db.js`)

- SQLite via `better-sqlite3` (native module, WAL journal mode)
- Schema 3 bảng:
  - `nodes(id, path UNIQUE, kind, mtime)` — file nodes
  - `edges(from_node, to_node, edge_type, line)` — import relationships
  - `symbols(id, node_id, name, kind, is_export, line)` — symbol declarations
- 5 indexes: `idx_nodes_path`, `idx_edges_from`, `idx_edges_to`, `idx_symbols_node`, `idx_symbols_name`
- Prepared statements cho tất cả operations
- `indexFile()` — transactional upsert (node + replace edges + replace symbols)
- `stats()` trả `{ nodes, edges, symbols }` counts
- DB path: `<runtimeRoot>/.opencode/project-graph.db` (hoặc `:memory:` cho tests)

**B. Import Graph Builder** (`src/runtime/analysis/import-graph-builder.js`)

- Dùng `SyntaxIndexManager.readFile()` (tree-sitter) để parse
- Extract:
  - Static imports (`import x from '...'`)
  - `require()` calls
  - Re-exports (`export { x } from '...'`)
  - Dynamic imports (`import('...')`)
  - Export declarations (function, class, variable, default)
- Resolve relative specifiers → absolute paths (thử exact → thêm extensions → index.js)
- Trả về `{ filePath, mtime, imports[], symbols[] }`

**C. ProjectGraphManager** (`src/runtime/managers/project-graph-manager.js`)

- Constructor nhận `{ projectRoot, runtimeRoot, syntaxIndexManager, dbPath?, mode? }`
- `mode = 'read-only'` → không tạo DB (quan trọng cho doctor/bootstrap read-only)
- Methods:
  - `indexFile(filePath)` — index 1 file (skip nếu mtime unchanged)
  - `indexProject({ maxFiles })` — index toàn bộ project (listProjectFiles)
  - `getDependencies(filePath, { depth })` — BFS forward dependencies
  - `getDependents(filePath, { depth })` — BFS reverse dependencies
  - `findSymbol(name)` — search symbol by name
  - `getGraphSummary()` — node/edge/symbol counts
  - `describe()` — status + DB path + indexing state
  - `dispose()` — close DB connection

**D. Graph Tools** (`src/runtime/tools/graph/`)

| Tool ID               | File                  | Mô tả                                    |
|------------------------|-----------------------|-------------------------------------------|
| `tool.import-graph`    | `import-graph.js`     | Index/status/summary/index-file actions   |
| `tool.find-dependencies` | `find-dependencies.js` | Forward deps của 1 file (depth hỗ trợ) |
| `tool.find-dependents` | `find-dependents.js`  | Reverse deps (ai import file này)         |
| `tool.find-symbol`     | `find-symbol.js`      | Tìm symbol theo tên trên toàn project     |

Tất cả tools đều:
- Trả `{ status: 'unavailable' }` khi manager không có
- Validate input (filePath/name required)
- Hỗ trợ string input shorthand
- Đăng ký trong `tool-registry.js`, family = `'graph'`

**E. Background Indexing**

- `hooks/session-start.js` spawn detached process `hooks/graph-indexer.js`
- `graph-indexer.js` dynamically import managers từ kit root
- Fire-and-forget: không chặn session startup, silently exit nếu lỗi
- Index tối đa 2000 files mỗi lần

**F. Doctor Integration**

- `src/global/doctor.js` import `isBetterSqliteAvailable` từ tooling
- Warning message: `"better-sqlite3 native module is not available; project graph / import-graph tools will be degraded."`
- Remediation: `"Run npm install -g @duypham93/openkit to rebuild native addons."`

#### 2.2.4 Các bug đã fix trong session này

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `ast-grep-search.js` SyntaxError | Import `isAstGrepAvailable` từ `./ast-tooling-status.js` (không export) | Đổi import sang `../../../global/tooling.js`; fix call signature `{ env: process.env }` |
| `ast-search.js` tests fail | `execute` thành `async` khi thêm tree-sitter, tests gọi không `await` | Revert `execute` về sync; tree-sitter branch dùng `.then()` thay `await` |
| `runtime-bootstrap` read-only tạo `.opencode/` | `ProjectGraphManager` luôn tạo DB file | Thêm param `mode`; skip DB khi `mode === 'read-only'` |
| `ensure-install` workspaces dir created | Doctor → bootstrap read-only → ProjectGraphManager tạo DB | Cùng fix `mode` ở trên |
| `module-boundary.test.js` expect commonjs | Test cũ chưa cập nhật sau ESM migration | Đổi expect `"commonjs"` → `"module"` |

#### 2.2.5 Kết quả test

- **256 tests passing, 0 failures** (runtime + install + global + cli + release)
- 2 test files timeout do pre-existing Node v24 process-isolation issue (không phải regression):
  - `tests/global/doctor.test.js` — pass với `--experimental-test-isolation=none` (~122s)
  - `tests/cli/openkit-cli.test.js` — pre-existing hang, không liên quan Phase 2

#### 2.2.6 Cách chạy tests

```bash
# Tất cả runtime tests (bao gồm graph tests)
node --test tests/runtime/*.test.js

# Chỉ graph tests
node --test tests/runtime/graph-db.test.js
node --test tests/runtime/import-graph-builder.test.js
node --test tests/runtime/project-graph-manager.test.js
node --test tests/runtime/graph-tools.test.js

# Full suite (trừ 2 file timeout)
node --test tests/runtime/*.test.js tests/install/*.test.js \
  tests/global/ensure-install.test.js tests/global/agent-models.test.js \
  tests/global/config-validation.test.js tests/cli/install.test.js \
  tests/cli/onboard.test.js tests/cli/release-cli.test.js \
  tests/cli/configure-agent-models.test.js tests/release/*.test.js

# Doctor + CLI tests (cần isolation=none vì chậm)
node --experimental-test-isolation=none --test tests/global/doctor.test.js
```

---

## 3. Kế Hoạch Các Phase Tiếp Theo

### 3.1 Phase 3 — Symbol Index Nâng Cao

**Mục tiêu:** Enriched symbol metadata để hỗ trợ navigation và type-aware search.

**Công việc cụ thể:**

1. **Mở rộng schema `symbols` table:**
   - Thêm cột `signature TEXT` — function signature / type annotation
   - Thêm cột `doc_comment TEXT` — JSDoc / TSDoc comment gần nhất
   - Thêm cột `scope TEXT` — module / class / function scope
   - Thêm cột `start_line INTEGER`, `end_line INTEGER` — full range

2. **Tạo bảng `references`:**
   ```sql
   CREATE TABLE IF NOT EXISTS references (
     id        INTEGER PRIMARY KEY AUTOINCREMENT,
     symbol_id INTEGER NOT NULL,
     node_id   INTEGER NOT NULL,  -- file chứa reference
     line      INTEGER NOT NULL,
     column    INTEGER NOT NULL DEFAULT 0,
     kind      TEXT    NOT NULL DEFAULT 'usage',  -- usage | assignment | type-reference
     FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
     FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
   );
   ```

3. **Mở rộng `import-graph-builder.js`:**
   - Extract JSDoc comments gần declarations
   - Extract function parameter types / return types (nếu có TS annotations)
   - Track identifier usages (references) — đây là phần phức tạp nhất
   - Extract class members (methods, properties)

4. **Thêm bảng `call_graph`:**
   ```sql
   CREATE TABLE IF NOT EXISTS call_graph (
     caller_symbol_id INTEGER NOT NULL,
     callee_name      TEXT    NOT NULL,
     callee_node_id   INTEGER,  -- NULL nếu chưa resolve
     line             INTEGER NOT NULL,
     FOREIGN KEY (caller_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
   );
   ```

5. **Tests:**
   - Unit tests cho extended schema
   - Tests cho JSDoc extraction
   - Tests cho reference tracking
   - Tests cho call graph

**Files sẽ modify:**
- `src/runtime/analysis/project-graph-db.js` — schema migration + new prepared statements
- `src/runtime/analysis/import-graph-builder.js` — extract richer metadata

**Files sẽ tạo mới:**
- `src/runtime/analysis/reference-tracker.js` — identifier usage tracker
- `src/runtime/analysis/call-graph-builder.js` — call graph extractor
- `tests/runtime/reference-tracker.test.js`
- `tests/runtime/call-graph.test.js`

**Ước lượng:** 2-3 sessions

---

### 3.2 Phase 4 — Navigation Tools

**Mục tiêu:** Go-to-definition, find-references, prepare-rename qua graph DB (không cần LSP server).

**Công việc cụ thể:**

1. **Tạo `tool.graph-goto-definition`:**
   - Input: `{ filePath, line, column }` hoặc `{ symbol: 'functionName' }`
   - Tra cứu symbol tại vị trí → tìm definition trong DB
   - Fallback: nếu symbol không trong DB, suggest indexing
   - Output: `{ definitions: [{ path, line, column, kind }] }`

2. **Tạo `tool.graph-find-references`:**
   - Input: `{ symbol, scope? }`
   - Tra cứu tất cả references từ `references` table
   - Group by file, sort by line
   - Output: `{ references: [{ path, line, column, kind }], totalCount }`

3. **Tạo `tool.graph-call-hierarchy`:**
   - Input: `{ symbol }` + `{ direction: 'incoming' | 'outgoing' }`
   - Incoming: ai gọi symbol này
   - Outgoing: symbol này gọi gì
   - BFS depth support

4. **Tạo `tool.graph-rename-preview`:**
   - Input: `{ symbol, newName }`
   - Tìm tất cả occurrences (definition + references + imports)
   - Trả preview changes cho mỗi file (không apply)
   - Output: `{ changes: [{ path, edits: [{ line, oldText, newText }] }] }`

5. **Wiring:**
   - Đăng ký tools trong `tool-registry.js`
   - Thêm vào `registry.json` metadata

**Files sẽ tạo mới:**
- `src/runtime/tools/graph/goto-definition.js`
- `src/runtime/tools/graph/find-references.js`
- `src/runtime/tools/graph/call-hierarchy.js`
- `src/runtime/tools/graph/rename-preview.js`
- `tests/runtime/graph-navigation-tools.test.js`

**Dependencies:** Phase 3 (cần `references` table + call graph)

**Ước lượng:** 2 sessions

---

### 3.3 Phase 5 — LSP Integration

**Mục tiêu:** Bridge graph DB output sang LSP protocol format để editor integration có thể consume.

**Công việc cụ thể:**

1. **Tạo LSP response formatters:**
   - `lsp/formatters.js` — convert graph DB results sang LSP protocol JSON
   - `Location`, `LocationLink`, `SymbolInformation`, `WorkspaceEdit` formats

2. **Enhance existing LSP tools:**
   - Hiện tại `tool.lsp-symbols`, `tool.lsp-goto-definition`, etc. ở `src/runtime/tools/lsp/` đã tồn tại nhưng dùng regex/tree-sitter trực tiếp
   - Thêm graph DB fallback: nếu graph data available → dùng nó (nhanh hơn, cross-file); nếu không → fallback về cách cũ
   - Config flag: `graphBackedLsp: true/false` trong runtime config

3. **Incremental index update:**
   - File watcher hook: khi file save → re-index single file
   - Debounce logic: tránh spam re-index
   - Stale detection: mark nodes stale khi mtime thay đổi

4. **Tests:**
   - LSP format output tests
   - Integration tests: graph-backed vs regex-backed LSP tool output comparison
   - File watcher debounce tests

**Files sẽ tạo/modify:**
- `src/runtime/analysis/lsp-formatters.js` (mới)
- `src/runtime/tools/lsp/*.js` (modify — thêm graph fallback)
- `src/runtime/analysis/file-watcher.js` (mới — incremental updates)
- `tests/runtime/lsp-graph-integration.test.js` (mới)

**Dependencies:** Phase 4

**Ước lượng:** 2-3 sessions

---

### 3.4 Phase 6 — Semantic Memory / Search

**Mục tiêu:** Embedding-based code search và context-aware agent memory.

**Công việc cụ thể:**

1. **Code chunk extraction:**
   - Split files thành semantic chunks (function-level, class-level)
   - Mỗi chunk: source code + metadata (file, line range, symbol name, imports)

2. **Embedding storage:**
   - Thêm bảng `embeddings` vào SQLite:
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
   - Vector similarity via brute-force cosine (SQLite custom function) hoặc external vector store

3. **Semantic search tool:**
   - `tool.semantic-search` — input natural language query → embed → find similar chunks
   - Return ranked results với code snippets + graph context (imports, dependents)

4. **Agent context builder:**
   - Khi agent cần context cho task → query graph + embeddings
   - Return: relevant files + symbols + dependency chain + similar code patterns
   - Budget-aware: respect token limit, prioritize by relevance

5. **Session memory:**
   - Track files agent đã đọc/sửa trong session
   - Persist vào graph DB: `session_touches(session_id, node_id, action, timestamp)`
   - Cross-session recall: "file này đã được sửa trong session trước"

**Dependencies:** Phase 3 + embedding model access (có thể dùng local model hoặc API)

**Ước lượng:** 3-4 sessions

---

## 4. Dependency Graph Giữa Các Phase

```
Phase 0 (AST Foundation) ─────────────────────────────┐
Phase 1 (Tool Enforcement) ────────────────────────────┤
                                                       ▼
Phase 2 (Import Graph + DB) ◄━━━━━━━━━ HOÀN THÀNH ━━━━┤
                                                       │
                        ┌──────────────────────────────┘
                        ▼
Phase 3 (Symbol Index Nâng Cao) ◄── Cần làm trước Phase 4, 6
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
Phase 4 (Navigation Tools)   Phase 6 (Semantic Memory)
              │                   │
              ▼                   │
Phase 5 (LSP Integration) ◄──────┘ (optional dependency)
```

---

## 5. Patterns & Conventions Cần Tuân Thủ

### 5.1 Code Conventions

- ESM modules (không CommonJS)
- Explicit `.js` extensions trong imports
- `node:` prefix cho Node.js built-ins
- DI seams cho testing (constructor injection)

### 5.2 Manager Pattern

```javascript
// Tạo trong src/runtime/create-managers.js
const myManager = new MyManager({ projectRoot, runtimeRoot, mode });

// Trả về trong managers object
return {
  managerList,
  managers: Object.fromEntries(managerList.map(...)),
  myManager,  // direct access
  // ...
};
```

### 5.3 Tool Pattern

```javascript
// Tool factory nhận manager
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

- Đăng ký trong `src/runtime/tools/tool-registry.js`
- Import factory function → gọi với managers → push vào tools array

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

### 5.6 DB cho tests

- Luôn dùng `:memory:` cho unit tests (nhanh, không tạo file)
- `manager.dispose()` sau mỗi test

---

## 6. Lưu Ý Quan Trọng

### 6.1 Chưa commit

Tất cả thay đổi Phase 2 CHƯA được commit. Khi tiếp tục trên thiết bị khác:

1. Kiểm tra `git status` để xác nhận working tree
2. Chạy `node --test tests/runtime/*.test.js` để verify tests pass
3. Commit nếu muốn lưu state:
   ```bash
   git add -A
   git commit -m "feat(graph): add persistent project graph DB, import-graph builder, graph tools, and background indexing"
   ```

### 6.2 Pre-existing Issues (không phải regression)

- `tests/global/doctor.test.js` — timeout với Node v24 process isolation mode. Pass với `--experimental-test-isolation=none`. Root cause: 12 tests mỗi cái gọi `bootstrapRuntimeFoundation` mất ~13s → tổng ~122s > 120s timeout.
- `tests/cli/openkit-cli.test.js` — hang khi run với `--experimental-test-isolation=none`, fail nhanh với process isolation. Pre-existing issue.

### 6.3 Native Dependencies

- `better-sqlite3` là native module, cần C++ compiler để build
- Đã khai báo trong `package.json`
- `openkit doctor` sẽ warn nếu không available
- Nếu lỗi install: `npm rebuild better-sqlite3` hoặc cài lại `npm install -g @duypham93/openkit`

### 6.4 Sync vs Async trong Tools

- `ast-search.js` execute PHẢI sync cho JSON path (tests gọi không `await`)
- Tree-sitter path trả Promise via `.then()` (không dùng `async` keyword)
- Graph tools dùng `async execute` vì manager methods có thể async
- Syntax tools (`tool.syntax-*`) dùng `async execute`

### 6.5 Read-Only Mode

- `ProjectGraphManager` KHÔNG tạo DB khi `mode === 'read-only'`
- Doctor bootstrap luôn dùng `mode: 'read-only'`
- Quan trọng để tests `ensure-install` và `runtime-bootstrap` pass

---

## 7. Quick Start Cho Session Tiếp Theo

```bash
# 1. CD vào project
cd /home/duypham/Projects/open-kit

# 2. Verify current state
git status
node --test tests/runtime/*.test.js

# 3. Nếu muốn commit Phase 2 trước khi bắt đầu Phase 3
git add -A
git commit -m "feat(graph): add persistent project graph DB, import-graph builder, graph tools, and background indexing"

# 4. Bắt đầu Phase 3: Symbol Index Nâng Cao
# Đọc file: src/runtime/analysis/project-graph-db.js (schema hiện tại)
# Đọc file: src/runtime/analysis/import-graph-builder.js (extractor hiện tại)
# Bắt đầu mở rộng schema + builder
```

---

## 8. Thứ Tự Ưu Tiên Nếu Thời Gian Hạn Chế

Nếu không thể hoàn thành tất cả phases, ưu tiên theo thứ tự:

1. **Phase 3** — Symbol Index Nâng Cao (nền tảng cho mọi thứ sau)
2. **Phase 4** — Navigation Tools (giá trị sử dụng cao nhất cho agents)
3. **Phase 5** — LSP Integration (polish, không bắt buộc)
4. **Phase 6** — Semantic Memory (advanced, phụ thuộc embedding model)

Phase 3 + 4 đủ để có một codebase intelligence system hoàn chỉnh và hữu ích.
