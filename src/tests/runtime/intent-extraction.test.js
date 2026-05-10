import test from 'node:test';
import assert from 'node:assert/strict';

import { IntentExtractionService } from '../../runtime/analysis/intent-extraction-service.js';
import { IntentManager } from '../../runtime/managers/intent-manager.js';
import {
  ProjectGraphDb,
  isBetterSqliteAvailable,
} from '../../runtime/analysis/project-graph-db.js';

const sqliteAvailable = isBetterSqliteAvailable();

test('extracts and caches intents for symbol', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new IntentExtractionService({ db });

  const nodeId = db.insertNode({ path: '/test.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'validateEmail',
    kind: 'function',
    signature: 'function validateEmail(email: string): boolean',
  });

  const intents = await service.extractForSymbol(symbolId);

  assert(intents.length > 0);
  assert.strictEqual(intents[0].type, 'business-rule');

  // Verify stored in DB.
  const stored = db.getCodeIntents({ symbolId });
  assert(stored.length > 0);

  db.close();
});

test('skips cached extractions', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new IntentExtractionService({ db });

  const nodeId = db.insertNode({ path: '/test.js' });
  const symbolId = db.insertSymbol({ nodeId, name: 'test', kind: 'function' });

  await service.extractForSymbol(symbolId);

  // Second call should hit cache (no new DB inserts).
  const countBefore = db.getCodeIntents({ symbolId }).length;
  await service.extractForSymbol(symbolId);
  const countAfter = db.getCodeIntents({ symbolId }).length;

  assert.strictEqual(countBefore, countAfter);

  db.close();
});

test('filters intents below the minConfidence threshold', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new IntentExtractionService({ db, minConfidence: 0.95 });

  const nodeId = db.insertNode({ path: '/threshold.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'compute',
    kind: 'function',
    signature: 'function compute(): number',
  });

  // Stub returns confidence 0.85 — below the 0.95 threshold, so nothing
  // should make it to the DB even though the call still returns intents.
  const intents = await service.extractForSymbol(symbolId);
  assert(intents.length > 0);

  const stored = db.getCodeIntents({ symbolId });
  assert.strictEqual(stored.length, 0);

  db.close();
});

test('extractForFiles skips test files and trivial getters/setters', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new IntentExtractionService({ db });

  // Test file — every symbol inside should be skipped.
  const testNodeId = db.insertNode({ path: '/foo.test.js', isTest: true });
  const testSymbolId = db.insertSymbol({
    nodeId: testNodeId,
    name: 'shouldDoStuff',
    kind: 'function',
  });

  // Production file with one trivial getter and one real method.
  const prodNodeId = db.insertNode({ path: '/user.js' });
  const trivialSymbolId = db.insertSymbol({
    nodeId: prodNodeId,
    name: 'getName',
    kind: 'method',
  });
  const realSymbolId = db.insertSymbol({
    nodeId: prodNodeId,
    name: 'authenticate',
    kind: 'method',
    signature: 'authenticate(token: string): boolean',
  });

  const intents = await service.extractForFiles(['/foo.test.js', '/user.js']);

  // Only `authenticate` should produce intents (3 extractor types each).
  assert.strictEqual(intents.length, 3);

  assert.strictEqual(db.getCodeIntents({ symbolId: testSymbolId }).length, 0);
  assert.strictEqual(db.getCodeIntents({ symbolId: trivialSymbolId }).length, 0);
  assert(db.getCodeIntents({ symbolId: realSymbolId }).length > 0);

  db.close();
});

test('returns empty array when symbol does not exist', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const service = new IntentExtractionService({ db });

  const result = await service.extractForSymbol(99999);
  assert.deepStrictEqual(result, []);

  db.close();
});

test('IntentManager.triggerBackgroundExtraction is no-op when disabled', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const manager = new IntentManager({ db, backgroundEnabled: false });

  const nodeId = db.insertNode({ path: '/bg.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'work',
    kind: 'function',
    signature: 'function work(): void',
  });

  await manager.triggerBackgroundExtraction(['/bg.js']);
  // Allow any (incorrectly) scheduled async work a tick to execute.
  await new Promise((resolve) => setImmediate(resolve));

  const stored = db.getCodeIntents({ symbolId });
  assert.strictEqual(stored.length, 0);

  db.close();
});

test('IntentManager.triggerBackgroundExtraction runs when enabled', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const manager = new IntentManager({ db, backgroundEnabled: true });

  const nodeId = db.insertNode({ path: '/bg.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'process',
    kind: 'function',
    signature: 'function process(input: any): void',
  });

  await manager.triggerBackgroundExtraction(['/bg.js']);

  // Background work is fire-and-forget — give the microtask queue time
  // to drain so the (synchronous) stub extraction completes before we
  // inspect the DB.
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  const stored = db.getCodeIntents({ symbolId });
  assert(stored.length > 0);

  db.close();
});

test('IntentManager honors custom extractor list from config', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const manager = new IntentManager({
    db,
    config: { extractors: ['design-pattern'] },
  });

  const nodeId = db.insertNode({ path: '/custom.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'Singleton',
    kind: 'class',
    signature: 'class Singleton',
  });

  const intents = await manager.extractForSymbol(symbolId);

  assert.strictEqual(intents.length, 1);
  assert.strictEqual(intents[0].type, 'design-pattern');

  db.close();
});
