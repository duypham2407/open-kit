# Semantic Search And Code Intelligence

This document explains the code-intelligence stack in OpenKit, from parsing and
graph indexing through semantic search and embedding-based retrieval.

## 1. Why This Layer Exists

OpenKit increasingly relies on code-aware tooling rather than plain text search.
The code-intelligence stack supports:

- syntax-aware inspection
- import and dependency tracing
- symbol lookup
- references and call hierarchy
- semantic search over indexed code chunks

## 2. Main Components

### Syntax parsing

Primary runtime surface:
- `SyntaxIndexManager`

Purpose:
- tree-sitter parsing
- outline and context extraction
- foundational CST access for later analysis

Current extension coverage:
- `.js`, `.jsx`, `.cjs`, `.mjs`, `.ts`, `.tsx`, `.cts`, `.mts`

Lightweight extraction coverage (non-tree-sitter, regex/heuristic handlers):
- Python: `.py`
- Go: `.go`
- CSS: `.css`
- HTML: `.html`
- Markdown: `.md`, `.markdown`
- Config: `.yaml`, `.yml`, `.toml`

Lightweight handlers are in:
- `src/runtime/analysis/language-support/`

Shared source-extension constants are centralized in:
- `src/runtime/analysis/source-extensions.js`

### Project graph

Primary runtime surfaces:
- `ProjectGraphDb`
- `ProjectGraphManager`

Purpose:
- persist file nodes, edges, symbols, references, calls, embeddings, and session touches
- serve graph queries to graph tools and semantic search

Phase-2 indexing behavior:
- `indexFile()` reuses the parsed tree returned by `buildFileGraph()`
- reference/call indexing errors are surfaced through `phase3Errors` diagnostics

### Chunk extraction

Primary runtime surface:
- `src/runtime/analysis/code-chunk-extractor.js`

Current behavior:
- chunk by top-level symbol
- split oversized symbols into deterministic subchunks
- fall back to module chunk when symbol ranges are unavailable

### Embedding pipeline

Primary runtime surfaces:
- `EmbeddingIndexer`
- `embedding-provider.js`

Provider types:
- OpenAI-compatible
- Ollama
- custom OpenAI-compatible endpoint
- mock deterministic provider for tests
- no-op provider

Current enrichment includes:
- file path
- symbol name and kind
- parent symbol
- scope
- export signal
- line range
- split/part metadata
- estimated token count
- doc comment
- import summary
- raw code chunk

### Retrieval

Primary runtime surfaces:
- `SessionMemoryManager`
- `tool.semantic-search`

Current behavior:
- embedding search when provider and vectors are available
- keyword search when embeddings are unavailable
- hybrid merge when both vector and keyword results are available

Phase-5 retrieval updates:
- embeddings now persist `chunk_text` to support DB-local keyword retrieval
- SQLite FTS5 virtual table (`embeddings_fts`) is created when available, with triggers
  that keep keyword index synchronized with `embeddings`
- keyword retrieval in `tool.semantic-search` now prefers embedding-backed keyword
  search via `SessionMemoryManager.semanticKeywordSearch()` and degrades to symbol
  keyword matching when no embedding keyword rows exist
- vector retrieval path was updated from row-by-row cosine calls to a batched
  typed-array matrix pass for better throughput on larger embedding sets

## 3. Current Storage Model

Embeddings are stored in the project graph SQLite DB.

Important embedding fields now include:

- `chunk_id`
- `chunk_hash`
- `metadata_json`
- `embedding`
- `model`
- `created`

This keeps semantic search local-first and aligned with the project graph, without introducing an external vector DB.

## 4. Incrementality

Current incremental behavior includes:

- file indexing via `ProjectGraphManager.indexFile()`
- best-effort post-index callback wiring
- auto-embedding after file indexing when the embedding indexer is active
- chunk-level reuse using `chunk_hash` for unchanged chunks

This means unchanged chunks can now be preserved without re-embedding every time.

## 5. Search Modes

`tool.semantic-search` can currently return:

- `keyword`
- `embedding`
- `hybrid`

### Keyword mode

Used when embeddings are not available or not indexed.

Strengths:
- cheap
- predictable
- no extra model dependency

### Embedding mode

Used when vectors exist and keyword results are not being merged.

Strengths:
- better meaning-based retrieval

### Hybrid mode

Used when both vector and keyword results are available.

Current merge behavior includes:
- normalized vector score
- keyword score
- lightweight rerank boosts
- bounded graph-based result context

## 6. Context Expansion

Result context can currently include:

- dependencies
- dependents
- same-file symbols
- incoming and outgoing call hierarchy

This makes semantic search results more useful to agents than plain nearest-neighbor vector hits.

## 7. Related Tooling Surfaces

The semantic-search stack is closely related to:

- syntax tools
- AST tools
- graph tools
- LSP-style graph navigation tools
- embedding index operator tool

Useful tools in this area include:

- `tool.syntax-outline`
- `tool.syntax-context`
- `tool.ast-search`
- `tool.import-graph`
- `tool.find-dependencies`
- `tool.find-dependents`
- `tool.find-symbol`
- `tool.graph-goto-definition`
- `tool.graph-find-references`
- `tool.graph-call-hierarchy`
- `tool.graph-rename-preview`
- `tool.embedding-index`
- `tool.semantic-search`

## 8. What Is Intentionally Deferred

These are not baseline runtime requirements today:

- mandatory LLM query rewrite
- mandatory LLM-generated descriptions
- mandatory LLM reranking
- external vector databases as the default store

This keeps the current implementation practical, testable, and aligned with the kit's local-first design.

## 9. Maintainer Takeaway

The current code-intelligence system should be understood as a layered stack:

```text
tree-sitter parsing
  -> project graph and symbol extraction
  -> references and call graph
  -> chunk extraction and enrichment
  -> embedding generation and storage
  -> vector / keyword / hybrid retrieval
  -> graph-expanded result context
```

### Phase-2 call/reference accuracy updates

- call graph now tracks callers for:
  - functions
  - methods
  - function-assigned variables (arrow/function expressions)
  - class constructors (calls attributed to class symbol)
- call records include optional `callee_symbol_id` (when a callee symbol can be
  resolved from imported target file exports)
- reference tracking includes lightweight lexical scope tracking to reduce
  false positives from local shadowing

### Phase-5 rename/reference precision updates

- graph reference responses now include:
  - `scope` metadata for definitions/references
  - `scopeFiltered: true`
  - `importScoped: true`
- references are filtered to import-reachable files (definition files + dependent graph)
  to reduce same-name false positives across unrelated files
- rename preview now applies the same import-scoped filtering and returns the same flags

That stack is now one of the most important long-term foundations in OpenKit.
