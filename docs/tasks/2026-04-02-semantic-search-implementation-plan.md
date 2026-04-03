# Semantic Search Implementation Plan

> This document turns the initial `semantic_search_pipeline.md` sketch into an
> implementation plan aligned with the current OpenKit runtime. It is intended
> to be the working plan before further semantic-search changes are implemented.

**Repo:** `open-kit`
**Branch:** `main`
**Last updated:** 2026-04-02
**Input reference:** `semantic_search_pipeline.md`

---

## 1. Goal

Strengthen OpenKit's semantic code search so it remains:

- local-first
- dependency-light
- deterministic in tests
- degradable when embeddings are unavailable
- aligned with the existing project graph, SQLite storage, and tool registry

The plan is intentionally pragmatic. It separates what should be implemented
now from what should be deferred until the current baseline is stable.

---

## 2. Current State

OpenKit already has a usable first-pass embedding pipeline:

- `src/runtime/analysis/code-chunk-extractor.js`
  - extracts one chunk per top-level symbol
  - falls back to a file-level chunk when no symbols are available
- `src/runtime/analysis/embedding-indexer.js`
  - enriches chunk text with file path, symbol name, kind, doc comment, and imports
  - batches embedding requests through a pluggable provider
  - stores vectors in the project graph SQLite DB
- `src/runtime/analysis/embedding-provider.js`
  - supports `openai`, `ollama`, `custom`, `mock`, and no-op flows
- `src/runtime/managers/session-memory-manager.js`
  - performs brute-force cosine similarity over stored vectors
  - supports query embedding through the configured provider
- `src/runtime/tools/graph/semantic-search.js`
  - runs embedding search when available
  - falls back to keyword search otherwise

This means the baseline architecture already exists. The next work should focus
on improving retrieval quality and operability without destabilizing the kit.

---

## 3. Design Principles

Any semantic-search work should follow these rules:

1. Keep the current degrade path intact.
   - If no embedding provider is configured, semantic search must still return
     useful keyword-based results.

2. Prefer local deterministic metadata over additional LLM calls.
   - File path, symbol name, doc comments, imports, and graph context should be
     the first enrichment layer.

3. Reuse the existing project graph DB before introducing new storage systems.
   - Avoid adding Qdrant, Weaviate, or other external vector stores in the
     baseline implementation.

4. Keep indexing incremental.
   - Only changed files should be re-indexed.
   - Avoid expensive global rebuild requirements for normal development.

5. Keep tests network-free by default.
   - Unit and integration tests should use `MockEmbeddingProvider`.

6. Treat expensive intelligence features as optional layers.
   - Query rewriting, LLM reranking, and description generation are enhancements,
     not requirements for the baseline runtime.

---

## 4. Target Pipeline

The target runtime flow for the baseline should be:

1. Parse file via tree-sitter-backed runtime analysis
2. Extract logical symbol-level chunks
3. Enrich chunk text with deterministic metadata
4. Generate embeddings through the configured provider
5. Store embeddings in the project graph SQLite DB
6. Run vector retrieval for query embeddings
7. Run keyword/symbol retrieval in parallel or as a merged fallback
8. Merge and score results
9. Expand result context using graph relationships
10. Return a compact context payload to tools and agents

This keeps your original sketch, but removes mandatory LLM-only stages from the
critical path.

---

## 5. Scope Split

### 5.1 Baseline work for the current kit

These changes fit the current architecture and should be prioritized.

#### A. Improve chunk quality

Objective:
- keep symbol-level chunking
- reduce overly large chunks
- avoid low-value file-level fallback when symbol data exists

Planned changes:
- extend `extractCodeChunks()` to support soft size heuristics
- split oversized class/function chunks when their source becomes too large
- preserve one logical chunk per symbol where possible
- include optional metadata fields already available from the graph DB

Implementation notes:
- current extractor already skips class members as separate chunks and treats
  the parent class as the primary chunk
- the next step should be a simple token-estimate heuristic, not a full tokenizer

Acceptance criteria:
- top-level functions and small classes remain single chunks
- very large classes/functions are split into stable subchunks
- chunk IDs remain deterministic across runs for unchanged code

#### B. Improve deterministic enrichment

Objective:
- increase semantic signal without adding another model dependency

Planned changes:
- enrich chunk text with:
  - relative path
  - symbol name
  - symbol kind
  - doc comment
  - import summary
  - export signal when available
  - scope/class context when available
