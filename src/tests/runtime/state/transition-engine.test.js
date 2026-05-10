// tests/runtime/state/transition-engine.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransitionEngine } from '../../../runtime/state/transition-engine.js';

describe('TransitionEngine', () => {
  const engine = new TransitionEngine();

  describe('quick lane', () => {
    it('allows forward transition from quick_intake to quick_plan', () => {
      const result = engine.validateTransition('quick', 'quick_intake', 'quick_plan');
      assert.equal(result.valid, true);
      assert.equal(result.backward, false);
    });

    it('allows backward transition from quick_implement to quick_plan', () => {
      const result = engine.validateTransition('quick', 'quick_implement', 'quick_plan');
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

  describe('isTerminalStage — unknown input handling (I1)', () => {
    it('throws for unknown mode', () => {
      assert.throws(
        () => engine.isTerminalStage('typo_mode', 'quick_done'),
        /Unknown mode: typo_mode/
      );
    });

    it('throws for unknown stage within a valid mode', () => {
      assert.throws(
        () => engine.isTerminalStage('quick', 'nonexistent_stage'),
        /Unknown stage: nonexistent_stage/
      );
    });

    it('does not throw for a known terminal stage', () => {
      assert.doesNotThrow(() => engine.isTerminalStage('quick', 'quick_done'));
    });

    it('does not throw for a known non-terminal stage', () => {
      assert.doesNotThrow(() => engine.isTerminalStage('full', 'full_intake'));
    });
  });

  describe('getNextStages — edge cases', () => {
    it('returns empty array for terminal stage quick_done', () => {
      assert.deepEqual(engine.getNextStages('quick', 'quick_done'), []);
    });

    it('returns correct next stages for quick_plan (forward only)', () => {
      assert.deepEqual(engine.getNextStages('quick', 'quick_plan'), ['quick_implement']);
    });

    it('returns empty array for unknown mode', () => {
      assert.deepEqual(engine.getNextStages('unknown_mode', 'quick_plan'), []);
    });

    it('returns empty array for unknown stage within valid mode', () => {
      assert.deepEqual(engine.getNextStages('quick', 'no_such_stage'), []);
    });
  });

  describe('backward detection reliability (I2)', () => {
    it('correctly identifies backward transition in quick lane', () => {
      const result = engine.validateTransition('quick', 'quick_implement', 'quick_plan');
      assert.equal(result.valid, true);
      assert.equal(result.backward, true);
    });

    it('correctly identifies forward transition in quick lane', () => {
      const result = engine.validateTransition('quick', 'quick_plan', 'quick_implement');
      assert.equal(result.valid, true);
      assert.equal(result.backward, false);
    });

    it('correctly identifies backward transition in full lane', () => {
      const result = engine.validateTransition('full', 'full_code_review', 'full_solution');
      assert.equal(result.valid, true);
      assert.equal(result.backward, true);
    });

    it('correctly identifies backward transition in migration lane', () => {
      const result = engine.validateTransition('migration', 'migration_verify', 'migration_upgrade');
      assert.equal(result.valid, true);
      assert.equal(result.backward, true);
    });

    it('forward transition is not marked backward', () => {
      const result = engine.validateTransition('migration', 'migration_strategy', 'migration_upgrade');
      assert.equal(result.valid, true);
      assert.equal(result.backward, false);
    });
  });
});
