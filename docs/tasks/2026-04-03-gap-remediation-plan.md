# Kế hoạch vá lỗ hổng bề mặt đọc hiểu codebase

> Mục tiêu: vá **toàn bộ** lỗ hổng đã xác định trong bộ công cụ đọc hiểu
> codebase của OpenKit — từ nhỏ nhất đến lớn nhất — theo trật tự thống nhất,
> không vá chỗ này làm hổng chỗ khác.
>
> Nguyên tắc: mỗi phase tự kiểm chứng được trước khi phase sau bắt đầu.

**Repo:** `open-kit`
**Branch:** `main`
**Ngày tạo:** 2026-04-03
**Tham chiếu phân tích:** phiên phân tích bề mặt công cụ ngày 2026-04-03

---

## 0. Tổng quan lỗ hổng

### Bảng master — tất cả lỗ hổng, xếp theo nhóm

| # | Nhóm | Lỗ hổng | Vị trí | Mức |
|---|---|---|---|---|
| G01 | Shared constants | Ba file định nghĩa `SOURCE_EXTENSIONS` riêng lẻ, không chia sẻ | `syntax-index-manager.js:16`, `project-graph-manager.js:14`, `file-watcher.js:12` | thấp |
| G02 | Extension coverage | `.cts`/`.mts` thiếu trong syntax parser | `syntax-index-manager.js:16-23` | trung bình |
| G03 | Extension coverage | `.cts`/`.mts` thiếu trong graph indexer | `project-graph-manager.js:14` | trung bình |
| G04 | Extension coverage | `.cts`/`.mts` thiếu trong file watcher | `file-watcher.js:12` | thấp |
| G05 | Extension coverage | Heuristic LSP có `.cts`/`.mts` nhưng tree-sitter không có → inconsistency | `heuristic-lsp.js:6` vs `syntax-index-manager.js:16` | trung bình |
| G06 | Error visibility | Phase 3 indexing (refs + calls) nuốt lỗi im lặng | `project-graph-manager.js:183` — bare `catch {}` | cao |
| G07 | Performance | Tree parse 2 lần mỗi `indexFile()` | `project-graph-manager.js:118,157` | trung bình |
| G08 | Call graph | Callee chỉ resolve tới file node ID, không tới symbol ID | `call-graph-builder.js:144` | trung bình |
| G09 | Call graph | Chỉ `function`/`method` được track làm caller — bỏ sót arrow fn, constructor, IIFE | `call-graph-builder.js:43` | trung bình |
| G10 | Reference tracker | Không scope-aware — local shadow gây false positive | `reference-tracker.js:9` (documented limitation) | trung bình |
| G11 | Dead code | `FileWatcher` tồn tại, test tồn tại, nhưng runtime không bao giờ instantiate | Không import ở `create-managers.js` hay `index.js` | trung bình |
| G12 | MCP builtins | 3 MCP stubs rỗng — websearch, docs-search, code-search chỉ là metadata | `mcp/websearch.js`, `docs-search.js`, `code-search.js` (mỗi file 8 dòng) | cao |
| G13 | MCP dispatch | `dispatchMcpCall()` chỉ return status, không invoke gì | `mcp/dispatch.js:12-17` | cao |
| G14 | MCP external | `.mcp.json` config được load nhưng server không bao giờ dispatch tới | `mcp-config-loader.js` + `dispatch.js` | cao |
| G15 | Specialists | 6 specialists là identity stubs — không logic, không tool bindings | `specialists/*.js` (9 dòng mỗi file) | trung bình |
| G16 | Language support | Chỉ JS/TS — mù hoàn toàn với Python, Go, Rust, v.v. | `syntax-index-manager.js`, `import-graph-builder.js` | cao |
| G17 | Language support | Không parse CSS/HTML/Markdown/YAML/TOML | Không có grammar nào ngoài JS/TS/TSX | trung bình |
| G18 | Type awareness | Symbol resolution name-based, không type-aware | `reference-tracker.js`, `call-graph-builder.js` | trung bình |
| G19 | Vector search | Brute-force cosine trên toàn bộ embeddings — không scale | `session-memory-manager.js` `semanticSearch()` | trung bình |
| G20 | Tooling integration | Không tích hợp test runner / tsc / eslint từ tool surface | Không có tool nào | trung bình |

---

## 1. Nguyên tắc vá thống nhất

### 1.1. Dependency order — không phase nào phụ thuộc phase sau

```
Phase 1 (nền tảng chung)
    ↓
Phase 2 (chất lượng index pipeline)
    ↓
Phase 3 (mở rộng ngôn ngữ)
    ↓
Phase 4 (MCP dispatch thực)
    ↓
Phase 5 (cải thiện retrieval)
    ↓
Phase 6 (tích hợp tooling ngoài)
```

### 1.2. Invariant bảo toàn giữa các phase

Mỗi phase phải giữ nguyên các invariant sau:

- **I1:** Test suite hiện tại pass 100% trước và sau mỗi phase.
- **I2:** Mọi tool vẫn degradable — thiếu dependency thì fallback, không crash.
- **I3:** Không thay đổi public tool ID, tool input schema, hoặc tool output shape
  mà không cập nhật cả docs lẫn tests đồng thời.
