# Dataflow And Diagrams

This page shows the two primary data flows in the code intelligence stack —
indexing and querying — with pointers to the functions that implement each step.

## 1. Indexing Flow

When a file is indexed, data flows through four layers: parse, graph store,
chunk extraction, and embedding storage.

```
                          indexFile(filePath)
                          ProjectGraphManager
                          managers/project-graph-manager.js
                                  |
                    +-------------+-------------+
                    |                           |
              [mtime check]              [file deleted?]
              skip if unchanged          deleteNode()
                    |                           |
                    v                           v
           buildFileGraph(filePath)          (done)
           import-graph-builder.js
                    |
      [JS/TS tree-sitter path] OR [lightweight handler path]
      language-support/*.js for py/go/css/html/md/yaml/toml
                    |
        +-----------+-----------+
        |           |           |
     symbols     imports     edges
        |           |           |
        v           v           v
   replaceSymbolsFor()  replaceEdgesFrom()
   ProjectGraphDb        ProjectGraphDb
   analysis/project-graph-db.js
                    |
                    v
          trackReferences(symbols)
          reference-tracker.js
                    |
                    v
          buildCallGraph(symbols, refs)
          call-graph-builder.js
                    |
                    v
          onFileIndexed callback
          (wired in create-managers.js:~177)
                    |
                    v
        indexFileEmbeddings(filePath)
        EmbeddingIndexer
        analysis/embedding-indexer.js
                    |
          +---------+---------+
          |                   |
    extractCodeChunks()   getEmbeddingsByNode()
    code-chunk-extractor.js   project-graph-db.js
          |                   |
          v                   v
    [chunk list]        [existing chunk hashes]
          |                   |
          +--------+----------+
                   |
            [diff by chunk_hash]
            skip unchanged chunks
                   |
                   v
          embed(newChunkTexts)
          EmbeddingProvider._embed()
          analysis/embedding-provider.js
                   |
                   v
        replaceEmbeddingsForNode()
        ProjectGraphDb
        analysis/project-graph-db.js
                   |
                   v
       [FTS sync triggers update embeddings_fts]
                   |
                   v
              (indexed)
```

### Key implementation references

| Step | File | Function/Method |
|---|---|---|
| Entry point | `managers/project-graph-manager.js` | `indexFile(filePath)` |
| mtime check | `managers/project-graph-manager.js` | `indexFile()` early return |
| Parse & graph build | `analysis/import-graph-builder.js` | `buildFileGraph()` |
| Shared source extensions | `analysis/source-extensions.js` | `SOURCE_EXTENSIONS`, `EXTENSION_TO_LANGUAGE` |
| Lightweight language handlers | `analysis/language-support/` | `extractLightweightGraph()` |
| Symbol storage | `analysis/project-graph-db.js` | `replaceSymbolsFor()` |
| Edge storage | `analysis/project-graph-db.js` | `replaceEdgesFrom()` |
| Reference tracking | `analysis/reference-tracker.js` | `trackReferences()` |
| Call graph | `analysis/call-graph-builder.js` | `buildCallGraph()` |
| Auto-embed wiring | `create-managers.js` | `graphManager.onFileIndexed()` |
| Chunk extraction | `analysis/code-chunk-extractor.js` | `extractCodeChunks()` |
| Chunk hashing | `analysis/embedding-indexer.js` | `_buildChunkHash()` |
| Embedding text build | `analysis/embedding-indexer.js` | `_buildEmbeddingText()` |
| Embed via provider | `analysis/embedding-provider.js` | `embed()` / `_embed()` |
| Store embeddings | `analysis/project-graph-db.js` | `replaceEmbeddingsForNode()` |

### Phase-2 indexing reliability note

`ProjectGraphManager.indexFile()` now reuses `graphData.tree` and
`graphData.source` returned by `buildFileGraph()` for reference/call tracking.
This removes a redundant second parse of the same file during indexing.

Reference/call indexing failures are counted in `phase3Errors` and surfaced via:
- `projectGraphManager.describe()`
- `projectGraphManager.getGraphSummary()`

### Chunk splitting detail

When a symbol exceeds ~2200 characters, `extractCodeChunks()` splits it into
subchunks with 2-line overlap. Each subchunk gets metadata with `splitIndex`
and `totalSplits` so the retriever knows the chunk is a fragment.

```
  Symbol: function processData() { ... 3000 chars ... }
      |
      +-- chunk 0: lines 1-55   (splitIndex=0, totalSplits=2)
      +-- chunk 1: lines 53-110 (splitIndex=1, totalSplits=2)
                   ^^
                   2-line overlap for context continuity
```

Implementation: `code-chunk-extractor.js` → `splitOversizedChunk()`.

### Embedding text enrichment

The embedding text is not raw code. `_buildEmbeddingText()` prepends metadata
to improve retrieval quality:

```
File: src/runtime/analysis/embedding-indexer.js
Symbol: indexFileEmbeddings (function)
Parent: EmbeddingIndexer
Scope: class method
Export: yes
Lines: 45-120
Tokens: ~280
Doc: Indexes embeddings for all chunks in a single file.
Imports: code-chunk-extractor, embedding-provider

[actual code of the chunk]
```

