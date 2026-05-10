# Multi-Layer Intelligence Stack

## Overview

The Multi-Layer Intelligence Stack ensures OpenKit reads codebases **broadly** (finds all relevant context), **deeply** (understands how code works), and **reliably** (never misses critical context).

## Architecture

Four independent layers that work together:

```
L1: Structural Layer (Pure static analysis)
  → imports, symbols, references, types, flows, scopes

L2: Semantic Layer (Patterns + data flow)
  → pattern recognition, data flow tracing, usage mining

L3: Intent Layer (LLM-augmented understanding)
  → business rules, constraints, edge cases, design patterns

L4: Context Assembly (Smart orchestration)
  → queries L1+L2+L3, ranks, merges, applies budget
```

### How each layer works

**L1 — Structural** is pure static analysis on top of the SQLite project graph. It records file nodes (with module type and test/config flags), exported symbols (with signatures, parameters, return types, decorators, and parent-symbol links), import edges, lexical scope contexts (`scope_contexts` table), and type-flow edges between symbols (`type_flows` table). Querying L1 alone tells you "what depends on what" and "where does this value come from structurally."

**L2 — Semantic** layers meaning on top of structure. The data-flow analyzer traces values across transformations using L1's type-flow rows. Pattern recognition writes rows into the `code_patterns` table, tagging symbols with pattern types like `validation`, `error-handling`, or `api-usage`. Usage mining captures the actual fingerprint of how a symbol is invoked across the codebase. Embedding-backed semantic search complements keyword/FTS search.

**L3 — Intent** uses an LLM to extract human-meaningful insights — business rules, constraints, edge cases, design patterns, data transformations — and stores them in the `code_intents` table. The intent cache (`intent-cache-manager.js`) keys results by symbol + content hash so extractions are reused until the underlying code changes. Confidence scoring lets downstream consumers filter low-quality output.

**L4 — Context Assembly** is the orchestrator (`context-assembly-manager.js`). For a given task it queries L1/L2/L3 in parallel, merges the results, runs them through `result-ranker.js` (graph distance, embedding similarity, intent match, multi-layer bonus), then `budget-manager.js` packs the highest-value items into the caller's token budget using a 40/30/20/10 critical/important/supplementary/buffer allocation. The returned package includes coverage metrics, layer contributions, budget usage, and a confidence score.

## Usage

### Gather Task-Level Context

```javascript
const context = await tool.execute({
  mode: 'task',
  task: 'Add email validation to user registration',
  focus: ['src/user/registration.js'],
  depth: 'medium',
  budget: 8000
});
```

### Gather Session-Level Context

```javascript
const context = await tool.execute({
  mode: 'session',
  sessionId: 'current-session-id',
  recentFiles: ['file1.js', 'file2.js'],
  depth: 'broad',
  budget: 15000
});
```

### Gather Project-Level Context

```javascript
const context = await tool.execute({
  mode: 'project',
  query: 'authentication flow',
  scope: 'entire-project',
  depth: 'deep',
  budget: 30000
});
```

## Context Structure

```javascript
{
  primaryContext: [
    {
      file: 'src/user/registration.js',
      symbol: 'registerUser',
      code: '...',

      structural: {
        dependencies: [...],
        callGraph: { calls: [...], calledBy: [...] },
        dataFlow: [...],
        typeFlow: [...]
      },

      semantic: {
        patterns: ['async-validation', 'error-handling'],
        usageFingerprint: { errorHandling: 'try-catch: 95%' },
        similarCode: [...]
      },

      intent: {
        businessRules: ['Email must be unique'],
        constraints: ['Max 5 login attempts'],
        edgeCases: ['Handles duplicate email gracefully'],
        designPattern: 'Service Layer'
      },

      meta: {
        score: 0.92,
        foundInLayers: ['L1', 'L2', 'L3'],
        confidence: 0.88
      }
    }
  ],

  metadata: {
    coverageMetrics: { filesAnalyzed: 45, symbolsIncluded: 120, layersConsulted: 3 },
    layerContributions: { structural: 40, semantic: 35, intent: 25 },
    budgetUsage: { allocated: 8000, used: 7650, total: 8000 },
    confidenceScore: 0.87
  }
}
```

## Configuration

The full configuration schema lives in `.opencode/openkit.runtime.jsonc` under the `codeIntelligence` key. See `docs/configuration/code-intelligence.md` for the complete reference. The defaults balance performance, quality, and cost; common tuning knobs are summarised below.

```jsonc
{
  "codeIntelligence": {
    "structural":      { "maxGraphDepth": 5, "enableTypeFlow": true, "enableScopeTracking": true, "extractDecorators": true },
    "semantic":        { "enablePatternRecognition": true, "enableDataFlowAnalysis": true, "dataFlowMaxDepth": 10, "enableUsageMining": true, "embeddingProvider": "openai", "embeddingModel": "text-embedding-3-small" },
    "intent":          { "enable": true, "llmProvider": "anthropic", "llmModel": "claude-sonnet-4.5", "batchSize": 5, "cacheEnabled": true, "minConfidence": 0.6, "backgroundExtraction": true },
    "contextAssembly": { "defaultMode": "task", "defaultDepth": "medium", "budgets": { "task": 8000, "session": 15000, "project": 30000 }, "minQualityScore": 0.7 }
  }
}
```

## Testing

```bash
# Unit tests
node --test tests/runtime/data-flow-analyzer.test.js
node --test tests/runtime/intent-cache.test.js
node --test tests/runtime/context-assembly.test.js
node --test tests/runtime/budget-manager.test.js
node --test tests/runtime/result-ranker.test.js

# Integration test
node --test tests/runtime/context-integration.test.js

# E2E test (drives the full L1→L4 flow against a real SQLite DB)
node --test tests/runtime/e2e-context-gathering.test.js
```

## Performance

- **Indexing:** 1-3 minutes for a medium project (one-time + incremental)
- **Query:** 3-5 seconds for comprehensive context
- **Storage:** 2-3x codebase size (embeddings + patterns + intents)

## Troubleshooting

**Slow indexing**
- Reduce `structural.maxGraphDepth` to 3
- Disable `intent.backgroundExtraction`

**High LLM costs**
- Increase `intent.batchSize` to 10
- Lower `intent.minConfidence` to 0.7
- The intent cache is enabled by default; verify it has not been disabled

**Missing context**
- Increase the budget for the relevant mode (task / session / project)
- Set `depth` to `deep`
- Inspect `metadata.layerContributions` and `metadata.coverageMetrics` to see which layer fell short

## References

- Implementation plan: `docs/superpowers/plans/2026-05-10-multi-layer-intelligence-stack.md`
- Configuration reference: `docs/configuration/code-intelligence.md`
- Project graph DB: `src/runtime/analysis/project-graph-db.js`
- Context assembly manager: `src/runtime/managers/context-assembly-manager.js`
- Budget manager and result ranker: `src/runtime/lib/budget-manager.js`, `src/runtime/lib/result-ranker.js`
