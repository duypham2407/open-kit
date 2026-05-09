# Multi-Layer Intelligence Stack for Comprehensive Codebase Understanding

**Date:** 2026-05-10
**Status:** Approved for Implementation
**Author:** Design Session with User

## Executive Summary

This design implements a comprehensive 4-layer intelligence stack to ensure OpenKit reads codebases **broadly** (finds all relevant context), **deeply** (understands how code works), and **reliably** (never misses critical context). The system addresses intermittent context-missing issues across large codebases, post-refactor states, special file types, incomplete indexing, and unfamiliar code.

## Problem Statement

OpenKit agents occasionally miss context when coding, leading to:
- Incomplete understanding of dependencies between files
- Missing relevant code during searches
- Insufficient tracking of symbol usage across codebase
- Inadequate support for certain programming languages or file types
- Loss of context in large codebases or after major refactors

These issues occur intermittently but impact code quality and cause avoidable bugs.

## Goals

1. **Broad Coverage:** Always find ALL relevant context, even distant relationships
2. **Deep Understanding:** Understand structure, semantics, data flow, patterns, business logic, and architectural intent
3. **Reliability:** Zero false negatives on critical context
4. **Multi-Level Operation:** Support task-level, session-level, and project-level context gathering
5. **Hybrid Approach:** Combine static analysis (fast, deterministic) with LLM augmentation (understanding, intent)

## Non-Goals

- Real-time context gathering (accepting 3-5 second latency for comprehensive results)
- Zero storage overhead (accepting 2-3x storage increase)
- Minimal setup (accepting additional configuration for embedding models and analysis depth)

## Architecture Overview

### Four-Layer Stack

**Layer 1 - Structural Layer** (Foundation)
- Pure static analysis: imports, symbols, references, call graph, types, scopes
- Provides the "skeleton" - what connects to what
- Fast, deterministic, always available

**Layer 2 - Semantic Layer** (Meaning)
- Pattern recognition, data flow tracking, usage mining
- Hybrid: embeddings for similarity + graph analysis for flow
- Provides the "muscles" - how things work together

**Layer 3 - Intent Layer** (Understanding)
- LLM-augmented business logic extraction
- Extracts constraints, edge cases, design patterns, architectural intent
- Provides the "brain" - why things exist

**Layer 4 - Context Assembly** (Orchestration)
- Smart orchestrator querying all 3 layers
- Ranks, filters, manages token budget
- Supports task/session/project modes
- Provides the "decision making" - what to include

### Data Flow

```
Code Changes
    ↓
L1: Structural Indexing (graph update)
    ↓
L2: Semantic Analysis (embeddings + patterns)
    ↓
L3: Intent Extraction (LLM analysis)
    ↓
Cached & Ready

Agent Task Request
    ↓
L4: Context Assembly Orchestrator
    ↓
Query L1 + L2 + L3 in parallel
    ↓
Rank, Merge, Filter by Budget
    ↓
Comprehensive Context → Agent
```

## Layer 1: Structural Layer

### Enhanced Schema

**Extend `nodes` table:**
```sql
ALTER TABLE nodes ADD COLUMN module_type TEXT;      -- 'esm', 'commonjs', 'mixed'
ALTER TABLE nodes ADD COLUMN package_name TEXT;     -- for node_modules files
ALTER TABLE nodes ADD COLUMN is_test BOOLEAN;       -- detect test files
ALTER TABLE nodes ADD COLUMN is_config BOOLEAN;     -- detect config files
```

**Extend `symbols` table:**
```sql
ALTER TABLE symbols ADD COLUMN signature TEXT;          -- full function/class signature
ALTER TABLE symbols ADD COLUMN return_type TEXT;        -- return type annotation
ALTER TABLE symbols ADD COLUMN params_json TEXT;        -- parameters with types
ALTER TABLE symbols ADD COLUMN decorators_json TEXT;    -- decorators/annotations
ALTER TABLE symbols ADD COLUMN parent_symbol_id INTEGER; -- nested symbols
ALTER TABLE symbols ADD COLUMN scope_chain TEXT;        -- lexical scope path
ALTER TABLE symbols ADD COLUMN start_col INTEGER;
ALTER TABLE symbols ADD COLUMN end_col INTEGER;
```

**New `type_flows` table:**
```sql
CREATE TABLE type_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_symbol_id INTEGER NOT NULL,
  to_symbol_id INTEGER NOT NULL,
  flow_type TEXT NOT NULL,              -- 'param', 'return', 'assignment', 'property'
  node_id INTEGER NOT NULL,
  line INTEGER NOT NULL,
  confidence REAL DEFAULT 1.0,          -- 0.0-1.0, higher for explicit types
  FOREIGN KEY (from_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (to_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_type_flows_from ON type_flows(from_symbol_id);
CREATE INDEX idx_type_flows_to ON type_flows(to_symbol_id);
```

**New `scope_contexts` table:**
```sql
CREATE TABLE scope_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER NOT NULL,
  scope_type TEXT NOT NULL,             -- 'module', 'function', 'class', 'block'
  parent_scope_id INTEGER,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  bindings_json TEXT,                   -- local variables/params
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_scope_id) REFERENCES scope_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_scope_contexts_node ON scope_contexts(node_id);
CREATE INDEX idx_scope_contexts_parent ON scope_contexts(parent_scope_id);
```

### Enhanced Analysis

Upgrade `import-graph-builder.js` to extract:
- Type annotations (TypeScript, JSDoc, Flow)
- Data flow within functions (assignments, returns, parameter passing)
- Scope chains for accurate reference resolution
- Patterns: factories, singletons, dependency injection
- Decorators and their metadata
- Module type detection (ESM vs CommonJS)
- Test file detection (by path or imports)

### New Capabilities

L1 can answer:
- "Find all functions returning type User"
- "Show data flow from userInput parameter to database.save call"
- "Which exported symbols are never imported?"
- "Find all classes using @Injectable decorator"
- "Show complete scope chain for this variable reference"
- "List all test files for this module"

## Layer 2: Semantic Layer

### Pattern Recognition System

