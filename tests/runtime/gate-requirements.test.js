import test from 'node:test';
import assert from 'node:assert/strict';

import { checkGateRequirements } from '../../src/runtime/workflow/gate-requirements.js';

// ── Quick Mode Gates ────────────────────────────────────────────────────

test('quick: intake→plan without understanding_confirmed fails gate', () => {
  const state = { mode: 'quick', current_stage: 'quick_intake', verification_evidence: [] };
  const result = checkGateRequirements('quick', 'quick_intake', 'quick_plan', state);
  assert.equal(result.passed, false);
  assert.ok(result.missing.length > 0);
});

test('quick: intake→plan with understanding_confirmed passes gate', () => {
  const state = {
    mode: 'quick',
    current_stage: 'quick_intake',
    verification_evidence: [],
  };
  const evidence = { understanding_confirmed: true };
  const result = checkGateRequirements('quick', 'quick_intake', 'quick_plan', state, evidence);
  assert.equal(result.passed, true);
});

test('quick: plan→implement without plan_confirmed fails gate', () => {
  const state = { mode: 'quick', current_stage: 'quick_plan', verification_evidence: [] };
  const result = checkGateRequirements('quick', 'quick_plan', 'quick_implement', state);
  assert.equal(result.passed, false);
});

test('quick: plan→implement with plan_confirmed passes gate', () => {
  const state = { mode: 'quick', current_stage: 'quick_plan', verification_evidence: [] };
  const evidence = { plan_confirmed: true };
  const result = checkGateRequirements('quick', 'quick_plan', 'quick_implement', state, evidence);
  assert.equal(result.passed, true);
});

test('quick: test→done without evidence_recorded fails gate', () => {
  const state = { mode: 'quick', current_stage: 'quick_test', verification_evidence: [] };
  const result = checkGateRequirements('quick', 'quick_test', 'quick_done', state);
  assert.equal(result.passed, false);
});

test('quick: test→done with evidence passes gate', () => {
  const state = {
    mode: 'quick',
    current_stage: 'quick_test',
    verification_evidence: [{ type: 'test_result', data: { passed: true } }],
  };
  const result = checkGateRequirements('quick', 'quick_test', 'quick_done', state);
  assert.equal(result.passed, true);
});

// ── Full Mode Gates ─────────────────────────────────────────────────────

test('full: product→solution without scope_package fails gate', () => {
  const state = { mode: 'full', current_stage: 'full_product', verification_evidence: [] };
  const result = checkGateRequirements('full', 'full_product', 'full_solution', state);
  assert.equal(result.passed, false);
});

test('full: product→solution with scope_package passes gate', () => {
  const state = { mode: 'full', current_stage: 'full_product', verification_evidence: [] };
  const evidence = { scope_package: true };
  const result = checkGateRequirements('full', 'full_product', 'full_solution', state, evidence);
  assert.equal(result.passed, true);
});

test('full: solution→implementation without solution_package fails gate', () => {
  const state = { mode: 'full', current_stage: 'full_solution', verification_evidence: [] };
  const result = checkGateRequirements('full', 'full_solution', 'full_implementation', state);
  assert.equal(result.passed, false);
});

test('full: code_review→qa without review_completed fails gate', () => {
  const state = { mode: 'full', current_stage: 'full_code_review', verification_evidence: [] };
  const result = checkGateRequirements('full', 'full_code_review', 'full_qa', state);
  assert.equal(result.passed, false);
});

test('full: qa→done without qa_passed fails gate', () => {
  const state = { mode: 'full', current_stage: 'full_qa', verification_evidence: [] };
  const result = checkGateRequirements('full', 'full_qa', 'full_done', state);
  assert.equal(result.passed, false);
});

// ── Migration Mode Gates ────────────────────────────────────────────────

test('migration: baseline→strategy without baseline_captured fails gate', () => {
  const state = { mode: 'migration', current_stage: 'migration_baseline', verification_evidence: [] };
  const result = checkGateRequirements('migration', 'migration_baseline', 'migration_strategy', state);
  assert.equal(result.passed, false);
});

test('migration: baseline→strategy with baseline_captured passes gate', () => {
  const state = { mode: 'migration', current_stage: 'migration_baseline', verification_evidence: [] };
  const evidence = { baseline_captured: true };
  const result = checkGateRequirements('migration', 'migration_baseline', 'migration_strategy', state, evidence);
  assert.equal(result.passed, true);
});

test('migration: strategy→upgrade without strategy_approved fails gate', () => {
  const state = { mode: 'migration', current_stage: 'migration_strategy', verification_evidence: [] };
  const result = checkGateRequirements('migration', 'migration_strategy', 'migration_upgrade', state);
  assert.equal(result.passed, false);
});

test('migration: verify→done without verification_passed fails gate', () => {
  const state = { mode: 'migration', current_stage: 'migration_verify', verification_evidence: [] };
  const result = checkGateRequirements('migration', 'migration_verify', 'migration_done', state);
  assert.equal(result.passed, false);
});

// ── No gate transitions ─────────────────────────────────────────────────

test('quick: quick_brainstorm→quick_plan has no gate (quick_brainstorm is removed)', () => {
  // quick_brainstorm is no longer a stage; any transition from it has no gate (passes vacuously)
  const state = { mode: 'quick', current_stage: 'quick_intake', verification_evidence: [] };
  const result = checkGateRequirements('quick', 'quick_brainstorm', 'quick_plan', state);
  assert.equal(result.passed, true);
});

test('full: intake→product has no gate (always passes)', () => {
  const state = { mode: 'full', current_stage: 'full_intake', verification_evidence: [] };
  const result = checkGateRequirements('full', 'full_intake', 'full_product', state);
  assert.equal(result.passed, true);
});

test('quick: implement→test has no gate (always passes)', () => {
  const state = { mode: 'quick', current_stage: 'quick_implement', verification_evidence: [] };
  const result = checkGateRequirements('quick', 'quick_implement', 'quick_test', state);
  assert.equal(result.passed, true);
});
