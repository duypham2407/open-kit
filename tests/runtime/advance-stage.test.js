import test from 'node:test';
import assert from 'node:assert/strict';

import { createAdvanceStageTool } from '../../src/runtime/tools/workflow/advance-stage.js';

function createMockKernel(state) {
  const evidenceLog = [];
  const advanceLog = [];
  // Mutable ref so tests that rely on the same kernel instance can observe
  // state updates made via advanceStage (mirrors what WorkflowStateManager does).
  let currentStage = state?.current_stage ?? null;
  let currentOwner = state?.current_owner ?? null;

  return {
    showState() {
      return { state: { ...state, current_stage: currentStage, current_owner: currentOwner } };
    },
    advanceStage(targetStage, newOwner, metadata) {
      advanceLog.push({ targetStage, newOwner, metadata });
      currentStage = targetStage;
      currentOwner = newOwner;
      return { stage: targetStage, owner: newOwner };
    },
    setApproval() {
      // no-op in unit tests — gate pre-setting is tested in the integration suite
      return {};
    },
    recordVerificationEvidence(entry) {
      evidenceLog.push(entry);
    },
    _evidenceLog: evidenceLog,
    _advanceLog: advanceLog,
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

test('advance-stage surfaces structured workflow state errors', () => {
  const error = { reason: 'controller_exception', code: 'ERR_BAD_STATE', message: 'bad workflow json' };
  const tool = createAdvanceStageTool({
    workflowKernel: { showState: () => ({ statePath: null, state: null, error }) },
  });

  const result = tool.execute({ targetStage: 'quick_plan' });

  assert.equal(result.status, 'error');
  assert.match(result.reason, /Workflow state unavailable/);
  assert.deepEqual(result.workflowStateError, error);
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

test('advance-stage blocks invalid transition: quick intake → implement (skips plan)', () => {
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({
      mode: 'quick',
      current_stage: 'quick_intake',
      current_owner: 'MasterOrchestrator',
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

test('advance-stage blocks transition to quick_brainstorm (removed stage)', () => {
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({
      mode: 'quick',
      current_stage: 'quick_intake',
      current_owner: 'MasterOrchestrator',
      verification_evidence: [],
    }),
  });

  const result = tool.execute({ targetStage: 'quick_brainstorm' });
  assert.equal(result.status, 'blocked');
  assert.ok(result.reason.includes('Invalid transition'));
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

test('advance-stage blocks when gate not satisfied: plan → implement without understanding_confirmed', () => {
  // Audit fix [1-H-2]/[1-M-2]: the previous gate at quick_intake→quick_plan
  // was duplicate-defined in two systems and semantically dead in the
  // persistence layer. After the gate-system reform GateRegistry is the
  // single source of truth, and the enforced gate is at
  // quick_plan→quick_implement (id 'quick.understanding_confirmed').
  const tool = createAdvanceStageTool({
    workflowKernel: createMockKernel({
      mode: 'quick',
      current_stage: 'quick_plan',
      current_owner: 'QuickAgent',
      verification_evidence: [],
    }),
  });

  const result = tool.execute({ targetStage: 'quick_implement' });
  assert.equal(result.status, 'blocked');
  assert.ok(result.missingGates);
  assert.ok(result.missingGates.length > 0);
  assert.ok(result.guidance);
});

test('advance-stage passes when gate is satisfied with evidence: plan → implement', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_plan',
    current_owner: 'QuickAgent',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute({
    targetStage: 'quick_implement',
    evidence: { understanding_confirmed: true },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'quick_implement');
  assert.equal(result.newOwner, 'QuickAgent');
});

// ── Successful transitions ──────────────────────────────────────────────

test('advance-stage succeeds: quick intake → plan (with gate satisfied)', () => {
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_intake',
    current_owner: 'MasterOrchestrator',
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

test('advance-stage calls advanceStage on kernel with correct args (persists state)', () => {
  // Root Cause #1 fix: the tool now calls workflowKernel.advanceStage() so that
  // state is persisted to disk via WorkflowStateManager, replacing the old
  // recordVerificationEvidence() call that only wrote an audit log.
  const kernel = createMockKernel({
    mode: 'quick',
    current_stage: 'quick_intake',
    current_owner: 'MasterOrchestrator',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  tool.execute({
    targetStage: 'quick_plan',
    evidence: { understanding_confirmed: true },
  });

  assert.equal(kernel._advanceLog.length, 1);
  assert.equal(kernel._advanceLog[0].targetStage, 'quick_plan');
  assert.equal(kernel._advanceLog[0].newOwner, 'QuickAgent');
  assert.ok(kernel._advanceLog[0].metadata?.transition?.from === 'quick_intake');
  assert.ok(kernel._advanceLog[0].metadata?.transition?.to === 'quick_plan');
});

test('advance-stage includes handoffContext in transition passed to advanceStage', () => {
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

  assert.equal(kernel._advanceLog[0].metadata.transition.handoffContext, 'User wants to add a dark mode feature');
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

test('advance-stage handles string input for valid transition', () => {
  const kernel = createMockKernel({
    mode: 'full',
    current_stage: 'full_intake',
    current_owner: 'MasterOrchestrator',
    verification_evidence: [],
  });

  const tool = createAdvanceStageTool({ workflowKernel: kernel });
  const result = tool.execute('full_product');

  assert.equal(result.status, 'ok');
  assert.equal(result.newStage, 'full_product');
});

// ── Tool metadata ───────────────────────────────────────────────────────

test('advance-stage tool has correct id', () => {
  const tool = createAdvanceStageTool({ workflowKernel: null });
  assert.equal(tool.id, 'tool.advance-stage');
  assert.equal(tool.family, 'workflow');
});