**New `code_patterns` table:**
```sql
CREATE TABLE code_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT NOT NULL,           -- 'api-usage', 'error-handling', 'validation', etc.
  primary_symbol_id INTEGER NOT NULL,
  related_symbols_json TEXT,            -- list of symbol IDs involved
  node_id INTEGER NOT NULL,
  example_code TEXT,                    -- representative snippet
  frequency INTEGER DEFAULT 1,          -- occurrence count
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (primary_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_code_patterns_type ON code_patterns(pattern_type);
CREATE INDEX idx_code_patterns_symbol ON code_patterns(primary_symbol_id);
```

### Pattern Extractors

**PatternRecognitionService** with specialized extractors:

1. **API Usage Pattern Extractor**
   - Analyzes how functions/classes are called
   - Tracks parameter patterns, error handling, return value usage
   - Output: typical usage fingerprints

2. **Validation Pattern Extractor**
   - Detects common validation checks (null, type guards, boundaries)
   - Maps validation to domain concepts
   - Output: validation strategy fingerprints

3. **Error Handling Pattern Extractor**
   - Identifies try/catch patterns, error propagation styles
   - Tracks error types and handling strategies
   - Output: error handling fingerprints

4. **Architectural Pattern Detector**
   - Recognizes factory, singleton, observer, DI patterns
   - Maps code to known design patterns
   - Output: pattern classifications with confidence

5. **Test Pattern Analyzer**
   - Identifies test structures, mock patterns, assertion styles
   - Links tests to production code
   - Output: test coverage patterns

### Data Flow Tracker

**New `DataFlowAnalyzer` component:**

```javascript
class DataFlowAnalyzer {
  // Trace values through transformations
  traceFlow(options) {
    // Input: { from, to, maxDepth, includeTransforms }
    // Output: {
    //   path: [step1, step2, ...],
    //   transformations: [...],
    //   sideEffects: [...]
    // }
  }
  
  // Build dependency chains
  buildDependencyChain(symbolId) {
    // Output: {
    //   symbol,
    //   dependsOn: [symbol1, symbol2, ...],
    //   transitiveDepth: number
    // }
  }
  
  // Detect untrusted input flows (security)
  traceUntrustedInput(entryPoints) {
    // Output: {
    //   flows: [{ from: userInput, to: dangerousOperation, sanitized: false }],
    //   risks: [...]
    // }
  }
}
```

Capabilities:
- Trace: `userInput → validateInput → sanitize → buildQuery → db.query`
- Detect side effects: file writes, API calls, state mutations
- Build dependency chains: "This variable depends on these 5 values"
- Security analysis: untrusted input flow detection

### Usage Pattern Miner

**New `UsagePatternMiner` component:**

```javascript
class UsagePatternMiner {
  // Analyze actual usage across codebase
  analyzeSymbolUsage(symbolId) {
    // Output: {
    //   commonParams: [...],
    //   typicalContext: [...],
    //   errorHandling: {...},
    //   returnValueUsed: percentage,
    //   callFrequency: number,
    //   anomalies: [...]
    // }
  }
  
  // Build usage fingerprints
  buildFingerprint(symbolId) {
    // Output: UsageFingerprint object
  }
  
  // Detect anomalies
  detectAnomalies(symbolId) {
    // Output: unusual usages that might indicate bugs
  }
}
```

### Enhanced Embeddings

Enrich embedding chunk metadata:
- Pattern tags: `['factory-pattern', 'validates-input', 'async-operation']`
- Usage context: typical callers, common use cases
- Data flow summary: inputs/outputs/side effects
- Architectural role: 'controller', 'service', 'repository', 'utility'
- Related test files
- Confidence scores

### Hybrid Search Improvements

Upgrade `tool.semantic-search`:

```javascript
// Multi-source search
{
  query: "authentication code",
  results: [
    // 1. Embedding matches: semantically about auth
    { source: 'embedding', score: 0.92, ... },
    
    // 2. Pattern matches: code with 'authentication-pattern' tag
    { source: 'pattern', score: 0.88, ... },
    
    // 3. Usage matches: validates credentials
    { source: 'usage', score: 0.85, ... },
    
    // 4. Graph matches: in auth dependency chain
    { source: 'graph', score: 0.80, ... }
  ],
  merged: true,
  rankedBy: 'multi-layer-relevance'
}
```

## Layer 3: Intent Layer (LLM-Augmented)

### Intent Storage Schema

**New `code_intents` table:**
```sql
CREATE TABLE code_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER,
  symbol_id INTEGER,
  intent_type TEXT NOT NULL,            -- 'business-rule', 'constraint', 'edge-case', etc.
  description TEXT NOT NULL,            -- LLM-generated explanation
  evidence_code TEXT,                   -- code snippet showing intent
  confidence REAL DEFAULT 1.0,
  model TEXT,                           -- which model extracted this
  extracted_at REAL NOT NULL,
  validated BOOLEAN DEFAULT 0,          -- human validation flag
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);

CREATE INDEX idx_code_intents_type ON code_intents(intent_type);
CREATE INDEX idx_code_intents_node ON code_intents(node_id);
CREATE INDEX idx_code_intents_symbol ON code_intents(symbol_id);
```

**New `architectural_context` table:**
```sql
CREATE TABLE architectural_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_type TEXT NOT NULL,           -- 'module-purpose', 'layer-boundary', 'design-pattern', etc.
  scope TEXT NOT NULL,                  -- 'global', 'module:auth', 'class:UserService'
  description TEXT NOT NULL,
  related_nodes_json TEXT,              -- files involved
  related_symbols_json TEXT,            -- key symbols
  constraints_json TEXT,                -- extracted constraints
  examples_json TEXT,                   -- code examples
  confidence REAL DEFAULT 1.0,
  model TEXT,
  extracted_at REAL NOT NULL
);

CREATE INDEX idx_arch_context_type ON architectural_context(context_type);
CREATE INDEX idx_arch_context_scope ON architectural_context(scope);
```

### LLM Intent Extractors

**IntentExtractionService** with specialized extractors:

**1. Business Rule Extractor**
```javascript
{
  input: {
    code: functionImplementation,
    context: { callers, callees, comments, tests }
  },
  output: {
    rules: ['User must be authenticated', 'Email must be unique'],
    constraints: ['Max 5 login attempts', 'Password min 8 chars'],
    validation: ['Checks email format', 'Validates age >= 18'],
    invariants: ['createdAt < updatedAt', 'balance >= 0']
  }
}
```

**2. Edge Case Detector**
```javascript
{
  input: {
    implementation: functionCode,
    tests: relatedTestFiles
  },
  output: {
    handledCases: ['null input', 'empty array', 'negative number'],
    missingCases: ['extremely large number', 'concurrent access'],
    errorPaths: ['throws ValidationError on invalid email'],
    testCoverage: { covered: 8, total: 11 }
  }
}
```

**3. Design Pattern Identifier**
```javascript
{
  input: {
    code: classOrModuleCode,
    dependencies: importedSymbols
  },
  output: {
    pattern: 'Repository Pattern',
    intent: 'Abstracts data access from business logic',
    responsibilities: ['Query building', 'Result mapping', 'Connection pooling'],
    collaborators: [
      { role: 'client', name: 'UserService' },
      { role: 'dependency', name: 'Database' }
    ],
    confidence: 0.92
  }
}
```

**4. Data Transformation Explainer**
```javascript
{
  input: {
    function: transformationFunction,
    inputType: apiResponseType,
    outputType: domainModelType
  },
  output: {
    purpose: 'Converts API response to domain model',
    transformations: [
      'Renames snake_case to camelCase',
      'Converts timestamp to Date object',
      'Filters out soft-deleted items',
      'Enriches with default values'
    ],
    invariants: ['Output always has id field', 'createdAt < updatedAt'],
    lossOfInformation: ['Discards _metadata field'],
    confidence: 0.88
  }
}
```

**5. Constraint Extractor**
```javascript
{
  input: {
    code: validationOrBusinessLogic,
    domain: 'user-management'
  },
  output: {
    constraints: [
      { type: 'range', field: 'age', min: 18, max: 120 },
      { type: 'format', field: 'email', pattern: 'RFC5322' },
      { type: 'uniqueness', field: 'email', scope: 'global' },
      { type: 'rate-limit', operation: 'login', limit: '5/hour/ip' }
    ],
    source: 'code' | 'comment' | 'inferred'
  }
}
```

### Caching and Incremental Update

**IntentCacheManager:**
- Cache keyed by: `hash(code) + extractorType + modelVersion`
- Invalidate when: file content changes (hash mismatch)
- Batch processing: analyze multiple symbols with shared context in one LLM call
- Incremental: only re-analyze symbols affected by changes
- Background processing: extract during idle time, don't block indexing

**Cache structure:**
```javascript
{
  cacheKey: 'sha256(code)-business-rule-claude-sonnet-4.5',
  result: { /* extracted intent */ },
  timestamp: 1715327530,
  hits: 15,
  validated: false
}
```

### Quality Control

**Confidence Scoring:**
```javascript
class IntentConfidenceScorer {
  score(intent, structuralData, tests) {
    const scores = {
      // Cross-reference with L1 structural data
      codeEvidence: this.hasCodeEvidence(intent, structuralData),  // 0.0-0.3
      
      // Multiple extractions agreement
      modelConsensus: this.compareExtractions(intent, otherModels), // 0.0-0.3
      
      // Validation against tests
      testAlignment: this.checkTestCoverage(intent, tests),         // 0.0-0.2
      
      // LLM internal confidence
      llmConfidence: intent.rawConfidence,                          // 0.0-0.2
      
      // Total: 0.0-1.0
    };
    
    return Object.values(scores).reduce((a, b) => a + b, 0);
  }
}
```

**Validation Workflow:**
1. Flag low-confidence extractions (<0.6) for review
2. Allow manual validation/correction
3. Store validated intents with `validated: true` flag
4. Use validated intents to improve future extractions (few-shot examples)

### Integration with Other Layers

**Enrichment:**
- L1 graph queries filter by business rules: `findFunctions({ hasIntent: 'validates-user-input' })`
- L2 embeddings include intent tags: `['validates-email', 'enforces-rule-BR-123']`
- L4 context assembly prioritizes symbols with clear intent explanations

**Query Example:**
```javascript
// Query: "Find code related to user authentication constraints"

// L1: finds auth-related symbols via graph
const l1Results = graphManager.findSymbols({ 
  relatedTo: 'authentication', 
  type: 'function' 
});

// L2: finds semantically similar code via embeddings
const l2Results = embeddingSearch.search({ 
  query: 'authentication constraints',
  topK: 20 
});

// L3: finds code with constraint intents
const l3Results = intentStore.query({ 
  intentType: 'constraint',
  context: 'authentication' 
});

// Merge and rank by multi-layer relevance
const merged = mergeResults([l1Results, l2Results, l3Results]);
```

## Layer 4: Context Assembly (Orchestration)

### Context Assembly Manager

**ContextAssemblyManager** - core orchestrator:

```javascript
class ContextAssemblyManager {
  constructor({ layers, budgetManager, sessionMemory }) {
    this.l1 = layers.structural;
    this.l2 = layers.semantic;
    this.l3 = layers.intent;
    this.budgetManager = budgetManager;
    this.sessionMemory = sessionMemory;
  }
  
  // Task-level: focused context for specific task
  async gatherTaskContext(options) {
    const { task, focus, depth, budget } = options;
    return this.executeQueryPlan({
      mode: 'task',
      focus,
      depth: depth || 'medium',
      budget: budget || 8000
    });
  }
  
  // Session-level: maintain rich state during session
  async gatherSessionContext(options) {
    const { sessionId, recentFiles, workingMemory, depth, budget } = options;
    return this.executeQueryPlan({
      mode: 'session',
      priorContext: workingMemory,
      boost: recentFiles,
      depth: depth || 'broad',
      budget: budget || 15000
    });
  }
  
  // Project-level: comprehensive codebase understanding
  async gatherProjectContext(options) {
    const { query, scope, depth, budget } = options;
    return this.executeQueryPlan({
      mode: 'project',
      query,
      scope: scope || 'entire-project',
      depth: depth || 'deep',
      budget: budget || 30000
    });
  }
}
```

