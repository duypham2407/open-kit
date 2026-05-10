# Multi-Layer Intelligence Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive 4-layer intelligence stack (Structural, Semantic, Intent, Context Assembly) ensuring OpenKit reads codebases broadly, deeply, and reliably.

**Architecture:** Pure static analysis foundation (L1) → Pattern recognition + data flow (L2) → LLM-augmented intent extraction (L3) → Smart context orchestration (L4). Each layer queries independently, results merged and ranked by relevance.

**Tech Stack:** SQLite (better-sqlite3), Tree-sitter, Anthropic/OpenAI APIs, existing OpenKit runtime infrastructure

---

## File Structure Overview

### New Files to Create

**Layer 1 (Structural Enhancements):**
- `src/runtime/analysis/schema-migrations.js` - Database schema migration utilities
- `src/runtime/analysis/type-flow-extractor.js` - Type flow analysis
- `src/runtime/analysis/scope-tracker.js` - Lexical scope tracking

**Layer 2 (Semantic Layer):**
- `src/runtime/analysis/pattern-recognition-service.js` - Pattern detection core
- `src/runtime/analysis/pattern-extractors/api-usage-extractor.js` - API usage patterns
- `src/runtime/analysis/pattern-extractors/validation-extractor.js` - Validation patterns
- `src/runtime/analysis/pattern-extractors/error-handling-extractor.js` - Error handling patterns
- `src/runtime/analysis/pattern-extractors/architectural-extractor.js` - Architectural patterns
- `src/runtime/analysis/pattern-extractors/test-pattern-extractor.js` - Test patterns
- `src/runtime/analysis/data-flow-analyzer.js` - Data flow tracing
- `src/runtime/analysis/usage-pattern-miner.js` - Usage pattern mining
- `src/runtime/tools/semantic/pattern-search.js` - Pattern search tool
- `src/runtime/tools/semantic/usage-analysis.js` - Usage analysis tool
- `src/runtime/tools/graph/data-flow-trace.js` - Data flow tracing tool
- `src/runtime/tools/graph/type-flow-trace.js` - Type flow tracing tool

**Layer 3 (Intent Layer):**
- `src/runtime/analysis/intent-extraction-service.js` - Intent extraction core
- `src/runtime/analysis/intent-extractors/business-rule-extractor.js` - Business rules
- `src/runtime/analysis/intent-extractors/edge-case-detector.js` - Edge cases
- `src/runtime/analysis/intent-extractors/design-pattern-identifier.js` - Design patterns
- `src/runtime/analysis/intent-extractors/data-transformation-explainer.js` - Data transformations
- `src/runtime/analysis/intent-extractors/constraint-extractor.js` - Constraints
- `src/runtime/analysis/intent-cache-manager.js` - Intent caching
- `src/runtime/analysis/intent-confidence-scorer.js` - Confidence scoring
- `src/runtime/managers/intent-manager.js` - Intent layer orchestration
- `src/runtime/tools/intent/business-rule-query.js` - Business rule queries
- `src/runtime/tools/intent/constraint-query.js` - Constraint queries
- `src/runtime/tools/intent/design-pattern-query.js` - Design pattern queries

**Layer 4 (Context Assembly):**
- `src/runtime/managers/context-assembly-manager.js` - Context orchestrator
- `src/runtime/managers/session-memory-manager.js` - Session state management
- `src/runtime/lib/budget-manager.js` - Token budget management
- `src/runtime/lib/result-ranker.js` - Multi-layer ranking
- `src/runtime/lib/result-deduplicator.js` - Result deduplication
- `src/runtime/lib/context-enricher.js` - Context enrichment
- `src/runtime/lib/context-validator.js` - Context validation
- `src/runtime/tools/context/comprehensive-context.js` - Main context gathering tool

### Files to Modify

- `src/runtime/analysis/project-graph-db.js` - Add L1/L2/L3 schema tables
- `src/runtime/analysis/import-graph-builder.js` - Enhanced extraction
- `src/runtime/analysis/embedding-indexer.js` - Enhanced chunk metadata
- `src/runtime/managers/project-graph-manager.js` - Add L1/L2 query methods
- `src/runtime/tools/tool-registry.js` - Register new tools
- `src/runtime/tools/graph/semantic-search.js` - Multi-source search
- `src/runtime/create-managers.js` - Create new managers
- `src/runtime/create-tools.js` - Create new tools
- `src/openkit-runtime/openkit.runtime.jsonc` - Add configuration schema

### Test Files to Create

- `src/tests/runtime/schema-migrations.test.js`
- `src/tests/runtime/type-flow-extractor.test.js`
- `src/tests/runtime/scope-tracker.test.js`
- `src/tests/runtime/pattern-recognition.test.js`
- `src/tests/runtime/data-flow-analyzer.test.js`
- `src/tests/runtime/usage-pattern-miner.test.js`
- `src/tests/runtime/intent-extraction.test.js`
- `src/tests/runtime/intent-cache.test.js`
- `src/tests/runtime/budget-manager.test.js`
- `src/tests/runtime/result-ranker.test.js`
- `src/tests/runtime/context-assembly.test.js`
- `src/tests/runtime/session-memory.test.js`
- `src/tests/runtime/context-integration.test.js`

---

## Phase 1: Layer 1 - Structural Enhancements

### Task 1.1: Database Schema Migration Utility

**Files:**
- Create: `src/runtime/analysis/schema-migrations.js`
- Test: `src/tests/runtime/schema-migrations.test.js`

- [ ] **Step 1: Write failing test for schema version tracking**

```javascript
// tests/runtime/schema-migrations.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SchemaManager } from '../src/runtime/analysis/schema-migrations.js';
import Database from 'better-sqlite3';

test('tracks current schema version', () => {
  const db = new Database(':memory:');
  const manager = new SchemaManager(db);
  
  const version = manager.getCurrentVersion();
  assert.strictEqual(version, 0); // Fresh DB
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/schema-migrations.test.js`
Expected: FAIL with "SchemaManager is not defined"

- [ ] **Step 3: Write minimal SchemaManager implementation**

