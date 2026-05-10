import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidTransition,
  getValidNextStages,
  getStageOwner,
} from '../../runtime/workflow/state-machine.js';

// ── Quick Mode Transitions ──────────────────────────────────────────────

test('quick: intake → plan is valid (direct, no brainstorm)', () => {
  assert.equal(isValidTransition('quick', 'quick_intake', 'quick_plan'), true);
});

test('quick: plan → implement is valid', () => {
  assert.equal(isValidTransition('quick', 'quick_plan', 'quick_implement'), true);
});

test('quick: implement → test is valid', () => {
  assert.equal(isValidTransition('quick', 'quick_implement', 'quick_test'), true);
});

test('quick: test → done is valid', () => {
  assert.equal(isValidTransition('quick', 'quick_test', 'quick_done'), true);
});

test('quick: quick_brainstorm is no longer a valid stage', () => {
  assert.equal(isValidTransition('quick', 'quick_intake', 'quick_brainstorm'), false);
  assert.equal(isValidTransition('quick', 'quick_brainstorm', 'quick_plan'), false);
});

test('quick: intake → implement is INVALID (skips plan)', () => {
  assert.equal(isValidTransition('quick', 'quick_intake', 'quick_implement'), false);
});

test('quick: test → plan is NOT valid (no back-transition to plan from test)', () => {
  assert.equal(isValidTransition('quick', 'quick_test', 'quick_plan'), false);
});

test('quick: test → implement is valid (back-transition)', () => {
  assert.equal(isValidTransition('quick', 'quick_test', 'quick_implement'), true);
});

test('quick: implement → plan is valid (back-transition)', () => {
  assert.equal(isValidTransition('quick', 'quick_implement', 'quick_plan'), true);
});

// ── Full Mode Transitions ───────────────────────────────────────────────

test('full: intake → product is valid', () => {
  assert.equal(isValidTransition('full', 'full_intake', 'full_product'), true);
});

test('full: product → solution is valid', () => {
  assert.equal(isValidTransition('full', 'full_product', 'full_solution'), true);
});

test('full: solution → implementation is valid', () => {
  assert.equal(isValidTransition('full', 'full_solution', 'full_implementation'), true);
});

test('full: implementation → code_review is valid', () => {
  assert.equal(isValidTransition('full', 'full_implementation', 'full_code_review'), true);
});

test('full: code_review → qa is valid', () => {
  assert.equal(isValidTransition('full', 'full_code_review', 'full_qa'), true);
});

test('full: qa → done is valid', () => {
  assert.equal(isValidTransition('full', 'full_qa', 'full_done'), true);
});

test('full: intake → implementation is INVALID (skips product & solution)', () => {
  assert.equal(isValidTransition('full', 'full_intake', 'full_implementation'), false);
});

test('full: product → implementation is INVALID (skips solution)', () => {
  assert.equal(isValidTransition('full', 'full_product', 'full_implementation'), false);
});

test('full: code_review → implementation is valid (back for fixes)', () => {
  assert.equal(isValidTransition('full', 'full_code_review, full_implementation'), false);
  assert.equal(isValidTransition('full', 'full_code_review', 'full_implementation'), true);
});

test('full: qa → implementation is valid (back for fixes)', () => {
  assert.equal(isValidTransition('full', 'full_qa', 'full_implementation'), true);
});

// ── Migration Mode Transitions ──────────────────────────────────────────

test('migration: intake → baseline is valid', () => {
  assert.equal(isValidTransition('migration', 'migration_intake', 'migration_baseline'), true);
});

test('migration: baseline → strategy is valid', () => {
  assert.equal(isValidTransition('migration', 'migration_baseline', 'migration_strategy'), true);
});

test('migration: strategy → upgrade is valid', () => {
  assert.equal(isValidTransition('migration', 'migration_strategy', 'migration_upgrade'), true);
});

test('migration: upgrade → code_review is valid', () => {
  assert.equal(isValidTransition('migration', 'migration_upgrade', 'migration_code_review'), true);
});

