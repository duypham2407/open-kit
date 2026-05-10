# Code Intelligence Configuration

This document describes configuration options for the Multi-Layer Intelligence Stack.

## Configuration Location

`.opencode/openkit.runtime.jsonc` — `codeIntelligence` section.

The file is JSONC (JSON with comments) and is loaded by the capability runtime
alongside the user-scope file at `$OPENCODE_HOME/openkit/openkit.runtime.jsonc`.
Project values override user values, and both are merged on top of the runtime
defaults.

## Layer 1: Structural

**maxGraphDepth** (default: 5)
- Maximum dependency traversal depth
- Higher = more comprehensive but slower

**enableTypeFlow** (default: true)
- Track type flows between symbols
- Required for data flow analysis

**enableScopeTracking** (default: true)
- Track lexical scopes
- Improves reference resolution accuracy

**extractDecorators** (default: true)
- Extract decorators/annotations
- Useful for framework-specific patterns

## Layer 2: Semantic

**enablePatternRecognition** (default: true)
- Detect code patterns across codebase
- Patterns: api-usage, error-handling, validation, architectural

**enableDataFlowAnalysis** (default: true)
- Trace data flows through transformations
- Required for comprehensive understanding

**dataFlowMaxDepth** (default: 10)
- Maximum flow tracing depth

**enableUsageMining** (default: true)
- Mine actual usage patterns from code

**embeddingProvider** (default: "openai")
- Options: "openai", "ollama", "custom"

**embeddingModel** (default: "text-embedding-3-small")
- Model for semantic embeddings

## Layer 3: Intent

**enable** (default: true)
- Enable LLM-augmented intent extraction

**extractors** (array)
- Active extractors: business-rule, edge-case, design-pattern, etc.

**llmProvider** (default: "anthropic")
- Options: "anthropic", "openai", "custom"

**llmModel** (default: "claude-sonnet-4.5")
- Model for intent extraction

**batchSize** (default: 5)
- Symbols per LLM call (for cost efficiency)

**cacheEnabled** (default: true)
- Cache extractions (invalidated on code change)

**minConfidence** (default: 0.6)
- Minimum confidence to store extraction

**backgroundExtraction** (default: true)
- Extract during idle time

## Layer 4: Context Assembly

**defaultMode** (default: "task")
- Options: "task", "session", "project"

**defaultDepth** (default: "medium")
- Options: "shallow", "medium", "deep"

**budgets** (tokens)
- task: 8000
- session: 15000
- project: 30000

**budgetAllocation** (ratios)
- critical: 0.40
- important: 0.30
- supplementary: 0.20
- buffer: 0.10

**enableSessionMemory** (default: true)
- Maintain session state

**validateContext** (default: true)
- Run quality checks before returning

**minQualityScore** (default: 0.7)
- Minimum quality to return context

## Performance Tuning

**For faster indexing:**
- Reduce maxGraphDepth to 3
- Disable backgroundExtraction

**For better quality:**
- Increase budgets
- Set minConfidence to 0.8
- Enable all extractors

**For cost reduction:**
- Increase batchSize to 10
- Set minConfidence to 0.7
- Reduce llmModel calls
