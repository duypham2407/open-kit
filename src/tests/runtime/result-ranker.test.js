import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultRanker } from '../../runtime/lib/result-ranker.js';

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

  assert.strictEqual(ranked[0].id, 1);
  assert(ranked[0].score > ranked[1].score);
});
