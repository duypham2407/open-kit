import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, isLegacyState, STATE_VERSION } from '../../../runtime/state/state-schema.js';

describe('State Schema', () => {
  it('detects legacy state (no version field)', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_intake',
      owner: 'quick-agent'
    };

    assert.equal(isLegacyState(legacyState), true);
  });

  it('detects v2.0.0 state (has version field)', () => {
    const newState = {
      version: STATE_VERSION,
      mode: 'quick',
      stage: 'quick_intake',
      owner: 'quick-agent',
      gates: {}
    };

    assert.equal(isLegacyState(newState), false);
  });

  it('treats null/undefined as legacy state', () => {
    assert.equal(isLegacyState(null), true);
    assert.equal(isLegacyState(undefined), true);
    assert.equal(isLegacyState({}), true);
  });

  it('migrates old approvals and gates to unified gates', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_plan',
      owner: 'quick-agent',
      approvals: {
        quick_verified: false
      },
      gates: {
        user_understanding_confirmed: true
      }
    };

    const migrated = migrateState(legacyState);

    assert.equal(migrated.version, STATE_VERSION);
    assert.equal(migrated.gates['quick.verified'], false);
    assert.equal(migrated.gates['quick.understanding_confirmed'], true);
    assert.equal(migrated.approvals, undefined, 'old approvals field removed');
  });

  it('migrates user_plan_confirmed to quick.understanding_confirmed', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_plan',
      owner: 'quick-agent',
      gates: {
        user_plan_confirmed: true
      }
    };

    const migrated = migrateState(legacyState);
    assert.equal(migrated.gates['quick.understanding_confirmed'], true);
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

  it('migrates migration lane gates', () => {
    const legacyState = {
      mode: 'migration',
      stage: 'migration_verify',
      owner: 'qa-agent',
      approvals: {
        baseline_verified: true,
        strategy_approved: true,
        migration_code_review_passed: false,
        parity_verified: false
      }
    };

    const migrated = migrateState(legacyState);

    assert.equal(migrated.gates['migration.baseline_verified'], true);
    assert.equal(migrated.gates['migration.strategy_approved'], true);
    assert.equal(migrated.gates['migration.code_review_passed'], false);
    assert.equal(migrated.gates['migration.parity_verified'], false);
  });

  it('migrates all full lane gates including code review and qa', () => {
    const legacyState = {
      mode: 'full',
      stage: 'full_qa',
      owner: 'qa-agent',
      approvals: {
        product_to_solution: true,
        solution_to_implementation: true,
        code_review_passed: true,
        qa_passed: false
      }
    };

    const migrated = migrateState(legacyState);

    assert.equal(migrated.gates['full.product_to_solution'], true);
    assert.equal(migrated.gates['full.solution_to_implementation'], true);
    assert.equal(migrated.gates['full.code_review_passed'], true);
    assert.equal(migrated.gates['full.qa_passed'], false);
  });

  it('includes metadata with timestamps after migration', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_plan',
      owner: 'quick-agent'
    };

    const migrated = migrateState(legacyState);

    assert.ok(migrated.metadata);
    assert.ok(migrated.metadata.created_at);
    assert.ok(migrated.metadata.updated_at);
    assert.match(migrated.metadata.created_at, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('preserves unknown top-level fields during migration', () => {
    const legacyState = {
      mode: 'quick',
      stage: 'quick_plan',
      owner: 'quick-agent',
      customField: 'preserved',
      nested: { data: 'also preserved' }
    };

    const migrated = migrateState(legacyState);

    assert.equal(migrated.customField, 'preserved');
    assert.deepEqual(migrated.nested, { data: 'also preserved' });
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
