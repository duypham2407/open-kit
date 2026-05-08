import test from 'node:test';
import assert from 'node:assert/strict';

import { createAdvanceStageTool } from '../../src/runtime/tools/workflow/advance-stage.js';

function createMockKernel(state) {
  const evidenceLog = [];
  return {
    showState() {
      return { state };
    },
    recordVerificationEvidence(entry) {
      evidenceLog.push(entry);
    },
    _evidenceLog: evidenceLog,
  };
}

// ── Missing input ───────────────────────────────────────────────────────

test('advance-stage errors when targetStage is missing', () => {
  const tool = createAdvanceStageTool({ workflowKernel: createMockKernel({}) });
  const result = tool.execute({});
  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('targetStage'));
});

test('advance-stage errors when no workflow state', () => {
  const tool = createAdvanceStageTool({ workflowKernel: { showState: () => null } });
  const result = tool.execute({ targetStage: 'quick_plan' });
  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('No workflow state'));
});

test('advance-stage errors when state is incomplete', () => {
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({ mode: null, current_stage: null }),
  });
  const result = tool.execute({ targetStage: 'quick_plan' });
  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('incomplete'));
});

// ── Invalid transitions (FSM) ───────────────────────────────────────────

test('advance-stage blocks invalid transition: quick brainstorm → implement', () => {
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({
      mode: 'quick',
      current_stage: 'quick_brainstorm',
      current_owner: 'QuickAgent',
      verification_evidence: [],
    }),
  });

  const result = tool.execute({ targetStage: 'quick_implement' });
  assert.equal(result.status, 'blocked');
  assert.ok(result.reason.includes('Invalid transition'));
  assert.ok(Array.isArray(result.validNextStages));
  assert.ok(result.validNextStages.includes('quick_plan'));
  assert.ok(result.guidance);
});

test('advance-stage blocks invalid transition: full intake → implementation', () => {
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({
      mode: 'full',
      current_stage: 'full_intake',
      current_owner: 'MasterOrchestrator',
      verification_evidence: [],
    }),
  });

  const result = tool.execute({ targetStage: 'full_implementation' });
  assert.equal(result.status, 'blocked');
  assert.ok(result.validNextStages.includes('full_product'));
});

// ── Gate requirements ───────────────────────────────────────────────────

test('advance-stage blocks when gate not satisfied: brainstorm → plan without confirmation', () => {
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({
      mode: 'quick',
      current_stage: 'quick_brainstorm',
      current_owner: 'QuickAgent',
      verification_evidence: [],
    }),
  });

  const result = tool.execute({ targetStage: 'quick_plan' });
  assert.equal(result.status, 'blocked');
  assert.ok(result.missingGates);
  assert.ok(result.missingGates.length > 0);
  assert.ok(result.guidance);
});

test('advance-stage passes when gate is satisfied with evidence', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_brainstorm',
    current_owner: 'QuickAgent',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({
    targetStage: 'quick_plan',
    evidence: { understanding_confirmed: true },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'quick_plan');
  assert.equal(result.newOwner, 'QuickAgent');
});

// ── Successful transitions ──────────────────────────────────────────────

test('advance-stage succeeds: quick intake → brainstorm (no gate)', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_intake',
    current_owner: 'QuickAgent',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({ targetStage: 'quick_brainstorm' });

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'quick_brainstorm');
  assert.equal(result.newOwner, 'QuickAgent');
  assert.equal(result.mode, 'quick');
  assert.ok(Array.isArray(result.validNextStages));
  assert.ok(result.guidance.includes('QuickAgent'));
});

test('advance-stage succeeds: full intake → product', () => {
  const kernel = createMockKernel({
    mode: 'full',
    current_stage: 'full_intake',
    current_owner: 'MasterOrchestrator',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({ targetStage: 'full_product' });

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'full_product');
  assert.equal(result.newOwner, 'ProductLead');
  assert.ok(result.guidance.includes('ProductLead'));
});

test('advance-stage succeeds: quick implement → test (no gate)', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_implement',
    current_owner: 'QuickAgent',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({ targetStage: 'quick_test' });

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'quick_test');
});

// ── Transition record ───────────────────────────────────────────────────

test('advance-stage records transition as verification evidence', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_intake',
    current_owner: 'QuickAgent',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  tool.execute({ targetStage: 'quick_brainstorm' });

  assert.equal(kernel._evidenceLog.length, 1);
  assert.equal(kernel._evidenceLog[0].type, 'stage_transition');
  assert.equal(kernel._evidenceLog[0].transition.from, 'quick_intake');
  assert.equal(kernel._evidenceLog[0].transition.to, 'quick_brainstorm');
});

test('advance-stage includes handoffContext in transition', () => {
  const kernel = createMockKernel({
    mode: 'full',
    current_stage: 'full_intake',
    current_owner: 'MasterOrchestrator',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  tool.execute({
    targetStage: 'full_product',
    handoffContext: 'User wants to add a dark mode feature',
  });

  assert.equal(kernel._evidenceLog[0].transition.handoffContext, 'User wants to add a dark mode feature');
});

// ── Response guidance quality ───────────────────────────────────────────

test('success guidance includes resource reference', () => {
  const kernel = createMockKernel({
    mode: 'full',
    current_stage: 'full_intake',
    current_owner: 'MasterOrchestrator',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({ targetStage: 'full_product' });

  assert.ok(result.guidance.includes('openkit://active-role-instructions'));
});

test('success guidance includes role-specific hint', () => {
  const kernel = createMockKernel({
    mode: 'full',
    current_stage: 'full_solution',
    current_owner: 'SolutionLead',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({
    targetStage: 'full_implementation',
    evidence: { solution_package: true },
  });

  assert.ok(result.guidance.includes('FullstackAgent'));
  assert.ok(result.guidance.includes('Follow the solution package'));
});

// ── String input ────────────────────────────────────────────────────────

test('advance-stage handles string input', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_intake',
    current_owner: 'QuickAgent',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute('quick_brainstorm');

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'quick_brainstorm');
});

// ── Tool metadata ───────────────────────────────────────────────────────

test('advance-stage tool has correct id', () => {
  const tool = createAdvanceStageTool({ workflowKernel: null });
  assert.equal(tool.id, 'tool.advance-stage');
  assert.equal(tool.family, 'workflow');
});
