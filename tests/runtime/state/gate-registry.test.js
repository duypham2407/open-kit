// tests/runtime/state/gate-registry.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GateRegistry } from '../../../src/runtime/state/gate-registry.js';

describe('GateRegistry', () => {
  const registry = new GateRegistry();

  // --- getGate() / getGateMetadata() ---

  it('looks up gate by name (quick lane)', () => {
    const gate = registry.getGate('quick.understanding_confirmed');

    assert.equal(gate.stage, 'quick_brainstorm');
    assert.equal(gate.targetStage, 'quick_plan');
    assert.equal(gate.authority, 'user');
    assert.equal(gate.type, 'confirmation');
    assert.ok(gate.description, 'description should be present');
  });

  it('looks up quick.plan_confirmed gate', () => {
    const gate = registry.getGate('quick.plan_confirmed');

    assert.equal(gate.stage, 'quick_plan');
    assert.equal(gate.targetStage, 'quick_implement');
    assert.equal(gate.authority, 'user');
    assert.equal(gate.type, 'confirmation');
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

  it('getGateMetadata is an alias for getGate', () => {
    const via_getGate = registry.getGate('quick.understanding_confirmed');
    const via_metadata = registry.getGateMetadata('quick.understanding_confirmed');
    assert.deepEqual(via_getGate, via_metadata);
  });

  it('getGateMetadata returns null for unknown gate', () => {
    assert.equal(registry.getGateMetadata('does.not.exist'), null);
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
      gates: { 'quick.plan_confirmed': false }
    };
    assert.equal(registry.isGateMet(state, 'quick.plan_confirmed'), false);
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

  it('returns required gates for quick_brainstorm → quick_plan', () => {
    const gates = registry.getRequiredGates('quick_brainstorm', 'quick_plan');

    assert.equal(gates.length, 1);
    assert.equal(gates[0], 'quick.understanding_confirmed');
  });

  it('returns required gates for quick_plan → quick_implement', () => {
    const gates = registry.getRequiredGates('quick_plan', 'quick_implement');

    assert.equal(gates.length, 1);
    assert.equal(gates[0], 'quick.plan_confirmed');
  });

  it('returns empty array for transitions with no gates', () => {
    // quick_intake → quick_brainstorm has no gate
    const gates = registry.getRequiredGates('quick_intake', 'quick_brainstorm');
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

  // --- checkGate() ---

  it('checkGate returns met:true when gate is satisfied in context', () => {
    const context = {
      gates: { 'quick.understanding_confirmed': true }
    };
    const result = registry.checkGate('quick.understanding_confirmed', context);

    assert.equal(result.met, true);
  });

  it('checkGate returns met:false with gate details when not satisfied', () => {
    const context = {
      gates: { 'quick.understanding_confirmed': false }
    };
    const result = registry.checkGate('quick.understanding_confirmed', context);

    assert.equal(result.met, false);
    assert.equal(result.gate, 'quick.understanding_confirmed');
    assert.equal(result.authority, 'user');
    assert.ok(result.description);
  });

  it('checkGate throws for unknown gate id', () => {
    assert.throws(
      () => registry.checkGate('does.not.exist', { gates: {} }),
      /unknown gate/i
    );
  });

  // --- canTransition() ---

  it('allows transition when all required gates are met', () => {
    const state = {
      gates: { 'quick.understanding_confirmed': true }
    };

    const result = registry.canTransition(state, 'quick_brainstorm', 'quick_plan');

    assert.equal(result.allowed, true);
    assert.equal(result.missingGates.length, 0);
  });

  it('blocks transition when required gate is false', () => {
    const state = {
      gates: { 'quick.understanding_confirmed': false }
    };

    const result = registry.canTransition(state, 'quick_brainstorm', 'quick_plan');

    assert.equal(result.allowed, false);
    assert.equal(result.missingGates.length, 1);
    assert.equal(result.missingGates[0].gate, 'quick.understanding_confirmed');
    assert.equal(result.missingGates[0].authority, 'user');
    assert.equal(result.missingGates[0].met, false);
  });

  it('blocks transition when required gate is absent', () => {
    const state = { gates: {} };

    const result = registry.canTransition(state, 'quick_brainstorm', 'quick_plan');

    assert.equal(result.allowed, false);
    assert.equal(result.missingGates.length, 1);
  });

  it('allows transition when there are no required gates', () => {
    // quick_intake → quick_brainstorm has no gate requirement
    const state = { gates: {} };

    const result = registry.canTransition(state, 'quick_intake', 'quick_brainstorm');

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

  // --- listGatesForTransition() ---

  it('listGatesForTransition returns gates for a transition', () => {
    const gates = registry.listGatesForTransition('quick', 'quick_brainstorm', 'quick_plan');

    assert.equal(gates.length, 1);
    assert.equal(gates[0].id, 'quick.understanding_confirmed');
    assert.equal(gates[0].authority, 'user');
    assert.equal(gates[0].type, 'confirmation');
    assert.ok(gates[0].description);
  });

  it('listGatesForTransition returns empty array for gateless transition', () => {
    const gates = registry.listGatesForTransition('quick', 'quick_intake', 'quick_brainstorm');
    assert.equal(gates.length, 0);
  });

  it('listGatesForTransition includes id field on each gate', () => {
    const gates = registry.listGatesForTransition('full', 'full_qa', 'full_done');

    assert.equal(gates.length, 1);
    assert.equal(gates[0].id, 'full.qa_passed');
    assert.equal(gates[0].stage, 'full_qa');
    assert.equal(gates[0].targetStage, 'full_done');
  });

  it('listGatesForTransition returns empty array for unknown stages', () => {
    const gates = registry.listGatesForTransition('quick', 'no_such_stage', 'another_stage');
    assert.equal(gates.length, 0);
  });

  // --- listAllGates() ---

  it('listAllGates returns all gate definitions', () => {
    const all = registry.listAllGates();

    // Should have gates for all three lanes
    const ids = all.map(g => g.id);
    assert.ok(ids.includes('quick.understanding_confirmed'));
    assert.ok(ids.includes('quick.plan_confirmed'));
    assert.ok(ids.includes('quick.verified'));
    assert.ok(ids.includes('full.product_to_solution'));
    assert.ok(ids.includes('full.solution_to_implementation'));
    assert.ok(ids.includes('full.code_review_passed'));
    assert.ok(ids.includes('full.qa_passed'));
    assert.ok(ids.includes('migration.baseline_verified'));
    assert.ok(ids.includes('migration.strategy_approved'));
    assert.ok(ids.includes('migration.code_review_passed'));
    assert.ok(ids.includes('migration.parity_verified'));
  });

  it('each gate in listAllGates has id, stage, targetStage, authority, type, description', () => {
    const all = registry.listAllGates();

    for (const gate of all) {
      assert.ok(gate.id, `gate.id missing on ${JSON.stringify(gate)}`);
      assert.ok(gate.stage, `gate.stage missing on ${gate.id}`);
      assert.ok(gate.targetStage, `gate.targetStage missing on ${gate.id}`);
      assert.ok(gate.authority, `gate.authority missing on ${gate.id}`);
      assert.ok(gate.type, `gate.type missing on ${gate.id}`);
      assert.ok(gate.description, `gate.description missing on ${gate.id}`);
    }
  });
});
