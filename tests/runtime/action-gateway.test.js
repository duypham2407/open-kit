import test from 'node:test';
import assert from 'node:assert/strict';

import { createActionGatewayTool } from '../../src/runtime/tools/workflow/action-gateway.js';

function createMockKernel(state) {
  return {
    showState() {
      return { state };
    },
  };
}

// ── No workflow state ───────────────────────────────────────────────────

test('check-action allows when no workflow state', () => {
  const tool = createActionGatewayTool({ workflowKernel: null });
  const result = tool.execute({ action: 'edit_code' });
  assert.equal(result.allowed, true);
});

// ── Missing action ──────────────────────────────────────────────────────

test('check-action errors when action is missing', () => {
  const tool = createActionGatewayTool({ workflowKernel: null });
  const result = tool.execute({});
  assert.equal(result.status, 'error');
  assert.ok(result.knownActions);
});

// ── MasterOrchestrator blocked actions ──────────────────────────────────

test('check-action blocks edit_code for MasterOrchestrator', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'edit_code' });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 'blocked');
  assert.ok(result.suggestedApproach);
  assert.ok(result.blockedTools.length > 0);
});

test('check-action blocks run_bash for MasterOrchestrator', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'run_bash' });
  assert.equal(result.allowed, false);
});

test('check-action blocks run_tests for MasterOrchestrator', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'run_tests' });
  assert.equal(result.allowed, false);
});

// ── MasterOrchestrator allowed actions ──────────────────────────────────

test('check-action allows advance_stage for MasterOrchestrator', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'advance_stage' });
  assert.equal(result.allowed, true);
  assert.equal(result.status, 'ok');
});

// ── FullstackAgent ──────────────────────────────────────────────────────

test('check-action allows edit_code for FullstackAgent', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'FullstackAgent',
      current_stage: 'full_implementation',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'edit_code' });
  assert.equal(result.allowed, true);
});

test('check-action allows run_bash for FullstackAgent', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'FullstackAgent',
      current_stage: 'full_implementation',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'run_bash' });
  assert.equal(result.allowed, true);
});

// ── CodeReviewer ────────────────────────────────────────────────────────

test('check-action allows code_review for CodeReviewer', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'CodeReviewer',
      current_stage: 'full_code_review',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'code_review' });
  assert.equal(result.allowed, true);
});

test('check-action blocks edit_code for CodeReviewer', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'CodeReviewer',
      current_stage: 'full_code_review',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'edit_code' });
  assert.equal(result.allowed, false);
});

// ── Unknown action ──────────────────────────────────────────────────────

test('check-action is permissive for unknown actions', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'unknown_action' });
  assert.equal(result.allowed, true);
  assert.ok(result.knownActions);
});

// ── Response structure ──────────────────────────────────────────────────

test('blocked response includes allowedActions list', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'edit_code' });
  assert.ok(Array.isArray(result.allowedActions));
  assert.ok(result.allowedActions.includes('advance_stage'));
  assert.ok(Array.isArray(result.validNextStages));
});

test('allowed response includes action and tool info', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'FullstackAgent',
      current_stage: 'full_implementation',
      mode: 'full',
    }),
  });

  const result = tool.execute({ action: 'edit_code', description: 'fix a bug' });
  assert.equal(result.action, 'edit_code');
  assert.equal(result.description, 'fix a bug');
  assert.ok(Array.isArray(result.allowedTools));
});

// ── String input ────────────────────────────────────────────────────────

test('check-action handles string input', () => {
  const tool = createActionGatewayTool({
    workflowKernel: createMockKernel({
      current_owner: 'FullstackAgent',
      current_stage: 'full_implementation',
      mode: 'full',
    }),
  });

  const result = tool.execute('edit_code');
  assert.equal(result.allowed, true);
});