- **I4:** Mỗi file mới phải có test file tương ứng.
- **I5:** Mỗi constant mới phải import từ single source of truth,
  không copy-paste vào từng file.
- **I6:** `MockEmbeddingProvider` và test determinism không bị ảnh hưởng.
- **I7:** Embedding DB schema changes phải backward-compatible (migration,
  không drop table).

### 1.3. Exit gate mỗi phase

Mỗi phase chỉ được coi là xong khi:

1. Tất cả test cũ + test mới pass.
2. Các file liên quan trong `docs/kit-internals/` được cập nhật.
3. Commit message ghi rõ phase number và lỗ hổng đã vá.

---

## 2. Phase 1 — Nền tảng chung (constants, error visibility, dead code)

**Vá:** G01, G02, G03, G04, G05, G06, G11
**Ước tính:** nhỏ, ít rủi ro, giải quyết nợ kỹ thuật nền

### 2.1. Trích xuất shared constants (G01)

Tạo `src/runtime/analysis/source-extensions.js`:

```js
export const SOURCE_EXTENSIONS = [
  '.js', '.jsx', '.cjs', '.mjs',
  '.ts', '.tsx', '.cts', '.mts',
];

export const EXTENSION_TO_LANGUAGE = new Map([
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.cjs', 'javascript'],
  ['.mjs', 'javascript'],
  ['.ts', 'typescript'],
  ['.tsx', 'tsx'],
  ['.cts', 'typescript'],
  ['.mts', 'typescript'],
]);
```

Cập nhật consumer files import từ đây:

| File | Thay đổi |
|---|---|
| `syntax-index-manager.js` | Import `EXTENSION_TO_LANGUAGE`, xóa local `SUPPORTED_EXTENSIONS` |
| `project-graph-manager.js` | Import `SOURCE_EXTENSIONS`, xóa local constant |
| `file-watcher.js` | Import `SOURCE_EXTENSIONS`, xóa local constant |
| `heuristic-lsp.js` | Import `SOURCE_EXTENSIONS`, xóa local constant |
| `import-graph-builder.js` | Import `SOURCE_EXTENSIONS` nếu cần filter |

Việc này giải quyết đồng thời G01 (shared constant), G02-G04 (thêm `.cts`/`.mts`),
và G05 (inconsistency giữa heuristic LSP và tree-sitter).

### 2.2. Thêm error logging cho Phase 3 indexing (G06)

Trong `project-graph-manager.js`, thay bare `catch {}` tại line 183:

```js
} catch (err) {
  this._phase3Errors = (this._phase3Errors ?? 0) + 1;
  if (this._phase3Errors <= 5) {
    console.warn(`[ProjectGraphManager] reference/call tracking failed for ${absPath}: ${err.message}`);
  }
}
```

Expose `phase3Errors` trong `describe()` và `getGraphSummary()`.

### 2.3. Kích hoạt FileWatcher hoặc xóa sạch (G11)

Hai lựa chọn:

**Lựa chọn A (khuyến nghị) — Kích hoạt trong create-managers:**
- Import `FileWatcher` trong `create-managers.js`.
- Tạo instance khi `projectGraphManager.available === true`.
- Start sau khi initial index xong.
- Thêm vào `disposeManagers()`.

**Lựa chọn B — Xóa sạch:**
- Xóa `file-watcher.js` và test tương ứng.
- Ghi ADR giải thích tại sao chưa cần.

### 2.4. Kiểm chứng

```
node --test tests/runtime/*.test.js
```

Thêm test mới:
- `tests/runtime/source-extensions.test.js` — verify `.cts`/`.mts` có trong cả
  `SOURCE_EXTENSIONS` và `EXTENSION_TO_LANGUAGE`.
- Thêm test case cho `.cts` file trong `import-graph-builder.test.js`.
- Thêm test case verify `phase3Errors` counter hoạt động.

**Lỗ hổng đã vá sau phase này:** G01, G02, G03, G04, G05, G06, G11

---

## 3. Phase 2 — Nâng chất lượng index pipeline (parse, call graph, references)

**Vá:** G07, G08, G09, G10
**Ước tính:** trung bình, cần cẩn thận vì chạm vào core indexing path

### 3.1. Tránh parse tree 2 lần (G07)

`buildFileGraph()` hiện parse nội bộ và không return tree. Thay đổi:

1. Sửa `buildFileGraph()` trong `import-graph-builder.js` để trả thêm `{ tree, source }` 
   trong kết quả.
2. Trong `project-graph-manager.js indexFile()`, dùng `graphData.tree` thay vì gọi
   `syntaxIndexManager.readFile()` lần thứ hai tại line 157.

Lưu ý: tree object là tham chiếu tới WASM memory — cần verify rằng object vẫn
valid sau khi `db.indexFile()` đã chạy (không có lý do nào khiến nó invalid,
nhưng test phải confirm).

### 3.2. Call graph: resolve callee tới symbol ID (G08)

Trong `call-graph-builder.js`:

