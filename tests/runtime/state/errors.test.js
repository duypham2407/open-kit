import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StateTransitionError,
  GateNotMetError,
  InsufficientAuthorityError,
  StateCorruptionError
} from '../../../src/runtime/state/errors.js';

describe('State Errors', () => {
  it('StateTransitionError includes transition details', () => {
    const error = new StateTransitionError({
      currentStage: 'quick_done',
      targetStage: 'quick_brainstorm',
      validNextStages: []
    });

    assert.equal(error.name, 'StateTransitionError');
    assert.match(error.message, /quick_done.*quick_brainstorm/);
    assert.equal(error.currentStage, 'quick_done');
    assert.equal(error.targetStage, 'quick_brainstorm');
    assert.deepEqual(error.validNextStages, []);
  });

  it('GateNotMetError includes gate details', () => {
    const error = new GateNotMetError({
      currentStage: 'quick_brainstorm',
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
});
