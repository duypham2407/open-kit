import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSITIONS as canonicalTransitions } from '../../src/runtime/state/transitions.js';
import { getValidNextStages, getStageOwner } from '../../src/runtime/workflow/state-machine.js';

test('TRANSITIONS module exports a per-mode map for quick/full/migration', () => {
  assert.ok(canonicalTransitions.quick, 'quick mode missing');
  assert.ok(canonicalTransitions.full, 'full mode missing');
  assert.ok(canonicalTransitions.migration, 'migration mode missing');
});

test('state-machine.getValidNextStages reads from canonical TRANSITIONS for every stage', () => {
  for (const mode of ['quick', 'full', 'migration']) {
    const stages = Object.keys(canonicalTransitions[mode]);
    for (const stage of stages) {
      const fromCanonical = canonicalTransitions[mode][stage];
      const fromStateMachine = getValidNextStages(mode, stage);
      assert.deepEqual(
        fromStateMachine,
        fromCanonical,
        `state-machine disagrees with canonical TRANSITIONS for ${mode}/${stage}`,
      );
    }
  }
});

test('state-machine.getStageOwner returns a defined owner for every stage in TRANSITIONS', () => {
  for (const mode of ['quick', 'full', 'migration']) {
    for (const stage of Object.keys(canonicalTransitions[mode])) {
      const owner = getStageOwner(mode, stage);
      assert.ok(typeof owner === 'string' && owner.length > 0, `${mode}/${stage} has no owner`);
    }
  }
});

test('migration_strategy can transition back to migration_baseline (merged truth)', () => {
  assert.ok(
    canonicalTransitions.migration.migration_strategy.includes('migration_baseline'),
    'merged truth requires backward rework to migration_baseline',
  );
});

test('full_code_review can transition back to full_solution and full_product (merged truth)', () => {
  const targets = canonicalTransitions.full.full_code_review;
  assert.ok(targets.includes('full_solution'), 'full_code_review must allow back-rework to full_solution');
  assert.ok(targets.includes('full_product'), 'full_code_review must allow back-rework to full_product');
});