```javascript
// src/runtime/analysis/schema-migrations.js
export class SchemaManager {
  constructor(db) {
    this.db = db;
    this.initVersionTable();
  }
  
  initVersionTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at REAL NOT NULL
      )
    `);
  }
  
  getCurrentVersion() {
    const row = this.db.prepare(
      'SELECT MAX(version) as version FROM schema_version'
    ).get();
    return row?.version || 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/schema-migrations.test.js`
Expected: PASS

- [ ] **Step 5: Write failing test for applying migrations**

```javascript
// tests/runtime/schema-migrations.test.js (add to existing file)
test('applies migrations in order', () => {
  const db = new Database(':memory:');
  const manager = new SchemaManager(db);
  
  const migrations = [
    {
      version: 1,
      up: (db) => db.exec('CREATE TABLE test1 (id INTEGER)')
    },
    {
      version: 2,
      up: (db) => db.exec('CREATE TABLE test2 (id INTEGER)')
    }
  ];
  
  manager.migrate(migrations);
  
  assert.strictEqual(manager.getCurrentVersion(), 2);
  
  // Verify tables exist
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all();
  const tableNames = tables.map(t => t.name);
  assert(tableNames.includes('test1'));
  assert(tableNames.includes('test2'));
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test tests/runtime/schema-migrations.test.js`
Expected: FAIL with "migrate is not a function"

- [ ] **Step 7: Implement migrate method**

```javascript
// src/runtime/analysis/schema-migrations.js (add to SchemaManager class)
migrate(migrations) {
  const currentVersion = this.getCurrentVersion();
  
  const pendingMigrations = migrations
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);
  
  for (const migration of pendingMigrations) {
    this.db.transaction(() => {
      migration.up(this.db);
      this.db.prepare(
        'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)'
      ).run(migration.version, Date.now() / 1000);
    })();
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test tests/runtime/schema-migrations.test.js`
Expected: PASS

- [ ] **Step 9: Commit schema migration utility**

```bash
git add src/runtime/analysis/schema-migrations.js tests/runtime/schema-migrations.test.js
git commit -m "feat(L1): add database schema migration utility

Supports:
- Version tracking
- Sequential migration application
- Transactional safety

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 1.2: Extend ProjectGraphDb Schema for L1 Enhancements

**Files:**
- Modify: `src/runtime/analysis/project-graph-db.js`
- Test: `src/tests/runtime/project-graph-db.test.js` (existing, will add tests)

- [ ] **Step 1: Write failing test for extended nodes table**

```javascript
// tests/runtime/project-graph-db.test.js (add to existing file)
test('nodes table has extended columns', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  
  // Insert node with extended fields
  const nodeId = db.insertNode({
    path: '/test/file.js',
    moduleType: 'esm',
    packageName: null,
    isTest: false,
    isConfig: false
  });
  
  const node = db.getNode(nodeId);
  assert.strictEqual(node.module_type, 'esm');
  assert.strictEqual(node.is_test, 0);
  assert.strictEqual(node.is_config, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/project-graph-db.test.js::*extended*`
Expected: FAIL - columns don't exist

- [ ] **Step 3: Create migration for nodes table extension**

```javascript
// src/runtime/analysis/project-graph-db.js (add to MIGRATIONS array)
const MIGRATIONS = [
  // ... existing migrations
  {
    version: 2,
    name: 'add_l1_node_extensions',
    up: (db) => {
      db.exec(`
        ALTER TABLE nodes ADD COLUMN module_type TEXT;
        ALTER TABLE nodes ADD COLUMN package_name TEXT;
        ALTER TABLE nodes ADD COLUMN is_test INTEGER DEFAULT 0;
        ALTER TABLE nodes ADD COLUMN is_config INTEGER DEFAULT 0;
      `);
    }
  }
];
```

- [ ] **Step 4: Update insertNode to accept extended fields**

```javascript
// src/runtime/analysis/project-graph-db.js (modify insertNode method)
insertNode({ path, kind = 'module', mtime = 0, moduleType = null, packageName = null, isTest = false, isConfig = false }) {
  const result = this.stmts.insertNode.run({
    path,
    kind,
    mtime,
    module_type: moduleType,
    package_name: packageName,
    is_test: isTest ? 1 : 0,
    is_config: isConfig ? 1 : 0
  });
  return result.lastInsertRowid;
}
```

- [ ] **Step 5: Update prepared statements to include new fields**

```javascript
// src/runtime/analysis/project-graph-db.js (modify initStatements method)
this.stmts.insertNode = this.db.prepare(`
  INSERT INTO nodes (path, kind, mtime, module_type, package_name, is_test, is_config)
  VALUES (@path, @kind, @mtime, @module_type, @package_name, @is_test, @is_config)
  ON CONFLICT(path) DO UPDATE SET
    kind = @kind,
    mtime = @mtime,
    module_type = @module_type,
    package_name = @package_name,
    is_test = @is_test,
    is_config = @is_config
`);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/runtime/project-graph-db.test.js::*extended*`
Expected: PASS

- [ ] **Step 7: Write failing test for extended symbols table**

```javascript
// tests/runtime/project-graph-db.test.js (add)
test('symbols table has extended columns', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'testFunc',
    kind: 'function',
    isExport: true,
    line: 10,
    signature: 'function testFunc(a: string): number',
    returnType: 'number',
    paramsJson: JSON.stringify([{ name: 'a', type: 'string' }]),
    decoratorsJson: JSON.stringify(['@cached']),
    parentSymbolId: null,
    scopeChain: 'module',
    startCol: 0,
    endCol: 50
  });
  
  const symbol = db.getSymbol(symbolId);
  assert.strictEqual(symbol.signature, 'function testFunc(a: string): number');
  assert.strictEqual(symbol.return_type, 'number');
  assert.strictEqual(symbol.start_col, 0);
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `node --test tests/runtime/project-graph-db.test.js::*symbols*extended*`
Expected: FAIL - columns don't exist

- [ ] **Step 9: Create migration for symbols table extension**

```javascript
// src/runtime/analysis/project-graph-db.js (add to MIGRATIONS)
{
  version: 3,
  name: 'add_l1_symbol_extensions',
  up: (db) => {
    db.exec(`
      ALTER TABLE symbols ADD COLUMN signature TEXT;
      ALTER TABLE symbols ADD COLUMN return_type TEXT;
      ALTER TABLE symbols ADD COLUMN params_json TEXT;
      ALTER TABLE symbols ADD COLUMN decorators_json TEXT;
      ALTER TABLE symbols ADD COLUMN parent_symbol_id INTEGER;
      ALTER TABLE symbols ADD COLUMN scope_chain TEXT;
      ALTER TABLE symbols ADD COLUMN start_col INTEGER;
      ALTER TABLE symbols ADD COLUMN end_col INTEGER;
      
      CREATE INDEX IF NOT EXISTS idx_symbols_parent ON symbols(parent_symbol_id);
    `);
  }
}
```

- [ ] **Step 10: Update insertSymbol and prepared statements**

```javascript
// src/runtime/analysis/project-graph-db.js
insertSymbol({
  nodeId,
  name,
  kind = 'unknown',
  isExport = false,
  line = 0,
  signature = null,
  returnType = null,
  paramsJson = null,
  decoratorsJson = null,
  parentSymbolId = null,
  scopeChain = null,
  startCol = null,
  endCol = null
}) {
  const result = this.stmts.insertSymbol.run({
    node_id: nodeId,
    name,
    kind,
    is_export: isExport ? 1 : 0,
    line,
    signature,
    return_type: returnType,
    params_json: paramsJson,
    decorators_json: decoratorsJson,
    parent_symbol_id: parentSymbolId,
    scope_chain: scopeChain,
    start_col: startCol,
    end_col: endCol
  });
  return result.lastInsertRowid;
}

// Update prepared statement
this.stmts.insertSymbol = this.db.prepare(`
  INSERT INTO symbols (
    node_id, name, kind, is_export, line,
    signature, return_type, params_json, decorators_json,
    parent_symbol_id, scope_chain, start_col, end_col
  ) VALUES (
    @node_id, @name, @kind, @is_export, @line,
    @signature, @return_type, @params_json, @decorators_json,
    @parent_symbol_id, @scope_chain, @start_col, @end_col
  )
`);
```

- [ ] **Step 11: Run test to verify it passes**

Run: `node --test tests/runtime/project-graph-db.test.js::*symbols*extended*`
Expected: PASS

- [ ] **Step 12: Commit extended schema**

```bash
git add src/runtime/analysis/project-graph-db.js tests/runtime/project-graph-db.test.js
git commit -m "feat(L1): extend nodes and symbols tables with L1 metadata

Nodes: module_type, package_name, is_test, is_config
Symbols: signature, return_type, params, decorators, parent, scope, cols

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 1.3: Add type_flows Table

**Files:**
- Modify: `src/runtime/analysis/project-graph-db.js`
- Test: `src/tests/runtime/project-graph-db.test.js`

- [ ] **Step 1: Write failing test for type_flows table**

```javascript
// tests/runtime/project-graph-db.test.js (add)
test('can insert and query type flows', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  const fromSymbolId = db.insertSymbol({ nodeId, name: 'input', kind: 'variable' });
  const toSymbolId = db.insertSymbol({ nodeId, name: 'output', kind: 'variable' });
  
  const flowId = db.insertTypeFlow({
    fromSymbolId,
    toSymbolId,
    flowType: 'assignment',
    nodeId,
    line: 15,
    confidence: 1.0
  });
  
  const flows = db.getTypeFlows({ fromSymbolId });
  assert.strictEqual(flows.length, 1);
  assert.strictEqual(flows[0].flow_type, 'assignment');
  assert.strictEqual(flows[0].confidence, 1.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/project-graph-db.test.js::*type.flows*`
Expected: FAIL - table doesn't exist

- [ ] **Step 3: Create migration for type_flows table**

```javascript
// src/runtime/analysis/project-graph-db.js (add to MIGRATIONS)
{
  version: 4,
  name: 'create_type_flows_table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS type_flows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_symbol_id INTEGER NOT NULL,
        to_symbol_id INTEGER NOT NULL,
        flow_type TEXT NOT NULL,
        node_id INTEGER NOT NULL,
        line INTEGER NOT NULL,
        confidence REAL DEFAULT 1.0,
        FOREIGN KEY (from_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
        FOREIGN KEY (to_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_type_flows_from ON type_flows(from_symbol_id);
      CREATE INDEX IF NOT EXISTS idx_type_flows_to ON type_flows(to_symbol_id);
    `);
  }
}
```

- [ ] **Step 4: Add insertTypeFlow method and prepared statement**

```javascript
// src/runtime/analysis/project-graph-db.js

// In initStatements():
this.stmts.insertTypeFlow = this.db.prepare(`
  INSERT INTO type_flows (from_symbol_id, to_symbol_id, flow_type, node_id, line, confidence)
  VALUES (@from_symbol_id, @to_symbol_id, @flow_type, @node_id, @line, @confidence)
`);

this.stmts.getTypeFlows = this.db.prepare(`
  SELECT * FROM type_flows WHERE from_symbol_id = ? OR to_symbol_id = ?
`);

// Add methods:
insertTypeFlow({ fromSymbolId, toSymbolId, flowType, nodeId, line, confidence = 1.0 }) {
  const result = this.stmts.insertTypeFlow.run({
    from_symbol_id: fromSymbolId,
    to_symbol_id: toSymbolId,
    flow_type: flowType,
    node_id: nodeId,
    line,
    confidence
  });
  return result.lastInsertRowid;
}

getTypeFlows({ fromSymbolId = null, toSymbolId = null }) {
  if (fromSymbolId !== null) {
    return this.stmts.getTypeFlows.all(fromSymbolId, fromSymbolId);
  }
  if (toSymbolId !== null) {
    return this.stmts.getTypeFlows.all(toSymbolId, toSymbolId);
  }
  return [];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/runtime/project-graph-db.test.js::*type.flows*`
Expected: PASS

- [ ] **Step 6: Commit type_flows table**

```bash
git add src/runtime/analysis/project-graph-db.js tests/runtime/project-graph-db.test.js
git commit -m "feat(L1): add type_flows table for data flow tracking

Tracks param/return/assignment/property flows between symbols

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 1.4: Add scope_contexts Table

**Files:**
- Modify: `src/runtime/analysis/project-graph-db.js`
- Test: `src/tests/runtime/project-graph-db.test.js`

- [ ] **Step 1: Write failing test for scope_contexts table**

```javascript
// tests/runtime/project-graph-db.test.js (add)
test('can insert and query scope contexts', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  
  const scopeId = db.insertScopeContext({
    nodeId,
    scopeType: 'function',
    parentScopeId: null,
    startLine: 10,
    endLine: 20,
    bindingsJson: JSON.stringify({ a: 'parameter', b: 'variable' })
  });
  
  const scopes = db.getScopeContexts({ nodeId });
  assert.strictEqual(scopes.length, 1);
  assert.strictEqual(scopes[0].scope_type, 'function');
  assert.strictEqual(scopes[0].start_line, 10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/project-graph-db.test.js::*scope.contexts*`
Expected: FAIL - table doesn't exist

- [ ] **Step 3: Create migration for scope_contexts table**

```javascript
// src/runtime/analysis/project-graph-db.js (add to MIGRATIONS)
{
  version: 5,
  name: 'create_scope_contexts_table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS scope_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER NOT NULL,
        scope_type TEXT NOT NULL,
        parent_scope_id INTEGER,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        bindings_json TEXT,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_scope_id) REFERENCES scope_contexts(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_scope_contexts_node ON scope_contexts(node_id);
      CREATE INDEX IF NOT EXISTS idx_scope_contexts_parent ON scope_contexts(parent_scope_id);
    `);
  }
}
```

- [ ] **Step 4: Add insertScopeContext method and prepared statement**

```javascript
// src/runtime/analysis/project-graph-db.js

