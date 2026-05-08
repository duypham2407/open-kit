// tests/runtime/state/transition-engine.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransitionEngine } from '../../../src/runtime/state/transition-engine.js';

describe('TransitionEngine', () => {
  const engine = new TransitionEngine();

  describe('quick lane', () => {
    it('allows forward transition from quick_brainstorm to quick_plan', () => {
      const result = engine.validateTransition('quick', 'quick_brainstorm', 'quick_plan');
      assert.equal(result.valid, true);
      assert.equal(result.backward, false);
    });

    it('allows backward transition from quick_plan to quick_brainstorm', () => {
      const result = engine.validateTransition('quick', 'quick_plan', 'quick_brainstorm');
      assert.equal(result.valid, true);
      assert.equal(result.backward, true);
    });

    it('rejects transition from quick_done to quick_plan', () => {
      const result = engine.validateTransition('quick', 'quick_done', 'quick_plan');
      assert.equal(result.valid, false);
      assert.match(result.reason, /terminal stage/);
    });
  });

  describe('full lane', () => {
    it('allows forward transition from full_product to full_solution', () => {
      const result = engine.validateTransition('full', 'full_product', 'full_solution');
      assert.equal(result.valid, true);
    });

    it('allows backward transition from full_solution to full_product', () => {
      const result = engine.validateTransition('full', 'full_solution', 'full_product');
      assert.equal(result.valid, true);
      assert.equal(result.backward, true);
    });

    it('rejects skip from full_product to full_implementation', () => {
      const result = engine.validateTransition('full', 'full_product', 'full_implementation');
      assert.equal(result.valid, false);
    });
  });

  describe('migration lane', () => {
    it('allows forward transition from migration_baseline to migration_strategy', () => {
      const result = engine.validateTransition('migration', 'migration_baseline', 'migration_strategy');
      assert.equal(result.valid, true);
    });

    it('detects terminal stages', () => {
      assert.equal(engine.isTerminalStage('quick', 'quick_done'), true);
      assert.equal(engine.isTerminalStage('full', 'full_done'), true);
      assert.equal(engine.isTerminalStage('migration', 'migration_done'), true);
      assert.equal(engine.isTerminalStage('quick', 'quick_plan'), false);
    });
  });
});
