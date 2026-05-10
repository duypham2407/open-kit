import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StateTransitionError,
  GateNotMetError,
  InsufficientAuthorityError,
  StateCorruptionError
} from '../../../runtime/state/errors.js';

describe('State Errors', () => {
  it('StateTransitionError includes transition details', () => {
    const error = new StateTransitionError({
      currentStage: 'quick_done',
      targetStage: 'quick_plan',
      validNextStages: []
    });

    assert.equal(error.name, 'StateTransitionError');
    assert.match(error.message, /quick_done.*quick_plan/);
    assert.equal(error.currentStage, 'quick_done');
    assert.equal(error.targetStage, 'quick_plan');
    assert.deepEqual(error.validNextStages, []);
  });

  it('GateNotMetError includes gate details', () => {
    const error = new GateNotMetError({
      currentStage: 'quick_intake',
      targetStage: 'quick_plan',
      missingGates: [
        {
          gate: 'quick.understanding_confirmed',
          met: false,
          authority: 'user',
          description: 'User confirms understanding'
        }
      ]
    });

    assert.equal(error.name, 'GateNotMetError');
    assert.match(error.message, /quick.understanding_confirmed/);
    assert.equal(error.missingGates.length, 1);
  });

  it('InsufficientAuthorityError includes authority info', () => {
    const error = new InsufficientAuthorityError({
      gateName: 'quick.verified',
      requiredAuthority: 'quick-agent',
      actualCaller: 'user'
    });

    assert.equal(error.name, 'InsufficientAuthorityError');
    assert.match(error.message, /quick.verified/);
    assert.equal(error.requiredAuthority, 'quick-agent');
  });

  it('StateCorruptionError includes corruption details', () => {
    const error = new StateCorruptionError({
      reason: 'Missing required field: mode',
      state: { stage: 'quick_plan' }
    });

    assert.equal(error.name, 'StateCorruptionError');
    assert.match(error.message, /Missing required field/);
  });

  it('StateCorruptionError exposes reason property', () => {
    const error = new StateCorruptionError({
      reason: 'Missing required field',
      state: {}
    });

    assert.equal(error.reason, 'Missing required field');
    assert.deepEqual(error.state, {});
  });
});

describe('Error inheritance', () => {
  it('all error types extend Error', () => {
    const errors = [
      new StateTransitionError({ currentStage: 'a', targetStage: 'b' }),
      new GateNotMetError({ currentStage: 'a', targetStage: 'b' }),
      new InsufficientAuthorityError({ gateName: 'g', requiredAuthority: 'r', actualCaller: 'c' }),
      new StateCorruptionError({ reason: 'r', state: {} })
    ];

    errors.forEach(error => {
      assert.ok(error instanceof Error);
    });
  });
});

describe('toJSON() serialization', () => {
  it('StateTransitionError.toJSON() includes all fields', () => {
    const error = new StateTransitionError({
      currentStage: 'quick_done',
      targetStage: 'quick_plan',
      validNextStages: ['none']
    });

    const json = error.toJSON();

    assert.equal(json.type, 'StateTransitionError');
    assert.ok(json.message);
    assert.equal(json.currentStage, 'quick_done');
    assert.equal(json.targetStage, 'quick_plan');
    assert.deepEqual(json.validNextStages, ['none']);
  });

  it('GateNotMetError.toJSON() includes recommendations', () => {
    const error = new GateNotMetError({
      currentStage: 'quick_intake',
      targetStage: 'quick_plan',
      missingGates: [{
        gate: 'quick.understanding_confirmed',
        authority: 'user'
      }]
    });

    const json = error.toJSON();

    assert.equal(json.type, 'GateNotMetError');
    assert.ok(Array.isArray(json.recommendations));
    assert.equal(json.recommendations.length, 1);
    assert.match(json.recommendations[0], /quick.understanding_confirmed/);
  });

  it('StateCorruptionError.toJSON() includes state', () => {
    const corruptedState = { stage: 'invalid' };
    const error = new StateCorruptionError({
      reason: 'Missing mode',
      state: corruptedState
    });

    const json = error.toJSON();

    assert.equal(json.type, 'StateCorruptionError');
    assert.equal(json.reason, 'Missing mode');
    assert.deepEqual(json.state, corruptedState);
  });
});

describe('Edge cases', () => {
  it('StateTransitionError handles empty validNextStages', () => {
    const error = new StateTransitionError({
      currentStage: 'quick_done',
      targetStage: 'quick_plan',
      validNextStages: []
    });

    assert.match(error.message, /none/);
  });

  it('GateNotMetError handles empty missingGates', () => {
    const error = new GateNotMetError({
      currentStage: 'quick_plan',
      targetStage: 'quick_implement',
      missingGates: []
    });

    assert.match(error.message, /none/);
  });
});
