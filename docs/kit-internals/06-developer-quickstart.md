# Developer Quickstart

This page gets a kit contributor from zero to running tests, indexing a project,
and exercising semantic search locally in the shortest path possible.

## Prerequisites

- Node.js 18+ (required for the runtime and test runner)
- `better-sqlite3` native module (required for project graph and embeddings)
- The repository checked out locally

Verify native module availability:

```
node -e "require('better-sqlite3')"
```

If that fails, install it in the kit's managed `node_modules` or run
`openkit install --verify` which provisions it automatically.

## Running Tests

The repository uses Node.js built-in test runner (`node:test`). There is no
`package.json` test script yet, so run tests directly.

### Run all runtime tests

```
node --test tests/runtime/*.test.js
```

### Run only semantic search and embedding tests

```
node --test tests/runtime/semantic-memory.test.js tests/runtime/embedding-pipeline.test.js
```

### Run a single test file

```
node --test tests/runtime/graph-db.test.js
```

### Run CLI tests

```
node --test tests/cli/*.test.js
```

### Full test suite (all directories)

```
node --test tests/runtime/*.test.js tests/cli/*.test.js tests/global/*.test.js tests/install/*.test.js
```

## Using MockEmbeddingProvider In Tests

All embedding tests use `MockEmbeddingProvider` from
`src/runtime/analysis/embedding-provider.js` so they run without network calls
and produce deterministic results.

```js
import { MockEmbeddingProvider } from '../src/runtime/analysis/embedding-provider.js';

const provider = new MockEmbeddingProvider({ dimensions: 64 });

// Embed a single text — returns a deterministic 64-dim vector based on text hash
const vector = await provider.embedOne('function add(a, b) { return a + b; }');

// Embed a batch
const vectors = await provider.embed([
  'function add(a, b) { return a + b; }',
  'class UserService { }',
]);

// Describe the provider
console.log(provider.describe());
// { provider: 'mock', model: 'mock-64', dimensions: 64 }
```

The mock provider generates vectors by hashing the input text, so the same text
always produces the same vector. Different texts produce different vectors.
Cosine similarity between them is low but nonzero, which is enough for testing
ranking and retrieval logic.

## Minimal Indexing Example

Index a small repo and query it from code:

```js
import { ProjectGraphDb } from '../src/runtime/analysis/project-graph-db.js';
import { ProjectGraphManager } from '../src/runtime/managers/project-graph-manager.js';
import { EmbeddingIndexer } from '../src/runtime/analysis/embedding-indexer.js';
import { MockEmbeddingProvider } from '../src/runtime/analysis/embedding-provider.js';
import { SessionMemoryManager } from '../src/runtime/managers/session-memory-manager.js';

// 1. Create a graph manager (needs a syntax index manager — pass null for quick test)
const graphManager = new ProjectGraphManager({
  projectRoot: '/path/to/small-repo',
  runtimeRoot: '/tmp/openkit-test',
  syntaxIndexManager: null, // skip tree-sitter for this example
  dbPath: '/tmp/openkit-test/graph.db',
});

// 2. Create embedding provider and indexer
const provider = new MockEmbeddingProvider({ dimensions: 64 });
const indexer = new EmbeddingIndexer({
  projectGraphManager: graphManager,
  embeddingProvider: provider,
  batchSize: 20,
});

// 3. Wire auto-embed callback (mirrors create-managers.js wiring)
graphManager.onFileIndexed(async (filePath) => {
  if (indexer.available) {
    await indexer.indexFileEmbeddings(filePath);
  }
});

// 4. Index a file
await graphManager.indexFile('/path/to/small-repo/src/utils.js');

// 5. Search
const memory = new SessionMemoryManager({
  projectGraphManager: graphManager,
  embeddingProvider: provider,
  sessionId: 'dev-test',
});

const results = await memory.semanticSearchQuery('add two numbers', {
  topK: 5,
  minScore: 0.0, // low threshold for mock vectors
});

console.log(results);
```

## Key Test Files

| What they cover | Test file |
|---|---|
| Project graph DB schema & ops | `tests/runtime/graph-db.test.js` |
| Import graph builder | `tests/runtime/import-graph-builder.test.js` |
| Graph manager indexing & queries | `tests/runtime/project-graph-manager.test.js` |
| Graph navigation tools | `tests/runtime/graph-navigation-tools.test.js` |
| Chunk extraction & embedding pipeline | `tests/runtime/embedding-pipeline.test.js` |
| Session memory & semantic search | `tests/runtime/semantic-memory.test.js` |
| Capability registry | `tests/runtime/capability-registry.test.js` |
| Runtime bootstrap | `tests/runtime/runtime-bootstrap.test.js` |
| Tool enforcement plugin | `.opencode/tests/tool-enforcement.test.js` |
| CLI configure-embedding | `tests/cli/configure-embedding.test.js` |
| CLI install | `tests/cli/install.test.js` |

## Project Layout Refresher

```
src/runtime/
  index.js                     bootstrap entry
  create-managers.js           manager wiring
  create-tools.js              tool assembly
  create-hooks.js              hook assembly
  capability-registry.js       capability definitions
  tools/tool-registry.js       tool creation & guard wrapping
  analysis/                    chunk extraction, embedding, graph DB
  managers/                    16 managers
  tools/graph/                 graph & semantic search tools
  tools/syntax/                syntax outline, context, locate
  tools/ast/                   AST search & replace
  hooks/tool-guards/           enforcement hooks
  mcp/                         builtin MCP servers
  skills/                      skill loading
  specialists/                 specialist agents

tests/
  runtime/                     23 test files
  cli/                         6 test files
  global/                      4 test files
  install/                     4 test files
```

## Next Steps For Contributors

1. Read `05-semantic-search-and-code-intelligence.md` for the full pipeline design.
2. Look at `tests/runtime/embedding-pipeline.test.js` for chunk-splitting and
   embedding-reuse test patterns.
3. If adding a new tool, follow the pattern in `src/runtime/tools/graph/` and
   register it in `src/runtime/tools/tool-registry.js`.
4. If adding a new manager, add it in `src/runtime/create-managers.js` and
   expose it through the managers object.