Implementation: `embedding-indexer.js` → `_buildEmbeddingText(chunk)`.

## 2. Query Flow

When the user runs `tool.semantic-search search "query"`, the retrieval
pipeline runs through embedding, vector search, keyword search, merge, and
context expansion.

```
          tool.semantic-search search "query"
          tools/graph/semantic-search.js
                      |
         +------------+------------+
         |                         |
   [has embedding provider?]  executeKeywordSearch()
         |                    semantic-search.js
         v                         |
   embedOne(query)                 v
   EmbeddingProvider          [split query into keywords]
   embedding-provider.js      [search symbols by name]
         |                    [score by match count + boosts]
         v                         |
   semanticSearchQuery()           |
   SessionMemoryManager            |
   session-memory-manager.js       |
         |                         |
         v                         |
    semanticSearch()                |
    [batched typed-array cosine     |
     over embedding matrix]         |
         |                         |
         v                         v
   vectorResults             keywordResults
         |                         |
         +------------+------------+
                      |
               [both have results?]
              /                    \
           yes                      no
            |                        |
            v                        v
   mergeHybridResults()     [return whichever exists]
   semantic-search.js       enrichVectorResult() or
            |               keywordResults as-is
            v
   [dedupe by chunk/path key]
   [for each result:]
     mergedScore = 0.7 * vectorScore
                 + 0.3 * keywordScore
                 + rerankBoost
   [sort descending, slice topK]
            |
            v
   [for top results:]
   buildResultContext()
   SessionMemoryManager
   session-memory-manager.js
            |
   +--------+--------+--------+
   |        |        |        |
 deps    dependents  same-   call
         (reverse)   file    hierarchy
                    symbols  (in + out)
   |        |        |        |
   +--------+--------+--------+
            |
            v
   [enriched results with context]
            |
            v
        (response)
```

### Key implementation references

| Step | File | Function/Method |
|---|---|---|
| Tool entry | `tools/graph/semantic-search.js` | `execute()` search action |
| Query embedding | `analysis/embedding-provider.js` | `embedOne()` |
| Vector search | `managers/session-memory-manager.js` | `semanticSearch()` |
| Embedding keyword search | `managers/session-memory-manager.js` | `semanticKeywordSearch()` |
| Embedding FTS lookup | `analysis/project-graph-db.js` | `searchEmbeddingsKeyword()` |
| Keyword search | `tools/graph/semantic-search.js` | `executeKeywordSearch()` |
| Hybrid merge | `tools/graph/semantic-search.js` | `mergeHybridResults()` |
| Score clamping | `tools/graph/semantic-search.js` | `clampMergedScore()` |
| Vector enrichment | `tools/graph/semantic-search.js` | `enrichVectorResult()` |
| Context expansion | `managers/session-memory-manager.js` | `buildResultContext()` |
| Dependency lookup | `managers/project-graph-manager.js` | `getDependencies()` |
| Dependent lookup | `managers/project-graph-manager.js` | `getDependents()` |
| Call hierarchy | `managers/project-graph-manager.js` | `getCallHierarchy()` |

### Scoring formula detail

```
mergedScore = clamp(
    0.7 * normalizedVectorScore
  + 0.3 * normalizedKeywordScore
  + rerankBoost
, 0, 1)

rerankBoost =
  + 0.10   if symbol name appears in query text
  + 0.03   if symbol kind is 'function' or 'class'
  + 0.05   if symbol is exported
```

The 0.7/0.3 split favors semantic similarity while still rewarding exact name
matches. The rerank boosts are lightweight and deterministic — no LLM calls.

Implementation: `semantic-search.js` → `mergeHybridResults()` (~line 269).

### Context expansion detail

For the top results, `buildResultContext()` adds:

1. **Dependencies** — files this result's file imports from (depth 1)
2. **Dependents** — files that import this result's file (depth 1)
3. **Same-file symbols** — other symbols defined in the same file
4. **Call hierarchy** — incoming and outgoing calls for the result's symbol

This bounded expansion gives the consumer enough surrounding context to
understand the result without loading the entire dependency tree.

Implementation: `session-memory-manager.js` → `buildResultContext()`.

### Phase-2 call graph detail

Call graph extraction now includes:
- function callers
- method callers
- class-constructor callers (attributed to class symbol)
- function-assigned variable callers (arrow/function expressions)

Call rows may now include `callee_symbol_id` when callee resolution can map to
an exported symbol in the imported target file.

## 3. Auto-Embed Wiring

The connection between indexing and embedding is a callback, not a direct call:

```
create-managers.js (~line 177):

  graphManager.onFileIndexed(async (filePath) => {
    if (embeddingIndexer?.available) {
      await embeddingIndexer.indexFileEmbeddings(filePath);
    }
  });
```

This means:
- Every `indexFile()` call that successfully parses automatically triggers
  embedding, with no extra caller action needed.
- If the embedding indexer is unavailable (no provider configured), the
  callback silently skips — no error, no degradation of the graph.
- `indexProject()` indexes all files sequentially, and each file triggers the
  callback individually.
