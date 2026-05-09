// src/runtime/state/gate-registry.js
//
// Unified gate definitions across all workflow lanes (quick, full, migration).
// This is the single source of truth for gate metadata. Gate IDs use the
// "<lane>.<gate_name>" dot-notation to avoid collisions between lanes.

/**
 * @typedef {Object} GateDefinition
 * @property {string} stage        - The stage the gate is evaluated in (from-stage)
 * @property {string} targetStage  - The stage the gate must be met before entering
 * @property {string} authority    - Role/agent that is authorised to set this gate
 * @property {'confirmation'|'approval'} type - Semantic type of the gate
 * @property {string} description  - Human-readable description of what meeting the gate means
 */

/** @type {Record<string, GateDefinition>} */
const UNIFIED_GATES = {
  // ── Quick lane ───────────────────────────────────────────────────────────
  'quick.understanding_confirmed': {
    stage: 'quick_plan',
    targetStage: 'quick_implement',
    authority: 'user',
    type: 'confirmation',
    description: 'User confirms understanding of task and approves plan'
  },
  'quick.verified': {
    stage: 'quick_test',
    targetStage: 'quick_done',
    authority: 'quick-agent',
    type: 'approval',
    description: 'Quick Agent verifies tests pass'
  },

  // ── Full lane ─────────────────────────────────────────────────────────────
  'full.product_to_solution': {
    stage: 'full_product',
    targetStage: 'full_solution',
    authority: 'user',
    type: 'approval',
    description: 'User approves scope package'
  },
  'full.solution_to_implementation': {
    stage: 'full_solution',
    targetStage: 'full_implementation',
    authority: 'user',
    type: 'approval',
    description: 'User approves solution package'
  },
  'full.code_review_passed': {
    stage: 'full_code_review',
    targetStage: 'full_qa',
    authority: 'code-reviewer',
    type: 'approval',
    description: 'Code Reviewer approves implementation'
  },
  'full.qa_passed': {
    stage: 'full_qa',
    targetStage: 'full_done',
    authority: 'qa-agent',
    type: 'approval',
    description: 'QA Agent verifies acceptance criteria'
  },

  // ── Migration lane ────────────────────────────────────────────────────────
  'migration.baseline_verified': {
    stage: 'migration_baseline',
    targetStage: 'migration_strategy',
    authority: 'solution-lead-agent',
    type: 'approval',
    description: 'Baseline evidence collected'
  },
  'migration.strategy_approved': {
    stage: 'migration_strategy',
    targetStage: 'migration_upgrade',
    authority: 'user',
    type: 'approval',
    description: 'User approves migration strategy'
  },
  'migration.code_review_passed': {
    stage: 'migration_code_review',
    targetStage: 'migration_verify',
    authority: 'code-reviewer',
    type: 'approval',
    description: 'Code Reviewer approves migration changes'
  },
  'migration.parity_verified': {
    stage: 'migration_verify',
    targetStage: 'migration_done',
    authority: 'qa-agent',
    type: 'approval',
    description: 'Parity verification complete'
  }
};

export class GateRegistry {
  constructor() {
    /** @type {Record<string, GateDefinition>} */
    this.gates = UNIFIED_GATES;
  }

  // ── Gate lookup ────────────────────────────────────────────────────────────

  /**
   * Return the gate definition for the given id, or null if not found.
   * @param {string} gateId
   * @returns {GateDefinition|null}
   */
  getGate(gateId) {
    return this.gates[gateId] ?? null;
  }

  // ── Gate status checks ─────────────────────────────────────────────────────

  /**
   * Return true only if the named gate is explicitly set to `true` in the
   * provided state object.
   *
   * @param {Object} state - Workflow state object (must have a `gates` map)
   * @param {string} gateId
   * @returns {boolean}
   */
  isGateMet(state, gateId) {
    if (!this.gates[gateId]) return false;
    if (!state || !state.gates) return false;
    return state.gates[gateId] === true;
  }

  // ── Transition gate queries ────────────────────────────────────────────────

  /**
   * Return the ids of all gates that must be met before advancing from
   * `fromStage` to `toStage`. Returns an empty array if no gates apply.
   *
   * @param {string} fromStage
   * @param {string} toStage
   * @returns {string[]}
   */
  getRequiredGates(fromStage, toStage) {
    const required = [];
    for (const [id, def] of Object.entries(this.gates)) {
      if (def.stage === fromStage && def.targetStage === toStage) {
        required.push(id);
      }
    }
    return required;
  }

  /**
   * Check whether all required gates for the fromStage → toStage transition
   * are met in `state`. Returns an `allowed` flag plus the list of any
   * missing gates with authority info for error messaging.
   *
   * @param {Object} state
   * @param {string} fromStage
   * @param {string} toStage
   * @returns {{ allowed: boolean, missingGates: Array<{gate: string, met: false, authority: string, description: string}> }}
   */
  canTransition(state, fromStage, toStage) {
    const requiredIds = this.getRequiredGates(fromStage, toStage);
    const missingGates = [];

    for (const gateId of requiredIds) {
      if (!this.isGateMet(state, gateId)) {
        const def = this.gates[gateId];
        missingGates.push({
          gate: gateId,
          met: false,
          authority: def.authority,
          description: def.description
        });
      }
    }

    return {
      allowed: missingGates.length === 0,
      missingGates
    };
  }

  /**
   * Record that a gate has been met in the state object.
   * Sets `state.gates[gateName]` to `true` and stores approver and metadata
   * under `state.gateMeta[gateName]`. Throws for unknown gate names.
   *
   * @param {Object} state       - Workflow state object (mutated in place and returned)
   * @param {string} gateName    - Registered gate id (e.g. 'quick.understanding_confirmed')
   * @param {string} approver    - Identity of the actor meeting the gate
   * @param {Object} [metadata]  - Optional additional metadata to record
   * @returns {Object} The updated state object
   * @throws {Error} if gateName is not a registered gate
   */
  recordGateMet(state, gateName, approver, metadata = {}) {
    if (!this.gates[gateName]) {
      throw new Error(`Unknown gate: '${gateName}'`);
    }

    if (!state.gates) {
      state.gates = {};
    }

    state.gates[gateName] = true;

    if (!state.gateMeta) {
      state.gateMeta = {};
    }

    state.gateMeta[gateName] = {
      approver,
      metAt: new Date().toISOString(),
      ...metadata
    };

    return state;
  }
}
