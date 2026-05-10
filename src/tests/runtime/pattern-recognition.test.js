import test from 'node:test';
import assert from 'node:assert/strict';

import { PatternRecognitionService } from '../../runtime/analysis/pattern-recognition-service.js';
import {
  ProjectGraphDb,
  isBetterSqliteAvailable,
} from '../../runtime/analysis/project-graph-db.js';

const sqliteAvailable = isBetterSqliteAvailable();

test('extracts API usage patterns', { skip: !sqliteAvailable }, () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new PatternRecognitionService({ db });

  const nodeId = db.insertNode({ path: '/api.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'fetchUser',
    kind: 'function',
  });

  const patterns = service.extractForSymbol(symbolId);

  assert(patterns.some((p) => p.type === 'api-usage'));

  // Verify persistence to code_patterns table.
  const stored = db.getCodePatterns({ symbolId });
  assert(stored.some((row) => row.pattern_type === 'api-usage'));

  db.close();
});

test('extracts validation patterns', { skip: !sqliteAvailable }, () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new PatternRecognitionService({ db });

  const nodeId = db.insertNode({ path: '/validate.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'validateEmail',
    kind: 'function',
  });

  const patterns = service.extractForSymbol(symbolId);

  assert(patterns.some((p) => p.type === 'validation'));

  db.close();
});

test('extracts error-handling patterns', { skip: !sqliteAvailable }, () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new PatternRecognitionService({ db });

  const nodeId = db.insertNode({ path: '/errors.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'handleError',
    kind: 'function',
  });

  const patterns = service.extractForSymbol(symbolId);

  assert(patterns.some((p) => p.type === 'error-handling'));

  db.close();
});

test('detects schema-validation subtype', { skip: !sqliteAvailable }, () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new PatternRecognitionService({ db });

  const nodeId = db.insertNode({ path: '/schemas.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'userSchema',
    kind: 'variable',
  });

  const patterns = service.extractForSymbol(symbolId);

  assert(
    patterns.some(
      (p) => p.type === 'validation' && p.subtype === 'schema-validation',
    ),
  );

  db.close();
});

test('detects retry-logic subtype', { skip: !sqliteAvailable }, () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new PatternRecognitionService({ db });

  const nodeId = db.insertNode({ path: '/retry.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'retryWithBackoff',
    kind: 'function',
  });

  const patterns = service.extractForSymbol(symbolId);

  assert(
    patterns.some(
      (p) => p.type === 'error-handling' && p.subtype === 'retry-logic',
    ),
  );

  db.close();
});

test(
  'returns empty array for non-matching symbol',
  { skip: !sqliteAvailable },
  () => {
    const db = new ProjectGraphDb({ dbPath: ':memory:' });
    const service = new PatternRecognitionService({ db });

    const nodeId = db.insertNode({ path: '/util.js' });
    const symbolId = db.insertSymbol({
      nodeId,
      name: 'noop',
      kind: 'function',
    });

    const patterns = service.extractForSymbol(symbolId);

    assert.strictEqual(patterns.length, 0);

    db.close();
  },
);

test(
  'extractForSymbol returns [] when symbol does not exist',
  { skip: !sqliteAvailable },
  () => {
    const db = new ProjectGraphDb({ dbPath: ':memory:' });
    const service = new PatternRecognitionService({ db });

    const patterns = service.extractForSymbol(9999);
    assert.deepStrictEqual(patterns, []);

    db.close();
  },
);

test(
  'extractForFiles iterates symbols and skips test files',
  { skip: !sqliteAvailable },
  () => {
    const db = new ProjectGraphDb({ dbPath: ':memory:' });
    const service = new PatternRecognitionService({ db });

    const apiNodeId = db.insertNode({ path: '/svc/api.js' });
    db.insertSymbol({ nodeId: apiNodeId, name: 'fetchOrders', kind: 'function' });
    db.insertSymbol({ nodeId: apiNodeId, name: 'noopHelper', kind: 'function' });

    const testNodeId = db.insertNode({ path: '/svc/api.test.js', isTest: true });
    db.insertSymbol({
      nodeId: testNodeId,
      name: 'validateThing',
      kind: 'function',
    });

    const patterns = service.extractForFiles([
      '/svc/api.js',
      '/svc/api.test.js',
    ]);

    // Only the api-usage pattern from /svc/api.js should be returned.
    assert(patterns.some((p) => p.type === 'api-usage'));
    assert(!patterns.some((p) => p.type === 'validation'));

    db.close();
  },
);

test(
  'respects enabledPatterns filter',
  { skip: !sqliteAvailable },
  () => {
    const db = new ProjectGraphDb({ dbPath: ':memory:' });
    const service = new PatternRecognitionService({
      db,
      enabledPatterns: ['validation'],
    });

    const nodeId = db.insertNode({ path: '/mixed.js' });
    const symbolId = db.insertSymbol({
      nodeId,
      // Matches both api-usage (fetch) and validation (validate).
      name: 'fetchAndValidateUser',
      kind: 'function',
    });

    const patterns = service.extractForSymbol(symbolId);

    assert(patterns.every((p) => p.type === 'validation'));
    assert(patterns.length > 0);

    db.close();
  },
);

test(
  'persists pattern to code_patterns table with correct fields',
  { skip: !sqliteAvailable },
  () => {
    const db = new ProjectGraphDb({ dbPath: ':memory:' });
    const service = new PatternRecognitionService({ db });

    const nodeId = db.insertNode({ path: '/db.js' });
    const symbolId = db.insertSymbol({
      nodeId,
      name: 'findOneUser',
      kind: 'function',
      signature: 'function findOneUser(id: string): User',
    });

    service.extractForSymbol(symbolId);

    const stored = db.getCodePatterns({ symbolId });
    const dbPattern = stored.find((row) => row.pattern_type === 'api-usage');
    assert(dbPattern, 'expected api-usage row');
    assert.strictEqual(dbPattern.primary_symbol_id, symbolId);
    assert.strictEqual(dbPattern.node_id, nodeId);
    assert(dbPattern.confidence > 0 && dbPattern.confidence <= 1);

    db.close();
  },
);

test(
  'throws when constructed without a db',
  () => {
    assert.throws(() => new PatternRecognitionService({}), /requires a db/);
  },
);
