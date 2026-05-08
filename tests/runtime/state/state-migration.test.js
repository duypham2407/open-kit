import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, isLegacyState } from '../../../src/runtime/state/state-schema.js';

describe('State Schema', () => {
  it('detects legacy state (no version field)', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_brainstorm',
      owner: 'quick-agent'
    };

    assert.equal(isLegacyState(legacyState), true);
  });

  it('detects v2.0.0 state (has version field)', () => {
    const newState = {
      version: '2.0.0',
      mode: 'quick',
      stage: 'quick_brainstorm',
      owner: 'quick-agent',
      gates: {}
    };

    assert.equal(isLegacyState(newState), false);
  });

  it('migrates old approvals to unified gates', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_plan',
      owner: 'quick-agent',
      approvals: {
        quick_verified: false
      },
      gates: {
        user_understanding_confirmed: true,
        user_plan_confirmed: false
      }
    };

    const migrated = migrateState(legacyState);

    assert.equal(migrated.version, '2.0.0');
    assert.equal(migrated.gates['quick.verified'], false);
    assert.equal(migrated.gates['quick.understanding_confirmed'], true);
    assert.equal(migrated.gates['quick.plan_confirmed'], false);
    assert.equal(migrated.approvals, undefined, 'old approvals field removed');
  });

  it('migrates full lane gates', () => {
    const legacyState = {
      mode: 'full',
      stage: 'full_solution',
      owner: 'solution-lead-agent',
      approvals: {
        product_to_solution: true,
        solution_to_implementation: false
      }
    };

    const migrated = migrateState(legacyState);

    assert.equal(migrated.gates['full.product_to_solution'], true);
    assert.equal(migrated.gates['full.solution_to_implementation'], false);
  });

  it('is idempotent - migrating twice produces same result', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_plan',
      owner: 'quick-agent',
      approvals: { quick_verified: false }
    };

    const migrated1 = migrateState(legacyState);
    const migrated2 = migrateState(migrated1);

    assert.deepEqual(migrated1, migrated2);
  });
});
