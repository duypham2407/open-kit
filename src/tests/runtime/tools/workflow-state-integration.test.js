// tests/runtime/tools/workflow-state-integration.test.js
//
// Integration tests for the workflow-state tool — verifies read-only access
// to state persisted on disk via a real WorkflowStateManager.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createWorkflowStateTool } from '../../../runtime/tools/workflow/workflow-state.js';
import { WorkflowStateManager } from '../../../runtime/state/workflow-state-manager.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-state-int-'));
}

/**
 * Build a kernel-like object backed by a real WorkflowStateManager.
 * The kernel exposes only getState() and getWorkItem() — matching the
 * read-only contract of the workflow-state tool.
 */
function createRealKernel(stateManager) {
  return {
    getState() {
      return stateManager.getState();
    },
    getWorkItem(workItemId) {
      return stateManager.getWorkItem(workItemId);
    },
  };
}

// ── Current state reads ───────────────────────────────────────────────────────

test('workflow-state returns initialized state via real WorkflowStateManager', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'ws-001', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    const result = tool.execute();

    assert.ok(result, 'Result should not be null');
    assert.equal(result.mode, 'quick', `Expected mode 'quick', got '${result.mode}'`);
    assert.equal(result.stage, 'quick_intake', `Expected stage 'quick_intake', got '${result.stage}'`);
    assert.equal(result.owner, 'QuickAgent', `Expected owner 'QuickAgent', got '${result.owner}'`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('workflow-state reflects stage after advance via real WorkflowStateManager', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'ws-002', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });
    // Set gate before advancing (quick_intake → quick_plan requires understanding_confirmed)
    stateManager.setApproval('quick.understanding_confirmed', true, 'user', {});
    stateManager.advanceStage('quick_plan', 'QuickAgent');

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    const result = tool.execute({});

    assert.ok(result, 'Result should not be null');
    assert.equal(result.stage, 'quick_plan');
    assert.equal(result.owner, 'QuickAgent');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('workflow-state reflects gate state after setApproval via real WorkflowStateManager', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'ws-003', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });
    stateManager.setApproval('quick.understanding_confirmed', true, 'user', {});

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    const result = tool.execute();

    assert.ok(result, 'Result should not be null');
    assert.equal(
      result.gates['quick.understanding_confirmed'],
      true,
      'Gate should be true in returned state'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('workflow-state returns state matching what is on disk', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'ws-004', baseDir: tmpDir });
    stateManager.initialize({ mode: 'full', owner: 'MasterOrchestrator' });
    stateManager.advanceStage('full_product', 'ProductLead');

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    const result = tool.execute();

    // Read mirror file from disk for comparison
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'workflow-state.json'), 'utf-8')
    );

    assert.equal(result.stage, onDisk.stage);
    assert.equal(result.owner, onDisk.owner);
    assert.equal(result.mode, onDisk.mode);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Work item queries ─────────────────────────────────────────────────────────

test('workflow-state returns correct state for specific workItemId', () => {
  const tmpDir = makeTempDir();
  try {
    // Create two work items
    const sm1 = new WorkflowStateManager({ workItemId: 'wi-alpha', baseDir: tmpDir });
    sm1.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const sm2 = new WorkflowStateManager({ workItemId: 'wi-beta', baseDir: tmpDir });
    sm2.initialize({ mode: 'full', owner: 'MasterOrchestrator' });

    // Use sm1 as the "current" kernel backing
    const kernel = createRealKernel(sm1);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    // Query the other work item
    const result = tool.execute({ workItemId: 'wi-beta' });

    assert.ok(result, 'Result should not be null');
    assert.equal(result.mode, 'full', `Expected mode 'full', got '${result.mode}'`);
    assert.equal(result.stage, 'full_intake', `Expected stage 'full_intake', got '${result.stage}'`);
    assert.equal(result.owner, 'MasterOrchestrator');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('workflow-state returns error for non-existent workItemId', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-exists', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    const result = tool.execute({ workItemId: 'wi-does-not-exist' });

    assert.equal(result.status, 'error');
    assert.ok(
      result.reason.includes('wi-does-not-exist') || result.reason.toLowerCase().includes('not found'),
      `Expected reason to mention the missing item, got: ${result.reason}`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('workflow-state with workItemId does not mutate state', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-immutable', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    const result = tool.execute({ workItemId: 'wi-immutable' });
    assert.ok(result, 'Should return state');

    // Attempting to mutate the returned object should not affect the manager
    if (result && typeof result === 'object') {
      result.stage = 'MUTATED';
    }

    const freshState = stateManager.getState();
    assert.equal(freshState.stage, 'quick_intake', 'Internal state should not be mutated by callers');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Read-only — tool.execute makes no writes ──────────────────────────────────

test('workflow-state execute does not change state on disk', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'ws-ro', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const mirrorPath = path.join(tmpDir, 'workflow-state.json');
    const statBefore = fs.statSync(mirrorPath);

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    // Execute multiple times
    tool.execute();
    tool.execute({});
    tool.execute({ workItemId: 'ws-ro' });

    const statAfter = fs.statSync(mirrorPath);

    // mtime should be unchanged — no writes occurred
    assert.equal(
      statBefore.mtimeMs,
      statAfter.mtimeMs,
      'workflow-state tool must not write to disk'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Full workflow — read at each stage ────────────────────────────────────────

test('workflow-state accurately reflects state through full quick workflow', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'ws-full', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createWorkflowStateTool({ workflowKernel: kernel });

    // Stage 1: quick_intake (initial)
    let state = tool.execute();
    assert.equal(state.stage, 'quick_intake');

    // Set gate and advance to quick_plan (quick_intake → quick_plan requires understanding_confirmed)
    stateManager.setApproval('quick.understanding_confirmed', true, 'user', {});
    stateManager.advanceStage('quick_plan', 'QuickAgent');
    state = tool.execute();
    assert.equal(state.stage, 'quick_plan');
    assert.equal(state.gates['quick.understanding_confirmed'], true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
