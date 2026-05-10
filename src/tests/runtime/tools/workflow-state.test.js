// tests/runtime/tools/workflow-state.test.js
//
// Unit tests for the workflow-state tool.
// Uses a mock workflowKernel so no filesystem I/O occurs.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkflowStateTool } from '../../../runtime/tools/workflow/workflow-state.js';

// ── Mock kernel factory ────────────────────────────────────────────────────

function createMockKernel({ state = null, workItems = {}, throwsGetState = null, throwsGetWorkItem = null } = {}) {
  return {
    getState() {
      if (throwsGetState) throw throwsGetState;
      return state;
    },
    getWorkItem(workItemId) {
      if (throwsGetWorkItem) throw throwsGetWorkItem;
      const item = workItems[workItemId];
      if (!item) {
        throw new Error(`State not found for work item '${workItemId}'. Ensure the work item has been initialized.`);
      }
      return item;
    },
  };
}

const MOCK_STATE = {
  version: '2.0.0',
  mode: 'quick',
  stage: 'quick_intake',
  owner: 'QuickAgent',
  gates: {},
  gateMeta: {},
  metadata: { created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z' },
};

// ── Tool metadata ──────────────────────────────────────────────────────────

test('workflow-state tool has correct id', () => {
  const tool = createWorkflowStateTool({ workflowKernel: createMockKernel() });
  assert.equal(tool.id, 'tool.workflow-state');
});

test('workflow-state tool has correct family and stage', () => {
  const tool = createWorkflowStateTool({ workflowKernel: createMockKernel() });
  assert.equal(tool.family, 'workflow');
  assert.equal(tool.stage, 'foundation');
});

test('workflow-state tool has active status', () => {
  const tool = createWorkflowStateTool({ workflowKernel: createMockKernel() });
  assert.equal(tool.status, 'active');
});

// ── Current state queries (no workItemId) ─────────────────────────────────

test('workflow-state returns current state when no input provided', () => {
  const kernel = createMockKernel({ state: MOCK_STATE });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute();

  assert.deepEqual(result, MOCK_STATE);
});

test('workflow-state returns current state when empty object provided', () => {
  const kernel = createMockKernel({ state: MOCK_STATE });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({});

  assert.deepEqual(result, MOCK_STATE);
});

test('workflow-state returns null when kernel returns null state', () => {
  const kernel = createMockKernel({ state: null });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({});

  assert.equal(result, null);
});

test('workflow-state returns error when getState throws', () => {
  const kernel = createMockKernel({ throwsGetState: new Error('No state initialized') });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({});

  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('No state initialized'), `Expected reason to include error message, got: ${result.reason}`);
});

// ── Work item queries (with workItemId) ────────────────────────────────────

test('workflow-state returns work item state when workItemId provided', () => {
  const itemState = { ...MOCK_STATE, stage: 'quick_plan' };
  const kernel = createMockKernel({ workItems: { 'wi-001': itemState } });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ workItemId: 'wi-001' });

  assert.deepEqual(result, itemState);
});

test('workflow-state returns error when workItemId is not found', () => {
  const kernel = createMockKernel({ workItems: {} });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ workItemId: 'wi-nonexistent' });

  assert.equal(result.status, 'error');
  assert.ok(
    result.reason.includes('wi-nonexistent') || result.reason.toLowerCase().includes('not found'),
    `Expected reason to mention work item or not found, got: ${result.reason}`
  );
});

test('workflow-state returns error when workItemId is empty string', () => {
  const kernel = createMockKernel();
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ workItemId: '' });

  assert.equal(result.status, 'error');
  assert.ok(
    result.reason.toLowerCase().includes('workitemid'),
    `Expected reason to mention workItemId, got: ${result.reason}`
  );
});

test('workflow-state returns error when workItemId is whitespace only', () => {
  const kernel = createMockKernel();
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ workItemId: '   ' });

  assert.equal(result.status, 'error');
  assert.ok(
    result.reason.toLowerCase().includes('workitemid'),
    `Expected reason to mention workItemId, got: ${result.reason}`
  );
});

test('workflow-state returns error when getWorkItem throws', () => {
  const kernel = createMockKernel({ throwsGetWorkItem: new Error('Disk read failure') });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ workItemId: 'wi-001' });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('Disk read failure'), `Expected reason to include error message, got: ${result.reason}`);
});

test('workflow-state returns error when getWorkItem throws non-Error', () => {
  const kernel = createMockKernel({ throwsGetWorkItem: 'string error' });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ workItemId: 'wi-001' });

  assert.equal(result.status, 'error');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

// ── Input edge cases ───────────────────────────────────────────────────────

test('workflow-state ignores extra input fields', () => {
  const kernel = createMockKernel({ state: MOCK_STATE });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  const result = tool.execute({ unknownField: 'ignored', anotherField: 123 });

  assert.deepEqual(result, MOCK_STATE);
});

test('workflow-state treats non-object input as empty (uses getState)', () => {
  const kernel = createMockKernel({ state: MOCK_STATE });
  const tool = createWorkflowStateTool({ workflowKernel: kernel });

  // Non-object input (legacy string call) should default to getState()
  const result = tool.execute('status');

  assert.deepEqual(result, MOCK_STATE);
});
