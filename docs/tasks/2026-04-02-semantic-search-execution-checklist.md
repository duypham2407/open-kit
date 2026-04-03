# Semantic Search Execution Checklist

Use this checklist to execute the semantic-search upgrade plan in small,
verifiable slices without drifting into higher-cost features too early.

Primary reference:
- `docs/tasks/2026-04-02-semantic-search-implementation-plan.md`

Source sketch:
- `semantic_search_pipeline.md`

## Guardrails

- [ ] Keyword fallback remains intact when embeddings are disabled or unavailable.
- [ ] Baseline implementation stays local-first and SQLite-backed.
- [ ] No mandatory LLM query rewrite is introduced.
- [ ] No mandatory LLM-generated descriptions are introduced.
- [ ] No mandatory LLM reranking is introduced.
- [ ] No external vector database is added as a baseline dependency.
- [ ] Tests remain deterministic with `MockEmbeddingProvider`.

## Phase 1: Baseline Retrieval Quality

### 1. Chunk Quality

- [ ] Review current `extractCodeChunks()` behavior in `src/runtime/analysis/code-chunk-extractor.js`.
- [ ] Define a deterministic size heuristic for oversized chunks.
- [ ] Keep one chunk per top-level symbol for normal-sized functions/classes.
- [ ] Split oversized functions/classes into stable subchunks.
- [ ] Preserve deterministic chunk IDs for unchanged content.
- [ ] Keep file-level fallback only when symbol-level chunking is unavailable.

Acceptance check:
- [ ] Small functions/classes stay single-chunk.
- [ ] Large symbols split predictably.
- [ ] Chunking behavior is covered by tests.

### 2. Deterministic Enrichment

- [ ] Review `_buildEmbeddingText()` in `src/runtime/analysis/embedding-indexer.js`.
- [ ] Ensure embedding text includes relative path.
- [ ] Ensure embedding text includes symbol name.
- [ ] Ensure embedding text includes symbol kind.
- [ ] Ensure embedding text includes doc comments when available.
- [ ] Ensure embedding text includes import summary when available.
- [ ] Add export/scope/class-context metadata when available.
- [ ] Keep enrichment deterministic and string-based.

Acceptance check:
- [ ] Embedding input is more descriptive than raw code alone.
- [ ] Test fixtures can assert exact embedding input text.

### 3. Hybrid Retrieval

- [ ] Review current `tool.semantic-search` flow in `src/runtime/tools/graph/semantic-search.js`.
- [ ] Keep pure embedding mode available when keyword results are unnecessary.
- [ ] Keep pure keyword mode available when embeddings are unavailable.
- [ ] Add hybrid retrieval path that merges vector and keyword/symbol results.
- [ ] Normalize vector and keyword results to a shared structure.
- [ ] Dedupe merged results by chunk/file/symbol identity.
- [ ] Add deterministic score merge formula.
- [ ] Expose `searchMode` accurately: `embedding`, `keyword`, or `hybrid`.

Acceptance check:
- [ ] Vague natural-language queries improve over keyword-only retrieval.
- [ ] Exact symbol queries still benefit from keyword precision.
- [ ] Ranking remains deterministic in tests.

## Phase 2: Context And Incrementality

### 4. Graph-Based Context Expansion

- [ ] Expand top semantic results with dependencies/imports where useful.
- [ ] Expand with dependents where useful.
- [ ] Include nearby same-file symbols where useful.
- [ ] Include call hierarchy when available and bounded.
- [ ] Keep context expansion optional and budget-aware.

Acceptance check:
- [ ] Result context helps agents act without flooding the prompt.
- [ ] Expansion limits are covered by tests.

### 5. Chunk-Level Caching And Invalidation

- [ ] Review current file-level embedding skip behavior in `src/runtime/analysis/embedding-indexer.js`.
- [ ] Add chunk-level content hashing.
- [ ] Skip re-embedding unchanged chunks.
- [ ] Re-embed only changed chunks inside a changed file.
- [ ] Keep file-level incremental indexing intact.

Acceptance check:
- [ ] Unchanged chunks are not re-embedded.
- [ ] Repeated indexing runs are materially cheaper on stable code.

## Phase 3: Quality Refinements

### 6. Lightweight Reranking

- [ ] Add exact symbol-name match boosts.
- [ ] Add export boosts where useful.
- [ ] Add file path similarity boosts where useful.
- [ ] Add graph-proximity boosts where useful.
- [ ] Keep reranking deterministic and local.

Acceptance check:
- [ ] Top 5 quality improves on ambiguous queries.
- [ ] No new network dependency is introduced.

### 7. Better Retrieval Output

- [ ] Return file path for each result.
- [ ] Return symbol name when available.
- [ ] Return chunk kind.
- [ ] Return line range.
- [ ] Return score breakdown where practical.
- [ ] Return graph expansion summary where practical.

Acceptance check:
- [ ] Operators can understand why a result ranked highly.
- [ ] Agents can consume results without extra lookups.

## Deferred Features

Do not implement these in the first pass unless explicitly re-approved.

- [ ] LLM query rewrite is still deferred.
- [ ] LLM-generated chunk descriptions are still deferred.
- [ ] LLM reranking is still deferred.
- [ ] External vector databases are still deferred.

## Files To Touch

- [ ] `src/runtime/analysis/code-chunk-extractor.js`
- [ ] `src/runtime/analysis/embedding-indexer.js`
- [ ] `src/runtime/managers/session-memory-manager.js`
- [ ] `src/runtime/tools/graph/semantic-search.js`
- [ ] `src/runtime/analysis/project-graph-db.js` if schema support is needed
- [ ] `src/runtime/create-managers.js` if wiring changes are needed
- [ ] `src/runtime/tools/analysis/embedding-index.js` if status/diagnostics expand
- [ ] `src/global/doctor.js` if operator diagnostics need updates
- [ ] `context/core/project-config.md` if config behavior changes

## Test Coverage Checklist

- [ ] Chunk splitting tests added or updated.
- [ ] Deterministic embedding input tests added or updated.
- [ ] Hybrid retrieval merge tests added or updated.
- [ ] Keyword fallback tests still pass.
- [ ] Chunk cache invalidation tests added or updated.
- [ ] Context expansion boundary tests added or updated.
- [ ] Existing semantic-memory and embedding-pipeline tests still pass.

## Exit Gate

Semantic-search baseline work is ready to ship only when:

- [ ] fallback behavior still works without embeddings
- [ ] retrieval quality improved without introducing mandatory high-cost features
- [ ] indexing remains incremental
- [ ] output remains deterministic in tests
- [ ] operator-facing diagnostics and docs match actual runtime behavior