### Multi-Layer Query Strategy

**Query Execution Plan:**
```javascript
{
  // L1 Structural queries (parallel)
  structural: [
    { type: 'dependencies', target: focusFiles, depth: 3 },
    { type: 'dependents', target: focusFiles, depth: 2 },
    { type: 'symbols', filter: 'exported' },
    { type: 'call-graph', direction: 'both', depth: 2 },
    { type: 'data-flow', from: 'userInput', to: 'storage' },
    { type: 'type-flow', symbols: relevantSymbols }
  ],
  
  // L2 Semantic queries (parallel)
  semantic: [
    { type: 'embedding-search', query: taskDescription, topK: 20 },
    { type: 'pattern-search', patterns: ['validation', 'error-handling'] },
    { type: 'usage-patterns', symbols: relevantSymbols },
    { type: 'similar-code', reference: focusFiles },
    { type: 'data-flow-analysis', entry: mainFunction }
  ],
  
  // L3 Intent queries (parallel)
  intent: [
    { type: 'business-rules', scope: relevantModules },
    { type: 'constraints', related: focusSymbols },
    { type: 'edge-cases', coverage: testFiles },
    { type: 'design-patterns', context: architecturalLayer },
    { type: 'architectural-context', scope: moduleScope }
  ]
}
```

**Execution:**
```javascript
async executeQueryPlan(plan) {
  // Execute all layer queries in parallel
  const [l1Results, l2Results, l3Results] = await Promise.all([
    this.l1.executeQueries(plan.structural),
    this.l2.executeQueries(plan.semantic),
    this.l3.executeQueries(plan.intent)
  ]);
  
  // Merge and deduplicate
  const merged = this.mergeResults(l1Results, l2Results, l3Results);
  
  // Rank by multi-layer relevance
  const ranked = this.rankResults(merged, plan);
  
  // Apply budget constraints
  const filtered = this.budgetManager.applyBudget(ranked, plan.budget);
  
  // Enrich with cross-references
  const enriched = this.enrichContext(filtered);
  
  // Validate quality
  const validated = this.validate(enriched, plan);
  
  return validated;
}
```

### Result Ranking and Fusion

**Multi-Layer Ranking Algorithm:**
```javascript
function rankContextItem(item, query, context) {
  const scores = {
    // L1 Structural relevance (0.0-0.3)
    graphDistance: 0.15 * (1.0 / (item.graphHops + 1)),
    centralityScore: 0.10 * item.pageRank,
    callDepth: 0.05 * (1.0 / (item.callDepth + 1)),
    
    // L2 Semantic relevance (0.0-0.4)
    embeddingSimilarity: 0.20 * item.cosineSimilarity,
    patternMatch: 0.10 * (item.matchedPatterns.length * 0.1),
    usageFrequency: 0.05 * Math.log(item.usageCount + 1) * 0.1,
    dataFlowRelevance: 0.05 * item.dataFlowScore,
    
    // L3 Intent relevance (0.0-0.3)
    intentMatch: 0.15 * (item.intentTypes.includes(query.intentType) ? 1.0 : 0),
    constraintRelevance: 0.10 * (item.relatedConstraints.length * 0.1),
    designPatternMatch: 0.05 * (item.matchesPattern ? 1.0 : 0),
    
    // Cross-layer boosters (0.0-0.5)
    multiLayerBonus: 0.20 * (item.foundInLayers.size - 1),  // boost if in multiple layers
    recencyBonus: 0.10 * (item.recentlyModified ? 1.0 : 0),
    testCoverage: 0.05 * (item.hasTests ? 1.0 : 0),
    validatedIntent: 0.10 * (item.hasValidatedIntent ? 1.0 : 0),
    sessionRelevance: 0.05 * (item.inWorkingSet ? 1.0 : 0)
  };
  
  // Total possible: 1.0
  return Object.values(scores).reduce((a, b) => a + b, 0);
}
```

**Deduplication:**
```javascript
class ResultDeduplicator {
  deduplicate(results) {
    const seen = new Map(); // key: file+symbol, value: merged item
    
    for (const item of results) {
      const key = `${item.file}:${item.symbol}`;
      
      if (seen.has(key)) {
        // Merge metadata from all layers
        const existing = seen.get(key);
        existing.foundInLayers.add(item.layer);
        existing.metadata = this.mergeMetadata(existing.metadata, item.metadata);
        existing.score = Math.max(existing.score, item.score);
      } else {
        item.foundInLayers = new Set([item.layer]);
        seen.set(key, item);
      }
    }
    
    return Array.from(seen.values());
  }
  
  mergeMetadata(existing, newMeta) {
    return {
      // L1 structural
      dependencies: [...new Set([...existing.dependencies || [], ...newMeta.dependencies || []])],
      callGraph: { ...existing.callGraph, ...newMeta.callGraph },
      
      // L2 semantic
      patterns: [...new Set([...existing.patterns || [], ...newMeta.patterns || []])],
      usageExamples: [...existing.usageExamples || [], ...newMeta.usageExamples || []],
      
      // L3 intent
      businessRules: [...existing.businessRules || [], ...newMeta.businessRules || []],
      constraints: [...existing.constraints || [], ...newMeta.constraints || []],
      
      // Keep all unique insights
    };
  }
}
```

### Budget Management

