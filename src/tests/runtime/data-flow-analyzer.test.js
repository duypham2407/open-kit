/**
 * Tests for DataFlowAnalyzer (Phase 2, Layer 2 — Semantic, Task 2.2).
 *
 * Exercises BFS path tracing across `type_flows` and direct dependency-chain
 * extraction for a target symbol.  These behaviours are consumed by L3 Intent
 * extraction and L4 Context Assembly downstream.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DataFlowAnalyzer } from '../../runtime/analysis/data-flow-analyzer.js';
import { ProjectGraphDb } from '../../runtime/analysis/project-graph-db.js';

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
  assert(chain.dependsOn.some((s) => s.name === 'x'));
  assert(chain.dependsOn.some((s) => s.name === 'y'));
});