1. Sau khi resolve `calleeNodeId` (line 144), thêm bước lookup symbol:
   ```js
   let calleeSymbolId = null;
   if (calleeNodeId) {
     const candidates = db.getSymbolsByNode(calleeNodeId);
     const match = candidates.find(s => s.name === calleeName && s.is_export);
     calleeSymbolId = match?.id ?? null;
   }
   ```
2. Thêm `calleeSymbolId` vào return value.
3. Cập nhật `call_graph` table schema: thêm column `callee_symbol_id INTEGER`
   (nullable, migration-safe vì SQLite cho phép `ALTER TABLE ADD COLUMN`).
4. Cập nhật `replaceCallsForNode()` và `getCallsFrom()`/`getCallsTo()` trong
   `project-graph-db.js`.

### 3.3. Mở rộng caller coverage (G09)

Trong `call-graph-builder.js`:

1. Bỏ filter `kind === 'function' || kind === 'method'` tại line 43.
2. Thay bằng: bao gồm cả `'variable'` khi symbol có `signature` chứa `=>` hoặc
   `function` (arrow fn / function expression gán vào biến).
3. Thêm handling cho constructor: khi `kind === 'class'`, tìm `constructor` method
   trong body và extract calls từ đó.
4. Thêm module-level calls: scan top-level `call_expression` nodes không nằm trong
   bất kỳ function/class nào, gán caller = `null` (module-level caller).

### 3.4. Cải thiện reference tracker scope awareness (G10)

Mức cải thiện thực tế (không cần type checker):

1. Build scope stack khi walk AST: mỗi khi gặp `function_declaration`,
   `arrow_function`, `class_body`, `block` (có `let`/`const`), push scope mới.
2. Track local declarations per scope (parameter names, let/const/var bindings).
3. Khi gặp identifier, check scope stack từ trong ra ngoài — nếu tìm thấy local
   declaration thì skip, không record cross-file reference.

Đây không phải type-aware đầy đủ nhưng loại bỏ phần lớn false positives từ
local variable shadow.

### 3.5. Kiểm chứng

```
node --test tests/runtime/graph-db.test.js
node --test tests/runtime/project-graph-manager.test.js
node --test tests/runtime/graph-navigation-tools.test.js
node --test tests/runtime/import-graph-builder.test.js
node --test tests/runtime/reference-tracker.test.js
```

Thêm test mới:
- Test verify tree không parse lại (mock `readFile` call count).
- Test call graph với arrow function caller.
- Test call graph với module-level call.
- Test callee symbol ID resolution.
- Test reference tracker không tạo false positive cho local variable shadow.

**Lỗ hổng đã vá sau phase này:** G07, G08, G09, G10

### 3.6. Trạng thái triển khai thực tế (2026-04-03)

Đã hoàn thành trong codebase hiện tại:

1. `buildFileGraph()` trả thêm `tree` và `source`.
2. `ProjectGraphManager.indexFile()` dùng `graphData.tree`/`graphData.source`,
   bỏ re-parse lần hai.
3. `call_graph` schema thêm `callee_symbol_id` + migration SQLite an toàn.
4. `buildCallGraph()`:
   - mở rộng caller coverage cho function/method/class-constructor/variable-callable
   - resolve `callee_symbol_id` từ symbols export của imported target file
5. `trackReferences()` thêm lexical-scope stack để chặn false positives do shadowing.
6. Bổ sung test:
   - `indexFile` parse-once assertion
   - constructor + variable caller coverage
   - callee symbol id resolution
   - shadowed-import reference suppression

Lưu ý thực thi:
- Mục module-level caller ban đầu của Phase 2 đã được rút lại để giữ tương thích
  schema hiện tại (`caller_symbol_id` NOT NULL). Nội dung này sẽ được xử lý ở
  phase sau nếu mở rộng schema sang caller nullable hoặc module pseudo-symbol.

---

## 4. Phase 3 — Mở rộng ngôn ngữ

**Vá:** G16, G17
**Ước tính:** lớn, nhưng isolated — thêm parser mới không chạm logic cũ

### 4.1. Kiến trúc mở rộng ngôn ngữ

Hiện tại `import-graph-builder.js` chứa logic extract cứng cho JS/TS. Để mở
rộng mà không phá vỡ, cần tách thành kiến trúc pluggable:

```
src/runtime/analysis/
  source-extensions.js          ← shared constants (Phase 1)
  language-support/
    index.js                    ← registry: extension → language handler
    javascript-handler.js       ← tách logic JS/TS hiện tại ra đây
    python-handler.js           ← mới
    go-handler.js               ← mới (nếu cần)
    css-handler.js              ← mới (minimal)
    config-handler.js           ← JSON/YAML/TOML (minimal)
```

Mỗi handler export cùng interface:

```js
{
  languageId: string,
  extensions: string[],
  grammarPackage: string | null,
  extractImports(tree, source, filePath): Import[],
  extractSymbols(tree, source, filePath): Symbol[],
  extractExports(tree, source, filePath): Export[],
  resolveSpecifier(specifier, fromFile, projectRoot): string | null,
}
```

