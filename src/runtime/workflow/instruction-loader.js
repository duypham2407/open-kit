/**
 * Instruction Loader
 *
 * Loads role-specific instruction markdown files based on the current
 * workflow mode, stage, and owner. These instructions are served via
 * MCP Resources or included in tool.advance-stage responses.
 *
 * Instruction files are stored in the `instructions/` directory at the kit root.
 * Structure:
 *   instructions/core/workflow-router.md
 *   instructions/core/role-boundaries.md
 *   instructions/quick/{brainstorm,plan,implement,test}.md
 *   instructions/full/{orchestrator-intake,product-lead,solution-lead,fullstack-implement,code-reviewer,qa-agent}.md
 *   instructions/migration/{baseline,strategy,upgrade,verify}.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KIT_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');

function resolveInstructionsRoot(kitRoot) {
  const candidates = [
    kitRoot,
    process.env.OPENKIT_KIT_ROOT,
    DEFAULT_KIT_ROOT,
  ].filter(Boolean);

  for (const root of candidates) {
    const dir = path.join(root, 'instructions');
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return path.join(DEFAULT_KIT_ROOT, 'instructions');
}

const STAGE_TO_INSTRUCTION = {
  // Quick mode
  quick_intake: 'core/workflow-router.md',
  quick_plan: 'quick/plan.md',
  quick_implement: 'quick/implement.md',
  quick_test: 'quick/test.md',
  quick_done: 'core/workflow-router.md',

  // Full mode
  full_intake: 'full/orchestrator-intake.md',
  full_product: 'full/product-lead.md',
  full_solution: 'full/solution-lead.md',
  full_implementation: 'full/fullstack-implement.md',
  full_code_review: 'full/code-reviewer.md',
  full_qa: 'full/qa-agent.md',
  full_done: 'core/workflow-router.md',

  // Migration mode
  migration_intake: 'core/workflow-router.md',
  migration_baseline: 'migration/baseline.md',
  migration_strategy: 'migration/strategy.md',
  migration_upgrade: 'migration/upgrade.md',
  migration_code_review: 'full/code-reviewer.md',
  migration_verify: 'migration/verify.md',
  migration_done: 'core/workflow-router.md',
};

/**
 * Load role instructions for the given mode/stage/owner.
 *
 * @param {string} mode - Workflow mode (quick, full, migration)
 * @param {string} stage - Current stage
 * @param {string} owner - Current owner role
 * @param {object} options - Optional { kitRoot }
 * @returns {string} Markdown instruction content
 */
export function loadRoleInstructions(mode, stage, owner, options = {}) {
  const instructionsRoot = resolveInstructionsRoot(options.kitRoot ?? DEFAULT_KIT_ROOT);
  const parts = [];

  // Always prepend role boundaries
  const boundariesPath = path.join(instructionsRoot, 'core', 'role-boundaries.md');
  if (fs.existsSync(boundariesPath)) {
    parts.push(fs.readFileSync(boundariesPath, 'utf8').trim());
  }

  // Load stage-specific instructions
  const instructionFile = STAGE_TO_INSTRUCTION[stage];
  if (instructionFile) {
    const filePath = path.join(instructionsRoot, instructionFile);
    if (fs.existsSync(filePath)) {
      parts.push(fs.readFileSync(filePath, 'utf8').trim());
    } else {
      parts.push(buildFallbackInstructions(mode, stage, owner));
    }
  } else {
    parts.push(buildFallbackInstructions(mode, stage, owner));
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Load just the stage-specific instructions (without role boundaries prefix).
 */
export function loadStageInstructions(stage, options = {}) {
  const instructionsRoot = resolveInstructionsRoot(options.kitRoot ?? DEFAULT_KIT_ROOT);
  const instructionFile = STAGE_TO_INSTRUCTION[stage];
  if (!instructionFile) return null;

  const filePath = path.join(instructionsRoot, instructionFile);
  if (!fs.existsSync(filePath)) return null;

  return fs.readFileSync(filePath, 'utf8').trim();
}

/**
 * Build fallback instructions when a specific instruction file is missing.
 */
function buildFallbackInstructions(mode, stage, owner) {
  return [
    `# ${owner} — ${stage}`,
    '',
    `You are ${owner} in \`${stage}\` (${mode} mode).`,
    '',
    '## Available Actions',
    '- Call `tool.advance-stage` to transition to the next stage',
    '- Call `tool.workflow-state` to check current workflow state',
    '- Your tool permissions are enforced by the Role Guard Hook',
    '',
    '## Role Boundaries',
    `Refer to the role boundaries above for your permissions as ${owner}.`,
  ].join('\n');
}

/**
 * Get the instruction file path for a stage (for inspection purposes).
 */
export function getInstructionPath(stage) {
  return STAGE_TO_INSTRUCTION[stage] ?? null;
}
