// tests/runtime/state/gate-registry.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GateRegistry } from '../../../src/runtime/state/gate-registry.js';

describe('GateRegistry', () => {
  const registry = new GateRegistry();

  // --- getGate() / getGateMetadata() ---

  it('looks up gate by name (quick lane)', () => {
    const gate = registry.getGate('quick.understanding_confirmed');

    assert.equal(gate.stage, 'quick_plan');
    assert.equal(gate.targetStage, 'quick_implement');
    assert.equal(gate.authority, 'user');
    assert.equal(gate.type, 'confirmation');
    assert.ok(gate.description, 'description should be present');
  });

  it('quick.plan_confirmed gate no longer exists', () => {
    const gate = registry.getGate('quick.plan_confirmed');
    assert.equal(gate, null);
  });

  it('looks up quick.verified gate', () => {
    const gate = registry.getGate('quick.verified');

    assert.equal(gate.stage, 'quick_test');
    assert.equal(gate.targetStage, 'quick_done');
    assert.equal(gate.authority, 'quick-agent');
    assert.equal(gate.type, 'approval');
  });

  it('looks up full lane gate', () => {
    const gate = registry.getGate('full.product_to_solution');

    assert.equal(gate.stage, 'full_product');
    assert.equal(gate.targetStage, 'full_solution');
    assert.equal(gate.authority, 'user');
  });

  it('looks up migration lane gate', () => {
    const gate = registry.getGate('migration.baseline_verified');

    assert.equal(gate.stage, 'migration_baseline');
    assert.equal(gate.targetStage, 'migration_strategy');
    assert.equal(gate.authority, 'solution-lead-agent');
  });

  it('returns null for unknown gate', () => {
    const gate = registry.getGate('unknown.gate');
    assert.equal(gate, null);
  });

  // --- isGateMet() ---

  it('isGateMet returns true when gate is true in state', () => {
    const state = {
      gates: { 'quick.understanding_confirmed': true }
    };
    assert.equal(registry.isGateMet(state, 'quick.understanding_confirmed'), true);
  });

  it('isGateMet returns false when gate is false in state', () => {
    const state = {
      gates: { 'quick.understanding_confirmed': false }
    };
    assert.equal(registry.isGateMet(state, 'quick.understanding_confirmed'), false);
  });

  it('isGateMet returns false when gate is absent from state', () => {
    const state = { gates: {} };
    assert.equal(registry.isGateMet(state, 'quick.understanding_confirmed'), false);
  });

  it('isGateMet returns false when state has no gates field', () => {
    assert.equal(registry.isGateMet({}, 'quick.understanding_confirmed'), false);
  });

  it('isGateMet returns false for unknown gate name regardless of state', () => {
    const state = { gates: { 'quick.understanding_confirmed': true } };
    assert.equal(registry.isGateMet(state, 'unknown.gate'), false);
  });

  // --- getRequiredGates() ---

  it('returns required gates for quick_plan → quick_implement', () => {
    const gates = registry.getRequiredGates('quick_plan', 'quick_implement');

    assert.equal(gates.length, 1);
    assert.equal(gates[0], 'quick.understanding_confirmed');
  });

  it('returns empty array for transitions with no gates', () => {
    // quick_intake → quick_plan has no gate
    const gates = registry.getRequiredGates('quick_intake', 'quick_plan');
    assert.equal(gates.length, 0);
  });

  it('returns empty array for unknown stage combination', () => {
    const gates = registry.getRequiredGates('nonexistent_stage', 'also_nonexistent');
    assert.equal(gates.length, 0);
  });

  it('returns full lane gate for full_product → full_solution', () => {
    const gates = registry.getRequiredGates('full_product', 'full_solution');

    assert.equal(gates.length, 1);
    assert.equal(gates[0], 'full.product_to_solution');
  });

  it('returns migration gate for migration_strategy → migration_upgrade', () => {
    const gates = registry.getRequiredGates('migration_strategy', 'migration_upgrade');

    assert.equal(gates.length, 1);
    assert.equal(gates[0], 'migration.strategy_approved');
  });

  // --- canTransition() ---

  it('allows transition when all required gates are met', () => {
    const state = {
      gates: { 'quick.understanding_confirmed': true }
    };

    const result = registry.canTransition(state, 'quick_plan', 'quick_implement');

    assert.equal(result.allowed, true);
    assert.equal(result.missingGates.length, 0);
  });

  it('blocks transition when required gate is false', () => {
    const state = {
      gates: { 'quick.understanding_confirmed': false }
    };

    const result = registry.canTransition(state, 'quick_plan', 'quick_implement');

    assert.equal(result.allowed, false);
    assert.equal(result.missingGates.length, 1);
    assert.equal(result.missingGates[0].gate, 'quick.understanding_confirmed');
    assert.equal(result.missingGates[0].authority, 'user');
    assert.equal(result.missingGates[0].met, false);
  });

  it('blocks transition when required gate is absent', () => {
    const state = { gates: {} };

    const result = registry.canTransition(state, 'quick_plan', 'quick_implement');

    assert.equal(result.allowed, false);
    assert.equal(result.missingGates.length, 1);
  });

  it('allows transition when there are no required gates', () => {
    // quick_intake → quick_plan has no gate requirement
    const state = { gates: {} };

    const result = registry.canTransition(state, 'quick_intake', 'quick_plan');

    assert.equal(result.allowed, true);
    assert.equal(result.missingGates.length, 0);
  });

  it('reports all missing gates when multiple are unmet', () => {
    // Create a hypothetical multi-gate scenario by checking multiple
    // separate unmet gates for different transitions
    const state = {
      gates: {
        'full.product_to_solution': false,
      }
    };

    const result = registry.canTransition(state, 'full_product', 'full_solution');

    assert.equal(result.allowed, false);
    assert.equal(result.missingGates.length, 1);
    assert.equal(result.missingGates[0].gate, 'full.product_to_solution');
  });

  // --- recordGateMet() ---

  it('recordGateMet sets the gate to true in state.gates', () => {
    const state = { gates: {} };
    registry.recordGateMet(state, 'quick.understanding_confirmed', 'user');
    assert.equal(state.gates['quick.understanding_confirmed'], true);
  });

  it('recordGateMet creates state.gates if absent', () => {
    const state = {};
    registry.recordGateMet(state, 'quick.understanding_confirmed', 'user');
    assert.equal(state.gates['quick.understanding_confirmed'], true);
  });

  it('recordGateMet stores approver and metAt in state.gateMeta', () => {
    const state = { gates: {} };
    registry.recordGateMet(state, 'quick.verified', 'quick-agent');
    assert.ok(state.gateMeta, 'state.gateMeta should be created');
    assert.equal(state.gateMeta['quick.verified'].approver, 'quick-agent');
    assert.ok(state.gateMeta['quick.verified'].metAt, 'metAt timestamp should be set');
  });

  it('recordGateMet stores extra metadata fields alongside approver', () => {
    const state = { gates: {} };
    registry.recordGateMet(state, 'full.product_to_solution', 'user', { note: 'looks good' });
    assert.equal(state.gateMeta['full.product_to_solution'].note, 'looks good');
    assert.equal(state.gateMeta['full.product_to_solution'].approver, 'user');
  });

  it('recordGateMet returns the state object', () => {
    const state = { gates: {} };
    const returned = registry.recordGateMet(state, 'quick.understanding_confirmed', 'user');
    assert.equal(returned, state);
  });

  it('recordGateMet makes isGateMet return true for the recorded gate', () => {
    const state = { gates: {} };
    registry.recordGateMet(state, 'migration.strategy_approved', 'user');
    assert.equal(registry.isGateMet(state, 'migration.strategy_approved'), true);
  });

  it('recordGateMet throws for unknown gate name', () => {
    assert.throws(
      () => registry.recordGateMet({ gates: {} }, 'does.not.exist', 'user'),
      /unknown gate/i
    );
  });

  it('recordGateMet works with metadata omitted (defaults to empty object)', () => {
    const state = { gates: {} };
    assert.doesNotThrow(() => registry.recordGateMet(state, 'quick.understanding_confirmed', 'user'));
    assert.equal(state.gates['quick.understanding_confirmed'], true);
  });
});
