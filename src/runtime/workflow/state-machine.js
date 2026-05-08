/**
 * Workflow Finite State Machine
 *
 * Defines legal stage transitions, stage owners, and validation logic
 * for all three workflow modes: quick, full, and migration.
 *
 * This is the single source of truth for:
 * - Which stages can follow which
 * - Which role owns each stage
 * - Whether a proposed transition is valid
 */

const QUICK_TRANSITIONS = {
  quick_intake: ['quick_brainstorm'],
  quick_brainstorm: ['quick_plan'],
  quick_plan: ['quick_implement', 'quick_brainstorm'],
  quick_implement: ['quick_test', 'quick_plan'],
  quick_test: ['quick_done', 'quick_implement'],
  quick_done: [],
};

const QUICK_STAGE_OWNERS = {
  quick_intake: 'QuickAgent',
  quick_brainstorm: 'QuickAgent',
  quick_plan: 'QuickAgent',
  quick_implement: 'QuickAgent',
  quick_test: 'QuickAgent',
  quick_done: 'QuickAgent',
};

const FULL_TRANSITIONS = {
  full_intake: ['full_product'],
  full_product: ['full_solution'],
  full_solution: ['full_implementation'],
  full_implementation: ['full_code_review', 'full_solution'],
  full_code_review: ['full_qa', 'full_implementation', 'full_solution', 'full_product'],
  full_qa: ['full_done', 'full_implementation', 'full_solution', 'full_product'],
  full_done: [],
};

const FULL_STAGE_OWNERS = {
  full_intake: 'MasterOrchestrator',
  full_product: 'ProductLead',
  full_solution: 'SolutionLead',
  full_implementation: 'FullstackAgent',
  full_code_review: 'CodeReviewer',
  full_qa: 'QAAgent',
  full_done: 'MasterOrchestrator',
};

const MIGRATION_TRANSITIONS = {
  migration_intake: ['migration_baseline'],
  migration_baseline: ['migration_strategy'],
  migration_strategy: ['migration_upgrade'],
  migration_upgrade: ['migration_code_review', 'migration_strategy'],
  migration_code_review: ['migration_verify', 'migration_upgrade', 'migration_strategy'],
  migration_verify: ['migration_done', 'migration_upgrade'],
  migration_done: [],
};

const MIGRATION_STAGE_OWNERS = {
  migration_intake: 'MasterOrchestrator',
  migration_baseline: 'SolutionLead',
  migration_strategy: 'SolutionLead',
  migration_upgrade: 'FullstackAgent',
  migration_code_review: 'CodeReviewer',
  migration_verify: 'QAAgent',
  migration_done: 'MasterOrchestrator',
};

const MODE_CONFIG = {
  quick: { transitions: QUICK_TRANSITIONS, owners: QUICK_STAGE_OWNERS },
  full: { transitions: FULL_TRANSITIONS, owners: FULL_STAGE_OWNERS },
  migration: { transitions: MIGRATION_TRANSITIONS, owners: MIGRATION_STAGE_OWNERS },
};

/**
 * Check if a transition from one stage to another is valid.
 */
export function isValidTransition(mode, fromStage, toStage) {
  const config = MODE_CONFIG[mode];
  if (!config) return false;

  const validTargets = config.transitions[fromStage];
  if (!validTargets) return false;

  return validTargets.includes(toStage);
}

/**
 * Get valid next stages from the current stage.
 */
export function getValidNextStages(mode, currentStage) {
  const config = MODE_CONFIG[mode];
  if (!config) return [];
  return config.transitions[currentStage] ?? [];
}

/**
 * Get the required owner for a stage.
 */
export function getStageOwner(mode, stage) {
  const config = MODE_CONFIG[mode];
  if (!config) return null;
  return config.owners[stage] ?? null;
}

/**
 * Get the initial stage for a mode.
 */
export function getInitialStage(mode) {
  const map = {
    quick: 'quick_intake',
    full: 'full_intake',
    migration: 'migration_intake',
  };
  return map[mode] ?? null;
}

/**
 * Get all stages for a mode in pipeline order.
 */
export function getStagesForMode(mode) {
  const config = MODE_CONFIG[mode];
  if (!config) return [];
  return Object.keys(config.transitions);
}

/**
 * Get a mode config for external inspection.
 */
export function getModeConfig(mode) {
  return MODE_CONFIG[mode] ?? null;
}

/**
 * List all known modes.
 */
export function getKnownModes() {
  return Object.keys(MODE_CONFIG);
}
