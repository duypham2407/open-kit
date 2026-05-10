import test from 'node:test';
import assert from 'node:assert/strict';

import { SemanticLayerEnhancer } from '../../runtime/analysis/semantic-layer-enhancer.js';
import {
  ProjectGraphDb,
  isBetterSqliteAvailable,
} from '../../runtime/analysis/project-graph-db.js';

const sqliteAvailable = isBetterSqliteAvailable();

test('enhances chunks with patterns and intents', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const enhancer = new SemanticLayerEnhancer({ db });

  const nodeId = db.insertNode({ path: '/test.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'validateEmail',
    kind: 'function',
  });

  const chunks = [{
    chunkId: 'chunk1',
    metadata: {
      symbols: [{ id: symbolId }],
      patterns: [],
      intents: [],
    },
  }];

  await enhancer.enhanceChunks(chunks, nodeId);

  assert.ok(chunks[0].metadata.patterns.length > 0, 'expected pattern hits');
  assert.ok(chunks[0].metadata.confidence > 0.5, 'confidence should rise above base');

  db.close();
});

test('skips intent extraction when intentConfig is disabled', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const enhancer = new SemanticLayerEnhancer({
    db,
    intentConfig: { enabled: false },
  });

  const nodeId = db.insertNode({ path: '/handler.js' });
  const symbolId = db.insertSymbol({
    nodeId,
    name: 'handleError',
    kind: 'function',
  });

  const chunks = [{
    chunkId: 'chunk1',
    metadata: {
      symbols: [{ id: symbolId }],
      patterns: [],
      intents: [],
    },
  }];

  await enhancer.enhanceChunks(chunks, nodeId);

  assert.equal(chunks[0].metadata.intents.length, 0, 'intents should remain empty');
  assert.ok(chunks[0].metadata.patterns.length > 0, 'patterns should still populate');

  db.close();
});

test('falls back to symbolName when chunk metadata.symbols is absent', { skip: !sqliteAvailable }, async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const enhancer = new SemanticLayerEnhancer({ db });

  const nodeId = db.insertNode({ path: '/api.js' });
  db.insertSymbol({
    nodeId,
    name: 'fetchUser',
    kind: 'function',
  });

  // Chunks shaped like the existing extractor output (no `symbols` array,
  // just `symbolName`).
  const chunks = [{
    chunkId: 'api.js:fetchUser:1',
    metadata: {
      symbolName: 'fetchUser',
      kind: 'function',
      patterns: [],
      intents: [],
    },
  }];

  await enhancer.enhanceChunks(chunks, nodeId);

  assert.ok(
    chunks[0].metadata.patterns.length > 0,
    'should match patterns by symbolName fallback',
  );

  db.close();
});

test('confidence calculation respects pattern + intent + symbol contributions', () => {
  const enhancer = new SemanticLayerEnhancer({ db: { getSymbols: () => [] } });

  assert.equal(enhancer._calculateConfidence({}), 0.5, 'base score');
  assert.equal(
    enhancer._calculateConfidence({ patterns: ['x'] }),
    0.7,
    'patterns add 0.2',
  );
  assert.equal(
    enhancer._calculateConfidence({ patterns: ['x'], intents: ['y'] }),
    0.9,
    'patterns + intents add 0.4',
  );
  assert.equal(
    enhancer._calculateConfidence({ patterns: ['x'], intents: ['y'], symbols: [{ id: 1 }] }),
    1.0,
    'symbols cap at 1.0',
  );
});

test('handles empty chunks gracefully', async () => {
  const enhancer = new SemanticLayerEnhancer({ db: { getSymbols: () => [] } });
  const result = await enhancer.enhanceChunks([], 1);
  assert.deepEqual(result, []);
});