test('migration: code_review → verify is valid', () => {
  assert.equal(isValidTransition('migration', 'migration_code_review', 'migration_verify'), true);
});

test('migration: verify → done is valid', () => {
  assert.equal(isValidTransition('migration', 'migration_verify', 'migration_done'), true);
});

test('migration: intake → upgrade is INVALID', () => {
  assert.equal(isValidTransition('migration', 'migration_intake', 'migration_upgrade'), false);
});

// ── getValidNextStages ──────────────────────────────────────────────────

test('getValidNextStages returns correct options for quick_intake', () => {
  const next = getValidNextStages('quick', 'quick_intake');
  assert.ok(Array.isArray(next));
  assert.ok(next.includes('quick_plan'));
  assert.ok(!next.includes('quick_brainstorm'));
});

test('getValidNextStages returns correct options for full_code_review', () => {
  const next = getValidNextStages('quick', 'quick_brainstorm');
  assert.deepEqual(next, [], 'quick_brainstorm must not appear as a valid stage');
});

test('getValidNextStages returns correct options for quick_plan', () => {
  const next = getValidNextStages('quick', 'quick_plan');
  assert.ok(next.includes('quick_implement'));
  assert.ok(!next.includes('quick_brainstorm'));
});

test('getValidNextStages returns correct for full_code_review back-transitions', () => {
  const next = getValidNextStages('full', 'full_code_review');
  assert.ok(next.includes('full_qa'));
  assert.ok(next.includes('full_implementation')); // back-transition
});

test('getValidNextStages returns empty for unknown stage', () => {
  const next = getValidNextStages('quick', 'nonexistent');
  assert.deepEqual(next, []);
});

test('getValidNextStages returns empty for unknown mode', () => {
  const next = getValidNextStages('nonexistent', 'quick_plan');
  assert.deepEqual(next, []);
});

// ── getStageOwner ───────────────────────────────────────────────────────

test('getStageOwner returns MasterOrchestrator for quick_intake', () => {
  assert.equal(getStageOwner('quick', 'quick_intake'), 'MasterOrchestrator');
});

test('getStageOwner returns QuickAgent for quick_plan, implement, test, done', () => {
  assert.equal(getStageOwner('quick', 'quick_plan'), 'QuickAgent');
  assert.equal(getStageOwner('quick', 'quick_implement'), 'QuickAgent');
  assert.equal(getStageOwner('quick', 'quick_test'), 'QuickAgent');
  assert.equal(getStageOwner('quick', 'quick_done'), 'QuickAgent');
});

test('getStageOwner returns null for quick_brainstorm (removed stage)', () => {
  assert.equal(getStageOwner('quick', 'quick_brainstorm'), null);
});

test('getStageOwner returns MasterOrchestrator for full_intake', () => {
  assert.equal(getStageOwner('full', 'full_intake'), 'MasterOrchestrator');
});

test('getStageOwner returns ProductLead for full_product', () => {
  assert.equal(getStageOwner('full', 'full_product'), 'ProductLead');
});

test('getStageOwner returns SolutionLead for full_solution', () => {
  assert.equal(getStageOwner('full', 'full_solution'), 'SolutionLead');
});

test('getStageOwner returns FullstackAgent for full_implementation', () => {
  assert.equal(getStageOwner('full', 'full_implementation'), 'FullstackAgent');
});

test('getStageOwner returns CodeReviewer for full_code_review', () => {
  assert.equal(getStageOwner('full', 'full_code_review'), 'CodeReviewer');
});

test('getStageOwner returns QAAgent for full_qa', () => {
  assert.equal(getStageOwner('full', 'full_qa'), 'QAAgent');
});

test('getStageOwner returns null for unknown stage', () => {
  assert.equal(getStageOwner('full', 'nonexistent'), null);
});

// ── Edge Cases ──────────────────────────────────────────────────────────

test('cross-mode transition is invalid (quick stage in full mode)', () => {
  assert.equal(isValidTransition('full', 'quick_plan', 'quick_implement'), false);
});

test('same-stage transition is invalid', () => {
  assert.equal(isValidTransition('quick', 'quick_plan', 'quick_plan'), false);
});