`import-graph-builder.js` gọi `getHandler(extension)` thay vì hardcode logic.

### 4.2. Python handler

**Tree-sitter grammar:** `tree-sitter-python` (WASM, tương tự JS/TS).

Cần extract:
- `import X` / `from X import Y` → imports
- `def`, `class`, `async def` → symbols
- `__all__` → exports (nếu có)
- Module resolution: tương đối (`from . import`), absolute (`import os`)

Không cần:
- Type inference
- Virtual env resolution (chỉ record specifier, không resolve tới file system
  trừ relative imports)

### 4.3. Go handler (optional, lower priority)

**Tree-sitter grammar:** `tree-sitter-go` (WASM).

Cần extract:
- `import "path"` / `import (...)` → imports
- `func`, `type`, `var`, `const` → symbols
- Exported = tên viết hoa (Go convention)

### 4.4. CSS/HTML/config handlers (minimal)

Không cần full parse — chỉ cần:
- **CSS:** extract selectors, `@import` statements.
- **HTML:** extract `<script src>`, `<link href>`.
- **YAML/TOML:** key extraction (tương tự `ast-search` cho JSON).
- **Markdown:** heading extraction, link references.

Đây là "awareness" level, không phải "understanding" level. Đủ để semantic
search index được nội dung, dù không có dependency graph.

### 4.5. Cập nhật syntax-index-manager

Thêm grammar loading:

```js
import pythonWasmPath from 'tree-sitter-python/tree-sitter-python.wasm';
// tương tự cho Go nếu thêm
```

Mở rộng `EXTENSION_TO_LANGUAGE` (từ shared constants) và `getLanguageInstance()`.

### 4.6. Kiểm chứng

- Thêm test fixtures: 1 file Python nhỏ, 1 file Go nhỏ.
- Test `buildFileGraph()` trả đúng imports/symbols cho Python.
- Test `syntax-outline` hoạt động cho Python file.
- Test `find-symbol` tìm được Python function.
- Test regression: tất cả JS/TS test cũ vẫn pass.

**Lỗ hổng đã vá sau phase này:** G16, G17

### 4.7. Trạng thái triển khai thực tế (2026-04-03)

Đã hoàn thành trong codebase hiện tại:

1. Tạo lightweight language-support layer tại:
   - `src/runtime/analysis/language-support/index.js`
   - `python-handler.js`, `go-handler.js`, `css-handler.js`, `html-handler.js`,
     `markdown-handler.js`, `config-handler.js`
2. Mở rộng source extension model:
   - parser JS/TS set
   - lightweight set cho `.py/.go/.css/.html/.md/.markdown/.yaml/.yml/.toml`
3. `buildFileGraph()` hỗ trợ 2 đường:
   - JS/TS parse bằng tree-sitter
   - non-JS/TS lightweight extraction (không cần parser)
4. Giữ tương thích với LSP/file watcher:
   - heuristic LSP giữ scope JS/TS family
   - file watcher giữ scope JS/TS family để không thay đổi hành vi ngoài ý muốn
5. Thêm test:
   - `tests/runtime/language-support.test.js`
   - mở rộng `tests/runtime/import-graph-builder.test.js`
   - cập nhật `tests/runtime/source-extensions.test.js`

Lưu ý thực thi:
- Phase này dùng lightweight parsing cho non-JS/TS thay vì tree-sitter grammar
  đầy đủ để đảm bảo rollout an toàn, deterministic, và không làm vỡ stack hiện tại.
- Nếu cần nâng độ chính xác, có thể nâng cấp từng handler sang tree-sitter thật
  ở phase kế tiếp mà không phá vỡ API hiện tại.

---

## 5. Phase 4 — MCP dispatch thực

**Vá:** G12, G13, G14, G15
**Ước tính:** trung bình-lớn, cần thiết kế MCP execution contract

### 5.1. Thiết kế MCP execution contract

Hiện tại MCP entry chỉ là `{ id, name, transport, status }`. Cần thêm:

```js
{
  id: 'mcp.code-search',
  name: 'code-search',
  transport: 'builtin',
  status: 'active',
  async execute(input) {
    // actual implementation
    return { results: [...] };
  },
}
```

### 5.2. Sửa dispatch.js

```js
export async function dispatchMcpCall(mcpPlatform, mcpName, input = {}) {
  // 1. Tìm builtin
  const builtin = mcpPlatform.builtin.find(e => e.name === mcpName || e.id === mcpName);

  // 2. Nếu không phải builtin, tìm external server
  if (!builtin) {
    const external = mcpPlatform.loadedServers?.find(s => s.name === mcpName);
    if (external) {
      return await invokeExternalMcp(external, input);
    }
    return { status: 'unknown-mcp', available: [...] };
  }

  // 3. Nếu builtin có execute, gọi nó
  if (typeof builtin.execute === 'function') {
    return await builtin.execute(input);
  }

  // 4. Fallback: stub response
  return { status: 'not-implemented', mcp: mcpName };
}
```

### 5.3. Implement builtin MCPs

**`mcp.code-search` — ưu tiên cao nhất:**