- add richer metadata storage for retrieval/debugging output

Implementation notes:
- `_buildEmbeddingText()` already adds a basic metadata header
- enrichment should remain deterministic and string-based
- do not require LLM-generated descriptions in baseline

Acceptance criteria:
- embedding input is more descriptive than raw code alone
- test fixtures can assert exact generated embedding text

#### C. Add true hybrid retrieval

Objective:
- combine vector similarity with keyword/symbol search instead of using keyword
  search only as a fallback

Planned changes:
- in `tool.semantic-search`, run:
  - embedding retrieval top K
  - keyword/symbol retrieval top K
- normalize both result sets to a shared result structure
- dedupe by chunk/file/symbol identity
- merge scores with a simple deterministic formula
- expose `searchMode: 'hybrid' | 'embedding' | 'keyword'`

Suggested scoring strategy:
- vector score: normalized cosine similarity
- keyword score: current relevance score from keyword search
- merge score: weighted combination, for example:
  - `0.7 * vectorScore + 0.3 * keywordScore`

Acceptance criteria:
- semantic search returns useful results even when exact symbols do not match
- symbol-heavy queries still benefit from keyword precision
- merged ranking is deterministic in tests

#### D. Add graph-based context expansion

Objective:
- make returned semantic results more actionable for agents

Planned changes:
- after top search results are selected, expand with graph context such as:
  - imports/dependencies
  - dependents
  - nearby symbols in the same file
  - call hierarchy where available
- keep expansion bounded to avoid overwhelming the model

Acceptance criteria:
- context output includes a small, relevant neighborhood around the result
- expansion remains optional and budget-aware

#### E. Improve caching and invalidation

Objective:
- avoid unnecessary re-embedding

Planned changes:
- add chunk-level content hashing
- skip re-embedding when chunk text is unchanged
- keep file-level incremental indexing behavior

Implementation notes:
- current pipeline skips already-embedded files at the node level
- this should become more precise at the chunk level

Acceptance criteria:
- editing an unrelated chunk in a file does not force every chunk in the file to re-embed
- repeated indexing runs are significantly cheaper on unchanged projects

### 5.2 Near-term upgrades after baseline

These are strong candidates once the baseline above is stable.

#### F. Lightweight reranking

Objective:
- improve top-N precision without requiring another network call

Planned changes:
- add heuristic reranking using:
  - exact symbol-name match boosts
  - export boosts
  - file path similarity boosts
  - graph proximity boosts

Acceptance criteria:
- top 5 results improve on ambiguous queries
- no extra external dependency is introduced

#### G. Better retrieval output

Objective:
- make semantic search results more useful to agents and operators

Planned changes:
- return richer result rows including:
  - file path
  - symbol name
  - chunk kind
  - line range
  - score source breakdown
  - graph expansion summary

Acceptance criteria:
- operators can inspect why a result ranked highly
- downstream agent prompts can select the best results more easily

#### H. SQLite-level retrieval optimization

Objective:
- improve performance for larger codebases

Planned changes:
- keep SQLite as the storage system
- investigate more efficient retrieval paths before considering external DBs
- only consider SQLite+ANN/HNSW if brute-force retrieval becomes a bottleneck

Acceptance criteria:
- performance data shows a real need before adding index complexity

### 5.3 Deferred advanced features

These should not block the current implementation.

#### I. Query rewrite using an LLM

Status:
- deferred

Reason:
- adds latency, cost, and another availability dependency to every semantic query
- complicates deterministic testing

When to revisit:
- only after hybrid retrieval still underperforms on real usage data

#### J. LLM-generated chunk descriptions

Status:
- deferred

Reason:
- expensive during indexing
- difficult to cache well
- may not outperform doc-comment + metadata enrichment enough to justify cost

#### K. LLM reranking

Status:
- deferred

Reason:
- useful in principle, but too expensive for a baseline local-first kit
- should only be explored behind an explicit opt-in config

#### L. External vector databases

Status:
- deferred

Reason:
- Qdrant/Weaviate add operational burden and contradict the current lightweight local-kit direction
- current architecture already has a natural SQLite home for vectors and graph data

---

## 6. Concrete File-Level Plan

### 6.1 Chunking and enrichment