**Smart Token Budget Allocation:**
```javascript
class BudgetManager {
  allocate(totalBudget, priorities) {
    return {
      critical: Math.floor(totalBudget * 0.40),      // Must-have: direct deps, callers
      important: Math.floor(totalBudget * 0.30),     // Related: patterns, similar code
      supplementary: Math.floor(totalBudget * 0.20), // Background: business rules, arch
      buffer: Math.floor(totalBudget * 0.10)         // Overflow: high-scoring extras
    };
  }
  
  applyBudget(rankedItems, totalBudget) {
    const allocation = this.allocate(totalBudget);
    const result = [];
    
    // Categorize items
    const categorized = this.categorizeItems(rankedItems);
    
    // Fill critical bucket first
    result.push(...this.fillBucket(categorized.critical, allocation.critical));
    
    // Then important
    result.push(...this.fillBucket(categorized.important, allocation.important));
    
    // Then supplementary
    result.push(...this.fillBucket(categorized.supplementary, allocation.supplementary));
    
    // Use buffer for high-scoring overflow
    const remaining = rankedItems.filter(i => !result.includes(i));
    const overflow = remaining
      .filter(i => i.score > 0.7)
      .slice(0, this.estimateCapacity(allocation.buffer));
    result.push(...overflow);
    
    return result;
  }
  
  categorizeItems(items) {
    return {
      critical: items.filter(i => 
        i.graphHops <= 1 || 
        i.directDependency || 
        i.directCaller
      ),
      important: items.filter(i =>
        i.patternMatch ||
        i.highSimilarity ||
        i.graphHops <= 3
      ),
      supplementary: items.filter(i =>
        i.hasIntent ||
        i.architecturalContext ||
        i.graphHops > 3
      )
    };
  }
  
  estimateCapacity(tokenBudget) {
    const avgTokensPerItem = 200; // estimate
    return Math.floor(tokenBudget / avgTokensPerItem);
  }
}
```

### Context Enrichment

**Cross-Reference Enrichment:**
```javascript
class ContextEnricher {
  enrich(contextItems) {
    return contextItems.map(item => ({
      // Core identification
      file: item.file,
      symbol: item.symbol,
      code: item.code,
      location: { line: item.line, column: item.column },
      
      // L1 Structural metadata
      structural: {
        dependencies: item.dependencies,
        dependents: item.dependents,
        callGraph: {
          calls: item.callees,
          calledBy: item.callers
        },
        dataFlow: item.dataFlowPaths,
        typeFlow: item.typeFlowChain,
        scopeChain: item.scopeChain,
        moduleType: item.moduleType
      },
      
      // L2 Semantic metadata
      semantic: {
        patterns: item.patterns,
        usageFingerprint: item.usageFingerprint,
        similarCode: item.similarCodeRefs,
        dataFlowRole: item.dataFlowRole,
        architecturalRole: item.architecturalRole
      },
      
      // L3 Intent metadata
      intent: {
        businessRules: item.businessRules,
        constraints: item.constraints,
        edgeCases: item.edgeCases,
        designPattern: item.designPattern,
        purpose: item.purpose,
        invariants: item.invariants
      },
      
      // Cross-layer metadata
      meta: {
        score: item.score,
        foundInLayers: Array.from(item.foundInLayers),
        confidence: item.confidence,
        testCoverage: item.testCoverage,
        recentlyModified: item.recentlyModified,
        validated: item.validated
      }
    }));
  }
}
```

**Final Context Structure:**
```javascript
{
  primaryContext: [
    {
      file: 'src/user/registration.js',
      symbol: 'registerUser',
      code: '...',
      location: { line: 45, column: 0 },
      
      structural: { dependencies: [...], callGraph: {...}, ... },
      semantic: { patterns: [...], usageFingerprint: {...}, ... },
      intent: { businessRules: [...], constraints: [...], ... },
      meta: { score: 0.92, foundInLayers: ['L1', 'L2', 'L3'], ... }
    },
    // ... more primary context items
  ],
  
  relatedContext: [
    // Supporting context items
  ],
  
  metadata: {
    query: originalQuery,
    mode: 'task' | 'session' | 'project',
    
    coverageMetrics: {
      filesAnalyzed: 45,
      symbolsIncluded: 120,
      patternsDetected: 15,
      intentsExtracted: 28,
      totalGraphDepth: 5
    },
    
    layerContributions: {
      L1_structural: 40,
      L2_semantic: 35,
      L3_intent: 25
    },
    
    budgetUsage: {
      allocated: 8000,
      used: 7650,
      breakdown: {
        critical: 3200,
        important: 2400,
        supplementary: 1600,
        buffer: 450
      }
    },
    
    confidenceScore: 0.87,
    qualityChecks: {
      completeness: 'passed',
      correctness: 'passed',
      coverage: 'passed',
      budgetCompliance: 'passed'
    },
    
    executionTime: {
      L1: 450,  // ms
      L2: 1200,
      L3: 2100,
      assembly: 300,
      total: 4050
    }
  }
}
```

### Session State Management

**SessionMemory:**
```javascript
class SessionMemory {
  constructor() {
    this.workingSet = new Map();      // file -> access count
    this.knownPatterns = new Set();   // patterns seen
    this.intentCache = new Map();     // symbol -> cached intent
    this.hypotheses = [];             // agent's working theories
    this.taskHistory = [];            // completed tasks
  }
  
  updateFromTask(taskContext) {
    // Learn from what agent actually used
    for (const item of taskContext.accessedFiles) {
      const count = this.workingSet.get(item) || 0;
      this.workingSet.set(item, count + 1);
    }
    
    for (const pattern of taskContext.discoveredPatterns) {
      this.knownPatterns.add(pattern);
    }
    
    this.taskHistory.push({
      task: taskContext.task,
      files: taskContext.accessedFiles,
      patterns: taskContext.discoveredPatterns,
      timestamp: Date.now()
    });
  }
  
  primeNextQuery(query) {
    // Use session history to enhance query
    const recentFiles = this.getRecentlyAccessedFiles(10);
    const commonPatterns = this.getMostCommonPatterns(5);
    
    return {
      ...query,
      boost: recentFiles,           // boost recently used files in ranking
      knownPatterns: commonPatterns, // prioritize known patterns
      priorContext: this.hypotheses, // include working theories
      sessionHistory: this.taskHistory.slice(-3) // last 3 tasks
    };
  }
  
  getRecentlyAccessedFiles(limit) {
    return Array.from(this.workingSet.entries())
      .sort((a, b) => b[1] - a[1])  // sort by access count
      .slice(0, limit)
      .map(([file, _]) => file);
  }
  
  getMostCommonPatterns(limit) {
    // Count pattern frequency across task history
    const frequency = new Map();
    for (const task of this.taskHistory) {
      for (const pattern of task.patterns) {
        frequency.set(pattern, (frequency.get(pattern) || 0) + 1);
      }
    }
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([pattern, _]) => pattern);
  }
  
  clear() {
    // Clear session state (e.g., on new session start)
    this.workingSet.clear();
    this.knownPatterns.clear();
    this.hypotheses = [];
    this.taskHistory = [];
    // Keep intentCache for performance
  }
}
```