// In initStatements():
this.stmts.insertScopeContext = this.db.prepare(`
  INSERT INTO scope_contexts (node_id, scope_type, parent_scope_id, start_line, end_line, bindings_json)
  VALUES (@node_id, @scope_type, @parent_scope_id, @start_line, @end_line, @bindings_json)
`);

this.stmts.getScopeContexts = this.db.prepare(`
  SELECT * FROM scope_contexts WHERE node_id = ? ORDER BY start_line
`);

// Add methods:
insertScopeContext({ nodeId, scopeType, parentScopeId = null, startLine, endLine, bindingsJson = null }) {
  const result = this.stmts.insertScopeContext.run({
    node_id: nodeId,
    scope_type: scopeType,
    parent_scope_id: parentScopeId,
    start_line: startLine,
    end_line: endLine,
    bindings_json: bindingsJson
  });
  return result.lastInsertRowid;
}

getScopeContexts({ nodeId }) {
  return this.stmts.getScopeContexts.all(nodeId);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/runtime/project-graph-db.test.js::*scope.contexts*`
Expected: PASS

- [ ] **Step 6: Commit scope_contexts table**

```bash
git add src/runtime/analysis/project-graph-db.js tests/runtime/project-graph-db.test.js
git commit -m "feat(L1): add scope_contexts table for lexical scope tracking

Tracks module/function/class/block scopes with bindings

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Layer 2 - Semantic Layer

### Task 2.1: Add code_patterns Table

**Files:**
- Modify: `src/runtime/analysis/project-graph-db.js`
- Test: `src/tests/runtime/project-graph-db.test.js`

- [ ] **Step 1: Write failing test for code_patterns table**

```javascript
// tests/runtime/project-graph-db.test.js (add)
test('can insert and query code patterns', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  const symbolId = db.insertSymbol({ nodeId, name: 'validate', kind: 'function' });
  
  const patternId = db.insertCodePattern({
    patternType: 'validation',
    primarySymbolId: symbolId,
    relatedSymbolsJson: JSON.stringify([]),
    nodeId,
    exampleCode: 'if (!email) throw new Error()',
    frequency: 1,
    confidence: 0.95
  });
  
  const patterns = db.getCodePatterns({ patternType: 'validation' });
  assert.strictEqual(patterns.length, 1);
  assert.strictEqual(patterns[0].confidence, 0.95);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/project-graph-db.test.js::*code.patterns*`
Expected: FAIL - table doesn't exist

- [ ] **Step 3: Create migration for code_patterns table**

```javascript
// src/runtime/analysis/project-graph-db.js (add to MIGRATIONS)
{
  version: 6,
  name: 'create_code_patterns_table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS code_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_type TEXT NOT NULL,
        primary_symbol_id INTEGER NOT NULL,
        related_symbols_json TEXT,
        node_id INTEGER NOT NULL,
        example_code TEXT,
        frequency INTEGER DEFAULT 1,
        confidence REAL DEFAULT 1.0,
        FOREIGN KEY (primary_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_code_patterns_type ON code_patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_code_patterns_symbol ON code_patterns(primary_symbol_id);
    `);
  }
}
```

- [ ] **Step 4: Add insertCodePattern and query methods**

```javascript
// src/runtime/analysis/project-graph-db.js

// In initStatements():
this.stmts.insertCodePattern = this.db.prepare(`
  INSERT INTO code_patterns (
    pattern_type, primary_symbol_id, related_symbols_json, node_id,
    example_code, frequency, confidence
  ) VALUES (
    @pattern_type, @primary_symbol_id, @related_symbols_json, @node_id,
    @example_code, @frequency, @confidence
  )
`);

this.stmts.getCodePatternsByType = this.db.prepare(`
  SELECT * FROM code_patterns WHERE pattern_type = ?
`);

this.stmts.getCodePatternsBySymbol = this.db.prepare(`
  SELECT * FROM code_patterns WHERE primary_symbol_id = ?
`);

