import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createWorkflowKernelAdapter } from '../../runtime/workflow-kernel.js';

// Use the real project root so the controller's src/ imports resolve correctly.
// Tests that need an isolated state file override via OPENKIT_WORKFLOW_STATE.
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

function makeTempStatePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-fresh-'));
  const statePath = path.join(dir, '.opencode', 'workflow-state.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  return statePath;
}

test('kernel showState returns null gracefully on fresh project (no state file)', () => {
  const tempStatePath = makeTempStatePath();
  // Create a kernel pointing at the real project (so controller loads), but
  // with a temp state path via OPENKIT_WORKFLOW_STATE that doesn't exist yet.
  const kernel = createWorkflowKernelAdapter({
    projectRoot: PROJECT_ROOT,
    env: { ...process.env, OPENKIT_WORKFLOW_STATE: tempStatePath },
  });

  // showState should return null (not throw) when file doesn't exist
  const state = kernel.showState();
  assert.equal(state, null, 'showState should return null when no state file exists');
});

test('kernel.bootstrapWorkflow creates state on fresh project', () => {
  const tempStatePath = makeTempStatePath();
  const kernel = createWorkflowKernelAdapter({
    projectRoot: PROJECT_ROOT,
    env: { ...process.env, OPENKIT_WORKFLOW_STATE: tempStatePath },
  });

  // Bootstrap should work even when the state file doesn't exist yet
  const result = kernel.bootstrapWorkflow({
    lane: 'quick',
    description: 'bootstrap fresh project test',
  });

  assert.equal(result.status, 'created');
  assert.ok(fs.existsSync(tempStatePath), 'state file should be created by bootstrap');
  const state = JSON.parse(fs.readFileSync(tempStatePath, 'utf8'));
  assert.equal(state.mode, 'quick');
  assert.equal(state.current_stage, 'quick_intake');
  assert.equal(state.intake_payload?.description, 'bootstrap fresh project test');
});

test('kernel.canWriteState is false before bootstrap, true after', () => {
  const tempStatePath = makeTempStatePath();
  const kernel = createWorkflowKernelAdapter({
    projectRoot: PROJECT_ROOT,
    env: { ...process.env, OPENKIT_WORKFLOW_STATE: tempStatePath },
  });

  // canWriteState is exposed for callers that need to short-circuit before
  // attempting a write. Pre-bootstrap: returns false because the state file
  // does not exist yet. Post-bootstrap: returns true because the file is
  // present. bootstrapWorkflow itself bypasses this guard and goes directly
  // to the controller, so it can run even when canWriteState is false.
  assert.equal(typeof kernel.canWriteState, 'function', 'canWriteState should be exposed');
  assert.equal(kernel.canWriteState(), false, 'canWriteState should be false before bootstrap');

  kernel.bootstrapWorkflow({ lane: 'quick', description: 'canWriteState test' });
  assert.equal(kernel.canWriteState(), true, 'canWriteState should be true after bootstrap');
});

test('kernel.canReadState is false before bootstrap, true after', () => {
  const tempStatePath = makeTempStatePath();
  const kernel = createWorkflowKernelAdapter({
    projectRoot: PROJECT_ROOT,
    env: { ...process.env, OPENKIT_WORKFLOW_STATE: tempStatePath },
  });

  // Before bootstrap: state file doesn't exist, so canReadState = false
  // (canReadState is internal, but showState returning null implies it's false)
  assert.equal(kernel.showState(), null, 'showState should return null before bootstrap');

  // After bootstrap: state file exists, showState should return the state
  kernel.bootstrapWorkflow({ lane: 'full', description: 'test' });
  const afterState = kernel.showState();
  assert.notEqual(afterState, null, 'showState should return state after bootstrap');
  assert.equal(afterState?.state?.mode ?? afterState?.mode, 'full');
});
