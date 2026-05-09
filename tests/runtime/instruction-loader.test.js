import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadRoleInstructions,
  loadStageInstructions,
  getInstructionPath,
} from '../../src/runtime/workflow/instruction-loader.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── loadRoleInstructions ────────────────────────────────────────────────

test('loadRoleInstructions returns content for quick_plan (includes brainstorm inline)', () => {
  const result = loadRoleInstructions('quick', 'quick_plan', 'QuickAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Plan'));
});

test('loadRoleInstructions returns null-path fallback for quick_brainstorm (removed stage)', () => {
  // quick_brainstorm is no longer a known stage; loader falls back to generic instructions
  const result = loadRoleInstructions('quick', 'quick_brainstorm', 'QuickAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('QuickAgent'));
  assert.ok(result.includes('quick_brainstorm'));
});

test('loadRoleInstructions returns content for quick_implement', () => {
  const result = loadRoleInstructions('quick', 'quick_implement', 'QuickAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Implement'));
});

test('loadRoleInstructions returns content for quick_test', () => {
  const result = loadRoleInstructions('quick', 'quick_test', 'QuickAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Test') || result.includes('Verify'));
});

test('loadRoleInstructions returns content for full_intake', () => {
  const result = loadRoleInstructions('full', 'full_intake', 'MasterOrchestrator', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('MasterOrchestrator'));
});

test('loadRoleInstructions returns content for full_product', () => {
  const result = loadRoleInstructions('full', 'full_product', 'ProductLead', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('ProductLead'));
});

test('loadRoleInstructions returns content for full_solution', () => {
  const result = loadRoleInstructions('full', 'full_solution', 'SolutionLead', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('SolutionLead'));
});

test('loadRoleInstructions returns content for full_implementation', () => {
  const result = loadRoleInstructions('full', 'full_implementation', 'FullstackAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('FullstackAgent'));
});

test('loadRoleInstructions returns content for full_code_review', () => {
  const result = loadRoleInstructions('full', 'full_code_review', 'CodeReviewer', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('CodeReviewer'));
});

test('loadRoleInstructions returns content for full_qa', () => {
  const result = loadRoleInstructions('full', 'full_qa', 'QAAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('QAAgent'));
});

test('loadRoleInstructions returns content for migration_baseline', () => {
  const result = loadRoleInstructions('migration', 'migration_baseline', 'SolutionLead', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Baseline') || result.includes('baseline'));
});

test('loadRoleInstructions returns content for migration_strategy', () => {
  const result = loadRoleInstructions('migration', 'migration_strategy', 'SolutionLead', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Strategy') || result.includes('strategy'));
});

test('loadRoleInstructions returns content for migration_upgrade', () => {
  const result = loadRoleInstructions('migration', 'migration_upgrade', 'FullstackAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Upgrade') || result.includes('upgrade'));
});

test('loadRoleInstructions returns content for migration_verify', () => {
  const result = loadRoleInstructions('migration', 'migration_verify', 'QAAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('Verify') || result.includes('verify'));
});

// ── Role boundaries always prepended ────────────────────────────────────

test('loadRoleInstructions always includes role boundaries', () => {
  const result = loadRoleInstructions('quick', 'quick_plan', 'QuickAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result.includes('MasterOrchestrator'));
  assert.ok(result.includes('QuickAgent'));
  assert.ok(result.includes('FullstackAgent'));
});

// ── Fallback for unknown stages ─────────────────────────────────────────

test('loadRoleInstructions returns fallback for unknown stage', () => {
  const result = loadRoleInstructions('quick', 'nonexistent_stage', 'QuickAgent', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
  assert.ok(result.includes('QuickAgent'));
  assert.ok(result.includes('nonexistent_stage'));
});

// ── loadStageInstructions ───────────────────────────────────────────────

test('loadStageInstructions returns content for quick_plan (brainstorm happens inline)', () => {
  const result = loadStageInstructions('quick_plan', { kitRoot: PROJECT_ROOT });
  assert.ok(result);
});

test('loadStageInstructions returns null for quick_brainstorm (removed stage)', () => {
  // quick_brainstorm is no longer in the stage-to-instruction map
  const result = loadStageInstructions('quick_brainstorm', { kitRoot: PROJECT_ROOT });
  assert.equal(result, null);
});

test('loadStageInstructions returns null for unknown stage', () => {
  const result = loadStageInstructions('nonexistent_stage', { kitRoot: PROJECT_ROOT });
  assert.equal(result, null);
});

// ── getInstructionPath ──────────────────────────────────────────────────

test('getInstructionPath returns null for quick_brainstorm (removed)', () => {
  assert.equal(getInstructionPath('quick_brainstorm'), null);
});

test('getInstructionPath returns path for known stages', () => {
  assert.equal(getInstructionPath('quick_plan'), 'quick/plan.md');
  assert.equal(getInstructionPath('full_intake'), 'full/orchestrator-intake.md');
  assert.equal(getInstructionPath('migration_baseline'), 'migration/baseline.md');
});

test('getInstructionPath returns null for unknown stage', () => {
  assert.equal(getInstructionPath('nonexistent'), null);
});

// ── Content size check ──────────────────────────────────────────────────

test('instruction content is under 5KB per stage', () => {
  const stages = [
    'quick_plan', 'quick_implement', 'quick_test',
    'full_intake', 'full_product', 'full_solution', 'full_implementation', 'full_code_review', 'full_qa',
    'migration_baseline', 'migration_strategy', 'migration_upgrade', 'migration_verify',
  ];

  for (const stage of stages) {
    const content = loadStageInstructions(stage, { kitRoot: PROJECT_ROOT });
    if (content) {
      const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
      assert.ok(sizeKB < 5, `${stage} instruction is ${sizeKB.toFixed(1)}KB (should be <5KB)`);
    }
  }
});