Delegate tới `tool.semantic-search` hoặc trực tiếp tới
`sessionMemoryManager.semanticSearchQuery()`. Đây là wrapper layer giúp
external agent/tool gọi semantic search qua MCP protocol.

```js
export function createCodeSearchMcp({ sessionMemoryManager }) {
  return {
    id: 'mcp.code-search',
    name: 'code-search',
    transport: 'builtin',
    status: sessionMemoryManager?.available ? 'active' : 'degraded',
    async execute({ query, topK = 10, minScore = 0.1 }) {
      if (!sessionMemoryManager?.available) {
        return { status: 'unavailable', reason: 'session memory not available' };
      }
      const results = await sessionMemoryManager.semanticSearchQuery(query, { topK, minScore });
      return { status: 'ok', results };
    },
  };
}
```

**`mcp.docs-search`:**

Delegate tới external documentation search. Hai con đường:
- Nếu user có MCP server bên ngoài (vd: Context7, Mintlify), dispatch tới đó.
- Nếu không, return degraded.

Không nên hardcode bất kỳ external API nào vào builtin. Thay vào đó:

```js
export function createDocsSearchMcp({ mcpPlatform }) {
  return {
    id: 'mcp.docs-search',
    name: 'docs-search',
    transport: 'builtin',
    status: 'degraded',
    async execute({ query }) {
      // Attempt to delegate to configured external docs-search server
      const external = mcpPlatform.loadedServers?.find(
        s => s.capabilities?.includes('docs-search')
      );
      if (external) {
        return await invokeExternalMcp(external, { query });
      }
      return { status: 'no-provider', hint: 'Configure a docs-search MCP server in .mcp.json' };
    },
  };
}
```

**`mcp.websearch`:** Tương tự docs-search — delegate tới external hoặc degraded.

### 5.4. External MCP invocation

Implement `invokeExternalMcp(server, input)`:

- Dùng stdio transport: spawn child process, giao tiếp qua JSON-RPC.
- Dùng HTTP transport: POST tới server URL.
- Trả về response hoặc error với timeout.

