// src/runtime/state/transition-engine.js

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

    const stageOrder = Object.keys(modeRules);
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
    const nextStages = this.getNextStages(mode, stage);
    return nextStages.length === 0;
  }
}
