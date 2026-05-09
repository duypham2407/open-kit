import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransitionEngine } from '../../src/runtime/state/transition-engine.js';

test('quick lane no longer has quick_brainstorm stage', () => {
  const engine = new TransitionEngine();
  const result = engine.validateTransition('quick', 'quick_intake', 'quick_plan');
  assert.equal(result.valid, true, 'quick_intake → quick_plan must be valid');
});

test('quick_brainstorm is no longer a known stage', () => {
  const engine = new TransitionEngine();
  const result = engine.validateTransition('quick', 'quick_brainstorm', 'quick_plan');
  assert.equal(result.valid, false);
  assert.match(result.reason, /Unknown stage|Invalid transition/);
});

test('quick lane STAGE_ORDER is intake → plan → implement → test → done', () => {
  const engine = new TransitionEngine();
  const validNext = (from) => engine.rules.quick[from] ?? null;
  assert.deepEqual(validNext('quick_intake'), ['quick_plan']);
  assert.ok(validNext('quick_brainstorm') == null, 'quick_brainstorm must not appear in rules');
});