Tham chiếu: MCP protocol specification (https://modelcontextprotocol.io).

### 5.5. Enrich specialists (G15)

Thay vì thêm logic vào specialist stubs, tạo system prompt templates:

```
src/runtime/specialists/
  prompts/
    oracle-system-prompt.md
    librarian-system-prompt.md
    explore-system-prompt.md
    ...
```

Mỗi specialist entry thêm:

```js
{
  ...existing,
  systemPromptPath: 'prompts/oracle-system-prompt.md',
  tools: ['tool.semantic-search', 'tool.graph-call-hierarchy', ...],
}
```

Delegation supervisor đọc `systemPromptPath` khi launch specialist. Specialist
có quyền gọi tools trong `tools` list.

### 5.6. Kiểm chứng

- Test `dispatchMcpCall()` thực sự invoke `execute()` trên builtin.
- Test `mcp.code-search` trả kết quả thật từ mock-embedded project.
- Test external MCP dispatch với mock stdio server.
- Test specialist có `systemPromptPath` và `tools` list.
- Test regression: `tool.mcp-dispatch` vẫn hoạt động.

**Lỗ hổng đã vá sau phase này:** G12, G13, G14, G15

---

## 6. Phase 5 — Cải thiện retrieval (vector search, type awareness)

**Vá:** G18, G19
**Ước tính:** trung bình, nhưng cần benchmark

### 6.1. Cải thiện vector search performance (G19)

**Bước 1 — SQLite FTS5 cho keyword search:**

Thêm FTS5 virtual table:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
  chunk_text,
  content='embeddings',
  content_rowid='rowid'
);
```

Keyword search qua FTS5 thay vì in-memory scan.

**Bước 2 — Batch cosine với typed arrays:**

Thay brute-force loop bằng batch cosine computation:
- Load tất cả embeddings thành single Float32Array buffer.
- Compute cosine similarity bằng SIMD-friendly loop.
- Sort top-K bằng partial sort (heap).

Ước tính: tăng tốc 5-10x cho 10k+ chunks, đủ dùng tới 50k chunks.

**Bước 3 (deferred) — HNSW index:**

Nếu bước 2 không đủ nhanh cho project >50k chunks, thêm HNSW via
`hnswlib-node` hoặc `usearch`. Defer tới khi có benchmark thực.

### 6.2. Cải thiện type awareness (G18)

**Mức thực tế (không cần TypeScript compiler API):**

1. **Import-scoped resolution:** Khi rename/find-references cho symbol `foo`,
   chỉ match references trong files mà import `foo` từ cùng source file.
   Không match `foo` ở file không import nó (trừ khi cùng file).

2. **Scope-qualified symbols:** Trong `findReferences()`, return kèm scope
   path: `{ symbol: 'foo', scope: 'UserService.constructor', file: '...' }`.
   Agent dùng scope để phân biệt cùng tên ở khác scope.

3. **Export graph filtering:** `graph-rename-preview` chỉ include files
   reachable qua import graph từ file gốc, không scan toàn project.

Đây không phải full type-aware nhưng loại bỏ 80% false positives cho rename
và find-references.

### 6.3. Kiểm chứng

- Benchmark: index 1000-file fixture, measure search latency before/after FTS5.
- Test FTS5 keyword results match cũ (hoặc tốt hơn).
- Test import-scoped resolution: rename `foo` không ảnh hưởng file không import nó.
- Test regression: hybrid scoring formula không đổi.

**Lỗ hổng đã vá sau phase này:** G18, G19

---

## 7. Phase 6 — Tích hợp external tooling

**Vá:** G20
**Ước tính:** trung bình, phụ thuộc project context

### 7.1. External tool runner framework

Tạo `src/runtime/tools/external/tool-runner.js`:

```js
export function createExternalToolRunner({ projectRoot, env }) {
  return {
    async run(command, args, { timeout = 30000, cwd } = {}) {
      // spawn child process
      // capture stdout/stderr
      // return { exitCode, stdout, stderr, timedOut }
    },
  };
}
```

### 7.2. TypeScript type checker tool

```js
// tool.typecheck
{
  id: 'tool.typecheck',
  family: 'external',
  execute({ filePath, project }) {
    // Run: npx tsc --noEmit --project <tsconfig>
    // Parse output into structured diagnostics
    // Return: { diagnostics: [{ file, line, code, message, severity }] }
  },
}
```

Gated: chỉ active khi `tsconfig.json` tồn tại trong `projectRoot`.

### 7.3. Linter tool

```js
// tool.lint
{
  id: 'tool.lint',
  family: 'external',
  execute({ filePath, fix }) {
    // Detect eslint/biome/prettier config
    // Run appropriate linter
    // Return: { findings: [...], fixable: n }
  },
}
```

Gated: chỉ active khi phát hiện config file (`.eslintrc`, `biome.json`, v.v.).

### 7.4. Test runner tool

```js
// tool.test-run
{
  id: 'tool.test-run',
  family: 'external',
  execute({ testFile, testName, framework }) {
    // Auto-detect: vitest, jest, node:test, pytest, go test
    // Run single test or file
    // Return: { passed, failed, output }
  },
}
```

Gated: chỉ active khi phát hiện test config hoặc test files.

### 7.5. Kiểm chứng

- Test tool runner với mock command.
- Test each external tool returns degraded khi config không tồn tại.
- Test typecheck tool parses `tsc` output correctly.

**Lỗ hổng đã vá sau phase này:** G20

---

## 8. Tổng kết — Checklist toàn cục

| Phase | Lỗ hổng vá | Rủi ro | Ưu tiên |
|---|---|---|---|
| **Phase 1** | G01, G02, G03, G04, G05, G06, G11 | thấp | **làm ngay** |
| **Phase 2** | G07, G08, G09, G10 | trung bình | **làm ngay sau Phase 1** |
| **Phase 3** | G16, G17 | trung bình (isolated) | cao — mở rộng coverage lớn nhất |
| **Phase 4** | G12, G13, G14, G15 | trung bình-cao | cao — MCP layer hiện không hoạt động |
| **Phase 5** | G18, G19 | trung bình | trung bình — cải thiện chất lượng |
| **Phase 6** | G20 | thấp (gated) | thấp — phụ thuộc project context |

### Tiến độ tracking

Khi bắt đầu mỗi phase, cập nhật bảng dưới:

| Phase | Trạng thái | Commit | Ngày |
|---|---|---|---|
| Phase 1 | `hoàn thành` | — | 2026-04-03 |
| Phase 2 | `hoàn thành` | — | 2026-04-03 |
| Phase 3 | `hoàn thành` | — | 2026-04-03 |
| Phase 4 | `hoàn thành` | — | 2026-04-03 |
| Phase 5 | `hoàn thành` | — | 2026-04-03 |
| Phase 6 | `hoàn thành` | — | 2026-04-03 |

### 6.4. Trạng thái triển khai thực tế (2026-04-03)

Đã hoàn thành trong codebase hiện tại:

1. Retrieval performance (G19):
   - thêm `chunk_text` vào bảng `embeddings`
   - thêm FTS5 table `embeddings_fts` + trigger sync `INSERT/UPDATE/DELETE`
   - thêm API `searchEmbeddingsKeyword()` trong `ProjectGraphDb` (FTS-first,
     fallback `LIKE` nếu FTS unavailable hoặc query malformed)
2. Embedding pipeline cập nhật để lưu `chunkText` cùng mỗi embedding record,
   bao gồm cả nhánh reuse chunk hash.
3. Vector search trong `SessionMemoryManager.semanticSearch()` chuyển từ gọi
   cosine theo từng row sang pass typed-array matrix + precomputed norms,
   giảm overhead cho tập embedding lớn hơn.
4. Type-awareness thực dụng (G18) cho rename/references:
   - `findReferences()` thêm import-graph scoped filtering (định nghĩa + files
     reachable qua dependents), giảm false positives cùng tên ở vùng không liên quan
   - output thêm `scope`, `scopeFiltered: true`, `importScoped: true`
   - `rename-preview` áp dụng cùng filtering/import reachability và trả cùng flags
   - LSP graph-backed wrappers propagate `scopeFiltered` + `importScoped`
5. Bổ sung test coverage cho:
   - embedding keyword search path (`searchEmbeddingsKeyword`, `semanticKeywordSearch`)
   - reference/rename scoped flags trong graph + LSP integration tests
6. Kiểm chứng regression:
   - toàn bộ runtime test suite pass (`node --test tests/runtime/*.test.js`).

Lưu ý thực thi:
- FTS5 được tích hợp theo hướng best-effort; nếu SQLite build không có FTS5,
  runtime tự degrade sang fallback `LIKE` mà không làm vỡ public tool surface.
- Import-scoped filtering là type-awareness mức practical (không TypeScript compiler API),
  tập trung giảm false positives mà vẫn giữ tương thích contract hiện có.

### 7.6. Trạng thái triển khai thực tế (2026-04-03)

Đã hoàn thành trong codebase hiện tại:

1. External tool runner framework (`src/runtime/tools/external/tool-runner.js`):
   - `createExternalToolRunner({ projectRoot, env })` trả về `{ run }` wrapper
   - `run(command, args, { timeout, cwd, extraEnv })` spawn child process với:
     - timeout + SIGTERM/SIGKILL grace period
     - `node_modules/.bin` prepended to PATH (project-local binaries found first)
     - structured return `{ exitCode, stdout, stderr, timedOut }`
   - Handles ENOENT (missing command), timeout, and error edge cases gracefully

2. TypeScript type checker tool (`tool.typecheck`, `src/runtime/tools/external/typecheck.js`):
   - Gated: active chỉ khi `tsconfig.json` hoặc `tsconfig.build.json` tồn tại
   - Detect project-local `tsc` binary, fallback to `npx tsc`
   - Parse tsc output thành structured diagnostics: `{ file, line, column, severity, code, message }`
   - Hỗ trợ file-scoped filtering khi `filePath` provided
   - Returns `ok`, `errors`, `timeout`, hoặc `unavailable`

3. Lint tool (`tool.lint`, `src/runtime/tools/external/lint.js`):
   - Gated: active khi ESLint config hoặc Biome config detected
   - ESLint detection: `.eslintrc*`, `eslint.config.*`, `eslintConfig` in package.json
   - Biome detection: `biome.json`, `biome.jsonc`
   - Detect project-local binary, fallback to `npx`
   - ESLint: `--format json` output parsing thành `{ file, line, column, severity, ruleId, message, fixable }`
   - Biome: `--reporter json` output parsing
   - Hỗ trợ `fix: true` cho auto-fix mode
   - Returns `ok`, `findings`, `timeout`, hoặc `unavailable`

4. Test runner tool (`tool.test-run`, `src/runtime/tools/external/test-run.js`):
   - Auto-detect framework: vitest, jest, node:test, pytest, go test
   - Detection order: config files → package.json deps → package.json scripts
   - Framework-specific argument building (non-watch mode, JSON reporters where available)
   - Output parsers: jest/vitest JSON, node:test TAP + info-line format, pytest summary, go test output
   - Hỗ trợ `testFile` và `testName` cho single-test execution
   - Returns `ok`, `failures`, `timeout`, hoặc `unavailable`

5. Tool registration:
   - External tools registered in `createToolRegistry()` via `createExternalTools()` helper
   - Each tool wrapped by `wrapToolExecution()` (guard hooks, action tracking, invocation logging)
   - Tools self-gate via project config detection — unused tools return `unavailable` without side effects

6. Test coverage:
   - `tests/runtime/external-tools.test.js` — 44 tests covering:
     - tool-runner: spawn, stderr, exit code, timeout, missing command, PATH prepend
     - typecheck: tsc line parsing, multi-line output, tsconfig detection, status gating
     - lint: config detection (eslint/biome/package.json), output parsing, status gating
     - test-run: framework detection, output parsers (jest/node-test/pytest/go), status gating
     - integration: real child process execution, nested node:test behavior

7. Kiểm chứng regression:
   - toàn bộ runtime test suite pass (`node --test tests/runtime/*.test.js`): 385 passed, 0 failed.

Lưu ý thực thi:
- External tools dùng child process spawn thay vì in-process execution để isolation và timeout safety.
- Project-local `node_modules/.bin` được prepend vào PATH tự động, ưu tiên project-installed binaries.
- Mỗi tool parser chỉ hỗ trợ output format phổ biến nhất; edge cases (custom reporter, non-standard locale) có thể cần mở rộng parser sau.
- Nested `node --test` runners có edge case khi output bị parent test runner consume — documented trong test.

### 5.7. Trạng thái triển khai thực tế (2026-04-03)

Đã hoàn thành trong codebase hiện tại:

1. MCP dispatch chuyển sang thực thi thật (`async`) trong `src/runtime/mcp/dispatch.js`:
   - invoke builtin `execute()` thực sự
   - honor runtime-config builtin enable/disable
   - fallback sang external MCP nếu không có builtin phù hợp
   - hỗ trợ external transport `http` và `stdio` với timeout + structured error
2. Builtin MCPs được nâng từ metadata-only sang executable:
   - `mcp.code-search` dùng `SessionMemoryManager.semanticSearchQuery()`
   - `mcp.docs-search` delegate theo capability `docs-search` nếu có external provider
   - `mcp.websearch` delegate theo capability `websearch` nếu có external provider
3. `createMcpPlatform()` nhận `sessionMemoryManager` từ bootstrap runtime,
   chuẩn hóa external server config và ánh xạ builtin IDs/aliases ổn định.
4. Specialists được enrich:
   - thêm `systemPromptPath`
   - thêm `tools` allowlist
   - registry hydrate `systemPrompt` text từ `src/runtime/specialists/prompts/`
5. Bổ sung test coverage:
   - `tests/runtime/mcp-dispatch.test.js`
   - cập nhật `tests/runtime/runtime-platform.test.js`
6. Kiểm chứng regression:
   - toàn bộ runtime test suite pass (`node --test tests/runtime/*.test.js`).

Lưu ý thực thi:
- External MCP hiện dùng contract invoke thực dụng (HTTP JSON POST hoặc single-shot stdio)
  thay vì full MCP JSON-RPC session lifecycle để giữ rollout an toàn và không làm vỡ
  surface hiện tại; có thể nâng cấp protocol fidelity ở phase sau mà không đổi tool ID.

---

## 9. Rủi ro và mitigation

| Rủi ro | Mitigation |
|---|---|
| Thêm grammar mới gây tăng WASM bundle size | Lazy-load grammar chỉ khi gặp file extension tương ứng |
| External MCP invocation gây timeout/crash | Timeout + error boundary cho mỗi MCP call |
| Call graph mở rộng gây index chậm | Benchmark trước và sau mỗi thay đổi; index là background task |
| FTS5 migration trên DB cũ | Migration script thêm FTS table, không xóa gì |
| Type awareness gây breaking change cho rename results | Thêm flag `scopeFiltered: true` trong output, giữ old behavior mặc định |
| `.cts`/`.mts` tree-sitter parse khác TypeScript chuẩn | Dùng cùng grammar `tree-sitter-typescript` — `.cts`/`.mts` chỉ là extension khác |

---

## 10. Files sẽ tạo mới (dự kiến)

```
src/runtime/analysis/source-extensions.js
src/runtime/analysis/language-support/index.js
src/runtime/analysis/language-support/javascript-handler.js
src/runtime/analysis/language-support/python-handler.js
src/runtime/analysis/language-support/go-handler.js          (optional)
src/runtime/analysis/language-support/css-handler.js          (minimal)
src/runtime/analysis/language-support/config-handler.js       (minimal)
src/runtime/specialists/prompts/oracle-system-prompt.md
src/runtime/specialists/prompts/librarian-system-prompt.md
src/runtime/specialists/prompts/explore-system-prompt.md
src/runtime/specialists/prompts/multimodal-looker-system-prompt.md
src/runtime/specialists/prompts/metis-system-prompt.md
src/runtime/specialists/prompts/momus-system-prompt.md
src/runtime/tools/external/tool-runner.js
src/runtime/tools/external/typecheck.js
src/runtime/tools/external/lint.js
src/runtime/tools/external/test-run.js
tests/runtime/source-extensions.test.js
tests/runtime/language-support.test.js
tests/runtime/mcp-dispatch.test.js
tests/runtime/external-tools.test.js
```

## 11. Files sẽ sửa (dự kiến)

```
src/runtime/analysis/import-graph-builder.js         — return tree, delegate to handler
src/runtime/analysis/call-graph-builder.js            — expand caller kinds, resolve callee symbol
src/runtime/analysis/reference-tracker.js             — scope stack
src/runtime/analysis/project-graph-db.js              — schema migration, FTS5, callee_symbol_id
src/runtime/managers/project-graph-manager.js         — error logging, reuse tree, SOURCE_EXTENSIONS
src/runtime/managers/syntax-index-manager.js          — shared constants, new grammars
src/runtime/managers/session-memory-manager.js        — batch cosine, FTS5 keyword
src/runtime/analysis/file-watcher.js                  — shared constants (or delete)
src/runtime/mcp/dispatch.js                           — real invocation
src/runtime/mcp/websearch.js                          — execute method
src/runtime/mcp/docs-search.js                        — execute method
src/runtime/mcp/code-search.js                        — execute method
src/runtime/mcp/builtin-mcps.js                       — inject dependencies
src/runtime/specialists/*.js                          — add systemPromptPath, tools
src/runtime/specialists/specialist-registry.js        — load prompts
src/runtime/tools/tool-registry.js                    — register new external tools
src/runtime/tools/lsp/heuristic-lsp.js                — shared constants
src/runtime/create-managers.js                        — FileWatcher wiring
src/runtime/create-tools.js                           — register external tools
docs/kit-internals/03-runtime-capabilities-and-managers.md  — update
docs/kit-internals/04-tools-hooks-skills-and-mcps.md        — update
docs/kit-internals/05-semantic-search-and-code-intelligence.md — update
docs/kit-internals/09-dataflow-and-diagrams.md              — update
```
