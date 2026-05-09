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

import { TRANSITIONS, STAGE_OWNERS } from '../state/transitions.js';

const MODE_CONFIG = {
  quick: { transitions: TRANSITIONS.quick, owners: STAGE_OWNERS.quick },
  full: { transitions: TRANSITIONS.full, owners: STAGE_OWNERS.full },
  migration: { transitions: TRANSITIONS.migration, owners: STAGE_OWNERS.migration },
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
