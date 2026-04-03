# Codebase Intelligence Pipeline — Kế Hoạch Chi Tiết Đầy Đủ

> Tài liệu này ghi lại toàn bộ phân tích, công việc đã làm, và kế hoạch các phase tiếp theo.
> Mục đích: cho phép tiếp tục công việc trên thiết bị khác mà không mất context.

**Repo:** `open-kit` (tại `/home/duypham/Projects/open-kit`)  
**Nhánh:** `main`  
**Commit gốc Phase 0-1:** `72f2ac6 feat: add tool enforcement and AST foundation for codebase intelligence`  
**Ngày cập nhật:** 2026-04-02

---

## MỤC LỤC

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Công Việc Đã Hoàn Thành (Phase 0-2)](#2-công-việc-đã-hoàn-thành)
3. [Phase 3 — Symbol Index Nâng Cao](#3-phase-3--symbol-index-nâng-cao)
4. [Phase 4 — Navigation Tools](#4-phase-4--navigation-tools)
5. [Phase 5 — LSP Graph Integration](#5-phase-5--lsp-graph-integration)
6. [Phase 6 — Semantic Memory / Search](#6-phase-6--semantic-memory--search)
7. [Dependency Graph](#7-dependency-graph)
8. [Kiến Trúc Hiện Tại Chi Tiết](#8-kiến-trúc-hiện-tại-chi-tiết)
9. [Patterns & Conventions](#9-patterns--conventions)
10. [Lưu Ý Quan Trọng](#10-lưu-ý-quan-trọng)
11. [Quick Start Cho Session Tiếp Theo](#11-quick-start)

---

## 1. Tổng Quan Kiến Trúc

### 1.1 Mục tiêu cuối cùng

Xây dựng persistent codebase intelligence cho OpenKit runtime:

- Import graph (ai import ai, cross-file dependency)
- Symbol index (function/class/variable trên toàn project)
- Navigation (go-to-definition, find-references, rename-preview qua graph DB)
- LSP tools nâng cấp từ regex-heuristic lên graph-backed
- Semantic memory (embedding search, session recall)

### 1.2 Bảng tổng quan Phase

| Phase | Tên | Sub-phases | Trạng thái | Sessions ước lượng |
|-------|-----|-----------|------------|-------------------|
| 0 | AST Foundation | — | **DONE** | — |
| 1 | Tool Enforcement | — | **DONE** | — |
| 2 | Import Graph + DB | 2A-2F | **DONE** | — |
| 3 | Symbol Index Nâng Cao | 3A-3E | **DONE** | — |
| 4 | Navigation Tools | 4A-4E | **DONE** | — |
| 5 | LSP Graph Integration | 5A-5D | TODO | 2-3 |
| 6 | Semantic Memory/Search | 6A-6E | TODO | 3-4 |

---

## 2. Công Việc Đã Hoàn Thành

### Phase 0 — AST Foundation (committed `72f2ac6`)

- `SyntaxIndexManager` (`src/runtime/managers/syntax-index-manager.js`, 441 dòng)
  - Web-tree-sitter (WASM) parser
  - Grammars: `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-tsx`
  - LRU ParseCache (100 entries, mtime-based validation)
  - API: `readFile()`, `getOutline()`, `getProjectOutline()`, `getContext()`, `locateType()`

### Phase 1 — Tool Enforcement (committed `72f2ac6`)

- OpenCode plugin & kit-internal tool guards
- AST-based JSON/JSONC search (`ast-search.js`)
- AST-grep binary wrapper (`ast-grep-search.js`)
- AST tooling status checker (`ast-tooling-status.js`)

### Phase 2 — Import Graph + Persistent DB (uncommitted, 2 sessions)

#### 2A. ProjectGraphDb (`src/runtime/analysis/project-graph-db.js`, 287 dòng)

Schema SQLite (better-sqlite3, WAL mode):

```sql
nodes   (id PK, path TEXT UNIQUE, kind TEXT DEFAULT 'module', mtime REAL)
edges   (from_node FK, to_node FK, edge_type TEXT DEFAULT 'import', line INTEGER)
symbols (id PK, node_id FK, name TEXT, kind TEXT DEFAULT 'unknown', is_export INTEGER, line INTEGER)
-- Indexes: idx_nodes_path, idx_edges_from, idx_edges_to, idx_symbols_node, idx_symbols_name
```

Methods: `upsertNode`, `getNode`, `deleteNode`, `replaceEdgesFrom`, `replaceSymbolsFor`, `getDependencies`, `getDependents`, `findSymbolByName`, `indexFile` (transactional), `stats`, `close`

#### 2B. Import Graph Builder (`src/runtime/analysis/import-graph-builder.js`, 480 dòng)

Dùng `SyntaxIndexManager.readFile()` (tree-sitter) extract:

| Node type (tree-sitter) | Extract ra |
|--------------------------|-----------|
| `import_statement` | imports (specifier, resolvedPath, importedNames, line, kind=static) |
| `export_statement` | exports + re-export imports + symbols |
| `function_declaration` | symbols (kind=function) |
| `class_declaration` | symbols (kind=class) |
| `lexical_declaration` / `variable_declaration` | symbols (kind=variable) + require() imports |
| `expression_statement` | require() imports |
| `interface_declaration` | symbols (kind=interface) |
| `type_alias_declaration` | symbols (kind=type) |
| `enum_declaration` | symbols (kind=enum) |

Module resolution: relative paths only (`.` / `..`), tries exact -> +extensions -> /index+extensions

API: `buildFileGraph({ syntaxIndexManager, filePath, projectRoot })` -> `{ filePath, mtime, imports[], exports[], symbols[] }` | `null`

#### 2C. ProjectGraphManager (`src/runtime/managers/project-graph-manager.js`, 373 dòng)

- Constructor: `{ projectRoot, runtimeRoot, syntaxIndexManager, dbPath?, mode? }`
- `mode='read-only'` -> không tạo DB (cho doctor/bootstrap)
- `indexFile(filePath)` -> skip nếu mtime unchanged
- `indexProject({ maxFiles=2000 })` -> sequential index all project files
- `getDependencies(filePath, { depth })` -> BFS forward deps
- `getDependents(filePath, { depth })` -> BFS reverse deps
- `findSymbol(name)` -> search symbol by name
- `getGraphSummary()` -> `{ status, nodes, edges, symbols, dbPath, ... }`
- `dispose()` -> close DB

#### 2D. Graph Tools (`src/runtime/tools/graph/`, 4 files)

| Tool ID | File | Input | Output key fields |
|---------|------|-------|-------------------|
| `tool.import-graph` | `import-graph.js` (47 dòng) | `{ action: 'status'\|'index'\|'index-file'\|'summary', filePath?, maxFiles? }` | Tùy action |
| `tool.find-dependencies` | `find-dependencies.js` (30 dòng) | `{ filePath, depth? }` hoặc string | `{ status, dependencies[] }` |
| `tool.find-dependents` | `find-dependents.js` (30 dòng) | `{ filePath, depth? }` hoặc string | `{ status, dependents[] }` |
| `tool.find-symbol` | `find-symbol.js` (27 dòng) | `{ name }` hoặc string | `{ status, name, matches[] }` |

Đăng ký trong `tool-registry.js`, family = `'graph'`

#### 2E. Background Indexing

- `hooks/session-start.js` spawn detached `hooks/graph-indexer.js`
- `graph-indexer.js` (66 dòng): dynamically import managers từ kit root, chạy `indexProject({ maxFiles: 2000 })`, fire-and-forget

#### 2F. Wiring & Doctor

- `src/runtime/create-managers.js`: tạo `ProjectGraphManager`, truyền `mode`, thêm vào `managerList`
- `src/runtime/create-runtime-interface.js`: expose `projectGraph` vào `runtimeState`
- `src/global/tooling.js`: thêm `isBetterSqliteAvailable()`
- `src/global/doctor.js`: warn khi better-sqlite3 không có

#### 2G. Bug Fixes (session hiện tại)

| File | Bug | Fix |
|------|-----|-----|
| `ast-grep-search.js:5` | Import `isAstGrepAvailable` từ sai module | Đổi sang `../../../global/tooling.js`, fix signature `{ env: process.env }` |
| `ast-search.js:163` | `async execute` khiến JSON path trả Promise | Revert về sync; tree-sitter dùng `.then()` |
| `project-graph-manager.js:26` | Tạo DB trong read-only mode | Thêm `mode` param, skip DB khi `'read-only'` |
| `create-managers.js:130` | Không truyền `mode` cho ProjectGraphManager | Thêm `mode` |
| `module-boundary.test.js:15` | Expect `"commonjs"` sau ESM migration | Đổi sang `"module"` |

#### 2H. Tests (256 pass, 0 fail)

| Test file | Tests | Nội dung |
|-----------|-------|---------|
| `graph-db.test.js` | 11 | ProjectGraphDb: schema, upsert, edges, symbols, cascade delete, stats |
| `import-graph-builder.test.js` | 8 | Extract imports, exports, re-exports, resolve paths, TS support |
| `project-graph-manager.test.js` | 11 | Manager lifecycle, indexFile, indexProject, deps, dependents, findSymbol, BFS |
| `graph-tools.test.js` | 22 | Tool metadata, execute actions, input validation, unavailable fallback |

---

## 3. Phase 3 — Symbol Index Nâng Cao

### 3A. Mở rộng schema symbols table

**Mục tiêu:** Enriched symbol metadata cho navigation chính xác.

**Công việc:**

1. Thêm cột vào `symbols` table:
   ```sql
   ALTER TABLE symbols ADD COLUMN signature TEXT DEFAULT NULL;
   ALTER TABLE symbols ADD COLUMN doc_comment TEXT DEFAULT NULL;
   ALTER TABLE symbols ADD COLUMN scope TEXT DEFAULT 'module';
   ALTER TABLE symbols ADD COLUMN start_line INTEGER DEFAULT 0;
   ALTER TABLE symbols ADD COLUMN end_line INTEGER DEFAULT 0;
   ```

2. Schema migration strategy: vì `better-sqlite3` không hỗ trợ `IF NOT EXISTS` cho `ALTER TABLE`, dùng `PRAGMA user_version` để track schema version:
   ```javascript
   const SCHEMA_VERSION = 2; // bump từ 1
   const currentVersion = db.pragma('user_version', { simple: true });
   if (currentVersion < 2) {
     db.exec('ALTER TABLE symbols ADD COLUMN signature TEXT DEFAULT NULL;');
     // ... các ALTER khác
     db.pragma(`user_version = ${SCHEMA_VERSION}`);
   }
   ```

3. Update prepared statements: `upsertSymbol`, `replaceSymbolsFor` phải include các cột mới

**Files modify:** `src/runtime/analysis/project-graph-db.js`  
**Tests:** Thêm vào `tests/runtime/graph-db.test.js`  
**Verify:** `node --test tests/runtime/graph-db.test.js`

### 3B. Extract rich symbol metadata từ tree-sitter

**Mục tiêu:** Builder extract thêm signature, doc comment, scope, line range.

**Công việc:**

1. **Function signature extraction:**
   ```javascript
   // Tree-sitter node: function_declaration
   // childForFieldName('parameters') → formal_parameters node
   // childForFieldName('return_type') → type_annotation node (TS only)
   // Concat: "functionName(param1: Type, param2): ReturnType"
   ```

2. **JSDoc/TSDoc extraction:**
   ```javascript
   // Look at node.previousNamedSibling or scan source backwards from node.startIndex
   // Pattern: multi-line /** ... */ comment immediately before declaration
   // Extract: full comment text, trim leading * per line
   ```

3. **Scope detection:**
   ```javascript
   // Walk node.parent chain:
   // - If parent.type === 'class_body' → scope = parentClass.name
   // - If parent.type === 'function_declaration' → scope = parentFunction.name
   // - Otherwise → scope = 'module'
   ```

4. **Line range:**
   ```javascript
   // start_line = node.startPosition.row + 1 (1-indexed)
   // end_line = node.endPosition.row + 1
   ```

5. **Class member extraction:**
   ```javascript
   // class_declaration → node.childForFieldName('body') → class_body
   // class_body.namedChildren → method_definition, public_field_definition, etc.
   // Extract each as symbol with scope = className
   ```

**Files modify:** `src/runtime/analysis/import-graph-builder.js`  
**Key tree-sitter nodes cần handle:**
- `method_definition` (class methods)
- `public_field_definition` / `field_definition` (class properties)
- `formal_parameters` (function params)
- `type_annotation` (TS types)
- `comment` (JSDoc)

**Tests:** Thêm vào `tests/runtime/import-graph-builder.test.js`  
**Verify:** `node --test tests/runtime/import-graph-builder.test.js`

### 3C. Tạo references table + reference tracker

**Mục tiêu:** Track nơi symbols được sử dụng (không chỉ khai báo).

**Công việc:**

1. **Thêm bảng `symbol_refs` vào schema:**
   ```sql
   CREATE TABLE IF NOT EXISTS symbol_refs (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     node_id     INTEGER NOT NULL,
     name        TEXT    NOT NULL,
     line        INTEGER NOT NULL,
     col         INTEGER NOT NULL DEFAULT 0,
     ref_kind    TEXT    NOT NULL DEFAULT 'usage',
     resolved_symbol_id INTEGER,
     FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
     FOREIGN KEY (resolved_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
   );
   CREATE INDEX IF NOT EXISTS idx_refs_node ON symbol_refs(node_id);
   CREATE INDEX IF NOT EXISTS idx_refs_name ON symbol_refs(name);
   CREATE INDEX IF NOT EXISTS idx_refs_resolved ON symbol_refs(resolved_symbol_id);
   ```
   `ref_kind`: `'usage'` | `'assignment'` | `'type-ref'` | `'import'`

2. **Tạo `src/runtime/analysis/reference-tracker.js`:**
   ```javascript
   export function extractReferences({ tree, source, filePath }) {
     // BFS qua toàn bộ tree
     // Tìm tất cả 'identifier' nodes
     // Phân loại:
     //   - parent.type === 'import_specifier' → kind = 'import'
     //   - parent.type === 'assignment_expression' (left side) → kind = 'assignment'
     //   - parent.type === 'type_annotation' → kind = 'type-ref'
     //   - otherwise → kind = 'usage'
     // Loại trừ: declarations (childForFieldName('name') nodes)
     // Return: [{ name, line, col, refKind }]
   }
   ```

3. **Reference resolution:**
   - Sau khi index toàn bộ project, chạy pass thứ 2:
   - Với mỗi reference `name` trong file X, tìm symbol trong DB matching:
     - Cùng file (local scope)
     - Import specifiers → resolve tới target file's exports
   - Update `resolved_symbol_id` trong `symbol_refs`

4. **Tích hợp vào `ProjectGraphManager.indexFile()`:**
   ```javascript
   // Sau buildFileGraph, thêm:
   const refs = extractReferences({ tree: parsed.tree, source: parsed.source, filePath });
   this._db.replaceRefsFor(nodeId, refs);
   ```

**Files tạo mới:** `src/runtime/analysis/reference-tracker.js`  
**Files modify:** `project-graph-db.js`, `project-graph-manager.js`, `import-graph-builder.js`  
**Files test:** `tests/runtime/reference-tracker.test.js`  
**Verify:** `node --test tests/runtime/reference-tracker.test.js tests/runtime/graph-db.test.js`

### 3D. Tạo call graph table

**Mục tiêu:** Track function calls cho call hierarchy navigation.

**Công việc:**

1. **Thêm bảng `call_edges` vào schema:**
   ```sql
   CREATE TABLE IF NOT EXISTS call_edges (
     id                 INTEGER PRIMARY KEY AUTOINCREMENT,
     caller_node_id     INTEGER NOT NULL,
     caller_symbol_name TEXT    NOT NULL,
     callee_name        TEXT    NOT NULL,
     line               INTEGER NOT NULL,
     resolved_callee_node_id INTEGER,
     FOREIGN KEY (caller_node_id) REFERENCES nodes(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_call_caller ON call_edges(caller_node_id);
   CREATE INDEX IF NOT EXISTS idx_call_callee ON call_edges(callee_name);
   ```

2. **Extract call sites từ tree-sitter:**
   ```javascript
   // Trong mỗi function body, tìm:
   // - call_expression → node.childForFieldName('function') → identifier hoặc member_expression
   // - member_expression: object.property()
   // Record: { callerSymbolName, calleeName, line }
   ```

3. **Tạo `src/runtime/analysis/call-graph-builder.js`:**
   - Input: parsed tree + symbol list (biết symbol nào đang ở scope nào)
   - Walk function bodies, extract call expressions
   - Return: `[{ callerSymbolName, calleeName, line }]`

**Files tạo mới:** `src/runtime/analysis/call-graph-builder.js`  
**Files modify:** `project-graph-db.js`, `project-graph-manager.js`  
**Files test:** `tests/runtime/call-graph.test.js`

### 3E. Tests & Integration cho Phase 3

**Công việc:**

1. Chạy full graph test suite: `node --test tests/runtime/graph-*.test.js tests/runtime/import-graph-builder.test.js tests/runtime/project-graph-manager.test.js tests/runtime/reference-tracker.test.js tests/runtime/call-graph.test.js`
2. Chạy full runtime suite: `node --test tests/runtime/*.test.js`
3. Verify `ProjectGraphManager.describe()` trả về enriched stats
4. Verify graph tools vẫn hoạt động bình thường (backward compatible)
5. Update `registry.json` nếu cần

**Acceptance criteria:**
- Schema migration transparent (old DB tự upgrade)
- Symbols có signature + doc_comment + scope + line range
- References tracked cho tất cả identifiers
- Call edges tracked cho function calls
- Tất cả tests pass (256+ tests)

---

## 4. Phase 4 — Navigation Tools

### 4A. tool.graph-goto-definition

**Mục tiêu:** Tìm nơi khai báo symbol, cross-file, chính xác hơn regex.

**Công việc:**

1. **Tạo `src/runtime/tools/graph/goto-definition.js`:**
   ```javascript
   export function createGraphGotoDefinitionTool({ projectGraphManager }) {
     return {
       id: 'tool.graph-goto-definition',
       name: 'Graph Go-to-Definition',
       description: 'Find symbol definitions using the project import graph.',
       family: 'graph',
       stage: 'foundation',
       status: projectGraphManager?.available ? 'active' : 'degraded',
       async execute(input = {}) {
         // Input: { symbol: 'functionName' } hoặc { filePath, line, column }
         // Strategy:
         // 1. Nếu có symbol name → db.findSymbolByName(symbol) → filter isExport
         // 2. Nếu có filePath+line+column → đọc file qua syntaxIndexManager
         //    → tìm identifier node tại vị trí → lấy name → query DB
         // 3. Cross-file: nếu symbol được import, trace qua edges tới source file
         // Output: { status, symbol, definitions: [{ path, line, column, kind, signature? }] }
       },
     };
   }
   ```

2. **Graph-aware resolution logic:**
   - Symbol in current file → check local symbols first
   - Symbol imported → follow import edge → find export in target file
   - Re-exports → follow chain until original declaration

**File:** `src/runtime/tools/graph/goto-definition.js`  
**Test:** `tests/runtime/graph-navigation-tools.test.js`  
**Dependency:** Phase 3A (enriched symbols)

### 4B. tool.graph-find-references

**Mục tiêu:** Tìm tất cả nơi sử dụng symbol (nhanh hơn regex, chính xác hơn).

**Công việc:**

1. **Tạo `src/runtime/tools/graph/find-references.js`:**
   ```javascript
   // Input: { symbol: 'functionName', scope?: 'module'|'project' }
   // Strategy:
   // 1. Query symbol_refs table by name
   // 2. Group by file, sort by line
   // 3. Include definition location + all usage locations
   // 4. Include import statements that import this symbol
   // Output: { status, symbol, totalCount, references: [{ path, line, col, refKind }] }
   ```

2. **Nhóm kết quả:**
   - `definitions` — nơi khai báo
   - `imports` — nơi import
   - `usages` — nơi sử dụng
   - `assignments` — nơi gán lại

**File:** `src/runtime/tools/graph/find-references.js`  
**Dependency:** Phase 3C (symbol_refs table)

### 4C. tool.graph-call-hierarchy

**Mục tiêu:** Ai gọi function X? Function X gọi gì?

**Công việc:**

1. **Tạo `src/runtime/tools/graph/call-hierarchy.js`:**
   ```javascript
   // Input: { symbol: 'functionName', direction: 'incoming'|'outgoing', depth?: 1 }
   // incoming: SELECT * FROM call_edges WHERE callee_name = ?
   // outgoing: SELECT * FROM call_edges WHERE caller_symbol_name = ? AND caller_node_id = ?
   // BFS for depth > 1
   // Output: { status, symbol, direction, hierarchy: [{ callerOrCallee, path, line }] }
   ```

**File:** `src/runtime/tools/graph/call-hierarchy.js`  
**Dependency:** Phase 3D (call_edges table)

### 4D. tool.graph-rename-preview

**Mục tiêu:** Preview rename across all files (definition + references + imports).

**Công việc:**

1. **Tạo `src/runtime/tools/graph/rename-preview.js`:**
   ```javascript
   // Input: { symbol: 'oldName', newName: 'newName' }
   // Strategy:
   // 1. Find all definitions (symbols table)
   // 2. Find all references (symbol_refs table)
   // 3. Find all import specifiers that import this name
   // 4. For each occurrence, read the source line and build edit preview
   // 5. Check for conflicts (newName already exists?)
   // Output: {
   //   status: 'preview-ready' | 'conflict',
   //   symbol, newName,
   //   totalOccurrences,
   //   conflicts: [],
   //   changes: [{
   //     path, relativePath,
   //     edits: [{ line, column, oldText, newText, lineContent }]
   //   }]
   // }
   ```

2. **Quan trọng:** Preview only, KHÔNG mutate files. Consistent với existing `tool.lsp-rename` contract.

**File:** `src/runtime/tools/graph/rename-preview.js`  
**Dependency:** Phase 3C (symbol_refs table)

### 4E. Wiring & Testing cho Phase 4

**Công việc:**

1. Đăng ký 4 tools mới trong `src/runtime/tools/tool-registry.js`:
   ```javascript
   import { createGraphGotoDefinitionTool } from './graph/goto-definition.js';
   import { createGraphFindReferencesTool } from './graph/find-references.js';
   import { createGraphCallHierarchyTool } from './graph/call-hierarchy.js';
   import { createGraphRenamePreviewTool } from './graph/rename-preview.js';
   // ... push vào tools array với { projectGraphManager }
   ```

2. Update `registry.json` metadata (thêm 4 tool entries)

3. Test file: `tests/runtime/graph-navigation-tools.test.js`
   - Setup: tạo multi-file project với imports, function calls, class usage
   - Test goto-definition: local symbol, imported symbol, re-exported symbol
   - Test find-references: within file, across files, import references
   - Test call-hierarchy: incoming + outgoing + depth > 1
   - Test rename-preview: simple rename, conflict detection, cross-file edits

4. Verify: `node --test tests/runtime/*.test.js` (toàn bộ phải pass)

---

## 5. Phase 5 — LSP Graph Integration

### 5A. Nâng cấp LSP tools từ heuristic lên graph-backed

**Context hiện tại:** 7 LSP tools trong `src/runtime/tools/lsp/` đều dùng regex (`heuristic-lsp.js`). Tất cả có `status: 'degraded'`. Chúng dùng regex patterns:
- `extractSymbolsFromText()` — regex cho function/class/variable/interface/type/enum
- `collectSymbolReferences()` — regex `\bsymbol\b` match
- Không hỗ trợ cross-file tracing, chỉ scan text

**Công việc:**

1. **Tạo `src/runtime/tools/lsp/graph-lsp-provider.js`:**
   ```javascript
   // Wrapper that checks if projectGraphManager is available
   // If yes → query graph DB (fast, accurate)
   // If no → fallback to heuristic-lsp.js (existing behavior)
   
   export function createGraphLspProvider({ projectGraphManager, projectRoot }) {
     const available = projectGraphManager?.available === true;
     return {
       available,
       provider: available ? 'graph-index' : 'heuristic-index',
       providerStatus: available ? 'available' : 'fallback-active',
       
       collectProjectSymbols(options) { /* graph or heuristic */ },
       collectHeuristicDiagnostics() { /* graph or heuristic */ },
       collectSymbolReferences(symbol) { /* graph or heuristic */ },
       prepareRename(options) { /* graph or heuristic */ },
       previewRename(options) { /* graph or heuristic */ },
     };
   }
   ```

2. **Modify mỗi LSP tool factory** để nhận `projectGraphManager`:
   ```javascript
   // TRƯỚC (hiện tại):
   export function createLspSymbolsTool({ projectRoot }) { ... }
   // SAU:
   export function createLspSymbolsTool({ projectRoot, projectGraphManager }) {
     const lspProvider = createGraphLspProvider({ projectGraphManager, projectRoot });
     return {
       status: lspProvider.available ? 'active' : 'degraded',
       execute(input) {
         const symbols = lspProvider.collectProjectSymbols(input);
         return { status: lspProvider.available ? 'ok' : 'heuristic', provider: lspProvider.provider, symbols };
       },
     };
   }
   ```

3. **Update `tool-registry.js`**: truyền `projectGraphManager` cho LSP tool factories

4. **Status upgrade:**
   - Khi graph available: `status: 'active'`, result `status: 'ok'`
   - Khi graph unavailable: `status: 'degraded'`, result `status: 'heuristic'` (hiện tại)

**Files modify:** Tất cả 7 files trong `src/runtime/tools/lsp/`  
**File tạo mới:** `src/runtime/tools/lsp/graph-lsp-provider.js`

### 5B. Enhanced diagnostics qua graph

**Công việc:**

1. **Graph-backed missing import detection:**
   ```javascript
   // Query edges WHERE to_node.kind = 'external' hoặc to_node not found
   // → chính xác hơn regex pattern matching
   ```

2. **Unused export detection (mới):**
   ```javascript
   // Query symbols WHERE is_export = 1 AND no incoming edges reference this file
   // → "exported but never imported"
   ```

3. **Circular dependency detection (mới):**
   ```javascript
   // DFS trên edges, detect back edges
   // Report: [{ cycle: [fileA, fileB, fileC, fileA] }]
   ```

**File modify:** `src/runtime/tools/lsp/graph-lsp-provider.js`

### 5C. Incremental index updates (file watcher)

**Mục tiêu:** Re-index file khi nó thay đổi, không cần manual trigger.

**Công việc:**

1. **Tạo `src/runtime/analysis/incremental-indexer.js`:**
   ```javascript
   export class IncrementalIndexer {
     constructor({ projectGraphManager, debounceMs = 500 }) { ... }
     
     // Called when a file changes
     onFileChange(filePath) {
       // Debounce: clear existing timer, set new one
       // After debounce: call projectGraphManager.indexFile(filePath)
     }
     
     // Check all indexed files for stale mtime
     async checkStale() {
       // Query all nodes from DB
       // For each, compare DB mtime vs fs.statSync().mtimeMs
       // Re-index stale files
     }
     
     dispose() { /* clear timers */ }
   }
   ```

2. **Hook into session-start:** kiểm tra stale files trước khi bắt đầu session
3. **Hook into tool execution:** sau khi `tool.hashline-edit` hoặc write tools modify files, trigger re-index

**File tạo mới:** `src/runtime/analysis/incremental-indexer.js`  
**Files modify:** `hooks/graph-indexer.js` (thêm stale check), `project-graph-manager.js` (thêm `checkStale()`)

### 5D. Tests cho Phase 5

**Công việc:**

1. **Test file:** `tests/runtime/lsp-graph-integration.test.js`
   - Test graph-backed symbol lookup vs heuristic (same results, better accuracy)
   - Test fallback khi graph unavailable
   - Test diagnostic: missing imports, unused exports, circular deps
   - Test status upgrade: degraded → active khi graph available

2. **Test file:** `tests/runtime/incremental-indexer.test.js`
   - Test debounce logic
   - Test stale detection
   - Test re-index after file change

3. **Integration test:** Modify existing `tests/runtime/runtime-platform.test.js`
   - Verify LSP tools return `status: 'ok'` (not `'heuristic'`) khi graph available

**Verify:** `node --test tests/runtime/*.test.js`

---

## 6. Phase 6 — Semantic Memory / Search

### 6A. Code chunking engine

**Mục tiêu:** Split code thành semantic chunks cho embedding.

**Công việc:**

1. **Tạo `src/runtime/analysis/code-chunker.js`:**
   ```javascript
   export function chunkFile({ parsed, filePath, symbols }) {
     // Strategy:
     // 1. Mỗi top-level function/class → 1 chunk
     // 2. Module-level code (imports, top-level statements) → 1 chunk
     // 3. Class methods → nested chunks within class chunk
     // 4. Chunk size limit: ~500 tokens (ước lượng ~2000 chars)
     //    - Nếu function quá dài → split tại blank lines hoặc nested functions
     
     // Mỗi chunk:
     return [{
       chunkId: `${filePath}#${symbolName}` hoặc `${filePath}#L${startLine}-L${endLine}`,
       filePath,
       startLine, endLine,
       symbolName,  // null cho module-level chunk
       symbolKind,
       content: sourceSlice,
       imports: relevantImports,  // imports mà chunk này sử dụng
       exports: relevantExports,  // exports từ chunk này
       metadata: { language, dependencies: [...] },
     }];
   }
   ```

2. **Chunk context enrichment:**
   - Mỗi chunk kèm theo: file path, symbol name, import list, dependent files
   - Giúp embedding model hiểu context tốt hơn

**File tạo mới:** `src/runtime/analysis/code-chunker.js`  
**Test:** `tests/runtime/code-chunker.test.js`

### 6B. Embedding storage

**Công việc:**

1. **Thêm bảng `embeddings` vào schema:**
   ```sql
   CREATE TABLE IF NOT EXISTS embeddings (
     id        INTEGER PRIMARY KEY AUTOINCREMENT,
     node_id   INTEGER NOT NULL,
     chunk_id  TEXT    NOT NULL UNIQUE,
     embedding BLOB    NOT NULL,
     model     TEXT    NOT NULL,
     dimensions INTEGER NOT NULL,
     created   REAL    NOT NULL,
     FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_embeddings_node ON embeddings(node_id);
   CREATE INDEX IF NOT EXISTS idx_embeddings_chunk ON embeddings(chunk_id);
   ```

2. **Vector similarity function:**
   ```javascript
   // Option A: Pure JS cosine similarity (brute force, works with SQLite BLOB)
   function cosineSimilarity(a, b) {
     // a, b are Float32Array
     let dot = 0, normA = 0, normB = 0;
     for (let i = 0; i < a.length; i++) {
       dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i];
     }
     return dot / (Math.sqrt(normA) * Math.sqrt(normB));
   }
   
   // Option B: better-sqlite3 custom function
   db.function('cosine_sim', { deterministic: true }, (blobA, blobB) => {
     const a = new Float32Array(blobA.buffer);
     const b = new Float32Array(blobB.buffer);
     return cosineSimilarity(a, b);
   });
   // → SELECT *, cosine_sim(embedding, ?) as score FROM embeddings ORDER BY score DESC LIMIT 10
   ```

3. **Embedding provider abstraction:**
   ```javascript
   // src/runtime/analysis/embedding-provider.js
   export class EmbeddingProvider {
     constructor({ model = 'local', apiKey?, endpoint? }) { ... }
     
     // Option 1: OpenAI-compatible API
     async embed(texts) { /* POST /embeddings */ }
     
     // Option 2: Local model (transformers.js hoặc ONNX runtime)
     async embedLocal(texts) { /* load local model, inference */ }
     
     get dimensions() { /* depends on model */ }
   }
   ```

**Files tạo mới:** `src/runtime/analysis/embedding-provider.js`  
**Files modify:** `project-graph-db.js` (schema migration)

### 6C. Semantic search tool

**Công việc:**

1. **Tạo `src/runtime/tools/graph/semantic-search.js`:**
   ```javascript
   export function createSemanticSearchTool({ projectGraphManager, embeddingProvider }) {
     return {
       id: 'tool.semantic-search',
       family: 'graph',
       async execute(input = {}) {
         // Input: { query: 'natural language question', topK?: 10 }
         // 1. Embed query text
         // 2. Query embeddings table, compute cosine similarity
         // 3. Return top-K chunks with:
         //    - code snippet
         //    - file path + line range
         //    - symbol info (from symbols table)
         //    - dependency context (from edges table)
         //    - similarity score
         return { status: 'ok', query, results: [...], totalIndexed };
       },
     };
   }
   ```

2. **Tạo `tool.index-embeddings`:**
   ```javascript
   // Input: { action: 'index' | 'status' | 'clear', maxFiles? }
   // index: chunk all files → embed → store
   // status: count of indexed chunks, model info
   // clear: delete all embeddings (force re-index)
   ```

**Files tạo mới:**
- `src/runtime/tools/graph/semantic-search.js`
- `src/runtime/tools/graph/index-embeddings.js`

### 6D. Agent context builder

**Mục tiêu:** Khi agent cần context, tự động build relevant context window.

**Công việc:**

1. **Tạo `src/runtime/analysis/context-builder.js`:**
   ```javascript
   export class ContextBuilder {
     constructor({ projectGraphManager, embeddingProvider, tokenBudget = 8000 }) { ... }
     
     async buildContext({ query, currentFile?, relevantSymbols? }) {
       // 1. Semantic search: top chunks matching query
       // 2. Graph walk: dependencies + dependents of current file
       // 3. Symbol lookup: definitions of relevant symbols
       // 4. Rank by relevance (semantic score + graph distance)
       // 5. Trim to token budget
       return {
         chunks: [...],         // ranked code chunks
         fileGraph: {...},      // relevant dependency subgraph
         symbolIndex: [...],    // relevant symbol definitions
         totalTokens: number,
       };
     }
   }
   ```

2. **Tạo `tool.build-context`:**
   ```javascript
   // Input: { query: 'implement feature X', currentFile?, budget?: 8000 }
   // Output: curated context window cho agent
   ```

**File tạo mới:** `src/runtime/analysis/context-builder.js`, `src/runtime/tools/graph/build-context.js`

### 6E. Session memory & cross-session recall

**Công việc:**

1. **Thêm bảng `session_touches` vào schema:**
   ```sql
   CREATE TABLE IF NOT EXISTS session_touches (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     session_id TEXT    NOT NULL,
     node_id    INTEGER NOT NULL,
     action     TEXT    NOT NULL,  -- 'read' | 'edit' | 'create' | 'delete'
     timestamp  REAL    NOT NULL,
     context    TEXT,              -- optional JSON metadata
     FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_touches_session ON session_touches(session_id);
   CREATE INDEX IF NOT EXISTS idx_touches_node ON session_touches(node_id);
   ```

2. **Hook into tool execution:**
   - Khi `tool.hashline-edit`, `tool.look-at`, etc. execute → record touch
   - `action = 'read'` cho read tools, `'edit'` cho edit tools

3. **Tạo `tool.session-recall`:**
   ```javascript
   // Input: { query?: 'what files did I edit last session?', sessionId? }
   // Output: list of touched files + actions + timestamps
   // Cross-session: "file X was edited 3 sessions ago, lines 10-20 changed"
   ```

**Files modify:** `project-graph-db.js`, `project-graph-manager.js`  
**Files tạo mới:** `src/runtime/tools/graph/session-recall.js`

---

## 7. Dependency Graph

```
Phase 0 (AST Foundation)     ━━━┓
Phase 1 (Tool Enforcement)   ━━━╋━━━━ DONE
                                 ┃
Phase 2 (Import Graph + DB)  ━━━┛ ◄━━ DONE
         │
         ├── 3A (Schema extend)
         ├── 3B (Rich extraction)
         ├── 3C (References table) ──────┐
         ├── 3D (Call graph) ────────────┤
         └── 3E (Integration tests)      │
                                         │
         ┌───────────────────────────────┘
         │
         ├── 4A (goto-definition) ◄── 3A
         ├── 4B (find-references) ◄── 3C
         ├── 4C (call-hierarchy)  ◄── 3D
         ├── 4D (rename-preview)  ◄── 3C
         └── 4E (wiring + tests)
                │
         ┌──────┘
         │
         ├── 5A (LSP upgrade) ◄── 4A, 4B
         ├── 5B (Enhanced diagnostics)
         ├── 5C (Incremental indexer)
         └── 5D (Tests)
                │
         ┌──────┘ (optional)
         │
         ├── 6A (Code chunker) ◄── 3A, 3B
         ├── 6B (Embedding storage)
         ├── 6C (Semantic search) ◄── 6A, 6B
         ├── 6D (Context builder) ◄── 6C, 4B
         └── 6E (Session memory)
```

**Minimum viable path:** Phase 3 → Phase 4 (navigation tools hoàn chỉnh)  
**Full path:** Phase 3 → Phase 4 → Phase 5 → Phase 6

---

## 8. Kiến Trúc Hiện Tại Chi Tiết

### 8.1 File map (Phase 2 hoàn thành)

```
src/runtime/
├── analysis/
│   ├── project-graph-db.js       (287 dòng)  — SQLite wrapper
│   └── import-graph-builder.js   (480 dòng)  — AST extractor
├── managers/
│   ├── syntax-index-manager.js   (441 dòng)  — Tree-sitter parser (Phase 0)
│   └── project-graph-manager.js  (373 dòng)  — Graph coordinator
├── tools/
│   ├── ast/
│   │   ├── ast-search.js         (237 dòng)  — JSON/JSONC + JS/TS AST search
│   │   ├── ast-grep-search.js    (127 dòng)  — ast-grep CLI wrapper
│   │   ├── ast-replace.js        (76 dòng)   — JSON replace preview
│   │   └── ast-tooling-status.js (19 dòng)   — Status checker
│   ├── graph/
│   │   ├── import-graph.js       (47 dòng)   — tool.import-graph
│   │   ├── find-dependencies.js  (30 dòng)   — tool.find-dependencies
│   │   ├── find-dependents.js    (30 dòng)   — tool.find-dependents
│   │   └── find-symbol.js        (27 dòng)   — tool.find-symbol
│   ├── lsp/                      — 7 tools, regex-based (sẽ upgrade Phase 5)
│   ├── shared/
│   │   └── project-file-utils.js (77 dòng)   — File listing, path utils
│   └── tool-registry.js          (105 dòng)  — 39 tools registered
├── create-managers.js            (190 dòng)  — Manager instantiation
├── create-runtime-interface.js   (71 dòng)   — runtimeState builder
└── index.js                                   — bootstrapRuntimeFoundation

hooks/
├── session-start.js              (259 dòng)  — Session hook + graph indexer spawn
└── graph-indexer.js              (66 dòng)   — Background indexer (detached)

tests/runtime/
├── graph-db.test.js              (11 tests)
├── graph-tools.test.js           (22 tests)
├── import-graph-builder.test.js  (8 tests)
├── project-graph-manager.test.js (11 tests)
└── ... (14 other test files, 189 total runtime tests)
```

### 8.2 Tree-sitter node types đã handle

| Category | Node types |
|----------|-----------|
| Imports | `import_statement`, `call_expression` (require) |
| Exports | `export_statement` |
| Declarations | `function_declaration`, `class_declaration`, `lexical_declaration`, `variable_declaration` |
| TS-specific | `interface_declaration`, `type_alias_declaration`, `enum_declaration` |
| Sub-nodes | `identifier`, `import_specifier`, `export_specifier`, `namespace_import`, `variable_declarator`, `arrow_function`, `function_expression` |

### 8.3 Tree-sitter node types CẦN thêm (Phase 3+)

| Category | Node types | Phase |
|----------|-----------|-------|
| Class members | `method_definition`, `public_field_definition`, `field_definition` | 3B |
| Parameters | `formal_parameters`, `required_parameter`, `optional_parameter` | 3B |
| Types | `type_annotation`, `return_type` | 3B |
| Comments | `comment` (JSDoc) | 3B |
| References | `identifier` (usage context), `member_expression` | 3C |
| Calls | `call_expression`, `new_expression` | 3D |

### 8.4 Hiện trạng LSP tools (sẽ upgrade Phase 5)

| Tool ID | File | Hiện tại | Sau Phase 5 |
|---------|------|---------|-------------|
| `tool.lsp-symbols` | `lsp-symbols.js` (19 dòng) | regex | graph → regex fallback |
| `tool.lsp-diagnostics` | `lsp-diagnostics.js` (20 dòng) | regex | graph → regex fallback |
| `tool.lsp-goto-definition` | `lsp-goto-definition.js` (20 dòng) | regex | graph → regex fallback |
| `tool.lsp-find-references` | `lsp-find-references.js` (20 dòng) | regex | graph → regex fallback |
| `tool.lsp-prepare-rename` | `lsp-prepare-rename.js` (18 dòng) | regex | graph → regex fallback |
| `tool.lsp-rename` | `lsp-rename.js` (18 dòng) | regex | graph → regex fallback |

Shared logic: `heuristic-lsp.js` (189 dòng) — regex patterns cho function/class/variable/interface/type/enum extraction + `\bsymbol\b` reference search.

---

## 9. Patterns & Conventions

### 9.1 Code conventions

- ESM modules, explicit `.js` extensions, `node:` prefix cho built-ins
- DI seams cho testing (constructor injection)
- `mode` param cho read-only vs read-write

### 9.2 Manager pattern (xem `create-managers.js`)

```javascript
const myManager = new MyManager({ projectRoot, runtimeRoot, syntaxIndexManager, mode });
// Thêm vào managerList + managers object + direct export
```

### 9.3 Tool pattern (xem `graph/find-symbol.js` cho ví dụ ngắn nhất)

```javascript
export function createMyTool({ projectGraphManager }) {
  return {
    id: 'tool.my-tool', name: '...', description: '...',
    family: 'graph', stage: 'foundation',
    status: projectGraphManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!projectGraphManager?.available) return { status: 'unavailable', reason: '...' };
      // validate input → delegate to manager → return structured result
    },
  };
}
```

### 9.4 Tool registration (xem `tool-registry.js`)

```javascript
import { createMyTool } from './graph/my-tool.js';
// trong createToolRegistry():
tools.push(createMyTool({ projectGraphManager: managers.projectGraphManager }));
```

### 9.5 Test pattern (xem `graph-tools.test.js`)

```javascript
function makeTempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-test-')); }
function writeFile(dir, rel, content) { /* mkdirSync + writeFileSync */ }
function makeManager(dir) {
  return new ProjectGraphManager({ projectRoot: dir, syntaxIndexManager: new SyntaxIndexManager({ projectRoot: dir }), dbPath: ':memory:' });
}

test('descriptive name', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'src/a.js', 'export const a = 1;\n');
  const mgr = makeManager(dir);
  await mgr.indexFile(path.join(dir, 'src', 'a.js'));
  // ... assert
  mgr.dispose();
});
```

### 9.6 Sync vs Async rules

| Tool type | execute | Lý do |
|-----------|---------|-------|
| JSON/JSONC tools (`ast-search`) | **sync** | Tests gọi không await |
| Tree-sitter tools (`syntax-*`) | **async** | `readFile()` async |
| Graph tools | **async** | Manager methods có thể async |
| LSP tools | **sync** | Hiện tại regex, tương lai có thể async |

### 9.7 Schema migration pattern

```javascript
const SCHEMA_VERSION = 2;
const current = this._db.pragma('user_version', { simple: true });
if (current < 2) {
  this._db.exec('ALTER TABLE symbols ADD COLUMN signature TEXT DEFAULT NULL;');
  this._db.pragma(`user_version = ${SCHEMA_VERSION}`);
}
```

---

## 10. Lưu Ý Quan Trọng

### 10.1 Trạng thái git hiện tại

Tất cả thay đổi Phase 2 + bug fixes **chưa commit**. Files:

**Modified (12):**
```
AGENTS.md, context/core/project-config.md, hooks/session-start.js,
package.json, package-lock.json, src/global/doctor.js, src/global/tooling.js,
src/runtime/create-managers.js, src/runtime/create-runtime-interface.js,
src/runtime/tools/ast/ast-grep-search.js, src/runtime/tools/ast/ast-search.js,
src/runtime/tools/tool-registry.js, tests/runtime/module-boundary.test.js
```

**Untracked (12):**
```
hooks/graph-indexer.js, src/runtime/analysis/project-graph-db.js,
src/runtime/analysis/import-graph-builder.js, src/runtime/managers/project-graph-manager.js,
src/runtime/tools/graph/import-graph.js, src/runtime/tools/graph/find-dependencies.js,
src/runtime/tools/graph/find-dependents.js, src/runtime/tools/graph/find-symbol.js,
tests/runtime/graph-db.test.js, tests/runtime/graph-tools.test.js,
tests/runtime/import-graph-builder.test.js, tests/runtime/project-graph-manager.test.js
```

### 10.2 Pre-existing test issues (KHÔNG phải regression)

- `tests/global/doctor.test.js` — timeout Node v24 process isolation. Pass: `node --experimental-test-isolation=none --test tests/global/doctor.test.js`
- `tests/cli/openkit-cli.test.js` — pre-existing hang

### 10.3 Native dependency

- `better-sqlite3` cần C++ compiler. Nếu lỗi: `npm rebuild better-sqlite3`
- `openkit doctor` warn nếu không available

### 10.4 Read-only mode guard

- `ProjectGraphManager(mode='read-only')` KHÔNG tạo DB
- Doctor bootstrap luôn dùng `mode: 'read-only'`
- Bất kỳ manager mới nào cũng phải respect `mode`

---

## 11. Quick Start

```bash
# Verify state
cd /home/duypham/Projects/open-kit
git status
node --test tests/runtime/*.test.js   # expect 189 pass

# Commit Phase 2
git add -A
git commit -m "feat(graph): add persistent project graph DB, import-graph builder, graph tools, and background indexing

- SQLite-backed project graph (nodes/edges/symbols tables) via better-sqlite3
- Import graph builder extracts imports, exports, symbols from JS/TS via tree-sitter
- ProjectGraphManager coordinates indexing and graph queries (deps, dependents, symbols)
- Four graph tools: import-graph, find-dependencies, find-dependents, find-symbol
- Background indexer spawned from session-start hook (detached, non-blocking)
- Doctor integration warns when better-sqlite3 is unavailable
- Fix: ast-grep-search import path, ast-search sync/async contract, read-only mode guard
- 52 new tests (graph-db, import-graph-builder, project-graph-manager, graph-tools)"

# Bắt đầu Phase 3A
# Đọc: src/runtime/analysis/project-graph-db.js (schema hiện tại)
# Bắt đầu: thêm PRAGMA user_version + ALTER TABLE symbols
```
