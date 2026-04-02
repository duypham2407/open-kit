# Troubleshooting

Concrete steps for diagnosing common issues with the project graph, embedding
pipeline, and semantic search.

## Inspecting The SQLite Database

The project graph and embeddings live in a single SQLite database. Its default
location depends on the runtime path model:

- **Managed workspace:** `OPENCODE_HOME/workspaces/<workspace-id>/openkit/.opencode/project-graph.db`
- **Local fallback:** `<projectRoot>/.opencode/project-graph.db`

You can find the exact path from the runtime:

```
# Inside a session:
tool.embedding-index status
# Returns { dbPath, stats: { nodes, edges, symbols, embeddings, ... } }
```

### Open the DB directly

```
sqlite3 /path/to/project-graph.db
```

### Check table counts

```sql
SELECT 'nodes' AS tbl, COUNT(*) AS cnt FROM nodes
UNION ALL SELECT 'edges', COUNT(*) FROM edges
UNION ALL SELECT 'symbols', COUNT(*) FROM symbols
UNION ALL SELECT 'symbol_references', COUNT(*) FROM symbol_references
UNION ALL SELECT 'call_graph', COUNT(*) FROM call_graph
UNION ALL SELECT 'embeddings', COUNT(*) FROM embeddings
UNION ALL SELECT 'session_touches', COUNT(*) FROM session_touches;
```

### Check embedding coverage

```sql
-- Files with embeddings
SELECT DISTINCT n.file_path
FROM embeddings e
JOIN nodes n ON n.id = e.node_id
ORDER BY n.file_path;

-- Files WITHOUT embeddings (indexed but not embedded)
SELECT n.file_path
FROM nodes n
WHERE n.id NOT IN (SELECT DISTINCT node_id FROM embeddings)
ORDER BY n.file_path;
```

### Inspect a specific file's chunks

```sql
SELECT e.chunk_id, e.chunk_hash, e.model,
       json_extract(e.metadata_json, '$.symbolName') AS symbol,
       json_extract(e.metadata_json, '$.kind') AS kind,
       json_extract(e.metadata_json, '$.startLine') AS start_line,
       json_extract(e.metadata_json, '$.endLine') AS end_line
FROM embeddings e
JOIN nodes n ON n.id = e.node_id
WHERE n.file_path = 'src/runtime/analysis/embedding-indexer.js'
ORDER BY start_line;
```

### Check for stale embeddings

```sql
-- Embeddings for files that no longer exist in the nodes table
SELECT e.chunk_id, e.node_id
FROM embeddings e
WHERE e.node_id NOT IN (SELECT id FROM nodes);
```

## Force Re-Indexing A File

If a file's embeddings seem stale or corrupted:

### From a session

```
tool.embedding-index index-file src/runtime/analysis/embedding-indexer.js
```

### Programmatically

```js
// Force re-index by deleting existing embeddings first
const db = graphManager.db;
const node = db.getNode('src/runtime/analysis/embedding-indexer.js');
if (node) {
  // Delete old embeddings for this node
  db.replaceEmbeddingsForNode(node.id, []);
  // Re-index
  await graphManager.indexFile('src/runtime/analysis/embedding-indexer.js');
  // onFileIndexed callback will re-embed
}
```

### Force full project re-index

```
tool.embedding-index index-project --force
```

The `force` flag bypasses mtime checks and re-indexes every file.

## Semantic Search Returns No Results

**Symptom:** `tool.semantic-search search "query"` returns empty or very few results.

**Check 1: Are there embeddings at all?**

```
tool.embedding-index status
```

If `stats.embeddings` is 0, the project has not been indexed. Run:

```
tool.embedding-index index-project
```

**Check 2: Is the embedding provider configured?**

```
openkit doctor
```

If the embedding capability shows `degraded`, configure a provider (see
`07-operator-runbook.md` section 2).

Without an embedding provider, search falls back to keyword-only mode, which
only matches symbol names — not code content.

**Check 3: Is the query too specific or too vague?**

