/**
 * Gate Requirements
 *
 * Defines conditions that must be met before a stage transition is allowed.
 * Each gate checks specific evidence or state conditions.
 */

const GATE_DEFINITIONS = {
  // Quick mode gates
  'quick_intake→quick_plan': {
    requires: ['user_understanding_confirmed'],
    description: 'Quick Agent must confirm understanding of the codebase and problem before planning.',
  },
  'quick_plan→quick_implement': {
    requires: ['user_plan_confirmed'],
    description: 'User must confirm the selected plan option before implementation starts.',
  },
  'quick_test→quick_done': {
    requires: ['evidence_recorded'],
    description: 'Test evidence must be recorded before marking quick task as done.',
  },

  // Full mode gates
  'full_product→full_solution': {
    requires: ['scope_package_exists'],
    description: 'Product Lead must produce a scope package before Solution Lead begins.',
  },
  'full_solution→full_implementation': {
    requires: ['solution_package_exists'],
    description: 'Solution Lead must produce a solution package before implementation begins.',
  },
  'full_code_review→full_qa': {
    requires: ['review_completed'],
    description: 'Code Reviewer must complete review before QA verification.',
  },
  'full_qa→full_done': {
    requires: ['qa_passed'],
    description: 'QA must pass verification before marking feature as done.',
  },

  // Migration mode gates
  'migration_baseline→migration_strategy': {
    requires: ['baseline_captured'],
    description: 'Baseline evidence must be captured before strategy formulation.',
  },
  'migration_strategy→migration_upgrade': {
    requires: ['strategy_approved'],
    description: 'Migration strategy must be approved before upgrade work begins.',
  },
  'migration_code_review→migration_verify': {
    requires: ['review_completed'],
    description: 'Code review must complete before verification.',
  },
  'migration_verify→migration_done': {
    requires: ['verification_passed'],
    description: 'Verification must pass before migration is marked done.',
  },
};

/**
 * Gate checker functions.
 * Each returns { met: boolean, detail: string }.
 */
const GATE_CHECKERS = {
  user_understanding_confirmed(state, evidence) {
    const met = evidence?.understanding_confirmed === true || state?.gates?.user_understanding_confirmed === true;
    return { met, detail: met ? 'User confirmed understanding.' : 'User has not yet confirmed understanding. Present your analysis and ask for confirmation.' };
  },
  user_plan_confirmed(state, evidence) {
    const met = evidence?.plan_confirmed === true || state?.gates?.user_plan_confirmed === true;
    return { met, detail: met ? 'Plan confirmed by user.' : 'User has not confirmed the plan. Present options and ask for explicit confirmation.' };
  },
  evidence_recorded(state, evidence) {
    const count = state?.verification_evidence?.length ?? evidence?.evidence_count ?? 0;
    const met = count > 0;
    return { met, detail: met ? `${count} evidence item(s) recorded.` : 'No verification evidence recorded. Run tests and capture results.' };
  },
  scope_package_exists(state, evidence) {
    const met = evidence?.scope_package === true || state?.gates?.scope_package_exists === true;
    return { met, detail: met ? 'Scope package exists.' : 'Product Lead must create scope package (docs/scope/) before handoff.' };
  },
  solution_package_exists(state, evidence) {
    const met = evidence?.solution_package === true || state?.gates?.solution_package_exists === true;
    return { met, detail: met ? 'Solution package exists.' : 'Solution Lead must create solution package (docs/solution/) before handoff.' };
  },
  review_completed(state, evidence) {
    const met = evidence?.review_completed === true || state?.gates?.review_completed === true;
    return { met, detail: met ? 'Code review completed.' : 'Code Reviewer has not completed review. Review must pass before proceeding.' };
  },
  qa_passed(state, evidence) {
    const met = evidence?.qa_passed === true || state?.gates?.qa_passed === true;
    return { met, detail: met ? 'QA passed.' : 'QA has not passed. Run verification and record evidence.' };
  },
  baseline_captured(state, evidence) {
    const met = evidence?.baseline_captured === true || state?.gates?.baseline_captured === true;
    return { met, detail: met ? 'Migration baseline captured.' : 'Capture current behavior baseline before proceeding.' };
  },
  strategy_approved(state, evidence) {
    const met = evidence?.strategy_approved === true || state?.gates?.strategy_approved === true;
    return { met, detail: met ? 'Migration strategy approved.' : 'Migration strategy must be approved before upgrade work.' };
  },
  verification_passed(state, evidence) {
    const met = evidence?.verification_passed === true || state?.gates?.verification_passed === true;
    return { met, detail: met ? 'Verification passed.' : 'Run verification tests and confirm behavior is preserved.' };
  },
};

/**
 * Check all gate requirements for a specific transition.
 *
 * @param {string} mode - Workflow mode (quick, full, migration)
 * @param {string} fromStage - Current stage
 * @param {string} toStage - Target stage
 * @param {object} state - Current workflow state
 * @param {object} evidence - Optional evidence object passed with the transition request
 * @returns {{ passed: boolean, missing: Array<{ requirement: string, detail: string }>, gateDescription: string|null }}
 */
export function checkGateRequirements(mode, fromStage, toStage, state = {}, evidence = {}) {
  const key = `${fromStage}→${toStage}`;
  const gate = GATE_DEFINITIONS[key];

  // No gate defined for this transition → always passes
  if (!gate) {
    return { passed: true, missing: [], gateDescription: null };
  }

  const missing = [];
  for (const requirement of gate.requires) {
    const checker = GATE_CHECKERS[requirement];
    if (!checker) {
      // Unknown requirement → treat as unmet
      missing.push({ requirement, detail: `Unknown gate requirement: ${requirement}` });
      continue;
    }

    const result = checker(state, evidence);
    if (!result.met) {
      missing.push({ requirement, detail: result.detail });
    }
  }

  return {
    passed: missing.length === 0,
    missing,
    gateDescription: gate.description,
  };
}

/**
 * Record a gate as met in the workflow state.
 * Returns a new gates object with the gate marked as true.
 */
export function recordGateMet(currentGates = {}, gateName) {
  return { ...currentGates, [gateName]: true };
}

/**
 * Get gate definition for a transition.
 */
export function getGateDefinition(fromStage, toStage) {
  return GATE_DEFINITIONS[`${fromStage}→${toStage}`] ?? null;
}
