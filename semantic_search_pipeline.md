# Semantic Search Pipeline for Codebase (text-embedding-3-small)

## Overview
Parse → Chunk → Enrich → Embed → Index → Query → Retrieve → Rerank → Context

---

## 1. Parse Code (AST)
- Use AST tools (tree-sitter, ast-grep)
- Extract:
  - Functions
  - Classes
  - Methods
  - Interfaces

---

## 2. Chunking (Critical)
### Rules
- 1 chunk = 1 logical unit (function/class)
- Ideal size: 100–300 tokens
- Max: ~800 tokens

### Avoid
- Chunk by fixed token size
- Embed entire file

---

## 3. Enrich Data
### Format
File: auth.service.ts  
Type: function  
Name: validateUserLogin  
Description: Validate user login credentials  

Code:
```ts
function validateUserLogin(...) { ... }
```

### Tips
- Generate description using LLM
- Add metadata: path, tags

---

## 4. Embedding
- Model: text-embedding-3-small
- Batch 100–500 chunks/request

---

## 5. Vector Database
Options:
- Qdrant
- Weaviate
- SQLite + HNSW

### Schema
```json
{
  "id": "...",
  "embedding": [...],
  "content": "...",
  "file": "auth.service.ts",
  "type": "function",
  "name": "validateUserLogin"
}
```

---

## 6. Query Optimization
### Raw query (bad)
"login error"

### Rewritten (good)
"function that validates user login and handles authentication errors"

---

## 7. Retrieval (Hybrid)
- Vector search + Keyword search (BM25)

Flow:
- vector top 20
- keyword top 20
- merge → top 30

---

## 8. Rerank (Important)
### Options
- Cosine similarity
- LLM rerank (recommended)

---

## 9. Context Building
- Expand related functions
- Include call graph

Example:
validateUserLogin → getUserByEmail → comparePassword

---

## 10. Caching & Updates
- Cache embeddings (hash content)
- Incremental indexing (only changed files)

---

## 11. Advanced Techniques
- Multi-vector (code + description)
- Graph-based retrieval
- AST + semantic hybrid search

---

## Cost Estimate
- 10k functions ≈ 2M tokens
- Cost ≈ $0.04

---

## Conclusion
### Must-have
- AST chunking
- Metadata enrichment
- Query rewrite
- Rerank

### Recommended
- Hybrid search
- Context expansion

### Model
- text-embedding-3-small is sufficient
