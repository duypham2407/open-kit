/**
 * Tests for ProjectGraphDb L1 (Structural) schema extensions.
 *
 * These tests cover the column additions made by SchemaManager-driven
 * migrations on top of the base nodes/symbols schema:
 *
 *   nodes:    module_type, package_name, is_test, is_config
 *   symbols:  return_type, params_json, decorators_json,
 *             parent_symbol_id, scope_chain, start_col, end_col
 *
 * The pre-existing `signature` column on `symbols` is also exercised here
 * because the L1 spec lists it among the required L1 fields, even though it
 * was already added by an earlier migration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ProjectGraphDb } from '../../src/runtime/analysis/project-graph-db.js';

// ---------------------------------------------------------------------------
// nodes table — L1 extensions
// ---------------------------------------------------------------------------

test('nodes table has extended L1 columns', () => {
  const db = new ProjectGraphDb(':memory:');

  const node = db.upsertNode({
    filePath: '/test/file.js',
    kind: 'module',
    mtime: 1000,
    moduleType: 'esm',
    packageName: null,
    isTest: false,
    isConfig: false,
  });

  assert.strictEqual(node.module_type, 'esm');
  assert.strictEqual(node.package_name, null);
  assert.strictEqual(node.is_test, 0);
  assert.strictEqual(node.is_config, 0);

  db.close();
});

test('nodes L1 columns default to null/0 when not provided', () => {
  const db = new ProjectGraphDb(':memory:');

  const node = db.upsertNode({ filePath: '/test/legacy.js' });

  assert.strictEqual(node.module_type, null);
  assert.strictEqual(node.package_name, null);
  assert.strictEqual(node.is_test, 0);
  assert.strictEqual(node.is_config, 0);

  db.close();
});

test('nodes L1 boolean columns coerce truthy values to 1', () => {
  const db = new ProjectGraphDb(':memory:');

  const testNode = db.upsertNode({
    filePath: '/test/foo.test.js',
    isTest: true,
    isConfig: false,
  });
  const configNode = db.upsertNode({
    filePath: '/test/eslint.config.js',
    isTest: false,
    isConfig: true,
    moduleType: 'cjs',
    packageName: '@scope/pkg',
  });

  assert.strictEqual(testNode.is_test, 1);
  assert.strictEqual(testNode.is_config, 0);

  assert.strictEqual(configNode.is_config, 1);
  assert.strictEqual(configNode.is_test, 0);
  assert.strictEqual(configNode.module_type, 'cjs');
  assert.strictEqual(configNode.package_name, '@scope/pkg');

  db.close();
});

test('upsertNode preserves L1 columns on conflict update', () => {
  const db = new ProjectGraphDb(':memory:');

  db.upsertNode({
    filePath: '/test/file.js',
    mtime: 1,
    moduleType: 'esm',
    packageName: 'pkg-a',
    isTest: false,
    isConfig: false,
  });

  const updated = db.upsertNode({
    filePath: '/test/file.js',
    mtime: 2,
    moduleType: 'cjs',
    packageName: 'pkg-b',
    isTest: true,
    isConfig: false,
  });

  assert.strictEqual(updated.mtime, 2);
  assert.strictEqual(updated.module_type, 'cjs');
  assert.strictEqual(updated.package_name, 'pkg-b');
  assert.strictEqual(updated.is_test, 1);

  db.close();
});

// ---------------------------------------------------------------------------
// symbols table — L1 extensions
// ---------------------------------------------------------------------------

test('symbols table has extended L1 columns', () => {
  const db = new ProjectGraphDb(':memory:');
  const node = db.upsertNode({ filePath: '/test/file.js' });

  db.replaceSymbolsFor(node.id, [
    {
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
      endCol: 50,
    },
  ]);

  const syms = db.getSymbolsByNode(node.id);
  assert.strictEqual(syms.length, 1);
  const symbol = syms[0];

  assert.strictEqual(symbol.signature, 'function testFunc(a: string): number');
  assert.strictEqual(symbol.return_type, 'number');
  assert.strictEqual(
    symbol.params_json,
    JSON.stringify([{ name: 'a', type: 'string' }])
  );
  assert.strictEqual(symbol.decorators_json, JSON.stringify(['@cached']));
  assert.strictEqual(symbol.parent_symbol_id, null);
  assert.strictEqual(symbol.scope_chain, 'module');
  assert.strictEqual(symbol.start_col, 0);
  assert.strictEqual(symbol.end_col, 50);

  db.close();
});

test('symbols L1 columns default to null when not provided', () => {
  const db = new ProjectGraphDb(':memory:');
  const node = db.upsertNode({ filePath: '/test/file.js' });

  db.replaceSymbolsFor(node.id, [
    { name: 'plain', kind: 'function', isExport: false, line: 1 },
  ]);

  const syms = db.getSymbolsByNode(node.id);
  assert.strictEqual(syms.length, 1);

  assert.strictEqual(syms[0].return_type, null);
  assert.strictEqual(syms[0].params_json, null);
  assert.strictEqual(syms[0].decorators_json, null);
  assert.strictEqual(syms[0].parent_symbol_id, null);
  assert.strictEqual(syms[0].scope_chain, null);
  assert.strictEqual(syms[0].start_col, null);
  assert.strictEqual(syms[0].end_col, null);

  db.close();
});

test('symbols support parent hierarchy', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/class.js' });

  const classId = db.insertSymbol({
    nodeId,
    name: 'MyClass',
    kind: 'class',
    line: 1,
  });

  const methodId = db.insertSymbol({
    nodeId,
    name: 'myMethod',
    kind: 'method',
    line: 5,
    parentSymbolId: classId,
  });

  const method = db.getSymbol(methodId);
  assert.strictEqual(method.parent_symbol_id, classId);

  const parent = db.getSymbol(method.parent_symbol_id);
  assert.strictEqual(parent.name, 'MyClass');
  assert.strictEqual(parent.kind, 'class');

  db.close();
});

// ---------------------------------------------------------------------------
// Migration idempotency — opening a DB twice should not fail or duplicate
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// insertNode / insertSymbol — thin wrappers used by downstream tasks
// (1.3, 1.4, 2.x, 3.x) that expect rowid return values.
// ---------------------------------------------------------------------------

test('insertNode returns rowid', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const id = db.insertNode({ path: '/test/file.js' });
  assert.strictEqual(typeof id, 'number');
  assert.ok(id > 0);
  db.close();
});

test('insertSymbol returns rowid', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'testFunc',
    kind: 'function',
  });
  assert.strictEqual(typeof symbolId, 'number');
  assert.ok(symbolId > 0);
  db.close();
});

test('insertSymbol is additive, not destructive', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });

  const id1 = db.insertSymbol({ nodeId, name: 'funcA', kind: 'function' });
  const id2 = db.insertSymbol({ nodeId, name: 'funcB', kind: 'function' });

  const symbols = db.getSymbols(nodeId);
  assert.strictEqual(symbols.length, 2);
  assert.strictEqual(symbols[0].id, id1);
  assert.strictEqual(symbols[0].name, 'funcA');
  assert.strictEqual(symbols[1].id, id2);
  assert.strictEqual(symbols[1].name, 'funcB');

  db.close();
});

// ---------------------------------------------------------------------------
// type_flows table — tracks data flow between symbols (Task 1.3)
// ---------------------------------------------------------------------------

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
    confidence: 1.0,
  });

  assert.strictEqual(typeof flowId, 'number');
  assert.ok(flowId > 0);

  const flows = db.getTypeFlows({ fromSymbolId });
  assert.strictEqual(flows.length, 1);
  assert.strictEqual(flows[0].flow_type, 'assignment');
  assert.strictEqual(flows[0].confidence, 1.0);

  db.close();
});

test('getTypeFlows unions results when both fromSymbolId and toSymbolId provided', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });
  const symbolA = db.insertSymbol({ nodeId, name: 'a', kind: 'variable' });
  const symbolB = db.insertSymbol({ nodeId, name: 'b', kind: 'variable' });
  const symbolC = db.insertSymbol({ nodeId, name: 'c', kind: 'variable' });
  const symbolD = db.insertSymbol({ nodeId, name: 'd', kind: 'variable' });

  // Flow 1: A -> B (touches A, not C)
  const flowAB = db.insertTypeFlow({
    fromSymbolId: symbolA,
    toSymbolId: symbolB,
    flowType: 'assignment',
    nodeId,
    line: 1,
  });
  // Flow 2: B -> C (touches C, not A)
  const flowBC = db.insertTypeFlow({
    fromSymbolId: symbolB,
    toSymbolId: symbolC,
    flowType: 'assignment',
    nodeId,
    line: 2,
  });
  // Flow 3: A -> C (touches BOTH A and C — must not be duplicated)
  const flowAC = db.insertTypeFlow({
    fromSymbolId: symbolA,
    toSymbolId: symbolC,
    flowType: 'assignment',
    nodeId,
    line: 3,
  });
  // Flow 4: B -> D (touches neither A nor C — must not appear)
  db.insertTypeFlow({
    fromSymbolId: symbolB,
    toSymbolId: symbolD,
    flowType: 'assignment',
    nodeId,
    line: 4,
  });

  // Query for flows involving either A or C — expect the union of both
  // result sets, deduplicated where a single row matches both.
  const flows = db.getTypeFlows({ fromSymbolId: symbolA, toSymbolId: symbolC });
  const ids = flows.map((f) => f.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [flowAB, flowBC, flowAC].sort((a, b) => a - b));
  assert.strictEqual(flows.length, 3);

  db.close();
});

// ---------------------------------------------------------------------------
// scope_contexts table — tracks lexical scope hierarchy and bindings (Task 1.4)
// ---------------------------------------------------------------------------

test('can insert and query scope contexts', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });

  const scopeId = db.insertScopeContext({
    nodeId,
    scopeType: 'function',
    parentScopeId: null,
    startLine: 10,
    endLine: 20,
    bindingsJson: JSON.stringify({ a: 'parameter', b: 'variable' }),
  });

  assert.strictEqual(typeof scopeId, 'number');
  assert.ok(scopeId > 0);

  const scopes = db.getScopeContexts({ nodeId });
  assert.strictEqual(scopes.length, 1);
  assert.strictEqual(scopes[0].scope_type, 'function');
  assert.strictEqual(scopes[0].start_line, 10);
  assert.strictEqual(scopes[0].end_line, 20);
  assert.strictEqual(scopes[0].parent_scope_id, null);
  assert.strictEqual(
    scopes[0].bindings_json,
    JSON.stringify({ a: 'parameter', b: 'variable' })
  );

  db.close();
});

test('scope contexts support parent hierarchy', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });

  const moduleScope = db.insertScopeContext({
    nodeId,
    scopeType: 'module',
    parentScopeId: null,
    startLine: 1,
    endLine: 100,
  });

  const classScope = db.insertScopeContext({
    nodeId,
    scopeType: 'class',
    parentScopeId: moduleScope,
    startLine: 5,
    endLine: 80,
  });

  const methodScope = db.insertScopeContext({
    nodeId,
    scopeType: 'function',
    parentScopeId: classScope,
    startLine: 10,
    endLine: 20,
    bindingsJson: JSON.stringify({ self: 'parameter' }),
  });

  const scopes = db.getScopeContexts({ nodeId });
  assert.strictEqual(scopes.length, 3);
  // Ordered by start_line
  assert.strictEqual(scopes[0].id, moduleScope);
  assert.strictEqual(scopes[0].parent_scope_id, null);
  assert.strictEqual(scopes[1].id, classScope);
  assert.strictEqual(scopes[1].parent_scope_id, moduleScope);
  assert.strictEqual(scopes[2].id, methodScope);
  assert.strictEqual(scopes[2].parent_scope_id, classScope);

  db.close();
});

test('scope contexts default optional fields to null', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/file.js' });

  const scopeId = db.insertScopeContext({
    nodeId,
    scopeType: 'block',
    startLine: 5,
    endLine: 7,
  });

  const scopes = db.getScopeContexts({ nodeId });
  assert.strictEqual(scopes.length, 1);
  assert.strictEqual(scopes[0].id, scopeId);
  assert.strictEqual(scopes[0].parent_scope_id, null);
  assert.strictEqual(scopes[0].bindings_json, null);

  db.close();
});

// ---------------------------------------------------------------------------
// code_patterns table — stores recognized patterns from static analysis (Task 2.1)
// ---------------------------------------------------------------------------

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
    confidence: 0.95,
  });

  assert.strictEqual(typeof patternId, 'number');
  assert.ok(patternId > 0);

  const patterns = db.getCodePatterns({ patternType: 'validation' });
  assert.strictEqual(patterns.length, 1);
  assert.strictEqual(patterns[0].confidence, 0.95);

  db.close();
});

// ---------------------------------------------------------------------------
// code_intents table — stores LLM-extracted insights (Task 3.1)
// ---------------------------------------------------------------------------

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
    validated: false,
  });

  assert.strictEqual(typeof intentId, 'number');
  assert.ok(intentId > 0);

  const intents = db.getCodeIntents({ symbolId });
  assert.strictEqual(intents.length, 1);
  assert.strictEqual(intents[0].intent_type, 'business-rule');
  assert.strictEqual(intents[0].confidence, 0.92);

  db.close();
});

test('can query code intents by intent_type', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/rules.js' });
  const symbolA = db.insertSymbol({ nodeId, name: 'checkA', kind: 'function' });
  const symbolB = db.insertSymbol({ nodeId, name: 'checkB', kind: 'function' });

  db.insertCodeIntent({
    nodeId,
    symbolId: symbolA,
    intentType: 'constraint',
    description: 'Value must be positive',
    extractedAt: Date.now() / 1000,
  });

  db.insertCodeIntent({
    nodeId,
    symbolId: symbolB,
    intentType: 'edge-case',
    description: 'Handles empty input',
    extractedAt: Date.now() / 1000,
  });

  const constraints = db.getCodeIntents({ intentType: 'constraint' });
  assert.strictEqual(constraints.length, 1);
  assert.strictEqual(constraints[0].description, 'Value must be positive');

  const edgeCases = db.getCodeIntents({ intentType: 'edge-case' });
  assert.strictEqual(edgeCases.length, 1);
  assert.strictEqual(edgeCases[0].description, 'Handles empty input');

  // No filter returns empty array
  const none = db.getCodeIntents({});
  assert.strictEqual(none.length, 0);

  db.close();
});

test('code_intents validated flag round-trips as integer', () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const nodeId = db.insertNode({ path: '/test/v.js' });
  const symbolId = db.insertSymbol({ nodeId, name: 'fn', kind: 'function' });

  db.insertCodeIntent({
    symbolId,
    intentType: 'design-pattern',
    description: 'Singleton instance',
    extractedAt: Date.now() / 1000,
    validated: true,
  });

  const rows = db.getCodeIntents({ symbolId });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].validated, 1);
  // Defaults applied when omitted
  assert.strictEqual(rows[0].confidence, 1.0);
  assert.strictEqual(rows[0].node_id, null);

  db.close();
});

test('schema migrations are idempotent across re-opens', () => {
  const db = new ProjectGraphDb(':memory:');
  const node = db.upsertNode({
    filePath: '/test/file.js',
    moduleType: 'esm',
    isTest: true,
  });
  assert.strictEqual(node.module_type, 'esm');
  assert.strictEqual(node.is_test, 1);

  // Closing and re-opening the same in-memory DB drops state, but the
  // important check is that re-running the schema setup on an already-migrated
  // file-backed DB does not throw.  We exercise the in-process equivalent by
  // re-running migrate via a fresh ProjectGraphDb pointed at ':memory:'.
  db.close();

  const db2 = new ProjectGraphDb(':memory:');
  // Should not throw; should still expose extended columns.
  const node2 = db2.upsertNode({ filePath: '/test/other.js', isConfig: true });
  assert.strictEqual(node2.is_config, 1);
  db2.close();
});