// Methods:
insertCodePattern({
  patternType,
  primarySymbolId,
  relatedSymbolsJson = null,
  nodeId,
  exampleCode = null,
  frequency = 1,
  confidence = 1.0
}) {
  const result = this.stmts.insertCodePattern.run({
    pattern_type: patternType,
    primary_symbol_id: primarySymbolId,
    related_symbols_json: relatedSymbolsJson,
    node_id: nodeId,
    example_code: exampleCode,
    frequency,
    confidence
  });
  return result.lastInsertRowid;
}

getCodePatterns({ patternType = null, symbolId = null }) {
  if (patternType) {
    return this.stmts.getCodePatternsByType.all(patternType);
  }
  if (symbolId) {
    return this.stmts.getCodePatternsBySymbol.all(symbolId);
  }
  return [];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/runtime/project-graph-db.test.js::*code.patterns*`
Expected: PASS

- [ ] **Step 6: Commit code_patterns table**

```bash
git add src/runtime/analysis/project-graph-db.js tests/runtime/project-graph-db.test.js
git commit -m "feat(L2): add code_patterns table for pattern recognition

Stores detected patterns: api-usage, validation, error-handling, etc.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2.2: Data Flow Analyzer

**Files:**
- Create: `src/runtime/analysis/data-flow-analyzer.js`
- Test: `src/tests/runtime/data-flow-analyzer.test.js`

- [ ] **Step 1: Write failing test for basic data flow tracing**

```javascript
// tests/runtime/data-flow-analyzer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { DataFlowAnalyzer } from '../src/runtime/analysis/data-flow-analyzer.js';
import { ProjectGraphDb } from '../src/runtime/analysis/project-graph-db.js';

test('traces simple assignment flow', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const analyzer = new DataFlowAnalyzer(db);
  
  // Setup: a -> b -> c
  const nodeId = db.insertNode({ path: '/test/flow.js' });
  const symbolA = db.insertSymbol({ nodeId, name: 'a', kind: 'variable' });
  const symbolB = db.insertSymbol({ nodeId, name: 'b', kind: 'variable' });
  const symbolC = db.insertSymbol({ nodeId, name: 'c', kind: 'variable' });
  
  db.insertTypeFlow({ fromSymbolId: symbolA, toSymbolId: symbolB, flowType: 'assignment', nodeId, line: 1 });
  db.insertTypeFlow({ fromSymbolId: symbolB, toSymbolId: symbolC, flowType: 'assignment', nodeId, line: 2 });
  
  const path = analyzer.traceFlow({ from: symbolA, to: symbolC, maxDepth: 10 });
  
  assert.strictEqual(path.length, 3); // a -> b -> c
  assert.strictEqual(path[0].name, 'a');
  assert.strictEqual(path[1].name, 'b');
  assert.strictEqual(path[2].name, 'c');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/data-flow-analyzer.test.js`
Expected: FAIL with "DataFlowAnalyzer is not defined"

- [ ] **Step 3: Write minimal DataFlowAnalyzer implementation**

```javascript
// src/runtime/analysis/data-flow-analyzer.js
export class DataFlowAnalyzer {
  constructor(db) {
    this.db = db;
  }
  
  traceFlow({ from, to, maxDepth = 10 }) {
    const visited = new Set();
    const queue = [{ symbolId: from, path: [] }];
    
    while (queue.length > 0) {
      const { symbolId, path } = queue.shift();
      
      if (visited.has(symbolId)) continue;
      visited.add(symbolId);
      
      const symbol = this.db.getSymbol(symbolId);
      const currentPath = [...path, symbol];
      
      if (symbolId === to) {
        return currentPath;
      }
      
      if (currentPath.length >= maxDepth) continue;
      
      // Find outgoing flows
      const flows = this.db.getTypeFlows({ fromSymbolId: symbolId });
      for (const flow of flows) {
        if (!visited.has(flow.to_symbol_id)) {
          queue.push({ symbolId: flow.to_symbol_id, path: currentPath });
        }
      }
    }
    
    return []; // No path found
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/data-flow-analyzer.test.js`
Expected: PASS

- [ ] **Step 5: Write test for dependency chain building**

```javascript
// tests/runtime/data-flow-analyzer.test.js (add)
test('builds dependency chain for symbol', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const analyzer = new DataFlowAnalyzer(db);
  
  const nodeId = db.insertNode({ path: '/test/deps.js' });
  const symbolX = db.insertSymbol({ nodeId, name: 'x', kind: 'variable' });
  const symbolY = db.insertSymbol({ nodeId, name: 'y', kind: 'variable' });
  const symbolZ = db.insertSymbol({ nodeId, name: 'z', kind: 'variable' });
  
  // z depends on x and y
  db.insertTypeFlow({ fromSymbolId: symbolX, toSymbolId: symbolZ, flowType: 'param', nodeId, line: 1 });
  db.insertTypeFlow({ fromSymbolId: symbolY, toSymbolId: symbolZ, flowType: 'param', nodeId, line: 1 });
  
  const chain = analyzer.buildDependencyChain(symbolZ);
  
  assert.strictEqual(chain.symbol.name, 'z');
  assert.strictEqual(chain.dependsOn.length, 2);
  assert(chain.dependsOn.some(s => s.name === 'x'));
  assert(chain.dependsOn.some(s => s.name === 'y'));
});
```

- [ ] **Step 6: Implement buildDependencyChain method**

```javascript
// src/runtime/analysis/data-flow-analyzer.js (add to class)
buildDependencyChain(symbolId) {
  const symbol = this.db.getSymbol(symbolId);
  const flows = this.db.getTypeFlows({ toSymbolId: symbolId });
  
  const dependsOn = flows.map(flow => {
    const depSymbol = this.db.getSymbol(flow.from_symbol_id);
    return {
      ...depSymbol,
      flowType: flow.flow_type,
      line: flow.line
    };
  });
  
  return {
    symbol,
    dependsOn,
    transitiveDepth: this.calculateTransitiveDepth(symbolId)
  };
}

calculateTransitiveDepth(symbolId, visited = new Set()) {
  if (visited.has(symbolId)) return 0;
  visited.add(symbolId);
  
  const flows = this.db.getTypeFlows({ toSymbolId: symbolId });
  if (flows.length === 0) return 0;
  
  const depths = flows.map(flow =>
    1 + this.calculateTransitiveDepth(flow.from_symbol_id, new Set(visited))
  );
  
  return Math.max(...depths);
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/runtime/data-flow-analyzer.test.js`
Expected: All tests PASS

- [ ] **Step 8: Commit data flow analyzer**

```bash
git add src/runtime/analysis/data-flow-analyzer.js tests/runtime/data-flow-analyzer.test.js
git commit -m "feat(L2): add DataFlowAnalyzer for tracing value flows

Supports:
- Flow tracing between symbols
- Dependency chain building
- Transitive depth calculation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Layer 3 - Intent Layer

### Task 3.1: Add code_intents Table

**Files:**
- Modify: `src/runtime/analysis/project-graph-db.js`
- Test: `src/tests/runtime/project-graph-db.test.js`

- [ ] **Step 1: Write failing test for code_intents table**

```javascript
// tests/runtime/project-graph-db.test.js (add)
test('can insert and query code intents', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  const symbolId = db.insertSymbol({ nodeId, name: 'validateEmail', kind: 'function' });
  
  const intentId = db.insertCodeIntent({
    nodeId,
    symbolId,
    intentType: 'business-rule',
    description: 'Email must be unique in the system',
    evidenceCode: 'db.users.findOne({ email })',
    confidence: 0.92,
    model: 'claude-sonnet-4.5',
    extractedAt: Date.now() / 1000,
    validated: false
  });
  
  const intents = db.getCodeIntents({ symbolId });
  assert.strictEqual(intents.length, 1);
  assert.strictEqual(intents[0].intent_type, 'business-rule');
  assert.strictEqual(intents[0].confidence, 0.92);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/project-graph-db.test.js::*code.intents*`
Expected: FAIL - table doesn't exist

- [ ] **Step 3: Create migration for code_intents table**

```javascript
// src/runtime/analysis/project-graph-db.js (add to MIGRATIONS)
{
  version: 7,
  name: 'create_code_intents_table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS code_intents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER,
        symbol_id INTEGER,
        intent_type TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence_code TEXT,
        confidence REAL DEFAULT 1.0,
        model TEXT,
        extracted_at REAL NOT NULL,
        validated INTEGER DEFAULT 0,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_code_intents_type ON code_intents(intent_type);
      CREATE INDEX IF NOT EXISTS idx_code_intents_node ON code_intents(node_id);
      CREATE INDEX IF NOT EXISTS idx_code_intents_symbol ON code_intents(symbol_id);
    `);
  }
}
```

- [ ] **Step 4: Add insertCodeIntent and query methods**

```javascript
// src/runtime/analysis/project-graph-db.js

// In initStatements():
this.stmts.insertCodeIntent = this.db.prepare(`
  INSERT INTO code_intents (
    node_id, symbol_id, intent_type, description, evidence_code,
    confidence, model, extracted_at, validated
  ) VALUES (
    @node_id, @symbol_id, @intent_type, @description, @evidence_code,
    @confidence, @model, @extracted_at, @validated
  )
`);

this.stmts.getCodeIntentsBySymbol = this.db.prepare(`
  SELECT * FROM code_intents WHERE symbol_id = ?
`);

this.stmts.getCodeIntentsByType = this.db.prepare(`
  SELECT * FROM code_intents WHERE intent_type = ?
`);

// Methods:
insertCodeIntent({
  nodeId = null,
  symbolId = null,
  intentType,
  description,
  evidenceCode = null,
  confidence = 1.0,
  model = null,
  extractedAt,
  validated = false
}) {
  const result = this.stmts.insertCodeIntent.run({
    node_id: nodeId,
    symbol_id: symbolId,
    intent_type: intentType,
    description,
    evidence_code: evidenceCode,
    confidence,
    model,
    extracted_at: extractedAt,
    validated: validated ? 1 : 0
  });
  return result.lastInsertRowid;
}

getCodeIntents({ symbolId = null, intentType = null }) {
  if (symbolId) {
    return this.stmts.getCodeIntentsBySymbol.all(symbolId);
  }
  if (intentType) {
    return this.stmts.getCodeIntentsByType.all(intentType);
  }
  return [];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/runtime/project-graph-db.test.js::*code.intents*`
Expected: PASS

- [ ] **Step 6: Commit code_intents table**

```bash
git add src/runtime/analysis/project-graph-db.js tests/runtime/project-graph-db.test.js
git commit -m "feat(L3): add code_intents table for LLM-extracted insights

Stores business rules, constraints, edge cases, design decisions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 3.2: Intent Cache Manager

**Files:**
- Create: `src/runtime/analysis/intent-cache-manager.js`
- Test: `src/tests/runtime/intent-cache.test.js`

- [ ] **Step 1: Write failing test for cache key generation**

```javascript
// tests/runtime/intent-cache.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentCacheManager } from '../src/runtime/analysis/intent-cache-manager.js';
import crypto from 'node:crypto';

test('generates consistent cache keys', () => {
  const manager = new IntentCacheManager();
  
  const code = 'function test() { return 1; }';
  const extractorType = 'business-rule';
  const model = 'claude-sonnet-4.5';
  
  const key1 = manager.generateCacheKey(code, extractorType, model);
  const key2 = manager.generateCacheKey(code, extractorType, model);
  
  assert.strictEqual(key1, key2);
  assert(key1.includes('business-rule'));
  assert(key1.includes('claude-sonnet-4.5'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/intent-cache.test.js`
Expected: FAIL with "IntentCacheManager is not defined"

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/runtime/analysis/intent-cache-manager.js
import crypto from 'node:crypto';

export class IntentCacheManager {
  constructor() {
    this.cache = new Map(); // In-memory cache
  }
  
  generateCacheKey(code, extractorType, model) {
    const hash = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex')
      .substring(0, 16);
    
    return `${hash}-${extractorType}-${model}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/intent-cache.test.js`
Expected: PASS

- [ ] **Step 5: Write test for cache get/set**

```javascript
// tests/runtime/intent-cache.test.js (add)
test('caches and retrieves intent extractions', () => {
  const manager = new IntentCacheManager();
  
  const code = 'function validate() {}';
  const extractorType = 'business-rule';
  const model = 'claude-sonnet-4.5';
  const result = { rules: ['Email must be valid'] };
  
  manager.set(code, extractorType, model, result);
  
  const cached = manager.get(code, extractorType, model);
  assert.deepStrictEqual(cached.result, result);
  assert.strictEqual(cached.hits, 1);
});
```

- [ ] **Step 6: Implement get/set methods**

```javascript
// src/runtime/analysis/intent-cache-manager.js (add to class)
set(code, extractorType, model, result) {
  const key = this.generateCacheKey(code, extractorType, model);
  this.cache.set(key, {
    result,
    timestamp: Date.now(),
    hits: 0,
    validated: false
  });
}

get(code, extractorType, model) {
  const key = this.generateCacheKey(code, extractorType, model);
  const entry = this.cache.get(key);
  
  if (entry) {
    entry.hits += 1;
    return entry;
  }
  
  return null;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/runtime/intent-cache.test.js`
Expected: All tests PASS

- [ ] **Step 8: Write test for cache invalidation**

```javascript
// tests/runtime/intent-cache.test.js (add)
test('invalidates cache when code changes', () => {
  const manager = new IntentCacheManager();
  
  const code1 = 'function test() { return 1; }';
  const code2 = 'function test() { return 2; }'; // Different
  const extractorType = 'business-rule';
  const model = 'claude-sonnet-4.5';
  
  manager.set(code1, extractorType, model, { rules: ['Rule 1'] });
  
  const cached1 = manager.get(code1, extractorType, model);
  assert.ok(cached1);
  
  const cached2 = manager.get(code2, extractorType, model);
  assert.strictEqual(cached2, null); // Different code = cache miss
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `node --test tests/runtime/intent-cache.test.js`
Expected: PASS (already works due to hash-based keys)

- [ ] **Step 10: Commit intent cache manager**

```bash
git add src/runtime/analysis/intent-cache-manager.js tests/runtime/intent-cache.test.js
git commit -m "feat(L3): add IntentCacheManager for LLM extraction caching

Hash-based cache keys ensure invalidation on code changes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Layer 4 - Context Assembly

### Task 4.1: Budget Manager

**Files:**
- Create: `src/runtime/lib/budget-manager.js`
- Test: `src/tests/runtime/budget-manager.test.js`

- [ ] **Step 1: Write failing test for budget allocation**

```javascript
// tests/runtime/budget-manager.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetManager } from '../src/runtime/lib/budget-manager.js';

test('allocates budget across categories', () => {
  const manager = new BudgetManager();
  
  const allocation = manager.allocate(10000);
  
  assert.strictEqual(allocation.critical, 4000);      // 40%
  assert.strictEqual(allocation.important, 3000);     // 30%
  assert.strictEqual(allocation.supplementary, 2000); // 20%
  assert.strictEqual(allocation.buffer, 1000);        // 10%
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/budget-manager.test.js`
Expected: FAIL with "BudgetManager is not defined"

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/runtime/lib/budget-manager.js
export class BudgetManager {
  allocate(totalBudget, priorities = {}) {
    const defaultRatios = {
      critical: 0.40,
      important: 0.30,
      supplementary: 0.20,
      buffer: 0.10
    };
    
    const ratios = { ...defaultRatios, ...priorities };
    
    return {
      critical: Math.floor(totalBudget * ratios.critical),
      important: Math.floor(totalBudget * ratios.important),
      supplementary: Math.floor(totalBudget * ratios.supplementary),
      buffer: Math.floor(totalBudget * ratios.buffer)
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/budget-manager.test.js`
Expected: PASS

- [ ] **Step 5: Write test for applying budget to items**

```javascript
// tests/runtime/budget-manager.test.js (add)
test('applies budget constraints to items', () => {
  const manager = new BudgetManager();
  
  const items = [
    { id: 1, category: 'critical', estimatedTokens: 500, score: 0.9 },
    { id: 2, category: 'critical', estimatedTokens: 500, score: 0.8 },
    { id: 3, category: 'important', estimatedTokens: 300, score: 0.7 },
    { id: 4, category: 'supplementary', estimatedTokens: 200, score: 0.6 }
  ];
  
  const selected = manager.applyBudget(items, 1000);
  
  // Should select items within budget
  assert(selected.length <= 4);
  
  const totalTokens = selected.reduce((sum, item) => sum + item.estimatedTokens, 0);
  assert(totalTokens <= 1000);
});
```

- [ ] **Step 6: Implement applyBudget method**

```javascript
// src/runtime/lib/budget-manager.js (add to class)
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
    .slice(0, Math.floor(allocation.buffer / 200)); // Estimate 200 tokens/item
  result.push(...overflow);
  
  return result;
}

categorizeItems(items) {
  return {
    critical: items.filter(i => i.category === 'critical'),
    important: items.filter(i => i.category === 'important'),
    supplementary: items.filter(i => i.category === 'supplementary')
  };
}

fillBucket(items, budgetAllocation) {
  const selected = [];
  let usedTokens = 0;
  
  for (const item of items) {
    if (usedTokens + item.estimatedTokens <= budgetAllocation) {
      selected.push(item);
      usedTokens += item.estimatedTokens;
    }
  }
  
  return selected;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/runtime/budget-manager.test.js`
Expected: All tests PASS

- [ ] **Step 8: Commit budget manager**

```bash
git add src/runtime/lib/budget-manager.js tests/runtime/budget-manager.test.js
git commit -m "feat(L4): add BudgetManager for token budget allocation

Allocates: 40% critical, 30% important, 20% supplementary, 10% buffer

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.2: Result Ranker

**Files:**
- Create: `src/runtime/lib/result-ranker.js`
- Test: `src/tests/runtime/result-ranker.test.js`

- [ ] **Step 1: Write failing test for multi-layer ranking**

```javascript
// tests/runtime/result-ranker.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultRanker } from '../src/runtime/lib/result-ranker.js';

test('ranks items by multi-layer relevance', () => {
  const ranker = new ResultRanker();
  
  const items = [
    {
      id: 1,
      graphHops: 1,
      cosineSimilarity: 0.9,
      intentTypes: ['business-rule'],
      foundInLayers: new Set(['L1', 'L2', 'L3'])
    },
    {
      id: 2,
      graphHops: 5,
      cosineSimilarity: 0.5,
      intentTypes: [],
      foundInLayers: new Set(['L1'])
    }
  ];
  
  const ranked = ranker.rank(items, { intentType: 'business-rule' });
  
  assert.strictEqual(ranked[0].id, 1); // Higher score
  assert(ranked[0].score > ranked[1].score);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/result-ranker.test.js`
Expected: FAIL with "ResultRanker is not defined"

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/runtime/lib/result-ranker.js
export class ResultRanker {
  rank(items, query = {}) {
    const scored = items.map(item => ({
      ...item,
      score: this.calculateScore(item, query)
    }));
    
    return scored.sort((a, b) => b.score - a.score);
  }
  
  calculateScore(item, query) {
    const scores = {
      // L1 Structural (0.0-0.3)
      graphDistance: 0.15 * (1.0 / (item.graphHops || 1 + 1)),
      
      // L2 Semantic (0.0-0.4)
      embeddingSimilarity: 0.20 * (item.cosineSimilarity || 0),
      
      // L3 Intent (0.0-0.3)
      intentMatch: 0.15 * (item.intentTypes?.includes(query.intentType) ? 1.0 : 0),
      
      // Cross-layer boosters (0.0-0.5)
      multiLayerBonus: 0.20 * (item.foundInLayers?.size - 1 || 0)
    };
    
    return Object.values(scores).reduce((a, b) => a + b, 0);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/result-ranker.test.js`
Expected: PASS

- [ ] **Step 5: Commit result ranker**

```bash
git add src/runtime/lib/result-ranker.js tests/runtime/result-ranker.test.js
git commit -m "feat(L4): add ResultRanker for multi-layer relevance scoring

Combines L1 structural, L2 semantic, L3 intent, cross-layer signals

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Integration

### Task 5.1: Context Assembly Manager

**Files:**
- Create: `src/runtime/managers/context-assembly-manager.js`
- Test: `src/tests/runtime/context-assembly.test.js`

- [ ] **Step 1: Write failing test for task-level context gathering**

```javascript
// tests/runtime/context-assembly.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextAssemblyManager } from '../src/runtime/managers/context-assembly-manager.js';
import { ProjectGraphDb } from '../src/runtime/analysis/project-graph-db.js';
import { BudgetManager } from '../src/runtime/lib/budget-manager.js';
import { ResultRanker } from '../src/runtime/lib/result-ranker.js';

test('gathers task-level context', async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const budgetManager = new BudgetManager();
  const ranker = new ResultRanker();
  
  const manager = new ContextAssemblyManager({
    layers: {
      structural: { db },
      semantic: null,
      intent: null
    },
    budgetManager,
    ranker
  });
  
  // Setup test data
  const nodeId = db.insertNode({ path: '/test/file.js' });
  db.insertSymbol({ nodeId, name: 'testFunc', kind: 'function' });
  
  const context = await manager.gatherTaskContext({
    task: 'Test task',
    focus: ['/test/file.js'],
    depth: 'medium',
    budget: 1000
  });
  
  assert.ok(context.primaryContext);
  assert.ok(context.metadata);
  assert(context.metadata.budgetUsage.used <= 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/context-assembly.test.js`
Expected: FAIL with "ContextAssemblyManager is not defined"

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/runtime/managers/context-assembly-manager.js
export class ContextAssemblyManager {
  constructor({ layers, budgetManager, ranker, sessionMemory = null }) {
    this.l1 = layers.structural;
    this.l2 = layers.semantic;
    this.l3 = layers.intent;
    this.budgetManager = budgetManager;
    this.ranker = ranker;
    this.sessionMemory = sessionMemory;
  }
  
  async gatherTaskContext({ task, focus, depth = 'medium', budget = 8000 }) {
    const plan = this.createQueryPlan({ mode: 'task', focus, depth, budget });
    return this.executeQueryPlan(plan);
  }
  
  createQueryPlan({ mode, focus, depth, budget }) {
    return {
      mode,
      focus,
      depth,
      budget,
      structural: [
        { type: 'symbols', filter: 'exported' }
      ],
      semantic: [],
      intent: []
    };
  }
  
  async executeQueryPlan(plan) {
    // Simplified: just return structure for now
    const primaryContext = [];
    
    // Query L1 structural layer
    if (this.l1?.db) {
      const nodes = this.l1.db.db.prepare('SELECT * FROM nodes LIMIT 10').all();
      for (const node of nodes) {
        const symbols = this.l1.db.db.prepare('SELECT * FROM symbols WHERE node_id = ?').all(node.id);
        if (symbols.length > 0) {
          primaryContext.push({
            file: node.path,
            symbol: symbols[0].name,
            structural: { dependencies: [], callGraph: {} },
            semantic: { patterns: [] },
            intent: { businessRules: [] },
            meta: { score: 0.5, foundInLayers: ['L1'] }
          });
        }
      }
    }
    
    return {
      primaryContext,
      relatedContext: [],
      metadata: {
        query: plan,
        mode: plan.mode,
        coverageMetrics: {
          filesAnalyzed: primaryContext.length,
          symbolsIncluded: primaryContext.length,
          patternsDetected: 0,
          intentsExtracted: 0
        },
        layerContributions: {
          L1_structural: primaryContext.length,
          L2_semantic: 0,
          L3_intent: 0
        },
        budgetUsage: {
          allocated: plan.budget,
          used: primaryContext.length * 100,
          breakdown: {}
        },
        confidenceScore: 0.7
      }
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/context-assembly.test.js`
Expected: PASS

- [ ] **Step 5: Commit context assembly manager**

```bash
git add src/runtime/managers/context-assembly-manager.js tests/runtime/context-assembly.test.js
git commit -m "feat(L4): add ContextAssemblyManager core orchestrator

Supports task-level context gathering with multi-layer queries

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 5.2: Register Context Tool

**Files:**
- Create: `src/runtime/tools/context/comprehensive-context.js`
- Modify: `src/runtime/tools/tool-registry.js`
- Test: `src/tests/runtime/context-integration.test.js`

- [ ] **Step 1: Write failing test for context tool**

```javascript
// tests/runtime/context-integration.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createComprehensiveContextTool } from '../src/runtime/tools/context/comprehensive-context.js';

test('comprehensive-context tool executes', async () => {
  const mockManager = {
    gatherTaskContext: async ({ task }) => ({
      primaryContext: [{ file: '/test.js', symbol: 'test' }],
      metadata: { confidenceScore: 0.8 }
    })
  };
  
  const tool = createComprehensiveContextTool({ contextAssemblyManager: mockManager });
  
  assert.strictEqual(tool.id, 'tool.comprehensive-context');
  
  const result = await tool.execute({
    task: 'Test task',
    focus: ['/test.js']
  });
  
  assert.ok(result.primaryContext);
  assert.strictEqual(result.metadata.confidenceScore, 0.8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/context-integration.test.js`
Expected: FAIL with "createComprehensiveContextTool is not defined"

- [ ] **Step 3: Write tool implementation**

```javascript
// src/runtime/tools/context/comprehensive-context.js
export function createComprehensiveContextTool({ contextAssemblyManager }) {
  return {
    id: 'tool.comprehensive-context',
    name: 'Comprehensive Context',
    description: 'Gather comprehensive codebase context using all 4 intelligence layers',
    family: 'context',
    stage: 'foundation',
    status: contextAssemblyManager ? 'active' : 'unavailable',
    
    async execute(input = {}) {
      if (!contextAssemblyManager) {
        return {
          status: 'unavailable',
          reason: 'Context assembly manager not initialized'
        };
      }
      
      const {
        task = '',
        focus = [],
        mode = 'task',
        depth = 'medium',
        budget = 8000
      } = typeof input === 'string' ? { task: input } : input;
      
      if (mode === 'task') {
        return await contextAssemblyManager.gatherTaskContext({
          task,
          focus,
          depth,
          budget
        });
      } else if (mode === 'session') {
        return await contextAssemblyManager.gatherSessionContext({
          sessionId: input.sessionId,
          recentFiles: input.recentFiles || [],
          depth,
          budget
        });
      } else if (mode === 'project') {
        return await contextAssemblyManager.gatherProjectContext({
          query: task,
          scope: input.scope || 'entire-project',
          depth,
          budget
        });
      }
      
      return { status: 'error', reason: 'Invalid mode' };
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/context-integration.test.js`
Expected: PASS

- [ ] **Step 5: Register tool in tool-registry.js**

```javascript
// src/runtime/tools/tool-registry.js (add import and registration)
import { createComprehensiveContextTool } from './context/comprehensive-context.js';

// In createTools function, add:
if (managers.contextAssemblyManager) {
  tools.push(createComprehensiveContextTool({
    contextAssemblyManager: managers.contextAssemblyManager
  }));
}
```

- [ ] **Step 6: Create context assembly manager in create-managers.js**

```javascript
// src/runtime/create-managers.js (add)
import { ContextAssemblyManager } from './managers/context-assembly-manager.js';
import { BudgetManager } from './lib/budget-manager.js';
import { ResultRanker } from './lib/result-ranker.js';

// In createManagers function:
const budgetManager = new BudgetManager();
const ranker = new ResultRanker();

const contextAssemblyManager = new ContextAssemblyManager({
  layers: {
    structural: { db: projectGraphManager },
    semantic: null, // TODO: wire semantic layer
    intent: null    // TODO: wire intent layer
  },
  budgetManager,
  ranker,
  sessionMemory: null // TODO: wire session memory
});

managerList.push({
  name: 'contextAssemblyManager',
  instance: contextAssemblyManager,
  description: 'Multi-layer context assembly orchestrator'
});

// Add to returned managers object
return {
  managerList,
  managers: Object.fromEntries(managerList.map(m => [m.name, m.instance])),
  // ... existing managers
  contextAssemblyManager
};
```

- [ ] **Step 7: Run integration test**

Run: `node --test tests/runtime/context-integration.test.js`
Expected: All tests PASS

- [ ] **Step 8: Commit tool integration**

```bash
git add src/runtime/tools/context/comprehensive-context.js \
        src/runtime/tools/tool-registry.js \
        src/runtime/create-managers.js \
        tests/runtime/context-integration.test.js
git commit -m "feat(L4): integrate comprehensive-context tool

Exposes multi-layer context gathering via tool.comprehensive-context

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Configuration and Documentation

### Task 6.1: Runtime Configuration Schema

**Files:**
- Modify: `src/openkit-runtime/openkit.runtime.jsonc`
- Create: `docs/configuration/code-intelligence.md`

- [ ] **Step 1: Add configuration schema**

```jsonc
// .opencode/openkit.runtime.jsonc (add codeIntelligence section)
{
  // ... existing config
  
  "codeIntelligence": {
    // L1 Structural
    "structural": {
      "maxGraphDepth": 5,
      "enableTypeFlow": true,
      "enableScopeTracking": true,
      "extractDecorators": true
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
      "embeddingProvider": "openai",
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
      "llmProvider": "anthropic",
      "llmModel": "claude-sonnet-4.5",
      "batchSize": 5,
      "cacheEnabled": true,
      "minConfidence": 0.6,
      "backgroundExtraction": true
    },
    
    // L4 Context Assembly
    "contextAssembly": {
      "defaultMode": "task",
      "defaultDepth": "medium",
      "budgets": {
        "task": 8000,
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
      "minQualityScore": 0.7
    }
  }
}
```

- [ ] **Step 2: Create configuration documentation**

```markdown
<!-- docs/configuration/code-intelligence.md -->
# Code Intelligence Configuration

This document describes configuration options for the Multi-Layer Intelligence Stack.

## Configuration Location

`src/openkit-runtime/openkit.runtime.jsonc` - `codeIntelligence` section

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
```

- [ ] **Step 3: Commit configuration**

```bash
git add .opencode/openkit.runtime.jsonc docs/configuration/code-intelligence.md
git commit -m "docs: add code intelligence configuration schema and guide

Default config balances performance, quality, and cost

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Final Integration and Testing

### Task 7.1: End-to-End Integration Test

**Files:**
- Create: `src/tests/runtime/e2e-context-gathering.test.js`

- [ ] **Step 1: Write comprehensive E2E test**

```javascript
// tests/runtime/e2e-context-gathering.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectGraphDb } from '../src/runtime/analysis/project-graph-db.js';
import { ContextAssemblyManager } from '../src/runtime/managers/context-assembly-manager.js';
import { BudgetManager } from '../src/runtime/lib/budget-manager.js';
import { ResultRanker } from '../src/runtime/lib/result-ranker.js';

test('end-to-end context gathering with real data', async () => {
  // Create temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-e2e-'));
  const dbPath = path.join(tempDir, 'test.db');
  
  try {
    // Setup database with test data
    const db = new ProjectGraphDb({ dbPath });
    
    // Create realistic project structure
    const fileId1 = db.insertNode({
      path: '/project/src/user/registration.js',
      moduleType: 'esm',
      isTest: false
    });
    
    const fileId2 = db.insertNode({
      path: '/project/src/user/validation.js',
      moduleType: 'esm',
      isTest: false
    });
    
    const fileId3 = db.insertNode({
      path: '/project/tests/user/registration.test.js',
      moduleType: 'esm',
      isTest: true
    });
    
    // Add symbols
    const symbolReg = db.insertSymbol({
      nodeId: fileId1,
      name: 'registerUser',
      kind: 'function',
      isExport: true,
      line: 10,
      signature: 'async function registerUser(userData: UserData): Promise<User>',
      returnType: 'Promise<User>'
    });
    
    const symbolVal = db.insertSymbol({
      nodeId: fileId2,
      name: 'validateEmail',
      kind: 'function',
      isExport: true,
      line: 5
    });
    
    // Add dependencies
    db.insertEdge({
      fromNode: fileId1,
      toNode: fileId2,
      edgeType: 'import',
      line: 3
    });
    
    // Add type flow
    db.insertTypeFlow({
      fromSymbolId: symbolVal,
      toSymbolId: symbolReg,
      flowType: 'param',
      nodeId: fileId1,
      line: 12
    });
    
    // Add pattern
    db.insertCodePattern({
      patternType: 'validation',
      primarySymbolId: symbolVal,
      nodeId: fileId2,
      exampleCode: 'if (!email || !email.includes("@")) throw ValidationError',
      frequency: 15,
      confidence: 0.92
    });
    
    // Add intent
    db.insertCodeIntent({
      symbolId: symbolReg,
      intentType: 'business-rule',
      description: 'Email must be unique in the system',
      evidenceCode: 'await db.users.findOne({ email })',
      confidence: 0.88,
      model: 'claude-sonnet-4.5',
      extractedAt: Date.now() / 1000,
      validated: false
    });
    
    // Create context assembly manager
    const budgetManager = new BudgetManager();
    const ranker = new ResultRanker();
    
    const manager = new ContextAssemblyManager({
      layers: {
        structural: { db },
        semantic: null,
        intent: null
      },
      budgetManager,
      ranker
    });
    
    // Gather context
    const context = await manager.gatherTaskContext({
      task: 'Add email validation to user registration',
      focus: ['/project/src/user/registration.js'],
      depth: 'medium',
      budget: 8000
    });
    
    // Assertions
    assert.ok(context.primaryContext.length > 0, 'Should have primary context');
    assert.ok(context.metadata, 'Should have metadata');
    assert.ok(context.metadata.coverageMetrics, 'Should have coverage metrics');
    assert.ok(context.metadata.layerContributions, 'Should have layer contributions');
    assert(context.metadata.budgetUsage.used <= 8000, 'Should respect budget');
    
    // Cleanup
    db.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
});
```

- [ ] **Step 2: Run E2E test**

Run: `node --test tests/runtime/e2e-context-gathering.test.js`
Expected: PASS

- [ ] **Step 3: Commit E2E test**

```bash
git add tests/runtime/e2e-context-gathering.test.js
git commit -m "test: add end-to-end context gathering integration test

Validates complete flow: DB setup → context gathering → validation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 7.2: Update Main Documentation

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/features/multi-layer-intelligence.md`

- [ ] **Step 1: Update CLAUDE.md with new capabilities**

```markdown
<!-- CLAUDE.md (add section after "Project Graph") -->

### Multi-Layer Intelligence Stack

OpenKit now includes a comprehensive 4-layer intelligence stack for codebase understanding:

**Layer 1 - Structural Layer:**
- Enhanced graph: types, flows, scopes
- Type flow tracking: param/return/assignment/property
- Scope context tracking: lexical scopes with bindings
- Query capabilities: type flows, scope chains, decorator searches

**Layer 2 - Semantic Layer:**
- Pattern recognition: api-usage, validation, error-handling, architectural
- Data flow analysis: trace values through transformations
- Usage pattern mining: actual usage fingerprints
- Multi-source semantic search: embeddings + patterns + usage + graph

**Layer 3 - Intent Layer:**
- LLM-augmented business logic extraction
- Extractors: business rules, edge cases, design patterns, constraints
- Intent caching: hash-based with code change invalidation
- Confidence scoring: cross-validation with structural data

**Layer 4 - Context Assembly:**
- Smart orchestration: queries all layers in parallel
- Budget management: 40% critical, 30% important, 20% supplementary, 10% buffer
- Multi-layer ranking: combines structural, semantic, intent signals
- Session memory: maintains working set across tasks

**Tools:**
- `tool.comprehensive-context` - main context gathering (task/session/project modes)
- `tool.data-flow-trace` - trace data flows
- `tool.type-flow-trace` - trace type flows
- `tool.pattern-search` - search by patterns
- `tool.business-rule-query` - query business rules
- `tool.constraint-query` - query constraints

**Configuration:**
See `docs/configuration/code-intelligence.md` for full configuration guide.
```

- [ ] **Step 2: Create feature documentation**

```markdown
<!-- docs/features/multi-layer-intelligence.md -->
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
    coverageMetrics: { filesAnalyzed: 45, symbolsIncluded: 120, ... },
    layerContributions: { L1: 40, L2: 35, L3: 25 },
    budgetUsage: { allocated: 8000, used: 7650 },
    confidenceScore: 0.87
  }
}
```

## Configuration

See `docs/configuration/code-intelligence.md` for full configuration options.

## Testing

```bash
# Unit tests
node --test tests/runtime/data-flow-analyzer.test.js
node --test tests/runtime/pattern-recognition.test.js
node --test tests/runtime/intent-extraction.test.js
node --test tests/runtime/context-assembly.test.js

# Integration test
node --test tests/runtime/context-integration.test.js

# E2E test
node --test tests/runtime/e2e-context-gathering.test.js
```

## Performance

**Indexing:** 1-3 minutes for medium project (one-time + incremental)
**Query:** 3-5 seconds for comprehensive context
**Storage:** 2-3x codebase size (embeddings + patterns + intents)

## Troubleshooting

**Slow indexing:**
- Reduce `maxGraphDepth` to 3
- Disable `backgroundExtraction`

**High LLM costs:**
- Increase `batchSize` to 10
- Reduce `minConfidence` to 0.7
- Cache is enabled by default

**Missing context:**
- Increase budget
- Set depth to 'deep'
- Check layer contributions in metadata

## References

- Design: `docs/superpowers/specs/2026-05-10-codebase-understanding-design.md`
- Implementation: `docs/superpowers/plans/2026-05-10-multi-layer-intelligence-stack.md`
- Configuration: `docs/configuration/code-intelligence.md`
```

- [ ] **Step 3: Commit documentation updates**

```bash
git add CLAUDE.md docs/features/multi-layer-intelligence.md
git commit -m "docs: document multi-layer intelligence stack

Complete usage guide, architecture overview, configuration reference

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] All Phase 1 tasks completed (L1 Structural enhancements)
- [ ] All Phase 2 tasks completed (L2 Semantic layer)
- [ ] All Phase 3 tasks completed (L3 Intent layer)
- [ ] All Phase 4 tasks completed (L4 Context Assembly)
- [ ] All Phase 5 tasks completed (Integration)
- [ ] All Phase 6 tasks completed (Configuration & Documentation)
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Configuration schema added
- [ ] E2E test passing

---

## Notes

**Remaining Implementation Work:**

This plan provides a complete foundation but leaves some components for iterative enhancement:

1. **Pattern Extractors (L2):** Individual extractor implementations for api-usage, validation, error-handling, architectural, and test patterns
2. **Usage Pattern Miner (L2):** Complete implementation with anomaly detection
3. **Intent Extractors (L3):** Individual extractor implementations for each intent type
4. **Session Memory Manager (L4):** Full session state management
5. **Result Deduplicator (L4):** Result merging logic
6. **Context Enricher (L4):** Cross-reference enrichment
7. **Context Validator (L4):** Quality checks implementation

These components follow the same TDD pattern established in this plan. Each should:
- Start with failing tests
- Implement minimal passing version
- Extend iteratively
- Commit frequently

**Testing Strategy:**

- Unit tests for each component
- Integration tests for layer interactions
- E2E test for complete flow
- Performance benchmarks (separate from functional tests)

**Performance Optimization (Post-MVP):**

- Parallel query execution
- Query result caching
- Incremental L3 extraction in background
- Smart batch processing for LLM calls
- Storage compression

**Success Metrics:**

- Context miss rate < 5%
- Agent error rate < 10% of baseline
- Query time < 5 seconds
- Indexing time < 3 minutes (medium project)
- User satisfaction > 8/10