### Validation and Quality Checks

**ContextValidator:**
```javascript
class ContextValidator {
  validate(context, task) {
    const checks = {
      // Completeness checks
      hasPrimaryFiles: this.checkPrimaryFiles(context, task),
      hasDependencies: context.primaryContext.some(i => i.structural.dependencies.length > 0),
      hasUsageExamples: context.metadata.layerContributions.L2_semantic > 0,
      hasIntentData: context.metadata.layerContributions.L3_intent > 0,
      
      // Correctness checks
      noDeadReferences: this.checkDeadReferences(context),
      intentAlignedWithCode: this.verifyIntentCodeMatch(context),
      noConflictingData: this.checkConflicts(context),
      
      // Coverage checks
      coverageScore: this.calculateCoverage(context, task),
      allLayersContributed: context.metadata.layerContributions.L1_structural > 0 &&
                           context.metadata.layerContributions.L2_semantic > 0 &&
                           context.metadata.layerContributions.L3_intent > 0,
      minDepthAchieved: context.metadata.coverageMetrics.totalGraphDepth >= 3,
      
      // Budget checks
      withinBudget: context.metadata.budgetUsage.used <= context.metadata.budgetUsage.allocated,
      notTooSparse: context.primaryContext.length >= (task.minItems || 5),
      notTooNoisy: context.primaryContext.length <= (task.maxItems || 100)
    };
    
    const passed = Object.values(checks).every(v => v === true);
    const warnings = this.generateWarnings(checks);
    
    return {
      passed,
      checks,
      warnings,
      score: this.calculateQualityScore(checks)
    };
  }
  
  checkPrimaryFiles(context, task) {
    if (!task.targetFiles) return true;
    return task.targetFiles.every(file => 
      context.primaryContext.some(item => item.file === file)
    );
  }
  
  checkDeadReferences(context) {
    // Verify all referenced files exist
    for (const item of context.primaryContext) {
      for (const dep of item.structural.dependencies || []) {
        if (!this.fileExists(dep)) return false;
      }
    }
    return true;
  }
  
  verifyIntentCodeMatch(context) {
    // Check if L3 intents have code evidence in L1/L2 data
    for (const item of context.primaryContext) {
      if (item.intent.businessRules.length > 0) {
        // Should have validation patterns in L2
        const hasValidation = item.semantic.patterns.some(p => 
          p.includes('validation') || p.includes('check')
        );
        if (!hasValidation && item.meta.confidence < 0.7) {
          return false; // Suspicious: claims validation but no pattern
        }
      }
    }
    return true;
  }
  
  calculateCoverage(context, task) {
    const metrics = context.metadata.coverageMetrics;
    
    // Coverage score based on multiple factors
    const scores = {
      fileCount: Math.min(metrics.filesAnalyzed / 20, 1.0) * 0.25,
      symbolCount: Math.min(metrics.symbolsIncluded / 50, 1.0) * 0.25,
      patternDetection: Math.min(metrics.patternsDetected / 10, 1.0) * 0.25,
      intentExtraction: Math.min(metrics.intentsExtracted / 15, 1.0) * 0.25
    };
    
    return Object.values(scores).reduce((a, b) => a + b, 0);
  }
  
  generateWarnings(checks) {
    const warnings = [];
    
    if (!checks.hasPrimaryFiles) {
      warnings.push('Warning: Not all target files included in context');
    }
    
    if (!checks.allLayersContributed) {
      warnings.push('Warning: Some analysis layers did not contribute results');
    }
    
    if (!checks.intentAlignedWithCode) {
      warnings.push('Warning: Intent extractions may not align with code evidence');
    }
    
    if (checks.notTooSparse === false) {
      warnings.push('Warning: Context may be too sparse (fewer items than expected)');
    }
    
    if (checks.notTooNoisy === false) {
      warnings.push('Warning: Context may be too noisy (more items than budget allows)');
    }
    
    return warnings;
  }
  
  calculateQualityScore(checks) {
    const weights = {
      hasPrimaryFiles: 0.15,
      hasDependencies: 0.10,
      hasUsageExamples: 0.05,
      hasIntentData: 0.05,
      noDeadReferences: 0.15,
      intentAlignedWithCode: 0.10,
      allLayersContributed: 0.10,
      coverageScore: 0.20,
      withinBudget: 0.05,
      notTooSparse: 0.03,
      notTooNoisy: 0.02
    };
    
    let score = 0;
    for (const [check, weight] of Object.entries(weights)) {
      if (typeof checks[check] === 'boolean') {
        score += checks[check] ? weight : 0;
      } else {
        score += checks[check] * weight;  // for coverageScore
      }
    }
    
    return score;
  }
}
```

## Implementation Strategy

### Phase Breakdown

**Phase 1: Foundation (L1 Enhancements)**
- Extend schema: nodes, symbols, type_flows, scope_contexts
- Upgrade import-graph-builder.js for richer extraction
- Add type annotation extraction (TS/JSDoc)
- Add scope chain tracking
- Add data flow tracking (basic)
- Tests: schema migration, extraction accuracy

**Phase 2: Semantic Layer (L2)**
- Create code_patterns table
- Implement PatternRecognitionService
- Implement DataFlowAnalyzer
- Implement UsagePatternMiner
- Enhance embedding chunk metadata
- Upgrade semantic search to multi-source
- Tests: pattern detection, data flow tracing, usage mining

**Phase 3: Intent Layer (L3)**
- Create code_intents and architectural_context tables
- Implement IntentExtractionService
- Implement specialized extractors (business rules, edge cases, patterns, constraints)
- Implement IntentCacheManager
- Implement confidence scoring
- Tests: intent extraction accuracy, caching, validation

