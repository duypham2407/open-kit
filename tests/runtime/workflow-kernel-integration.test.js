// tests/runtime/workflow-kernel-integration.test.js
//
// Integration tests for workflow-kernel.js WorkflowStateManager delegation.
// Verifies that the kernel adapter exposes the new state management methods
// and delegates correctly to WorkflowStateManager.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createWorkflowKernelAdapter } from '../../src/runtime/workflow-kernel.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wk-integration-'));
}

/**
 * Create a kernel adapter wired to a real WorkflowStateManager.
 * The stateManager option injects a pre-built manager for testing.
 */
function createTestKernel(stateManager) {
  const tmpDir = makeTempDir();
  return {
    tmpDir,
    kernel: createWorkflowKernelAdapter({
      projectRoot: tmpDir,
      stateManager,
    }),
  };
}

// ── Unavailable kernel stubs ─────────────────────────────────────────────────

// When no stateManager is injected, the new methods return null even on an available kernel.
// This tests the graceful degradation path.

test('kernel without stateManager returns null for advanceStage', () => {
  const tmpDir = makeTempDir();
  const kernel = createWorkflowKernelAdapter({ projectRoot: tmpDir });
  assert.equal(kernel.advanceStage('quick_plan', 'QuickAgent'), null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('kernel without stateManager returns null for setApproval', () => {
  const tmpDir = makeTempDir();
  const kernel = createWorkflowKernelAdapter({ projectRoot: tmpDir });
  assert.equal(kernel.setApproval('some.gate', true, 'QuickAgent'), null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('kernel without stateManager returns null for getState', () => {
  const tmpDir = makeTempDir();
  const kernel = createWorkflowKernelAdapter({ projectRoot: tmpDir });
  assert.equal(kernel.getState(), null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('kernel without stateManager returns null for recordIssue', () => {
  const tmpDir = makeTempDir();
  const kernel = createWorkflowKernelAdapter({ projectRoot: tmpDir });
  assert.equal(kernel.recordIssue({ id: 'issue-1' }), null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('kernel without stateManager returns null for resolveIssue', () => {
  const tmpDir = makeTempDir();
  const kernel = createWorkflowKernelAdapter({ projectRoot: tmpDir });
  assert.equal(kernel.resolveIssue('issue-1', 'fixed'), null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('kernel without stateManager returns null for recordEvidence', () => {
  const tmpDir = makeTempDir();
  const kernel = createWorkflowKernelAdapter({ projectRoot: tmpDir });
  assert.equal(kernel.recordEvidence({ type: 'test' }), null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Delegation with injected manager ─────────────────────────────────────────

test('advanceStage delegates to stateManager.advanceStage', () => {
  const calls = [];
  const mockManager = {
    advanceStage(targetStage, newOwner, metadata) {
      calls.push({ method: 'advanceStage', targetStage, newOwner, metadata });
      return { stage: targetStage, owner: newOwner };
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  const result = kernel.advanceStage('quick_plan', 'QuickAgent', { note: 'test' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'advanceStage');
  assert.equal(calls[0].targetStage, 'quick_plan');
  assert.equal(calls[0].newOwner, 'QuickAgent');
  assert.deepEqual(calls[0].metadata, { note: 'test' });
  assert.equal(result.stage, 'quick_plan');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('setApproval delegates to stateManager.setApproval', () => {
  const calls = [];
  const mockManager = {
    setApproval(gateName, approved, approver, metadata) {
      calls.push({ method: 'setApproval', gateName, approved, approver, metadata });
      return { gates: { [gateName]: approved } };
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  const result = kernel.setApproval('quick.understanding_confirmed', true, 'QuickAgent', { note: 'ok' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].gateName, 'quick.understanding_confirmed');
  assert.equal(calls[0].approved, true);
  assert.equal(calls[0].approver, 'QuickAgent');
  assert.ok(result.gates);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('getState delegates to stateManager.getState', () => {
  const calls = [];
  const mockState = { stage: 'quick_plan', mode: 'quick' };
  const mockManager = {
    getState() {
      calls.push({ method: 'getState' });
      return mockState;
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  const result = kernel.getState();

  assert.equal(calls.length, 1);
  assert.deepEqual(result, mockState);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('recordIssue delegates to stateManager.recordIssue', () => {
  const calls = [];
  const mockManager = {
    recordIssue(issue) {
      calls.push({ method: 'recordIssue', issue });
      return { issues: [issue] };
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  const issue = { id: 'issue-1', description: 'something is wrong' };
  const result = kernel.recordIssue(issue);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].issue, issue);
  assert.ok(result.issues);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('resolveIssue delegates to stateManager.resolveIssue', () => {
  const calls = [];
  const mockManager = {
    resolveIssue(issueId, resolution) {
      calls.push({ method: 'resolveIssue', issueId, resolution });
      return { issues: [{ id: issueId, resolved: true }] };
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  const result = kernel.resolveIssue('issue-1', 'fixed it');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].issueId, 'issue-1');
  assert.equal(calls[0].resolution, 'fixed it');
  assert.ok(result.issues);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('recordEvidence delegates to stateManager.recordEvidence', () => {
  const calls = [];
  const mockManager = {
    recordEvidence(evidence) {
      calls.push({ method: 'recordEvidence', evidence });
      return { evidence: [evidence] };
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  const evidence = { type: 'test_run', result: 'passed' };
  const result = kernel.recordEvidence(evidence);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].evidence, evidence);
  assert.ok(result.evidence);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Backward compatibility: recordVerificationEvidence ───────────────────────

test('recordVerificationEvidence is still available on the kernel with stateManager', () => {
  const mockManager = {
    advanceStage() { return null; },
    setApproval() { return null; },
    getState() { return null; },
    recordIssue() { return null; },
    resolveIssue() { return null; },
    recordEvidence() { return null; },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  assert.equal(typeof kernel.recordVerificationEvidence, 'function');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Kernel exposes new methods on the returned object ─────────────────────────

test('available kernel exposes all new delegation methods', () => {
  const mockManager = {
    advanceStage() { return {}; },
    setApproval() { return {}; },
    getState() { return {}; },
    recordIssue() { return {}; },
    resolveIssue() { return {}; },
    recordEvidence() { return {}; },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);

  assert.equal(typeof kernel.advanceStage, 'function');
  assert.equal(typeof kernel.setApproval, 'function');
  assert.equal(typeof kernel.getState, 'function');
  assert.equal(typeof kernel.recordIssue, 'function');
  assert.equal(typeof kernel.resolveIssue, 'function');
  assert.equal(typeof kernel.recordEvidence, 'function');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Error propagation ─────────────────────────────────────────────────────────

test('advanceStage propagates errors from stateManager', () => {
  const mockManager = {
    advanceStage() {
      throw new Error('Invalid transition');
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  assert.throws(() => kernel.advanceStage('bad_stage', 'Agent'), /Invalid transition/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('setApproval propagates errors from stateManager', () => {
  const mockManager = {
    setApproval() {
      throw new Error('Unknown gate');
    },
  };

  const { kernel, tmpDir } = createTestKernel(mockManager);
  assert.throws(() => kernel.setApproval('bad.gate', true, 'Agent'), /Unknown gate/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
