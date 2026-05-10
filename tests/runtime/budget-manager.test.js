import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetManager } from '../../src/runtime/lib/budget-manager.js';

test('allocates budget across categories', () => {
  const manager = new BudgetManager();

  const allocation = manager.allocate(10000);

  assert.strictEqual(allocation.critical, 4000);
  assert.strictEqual(allocation.important, 3000);
  assert.strictEqual(allocation.supplementary, 2000);
  assert.strictEqual(allocation.buffer, 1000);
});

test('applies budget constraints to items', () => {
  const manager = new BudgetManager();

  const items = [
    { id: 1, category: 'critical', estimatedTokens: 500, score: 0.9 },
    { id: 2, category: 'critical', estimatedTokens: 500, score: 0.8 },
    { id: 3, category: 'important', estimatedTokens: 300, score: 0.7 },
    { id: 4, category: 'supplementary', estimatedTokens: 200, score: 0.6 }
  ];

  const selected = manager.applyBudget(items, 1000);

  assert(selected.length <= 4);

  const totalTokens = selected.reduce((sum, item) => sum + item.estimatedTokens, 0);
  assert(totalTokens <= 1000);
});