**Phase 4: Context Assembly (L4)**
- Implement ContextAssemblyManager
- Implement multi-layer query execution
- Implement ranking and fusion algorithms
- Implement BudgetManager
- Implement SessionMemory
- Implement ContextValidator
- Tests: query execution, ranking, budget management, validation

**Phase 5: Integration**
- Wire all layers together
- Add runtime config for depth/budget settings
- Add tools: `tool.comprehensive-context`
- Add hooks: session-start context priming
- Add background jobs: incremental L3 extraction
- Tests: end-to-end context gathering

**Phase 6: Optimization**
- Performance tuning: query parallelization, caching
- Storage optimization: compression, indexing
- LLM cost optimization: batch processing, smart caching
- Incremental update optimization
- Tests: performance benchmarks

### File Structure

```
src/runtime/
├── analysis/
│   ├── project-graph-db.js          (extend schema)
│   ├── import-graph-builder.js       (enhance extraction)
│   ├── data-flow-analyzer.js         (NEW)
│   ├── pattern-recognition-service.js (NEW)
│   ├── usage-pattern-miner.js        (NEW)
│   ├── intent-extraction-service.js  (NEW)
│   ├── intent-cache-manager.js       (NEW)
│   └── intent-confidence-scorer.js   (NEW)
│
├── managers/
│   ├── project-graph-manager.js      (enhance with L1+L2 queries)
│   ├── intent-manager.js             (NEW - L3 orchestration)
│   ├── context-assembly-manager.js   (NEW - L4 orchestration)
│   └── session-memory-manager.js     (NEW - session state)
│
├── tools/
│   ├── graph/
│   │   ├── ... (existing tools)
│   │   ├── data-flow-trace.js        (NEW)
│   │   └── type-flow-trace.js        (NEW)
│   │
│   ├── semantic/
│   │   ├── pattern-search.js         (NEW)
│   │   ├── usage-analysis.js         (NEW)
│   │   └── semantic-search.js        (enhance)
│   │
│   ├── intent/
│   │   ├── business-rule-query.js    (NEW)
│   │   ├── constraint-query.js       (NEW)
│   │   └── design-pattern-query.js   (NEW)
│   │
│   └── context/
│       └── comprehensive-context.js  (NEW - main context gathering tool)
│
└── lib/
    ├── budget-manager.js             (NEW)
    ├── result-ranker.js              (NEW)
    ├── result-deduplicator.js        (NEW)
    ├── context-enricher.js           (NEW)
    └── context-validator.js          (NEW)

tests/runtime/
├── l1-structural-enhancements.test.js
├── l2-semantic-layer.test.js
├── l3-intent-layer.test.js
├── l4-context-assembly.test.js
├── data-flow-analyzer.test.js
├── pattern-recognition.test.js
├── usage-pattern-miner.test.js
├── intent-extraction.test.js
├── budget-manager.test.js
├── session-memory.test.js
└── context-integration.test.js
```

## Configuration

**Runtime config (.opencode/openkit.runtime.jsonc):**
```jsonc
{
  "codeIntelligence": {
    // L1 Structural
    "structural": {
      "maxGraphDepth": 5,              // max dependency traversal depth
      "enableTypeFlow": true,          // track type flows
      "enableScopeTracking": true,     // track scope chains
      "extractDecorators": true        // extract decorators/annotations
    },
    
    // L2 Semantic
    "semantic": {
      "enablePatternRecognition": true,
      "patternTypes": [
        "api-usage",
        "error-handling",
        "validation",
        "architectural"
      ],
      "enableDataFlowAnalysis": true,
      "dataFlowMaxDepth": 10,
      "enableUsageMining": true,
      "embeddingProvider": "openai",   // or "ollama", "custom"
      "embeddingModel": "text-embedding-3-small"
    },
    
    // L3 Intent
    "intent": {
      "enable": true,
      "extractors": [
        "business-rule",
        "edge-case",
        "design-pattern",
        "data-transformation",
        "constraint"
      ],
      "llmProvider": "anthropic",      // or "openai", "custom"
      "llmModel": "claude-sonnet-4.5",
      "batchSize": 5,                  // symbols per LLM call
      "cacheEnabled": true,
      "minConfidence": 0.6,            // min confidence to store
      "backgroundExtraction": true     // extract during idle time
    },
    
    // L4 Context Assembly
    "contextAssembly": {
      "defaultMode": "task",           // "task" | "session" | "project"
      "defaultDepth": "medium",        // "shallow" | "medium" | "deep"
      "budgets": {
        "task": 8000,                  // tokens
        "session": 15000,
        "project": 30000
      },
      "budgetAllocation": {
        "critical": 0.40,
        "important": 0.30,
        "supplementary": 0.20,
        "buffer": 0.10
      },
      "enableSessionMemory": true,
      "validateContext": true,
      "minQualityScore": 0.7           // min quality score to return
    }
  }
}
```

## Success Metrics

**Coverage Metrics:**
- Dependency coverage: % of relevant dependencies included
- Symbol coverage: % of relevant symbols found
- Pattern detection rate: patterns found / patterns present
- Intent extraction rate: business rules found / total rules

**Quality Metrics:**
- Context precision: relevant items / total items
- Context recall: found relevant items / all relevant items
- Multi-layer contribution: % of results from all 3 layers
- Validation pass rate: % of contexts passing quality checks

**Performance Metrics:**
- Indexing time: time to index medium project (target: <3 min)
- Query time: time to gather comprehensive context (target: <5 sec)
- Storage overhead: DB size vs codebase size (target: <3x)
- LLM cost: tokens used per extraction (target: minimize via caching)

**Outcome Metrics:**
- Context miss rate: % of coding tasks missing critical context (target: <5%)
- Agent error rate: bugs due to missing context (target: <10% of baseline)
- User satisfaction: rating of context quality (target: >8/10)

## Trade-offs

