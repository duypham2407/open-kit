/**
 * End-to-end integration test for the Multi-Layer Intelligence Stack.
 *
 * Drives the full L1 (structural) → L4 (context assembly) flow against a
 * real on-disk SQLite database populated with a realistic project shape:
 *   - file nodes (with module type / test flags)
 *   - exported symbols (function signatures, return types)
 *   - import edges between files
 *   - L1 type-flow rows linking parameter types between symbols
 *   - L1 scope contexts with bindings
 *   - L2 code patterns (validation pattern with example code)
 *   - L3 LLM-extracted code intents (business rule)
 *
 * The test then constructs a ContextAssemblyManager wired to the live DB,
 * gathers task context, and asserts that the returned package is well-formed:
 * primary context is non-empty, the budget is respected, and the metadata
 * surfaces the documented coverage / contribution / confidence fields.
 *
 * The test cleans up its temp directory in both the happy and error paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  ProjectGraphDb,
  isBetterSqliteAvailable,
} from '../../src/runtime/analysis/project-graph-db.js';
import { ContextAssemblyManager } from '../../src/runtime/managers/context-assembly-manager.js';
import { BudgetManager } from '../../src/runtime/lib/budget-manager.js';
import { ResultRanker } from '../../src/runtime/lib/result-ranker.js';

test('end-to-end context gathering with real data', async (t) => {
  if (!isBetterSqliteAvailable()) {
    t.skip('better-sqlite3 native module not available on this platform');
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-e2e-'));
  const dbPath = path.join(tempDir, 'test.db');
  let db;

  try {
    // -------------------------------------------------------------------
    // Seed a realistic project structure into the graph DB.
    // -------------------------------------------------------------------
    db = new ProjectGraphDb({ dbPath });

    const fileId1 = db.insertNode({
      path: '/project/src/user/registration.js',
      moduleType: 'esm',
      isTest: false,
    });

    const fileId2 = db.insertNode({
      path: '/project/src/user/validation.js',
      moduleType: 'esm',
      isTest: false,
    });

    const fileId3 = db.insertNode({
      path: '/project/tests/user/registration.test.js',
      moduleType: 'esm',
      isTest: true,
    });

    // Two exported symbols: registerUser (depends on) → validateEmail
    const symbolReg = db.insertSymbol({
      nodeId: fileId1,
      name: 'registerUser',
      kind: 'function',
      isExport: true,
      line: 10,
      signature:
        'async function registerUser(userData: UserData): Promise<User>',
      returnType: 'Promise<User>',
    });

    const symbolVal = db.insertSymbol({
      nodeId: fileId2,
      name: 'validateEmail',
      kind: 'function',
      isExport: true,
      line: 5,
    });

    // Test file references the registration module so the dependents query
    // returns at least one consumer when later layers walk the graph.
    const symbolTest = db.insertSymbol({
      nodeId: fileId3,
      name: 'registers a new user',
      kind: 'test',
      isExport: false,
      line: 8,
    });

    // Import edges: registration.js imports validation.js;
    // the test file imports registration.js.
    db.replaceEdgesFrom(fileId1, [
      { toNodeId: fileId2, edgeType: 'import', line: 3 },
    ]);
    db.replaceEdgesFrom(fileId3, [
      { toNodeId: fileId1, edgeType: 'import', line: 1 },
    ]);

    // L1: type flow between symbols (validation result feeds registration)
    db.insertTypeFlow({
      fromSymbolId: symbolVal,
      toSymbolId: symbolReg,
      flowType: 'param',
      nodeId: fileId1,
      line: 12,
    });

    // L1: a lexical scope inside the registration function
    db.insertScopeContext({
      nodeId: fileId1,
      scopeType: 'function',
      parentScopeId: null,
      startLine: 10,
      endLine: 30,
      bindingsJson: JSON.stringify({ userData: 'parameter' }),
    });

    // L2: a validation pattern detected on the validation symbol
    db.insertCodePattern({
      patternType: 'validation',
      primarySymbolId: symbolVal,
      nodeId: fileId2,
      exampleCode:
        'if (!email || !email.includes("@")) throw ValidationError',
      frequency: 15,
      confidence: 0.92,
    });

    // L3: an LLM-extracted business rule on the registration symbol
    db.insertCodeIntent({
      symbolId: symbolReg,
      intentType: 'business-rule',
      description: 'Email must be unique in the system',
      evidenceCode: 'await db.users.findOne({ email })',
      confidence: 0.88,
      model: 'claude-sonnet-4.5',
      extractedAt: Math.floor(Date.now() / 1000),
      validated: false,
    });

    // Sanity-check the seed before driving the manager: if the seed broke,
    // any later assertion failure would otherwise be misleading.
    const stats = db.stats();
    assert.equal(stats.nodes, 3, 'expected 3 file nodes');
    assert.equal(stats.symbols, 3, 'expected 3 symbols');
    assert.equal(stats.edges, 2, 'expected 2 import edges');
    assert.deepEqual(
      db.getCodeIntents({ intentType: 'business-rule' }).map((i) => i.description),
      ['Email must be unique in the system'],
    );
    assert.deepEqual(
      db.getCodePatterns({ patternType: 'validation' }).map((p) => p.confidence),
      [0.92],
    );
    assert.equal(
      db.getTypeFlows({ fromSymbolId: symbolVal }).length,
      1,
      'expected one outgoing type flow from validateEmail',
    );

    // -------------------------------------------------------------------
    // Build the ContextAssemblyManager and drive a task-level query.
    // -------------------------------------------------------------------
    const budgetManager = new BudgetManager();
    const ranker = new ResultRanker();

    const manager = new ContextAssemblyManager({
      layers: {
        structural: { db },
        // L2/L3 are wired iteratively; the manager handles null layers.
        semantic: null,
        intent: null,
      },
      budgetManager,
      ranker,
    });

    const context = await manager.gatherTaskContext({
      task: 'Add email validation to user registration',
      focus: ['/project/src/user/registration.js'],
      depth: 'medium',
      budget: 8000,
    });

    // -------------------------------------------------------------------
    // Assertions on the assembled package.
    // -------------------------------------------------------------------
    assert.ok(Array.isArray(context.primaryContext), 'primaryContext is array');
    assert.ok(
      context.primaryContext.length > 0,
      'should return at least one primary context item from the focus file',
    );

    const regItem = context.primaryContext.find((i) => i.symbol === 'registerUser');
    assert.ok(regItem, 'expected registerUser to appear in primary context');
    assert.equal(regItem.file, '/project/src/user/registration.js');
    assert.equal(regItem.layer, 'structural');

    // Metadata shape — the docs/configuration/code-intelligence.md guide
    // and the design plan both promise these fields.
    assert.ok(context.metadata, 'should have metadata');
    assert.ok(context.metadata.coverageMetrics, 'should have coverage metrics');
    assert.ok(
      context.metadata.layerContributions,
      'should have layer contributions',
    );
    assert.ok(context.metadata.budgetUsage, 'should have budget usage');
    assert.equal(typeof context.metadata.confidenceScore, 'number');
    assert.equal(context.metadata.depth, 'medium');

    // Budget contract: never exceed the caller-supplied budget.
    assert.ok(
      context.metadata.budgetUsage.used <= 8000,
      `budget used (${context.metadata.budgetUsage.used}) must respect budget (8000)`,
    );
    assert.equal(context.metadata.budgetUsage.total, 8000);

    // Layer contributions: L1 is wired, so structural must have hits and
    // L2/L3 must report zero (not undefined).
    assert.ok(
      context.metadata.layerContributions.structural >= 1,
      'structural layer should contribute at least one item',
    );
    assert.equal(context.metadata.layerContributions.semantic, 0);
    assert.equal(context.metadata.layerContributions.intent, 0);

    // Coverage metrics must reflect the focus file and its symbols.
    assert.ok(
      context.metadata.coverageMetrics.filesAnalyzed >= 1,
      'at least the focus file should be analyzed',
    );
    assert.ok(
      context.metadata.coverageMetrics.symbolsIncluded >= 1,
      'at least one symbol should be included',
    );
    assert.equal(
      context.metadata.coverageMetrics.layersConsulted,
      context.metadata.layersQueried.length,
    );
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // best-effort cleanup
      }
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
