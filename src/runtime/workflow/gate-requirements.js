/**
 * Gate Requirements — UI/messaging layer over GateRegistry.
 *
 * Audit fix [1-H-2] / [1-M-2] / [1-L-4]: this file previously defined a
 * second, separate gate system with its own GATE_DEFINITIONS, GATE_CHECKERS,
 * and key naming ('quick_intake→quick_plan' style). It coexisted with
 * src/runtime/state/gate-registry.js, which is what WorkflowStateManager
 * consults at persistence time. The two systems disagreed on key naming and
 * on which gates existed at all, so a transition that passed one check
 * could be silently rejected by the other.
 *
 * The reform: GateRegistry is now the single source of truth for gate
 * metadata and gate state. This module is a thin shim that:
 *
 * 1. Maps a (mode, fromStage, toStage) transition to the registry gate IDs
 *    that block it.
 * 2. Reads `state.gates[gateId]` to determine pass/fail.
 * 3. Renders human-friendly missing-gate messages for the model.
 *
 * Evidence-driven gate setting (where a caller passes
 * `{ understanding_confirmed: true }` and we record the gate as met) lives
 * in src/runtime/tools/workflow/advance-stage.js — see EVIDENCE_TO_GATE
 * and updateWorkflowState there. This module only checks; it does not
 * write state.
 */

import { GateRegistry } from '../state/gate-registry.js';

const registry = new GateRegistry();

/**
 * Check all gate requirements for a specific transition.
 *
 * @param {string} mode - Workflow mode (quick, full, migration). Currently
 *   unused — gate IDs in the registry encode their stage already — but
 *   accepted for backward-compatible call sites.
 * @param {string} fromStage - Current stage
 * @param {string} toStage - Target stage
 * @param {object} state - Current workflow state (must have a `gates` map)
 * @param {object} evidence - Evidence passed with the transition request.
 *   Each evidence flag set to `true` is treated as if its corresponding
 *   gate has been met for purposes of THIS check. The actual write to
 *   state.gates happens in advance-stage.js before this function is called
 *   on the persistence path; the in-memory union here lets callers verify
 *   a transition will pass before attempting the state write.
 * @returns {{ passed: boolean, missing: Array<{ requirement: string, detail: string }>, gateDescription: string|null }}
 */
export function checkGateRequirements(mode, fromStage, toStage, state = {}, evidence = {}) {
  const requiredGateIds = registry.getRequiredGates(fromStage, toStage);

  // No registered gates for this transition → always passes.
  if (requiredGateIds.length === 0) {
    return { passed: true, missing: [], gateDescription: null };
  }

  // Build an effective gate map: state.gates ∪ evidence-derived gates.
  // EVIDENCE_TO_GATE in advance-stage.js handles writing real state, but the
  // pre-check (this function) wants to know whether the transition WILL pass
  // once those writes happen, so we union evidence into the read view.
  const effectiveGates = { ...(state?.gates ?? {}) };
  for (const [evidenceKey, value] of Object.entries(evidence)) {
    if (value !== true) continue;
    for (const registryId of evidenceKeyToRegistryIds(evidenceKey)) {
      effectiveGates[registryId] = true;
    }
  }

  const missing = [];
  let firstDescription = null;

  for (const gateId of requiredGateIds) {
    const def = registry.getGate(gateId);
    if (firstDescription === null && def?.description) {
      firstDescription = def.description;
    }

    if (effectiveGates[gateId] !== true) {
      missing.push({
        requirement: gateId,
        detail: def?.description
          ? `Gate '${gateId}' not met. ${def.description}. Authority: ${def.authority}.`
          : `Gate '${gateId}' not met.`,
      });
    }
  }

  return {
    passed: missing.length === 0,
    missing,
    gateDescription: firstDescription,
  };
}

/**
 * Record a gate as met in the workflow state. Backward-compatible with
 * older callers that constructed state objects locally; new callers should
 * prefer GateRegistry.recordGateMet (which also records gateMeta).
 */
export function recordGateMet(currentGates = {}, gateName) {
  return { ...currentGates, [gateName]: true };
}

/**
 * Get gate definition for a transition. Returns the first registry gate
 * that blocks the transition, or null if none.
 */
export function getGateDefinition(fromStage, toStage) {
  const ids = registry.getRequiredGates(fromStage, toStage);
  if (ids.length === 0) return null;
  const def = registry.getGate(ids[0]);
  return def ? { ...def, id: ids[0] } : null;
}

// Evidence-key → registry gate id(s) mapping. Mirrors EVIDENCE_TO_GATE in
// advance-stage.js; kept here so the read-side check can union evidence into
// state without depending on the tool layer.
function evidenceKeyToRegistryIds(evidenceKey) {
  switch (evidenceKey) {
    case 'understanding_confirmed':
    case 'plan_confirmed':
      return ['quick.understanding_confirmed'];
    case 'qa_passed':
      return ['full.qa_passed'];
    case 'verification_passed':
      return ['migration.parity_verified'];
    case 'review_completed':
      return ['full.code_review_passed', 'migration.code_review_passed'];
    case 'baseline_captured':
      return ['migration.baseline_verified'];
    case 'strategy_approved':
      return ['migration.strategy_approved'];
    case 'scope_package':
      return ['full.product_to_solution'];
    case 'solution_package':
      return ['full.solution_to_implementation'];
    case 'evidence_recorded':
      return ['quick.verified'];
    default:
      return [];
  }
}