**Accepted:**
- Indexing time: 1-3 minutes for medium project (one-time + incremental)
- Storage: 2-3x increase (embeddings + patterns + intents)
- Query latency: 3-5 seconds for comprehensive context
- Setup complexity: config for embedding provider, LLM provider, depth settings
- LLM costs: intent extraction requires API calls (mitigated by caching)

**Mitigated:**
- Incremental updates minimize re-indexing
- Smart caching reduces LLM costs
- Background processing avoids blocking
- Budget management prevents context overflow
- Multi-layer validation ensures quality

## Testing Strategy

**Unit Tests:**
- Each component tested in isolation
- Mock dependencies (DB, LLM, embeddings)
- Test edge cases, error handling

**Integration Tests:**
- Multi-layer query execution
- Result merging and ranking
- Budget management
- Context validation

**End-to-End Tests:**
- Full context gathering for real tasks
- Verify all layers contribute
- Validate quality metrics
- Performance benchmarks

**Validation Tests:**
- Compare context with manual analysis
- Track false negatives on known test cases
- Measure precision/recall on labeled dataset

## Rollout Plan

**Week 1-2: Phase 1 (L1 Enhancements)**
- Schema migration
- Enhanced extraction
- Tests

**Week 3-4: Phase 2 (L2 Semantic)**
- Pattern recognition
- Data flow analysis
- Usage mining
- Tests

**Week 5-6: Phase 3 (L3 Intent)**
- Intent extraction service
- Specialized extractors
- Caching and validation
- Tests

**Week 7-8: Phase 4 (L4 Context Assembly)**
- Context assembly manager
- Ranking and fusion
- Budget management
- Session memory
- Tests

**Week 9: Phase 5 (Integration)**
- Wire all layers
- Add tools and hooks
- End-to-end tests

**Week 10: Phase 6 (Optimization)**
- Performance tuning
- Cost optimization
- Documentation
- User testing

## Risks and Mitigations

**Risk: LLM extraction inaccuracy**
- Mitigation: Multi-layer validation, confidence scoring, human validation loop

**Risk: High LLM costs**
- Mitigation: Aggressive caching, batch processing, incremental updates

**Risk: Performance degradation**
- Mitigation: Parallel queries, optimized ranking, smart indexing

**Risk: Storage explosion**
- Mitigation: Compression, TTL on low-confidence intents, configurable retention

**Risk: Complexity barrier**
- Mitigation: Sensible defaults, guided setup, progressive enhancement

## Future Enhancements

**Post-MVP:**
- Multi-language support (Python, Go, Rust, Java)
- Real-time collaboration context sharing
- AI-powered context suggestions
- Custom pattern definitions
- Visual context exploration UI
- Context diff for code reviews
- Historical context analysis (git blame + intent)

## Appendix: Example Scenarios

### Scenario 1: Adding Email Validation

**Input:**
```javascript
{
  task: 'Add email validation to User registration',
  focus: ['src/user/registration.js'],
  depth: 'medium',
  budget: 8000
}
```

**L1 Structural finds:**
- `src/user/registration.js` and its dependencies
- `validateEmail` function (if exists elsewhere)
- Call graph: `registerUser` calls `saveToDb`, `sendWelcomeEmail`
- Data flow: `userInput.email` → `registration.email` → `db.users`

**L2 Semantic finds:**
- Existing validation patterns in codebase (null checks, type guards)
- Usage examples of email validation in other modules
- Similar validation code (phone, username)
- Common error handling patterns

**L3 Intent finds:**
- Business rule: "Email must be unique"
- Constraint: "Email format must follow RFC5322"
- Edge cases handled elsewhere: "Handles + alias in Gmail addresses"
- Design pattern: "Validation layer separates from business logic"

**L4 Assembly produces:**
```javascript
{
  primaryContext: [
    {
      file: 'src/user/registration.js',
      symbol: 'registerUser',
      structural: {
        dependencies: ['db.js', 'email-service.js'],
        callGraph: { calls: ['saveToDb', 'sendEmail'], calledBy: ['POST /register'] },
        dataFlow: ['userInput.email', 'registration.email', 'db.users.email']
      },
      semantic: {
        patterns: ['async-validation', 'error-handling-try-catch'],
        similarCode: ['src/admin/createAccount.js'],
        usageFingerprint: { errorHandling: 'try-catch: 95%' }
      },
      intent: {
        businessRules: ['Email must be unique'],
        constraints: ['Email format: RFC5322'],
        edgeCases: ['Handles Gmail + aliases'],
        designPattern: 'Service Layer'
      }
    },
    {
      file: 'src/validation/email-validator.js',
      symbol: 'validateEmail',
      // ... existing validator context
    }
  ],
  relatedContext: [...],
  metadata: {
    coverageMetrics: { filesAnalyzed: 12, symbolsIncluded: 35, ... },
    confidenceScore: 0.91
  }
}
```

Agent now has complete context to implement email validation correctly.

### Scenario 2: Refactoring Authentication

**Input:**
```javascript
{
  task: 'Refactor authentication to use JWT',
  focus: ['src/auth/'],
  depth: 'deep',
  budget: 15000
}
```

**L1 Structural finds:**
- All auth-related files and their dependencies (10+ files)
- Call graph: all functions calling auth functions
- Data flow: credentials → hash → session → response
- Type flows: AuthRequest → User → AuthToken

**L2 Semantic finds:**
- Current authentication patterns (session-based)
- Usage examples of auth across entire codebase
- Similar JWT implementations in other projects (if available)
- Common security patterns (token refresh, expiry)

**L3 Intent finds:**
- Business rules: "Session expires after 24h", "Must validate password strength"
- Constraints: "Max 5 login attempts per hour", "Token must include user role"
- Edge cases: "Handles concurrent login from multiple devices"
- Architectural context: "Stateless auth preferred for scaling"

**L4 Assembly produces comprehensive migration context:**
- Current implementation with full dependency graph
- All places where auth is called (50+ call sites)
- Business rules that must be preserved
- Security constraints to maintain
- Patterns to follow from similar code
- Edge cases to test

Agent can now perform safe, complete refactoring without missing any integration point.

---

**End of Design Document**
