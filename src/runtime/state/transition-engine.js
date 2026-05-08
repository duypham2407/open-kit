// src/runtime/state/transition-engine.js

// Stage ordering arrays define the canonical forward progression for each mode.
// These are the authoritative source for determining whether a transition is
// "backward" (to an earlier stage) or "forward" (to a later stage).
// The TRANSITION_RULES object must list stages in the same order as these arrays
// so that Object.keys() ordering matches STAGE_ORDER when used as a fallback,
// but STAGE_ORDER is always used explicitly for backward detection.
const STAGE_ORDER = {
  quick: [
    'quick_intake',
    'quick_brainstorm',
    'quick_plan',
    'quick_implement',
    'quick_test',
    'quick_done'
  ],
  full: [
    'full_intake',
    'full_product',
    'full_solution',
    'full_implementation',
    'full_code_review',
    'full_qa',
    'full_done'
  ],
  migration: [
    'migration_intake',
    'migration_baseline',
    'migration_strategy',
    'migration_upgrade',
    'migration_code_review',
    'migration_verify',
    'migration_done'
  ]
};

const TRANSITION_RULES = {
  quick: {
    quick_intake: ['quick_brainstorm'],
    quick_brainstorm: ['quick_plan'],
    quick_plan: ['quick_implement', 'quick_brainstorm'],
    quick_implement: ['quick_test', 'quick_plan'],
    quick_test: ['quick_done', 'quick_implement'],
    quick_done: []
  },

  full: {
    full_intake: ['full_product'],
    full_product: ['full_solution'],
    full_solution: ['full_implementation', 'full_product'],
    full_implementation: ['full_code_review', 'full_solution'],
    full_code_review: ['full_qa', 'full_implementation'],
    full_qa: ['full_done', 'full_implementation'],
    full_done: []
  },

  migration: {
    migration_intake: ['migration_baseline'],
    migration_baseline: ['migration_strategy'],
    migration_strategy: ['migration_upgrade', 'migration_baseline'],
    migration_upgrade: ['migration_code_review', 'migration_strategy'],
    migration_code_review: ['migration_verify', 'migration_upgrade'],
    migration_verify: ['migration_done', 'migration_upgrade'],
    migration_done: []
  }
};

export class TransitionEngine {
  constructor() {
    this.rules = TRANSITION_RULES;
  }

  validateTransition(mode, fromStage, toStage) {
    const modeRules = this.rules[mode];

    if (!modeRules) {
      return {
        valid: false,
        reason: `Unknown mode: ${mode}`
      };
    }

    const validNext = modeRules[fromStage];

    if (!validNext) {
      return {
        valid: false,
        reason: `Unknown stage: ${fromStage}`
      };
    }

    if (validNext.length === 0) {
      return {
        valid: false,
        reason: `${fromStage} is a terminal stage`
      };
    }

    if (!validNext.includes(toStage)) {
      return {
        valid: false,
        reason: `Invalid transition from ${fromStage} to ${toStage}. Valid: ${validNext.join(', ')}`
      };
    }

    // Use the explicit STAGE_ORDER array (not Object.keys) to reliably
    // determine direction. Object key insertion order is implementation-defined
    // in older environments and must not be relied on for semantic ordering.
    const stageOrder = STAGE_ORDER[mode];
    const fromIndex = stageOrder.indexOf(fromStage);
    const toIndex = stageOrder.indexOf(toStage);
    const isBackward = toIndex < fromIndex;

    return {
      valid: true,
      backward: isBackward
    };
  }

  getNextStages(mode, currentStage) {
    const modeRules = this.rules[mode];
    if (!modeRules) return [];
    return modeRules[currentStage] || [];
  }

  isTerminalStage(mode, stage) {
    const modeRules = this.rules[mode];
    if (!modeRules) {
      throw new Error(`Unknown mode: ${mode}`);
    }
    if (!(stage in modeRules)) {
      throw new Error(`Unknown stage: ${stage}`);
    }
    return modeRules[stage].length === 0;
  }
}
