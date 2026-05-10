import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentCacheManager } from '../../runtime/analysis/intent-cache-manager.js';

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
