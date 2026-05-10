import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoleGuardHook } from '../../runtime/hooks/tool-guards/role-guard-hook.js';

function createMockKernel(state) {
  return {
    showState() {
      return { state };
    },
  };
}

// ── No workflow state (permissive) ──────────────────────────────────────

test('role guard allows when no workflow kernel', () => {
  const hook = createRoleGuardHook({ workflowKernel: null });
  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, true);
});

test('role guard blocks when workflow state has a structured error', () => {
  const error = { reason: 'controller_exception', code: 'ERR_BAD_STATE', message: 'bad workflow json' };
  const hook = createRoleGuardHook({
    workflowKernel: { showState: () => ({ statePath: null, state: null, error }) },
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });

  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(result.blockedBy, ['workflow-state-error']);
  assert.match(result.reason, /Workflow state unavailable/);
  assert.deepEqual(result.workflowStateError, error);
});

test('role guard allows when no current_owner in state', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({ mode: 'quick', current_stage: 'quick_intake' }),
  });
  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, true);
});

test('role guard allows when no toolId provided', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({ current_owner: 'MasterOrchestrator' }),
  });
  const result = hook.run({});
  assert.equal(result.allowed, true);
});

// ── MasterOrchestrator blocks ───────────────────────────────────────────

test('role guard blocks MasterOrchestrator from hashline-edit', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(result.blockedBy, ['role-permission']);
  assert.ok(result.reason);
  assert.ok(result.guidance);
  assert.equal(result.currentOwner, 'MasterOrchestrator');
});

test('role guard blocks MasterOrchestrator from interactive-bash', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.interactive-bash' });
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

// ── MasterOrchestrator allows ───────────────────────────────────────────

test('role guard allows MasterOrchestrator workflow-state', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.workflow-state' });
  assert.equal(result.allowed, true);
});

test('role guard allows MasterOrchestrator advance-stage', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.advance-stage' });
  assert.equal(result.allowed, true);
});

// ── FullstackAgent allows ───────────────────────────────────────────────

test('role guard allows FullstackAgent hashline-edit', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'FullstackAgent',
      current_stage: 'full_implementation',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, true);
});

test('role guard allows FullstackAgent interactive-bash', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'FullstackAgent',
      current_stage: 'full_implementation',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.interactive-bash' });
  assert.equal(result.allowed, true);
});

// ── CodeReviewer blocks ─────────────────────────────────────────────────

test('role guard blocks CodeReviewer from editing', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'CodeReviewer',
      current_stage: 'full_code_review',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, false);
  assert.ok(result.suggestedOwner);
});

// ── QAAgent ─────────────────────────────────────────────────────────────

test('role guard blocks QAAgent from editing code', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'QAAgent',
      current_stage: 'full_qa',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, false);
});

test('role guard allows QAAgent test-run', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'QAAgent',
      current_stage: 'full_qa',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.test-run' });
  assert.equal(result.allowed, true);
});

// ── Unknown role ────────────────────────────────────────────────────────

test('role guard warns for unknown role but allows', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'UnknownRole',
      current_stage: 'custom_stage',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.equal(result.allowed, true);
  assert.ok(result.warning);
});

// ── Guidance quality ────────────────────────────────────────────────────

test('block response includes actionable guidance with stage hint', () => {
  const hook = createRoleGuardHook({
    workflowKernel: createMockKernel({
      current_owner: 'MasterOrchestrator',
      current_stage: 'full_intake',
      mode: 'full',
    }),
  });

  const result = hook.run({ toolId: 'tool.hashline-edit' });
  assert.ok(result.guidance.includes('MasterOrchestrator'));
  assert.ok(result.guidance.includes('tool.advance-stage'));
});