- Very short queries ("add") match too many symbols with low scores.
- Very long queries dilute the embedding signal.
- Try 3-8 word natural language queries: "parse JSON configuration file",
  "handle authentication middleware", "create database connection".

**Check 4: Is minScore too high?**

The default `minScore` is 0.1. With mock embeddings (for testing), scores are
inherently low. If testing with MockEmbeddingProvider, set `minScore: 0.0`.

## Hybrid Search Scoring Seems Wrong

**Symptom:** A clearly relevant result ranks lower than expected.

The hybrid scoring formula is:

```
mergedScore = 0.7 * vectorScore + 0.3 * keywordScore + rerankBoost
```

Rerank boosts:
- +0.10 if the symbol name appears in the query text
- +0.03 if the symbol is a function or class
- +0.05 if the symbol is exported

**Debug steps:**

1. Check `scoreBreakdown` in the result (returned by `tool.semantic-search`).
2. If `vectorScore` is 0, the query embedding did not match the chunk — may
   indicate the provider returned poor vectors for that domain.
3. If `keywordScore` is 0, no keyword match was found — expected for queries
   that use different terminology than the code.
4. If `rerankBoost` is 0, the chunk is not a named function/class export.

**Implementation reference:** `src/runtime/tools/graph/semantic-search.js:269`
(mergeHybridResults function).

## better-sqlite3 Not Found

**Symptom:** Runtime errors mentioning `better-sqlite3` module not found.

**Fix 1:** Run the install verifier:

```
openkit install --verify
```

**Fix 2:** Manual install in the managed kit:

```
npm install better-sqlite3 --save-optional
```

**Fix 3:** If compilation fails (no C++ compiler), install build tools:

- macOS: `xcode-select --install`
- Ubuntu: `sudo apt-get install build-essential python3`
- Windows: install windows-build-tools

**Checking availability:**

```
node -e "try { require('better-sqlite3'); console.log('OK'); } catch(e) { console.log('MISSING:', e.message); }"
```

Without `better-sqlite3`, the project graph and embedding subsystems are
entirely unavailable. Semantic search degrades to not-available (no keyword
fallback either, since keyword search also uses the SQLite DB).

## Tree-Sitter Parse Failures

**Symptom:** Files are indexed but show `status: 'parse-failed'`.

This means tree-sitter could not parse the file. Common causes:

1. **Unsupported language** — tree-sitter grammars must be installed for the
   file's language. Check which grammars are available:
   ```
   openkit doctor
   ```

2. **Syntax errors in the file** — tree-sitter is tolerant of many errors but
   severely broken files may fail entirely.

3. **Binary or non-source files** — the file scanner may have picked up a file
   that is not actually source code. The graph manager skips common binary
   extensions but may miss unusual ones.

## Manager describe() Outputs

Every manager has a `describe()` method that returns diagnostic info:

```js
// Inside runtime or test code
const desc = embeddingIndexer.describe();
// { available: true, provider: 'ollama', batchSize: 20, stats: { filesProcessed: 42, chunksEmbedded: 318, errors: 0, lastRunMs: 1234 } }

const memDesc = sessionMemoryManager.describe();
// { sessionId: 'abc', available: true, touchedFiles: 7, hasEmbeddingProvider: true }

const graphDesc = projectGraphManager.describe();
// { projectRoot: '...', available: true, stats: { nodes: 50, edges: 120, symbols: 400, embeddings: 318 }, dbPath: '...' }
```

Use these for quick health checks during development or debugging.

## Common Error Messages

| Error | Likely cause | Fix |
|---|---|---|
| `Cannot find module 'better-sqlite3'` | Native module not installed | `openkit install --verify` |
| `SQLITE_BUSY` | Another process has the DB locked | Close other openkit sessions |
| `embedding provider returned empty` | API key missing or provider down | Check `OPENAI_API_KEY` / Ollama running |
| `chunk extraction returned 0 chunks` | File has no parseable symbols | Check tree-sitter grammar for language |
| `onFileIndexed callback error` | Bug in embedding indexer | Check `embeddingIndexer.stats.errors` |
