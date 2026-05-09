/**
 * Canonical workflow transition rules.
 *
 * This module is the single source of truth for legal stage transitions
 * across the three OpenKit workflow modes (quick / full / migration) and
 * for the role that owns each stage. Both src/runtime/workflow/state-machine.js
 * (used by the advance-stage MCP tool and the openkit://available-actions
 * resource) and src/runtime/state/transition-engine.js (used by
 * WorkflowStateManager for persistence-time validation) import from here.
 *
 * Audit reference: 1-C-1 in docs/superpowers/specs/2026-05-09-project-audit-report.md
 *
 * Merge policy when the two prior tables disagreed: take the more permissive
 * entry, with the explicit goal of allowing backward rework so the model can
 * recover from a stuck stage. Forward-only transitions remain unchanged.
 */

export const TRANSITIONS = {
  quick: {
    quick_intake: ['quick_plan'],
    quick_plan: ['quick_implement'],
    quick_implement: ['quick_test', 'quick_plan'],
    quick_test: ['quick_done', 'quick_implement'],
    quick_done: [],
  },

  full: {
    full_intake: ['full_product'],
    full_product: ['full_solution'],
    full_solution: ['full_implementation', 'full_product'],
    full_implementation: ['full_code_review', 'full_solution'],
    full_code_review: ['full_qa', 'full_implementation', 'full_solution', 'full_product'],
    full_qa: ['full_done', 'full_implementation', 'full_solution', 'full_product'],
    full_done: [],
  },

  migration: {
    migration_intake: ['migration_baseline'],
    migration_baseline: ['migration_strategy'],
    migration_strategy: ['migration_upgrade', 'migration_baseline'],
    migration_upgrade: ['migration_code_review', 'migration_strategy'],
    migration_code_review: ['migration_verify', 'migration_upgrade', 'migration_strategy'],
    migration_verify: ['migration_done', 'migration_upgrade'],
    migration_done: [],
  },
};

export const STAGE_OWNERS = {
  quick: {
    quick_intake: 'MasterOrchestrator',
    quick_plan: 'QuickAgent',
    quick_implement: 'QuickAgent',
    quick_test: 'QuickAgent',
    quick_done: 'QuickAgent',
  },
  full: {
    full_intake: 'MasterOrchestrator',
    full_product: 'ProductLead',
    full_solution: 'SolutionLead',
    full_implementation: 'FullstackAgent',
    full_code_review: 'CodeReviewer',
    full_qa: 'QAAgent',
    full_done: 'MasterOrchestrator',
  },
  migration: {
    migration_intake: 'MasterOrchestrator',
    migration_baseline: 'SolutionLead',
    migration_strategy: 'SolutionLead',
    migration_upgrade: 'FullstackAgent',
    migration_code_review: 'CodeReviewer',
    migration_verify: 'QAAgent',
    migration_done: 'MasterOrchestrator',
  },
};
