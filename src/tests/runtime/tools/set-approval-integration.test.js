// tests/runtime/tools/set-approval-integration.test.js
//
// Integration tests for set-approval tool — verifies gate state persists to disk.
// These tests wire a real WorkflowStateManager so we can confirm that after
// a successful tool.execute() call the gate is actually written to disk and
// not just returned in-memory.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createSetApprovalTool } from '../../../runtime/tools/workflow/set-approval.js';
import { WorkflowStateManager } from '../../../runtime/state/workflow-state-manager.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'set-approval-int-'));
}

/**
 * Build a kernel-like object backed by a real WorkflowStateManager.
 * The kernel needs:
 *   • setApproval() — delegates to stateManager
 */
function createRealKernel(stateManager) {
  return {
    setApproval(gateName, approved, approver, metadata) {
      return stateManager.setApproval(gateName, approved, approver, metadata);
    },
  };
}

function readStateFromDisk(baseDir) {
  const mirrorPath = path.join(baseDir, 'workflow-state.json');
  if (!fs.existsSync(mirrorPath)) return null;
  return JSON.parse(fs.readFileSync(mirrorPath, 'utf-8'));
}

// ── Gate approval persistence ─────────────────────────────────────────────────

test('set-approval persists gate to disk after successful call', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-001', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    const result = tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'user',
    });

    assert.equal(result.status, 'ok', `Expected ok but got: ${JSON.stringify(result)}`);
    assert.equal(result.gateName, 'quick.understanding_confirmed');
    assert.equal(result.approved, true);

    // Confirm disk reflects the gate
    const onDisk = readStateFromDisk(tmpDir);
    assert.ok(onDisk, 'workflow-state.json must exist after set-approval');
    assert.equal(onDisk.gates['quick.understanding_confirmed'], true, `Gate should be true on disk, got: ${onDisk.gates['quick.understanding_confirmed']}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('set-approval disk state matches in-memory state after gate approval', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-002', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'user',
    });

    // In-memory state should reflect gate
    const inMemory = stateManager.getState();
    assert.equal(inMemory.gates['quick.understanding_confirmed'], true);

    // Disk must match in-memory
    const onDisk = readStateFromDisk(tmpDir);
    assert.deepEqual(onDisk.gates, inMemory.gates);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('set-approval persists state so a fresh read returns the gate', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-003', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'user',
    });

    // Simulate a "fresh read" by creating a NEW manager pointing at the same files
    const freshManager = new WorkflowStateManager({ workItemId: 'sa-003', baseDir: tmpDir });
    const freshState = freshManager.getState();

    assert.equal(
      freshState.gates['quick.understanding_confirmed'],
      true,
      `Fresh read should see gate as true. Got: ${freshState.gates['quick.understanding_confirmed']}`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Error handling — unknown gate ─────────────────────────────────────────────

test('set-approval returns error for unknown gate name', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-004', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    const result = tool.execute({
      gateName: 'nonexistent.gate',
      approved: true,
      approver: 'user',
    });

    assert.equal(result.status, 'error');
    assert.ok(
      result.reason.includes('nonexistent.gate') || result.reason.toLowerCase().includes('unknown'),
      `Expected reason to mention the gate, got: ${result.reason}`
    );

    // No gate should be set on disk
    const onDisk = readStateFromDisk(tmpDir);
    assert.ok(!onDisk?.gates?.['nonexistent.gate'], 'Unknown gate should not be stored');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('set-approval accepts canonical quick gate and role names from workflow docs', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-docs', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    const result = tool.execute({
      gateName: 'quick_verified',
      approved: true,
      approver: 'QuickAgent',
    });

    assert.equal(result.status, 'ok', `Expected ok but got: ${JSON.stringify(result)}`);
    assert.equal(result.gateName, 'quick.verified');
    const onDisk = readStateFromDisk(tmpDir);
    assert.equal(onDisk.gates['quick.verified'], true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Error handling — authority violation ──────────────────────────────────────

test('set-approval returns error when approver lacks authority for gate', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-005', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    // 'quick.understanding_confirmed' requires authority 'user', not 'qa-agent'
    const result = tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'qa-agent',
    });

    assert.equal(result.status, 'error');
    assert.ok(
      result.reason.includes('authority') || result.reason.includes('caller') || result.reason.includes('qa-agent'),
      `Expected reason to mention authority issue, got: ${result.reason}`
    );

    // Gate should not be persisted on failed authority check
    const onDisk = readStateFromDisk(tmpDir);
    assert.ok(!onDisk?.gates?.['quick.understanding_confirmed'], 'Gate should not be set when authority check fails');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Multiple gates ────────────────────────────────────────────────────────────

test('set-approval can set multiple gates independently', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-006', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    const r1 = tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'user',
    });
    assert.equal(r1.status, 'ok');

    const r2 = tool.execute({
      gateName: 'quick.verified',
      approved: true,
      approver: 'quick-agent',
    });
    assert.equal(r2.status, 'ok');

    const onDisk = readStateFromDisk(tmpDir);
    assert.equal(onDisk.gates['quick.understanding_confirmed'], true);
    assert.equal(onDisk.gates['quick.verified'], true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Gate revocation ───────────────────────────────────────────────────────────

test('set-approval can revoke a previously approved gate (approved: false)', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-007', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    // First approve the gate
    tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'user',
    });

    // Then revoke it
    const revokeResult = tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: false,
      approver: 'user',
    });

    assert.equal(revokeResult.status, 'ok');
    assert.equal(revokeResult.approved, false);

    const onDisk = readStateFromDisk(tmpDir);
    assert.equal(onDisk.gates['quick.understanding_confirmed'], false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Gate enables WorkflowStateManager.advanceStage ───────────────────────────

test('gate set via tool.set-approval enables stateManager.advanceStage to pass gate check', () => {
  // This test verifies that gate state written by set-approval is correctly
  // consumed by WorkflowStateManager.advanceStage (the new gate-enforcement path).
  // Note: the legacy advance-stage tool uses a separate checkGateRequirements
  // mechanism with legacy gate key names; that bridge is a separate concern.
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'sa-008', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'QuickAgent' });

    // quick_intake → quick_plan has no gate: advance directly to quick_plan
    stateManager.advanceStage('quick_plan', 'QuickAgent');

    const kernel = createRealKernel(stateManager);
    const tool = createSetApprovalTool({ workflowKernel: kernel });

    // quick_plan → quick_implement requires understanding_confirmed gate
    // Without the gate, stateManager.advanceStage to quick_implement should throw
    assert.throws(
      () => stateManager.advanceStage('quick_implement', 'QuickAgent'),
      (err) => err.name === 'GateNotMetError' || err.message.includes('gate'),
      'Expected GateNotMetError before gate is set'
    );

    // Set the gate via tool.set-approval
    const gateResult = tool.execute({
      gateName: 'quick.understanding_confirmed',
      approved: true,
      approver: 'user',
    });
    assert.equal(gateResult.status, 'ok');

    // Now stateManager.advanceStage should succeed
    const newState = stateManager.advanceStage('quick_implement', 'QuickAgent');
    assert.equal(newState.stage, 'quick_implement', `Expected stage to be quick_implement, got: ${newState.stage}`);

    // Disk should reflect the advanced stage
    const onDisk = readStateFromDisk(tmpDir);
    assert.equal(onDisk.stage, 'quick_implement');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