Files to modify:
- `src/runtime/analysis/code-chunk-extractor.js`
- `src/runtime/analysis/embedding-indexer.js`

Expected work:
- add chunk sizing heuristics
- add deterministic subchunk rules for oversized symbols
- enrich metadata header content
- add hash generation support for chunk invalidation

### 6.2 Retrieval and ranking

Files to modify:
- `src/runtime/managers/session-memory-manager.js`
- `src/runtime/tools/graph/semantic-search.js`

Expected work:
- normalize vector results and keyword results to a shared structure
- merge and rerank deterministically
- expose score components and search mode
- add bounded context expansion options

### 6.3 Database support

Files to modify:
- `src/runtime/analysis/project-graph-db.js`

Expected work:
- add chunk hash storage if needed
- support more selective embedding replacement/update operations
- keep schema changes additive and migration-safe

### 6.4 Runtime wiring and operator visibility

Files to modify:
- `src/runtime/create-managers.js`
- `src/runtime/tools/analysis/embedding-index.js`
- `src/global/doctor.js`
- `context/core/project-config.md`

Expected work:
- expose richer embedding diagnostics
- clarify operator-visible status when embeddings are disabled, unavailable, or partially indexed

### 6.5 Tests

Files to modify or create:
- `tests/runtime/embedding-pipeline.test.js`
- `tests/runtime/semantic-memory.test.js`
- new hybrid retrieval tests if needed

Required test coverage:
- chunk splitting behavior
- deterministic embedding input construction
- hybrid merge scoring
- keyword fallback still works when embeddings are unavailable
- chunk-level cache invalidation behavior
- graph context expansion boundaries

---

## 7. Proposed Phases

### Phase 1 — Baseline quality improvements

Deliverables:
- better chunking
- deterministic enrichment improvements
- hybrid retrieval merge
- updated tests

Success criteria:
- semantic search quality improves without adding new external infrastructure
- all tests remain deterministic with `MockEmbeddingProvider`

### Phase 2 — Context expansion and cache precision

Deliverables:
- graph-based context expansion
- chunk hash invalidation
- richer operator diagnostics

Success criteria:
- indexing becomes more incremental
- results become more directly usable by agents

### Phase 3 — Measured optimization

Deliverables:
- lightweight reranking improvements
- optional retrieval performance tuning

Success criteria:
- optimization work is backed by observed bottlenecks, not speculation

---

## 8. Non-Goals for This Plan

The following are explicitly out of scope for the initial implementation:

- mandatory query rewriting
- mandatory LLM reranking
- mandatory LLM chunk descriptions
- external vector databases as default storage
- replacing the existing degrade-to-keyword behavior

---

## 9. Risks and Mitigations

### Risk: indexing becomes too slow
- Mitigation:
  - keep batching configurable
  - keep chunk hashing incremental
  - avoid extra LLM calls during indexing

### Risk: semantic search becomes nondeterministic in tests
- Mitigation:
  - use `MockEmbeddingProvider`
  - keep ranking formulas deterministic
  - avoid LLM-dependent baseline logic

### Risk: result quality still feels weak on vague queries
- Mitigation:
  - implement hybrid retrieval before considering query rewrite
  - add graph-based expansion before adding external rerankers

### Risk: storage complexity grows too quickly
- Mitigation:
  - keep vectors in SQLite first
  - only evolve schema when a measurable need exists

---

## 10. Recommendation

Proceed with implementation only for the following baseline items first:

1. improve chunking with deterministic subchunk rules for oversized symbols
2. improve metadata enrichment without LLM description generation
3. implement true hybrid retrieval by merging embedding and keyword results
4. expand final context using existing graph relationships
5. add chunk-level cache invalidation

Do not implement query rewrite, LLM rerank, or external vector DBs in the first pass.

---

## 11. Ready-to-Implement Summary

If execution begins immediately, the first coding slice should be:

1. `code-chunk-extractor.js`
   - add deterministic chunk sizing rules

2. `embedding-indexer.js`
   - enrich metadata header further
   - compute chunk hashes

3. `semantic-search.js`
   - add hybrid retrieval path
   - merge vector + keyword results

4. `session-memory-manager.js`
   - support normalized result structures and graph-aware context support

5. tests
   - lock behavior with deterministic fixtures before further optimization

This sequence gives OpenKit a materially better semantic search system while staying compatible with the current runtime and install model.
