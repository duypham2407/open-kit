export const STATE_VERSION = '2.0.0';

export function isLegacyState(state) {
  return !state.version || state.version !== STATE_VERSION;
}

const APPROVAL_MIGRATION_MAP = {
  // Quick lane
  'quick_verified': 'quick.verified',

  // Full lane
  'product_to_solution': 'full.product_to_solution',
  'solution_to_implementation': 'full.solution_to_implementation',
  'code_review_passed': 'full.code_review_passed',
  'qa_passed': 'full.qa_passed',

  // Migration lane
  'baseline_verified': 'migration.baseline_verified',
  'strategy_approved': 'migration.strategy_approved',
  'migration_code_review_passed': 'migration.code_review_passed',
  'parity_verified': 'migration.parity_verified'
};

const GATE_MIGRATION_MAP = {
  'user_understanding_confirmed': 'quick.understanding_confirmed',
  'user_plan_confirmed': 'quick.plan_confirmed'
};

export function migrateState(oldState) {
  if (!isLegacyState(oldState)) {
    return oldState;
  }

  const newState = {
    version: STATE_VERSION,
    mode: oldState.mode,
    stage: oldState.stage,
    owner: oldState.owner,
    gates: {},
    metadata: {
      created_at: oldState.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      state_version: 1,
      migrated_from: oldState.version || '1.0.0'
    }
  };

  // Migrate old approvals
  if (oldState.approvals) {
    for (const [key, value] of Object.entries(oldState.approvals)) {
      const newKey = APPROVAL_MIGRATION_MAP[key];
      if (newKey) {
        newState.gates[newKey] = value;
      }
    }
  }

  // Migrate old gates
  if (oldState.gates) {
    for (const [key, value] of Object.entries(oldState.gates)) {
      const newKey = GATE_MIGRATION_MAP[key];
      if (newKey) {
        newState.gates[newKey] = value;
      }
    }
  }

  return newState;
}
