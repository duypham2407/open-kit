// tests/runtime/tools/advance-stage-integration.test.js
//
// Integration tests for advance-stage tool — verifies state persists to disk.
// These tests wire a real WorkflowStateManager so we can confirm that after
// a successful tool.execute() call the stage is actually written to disk and
// not just returned in-memory.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createAdvanceStageTool } from '../../../runtime/tools/workflow/advance-stage.js';
import { WorkflowStateManager } from '../../../runtime/state/workflow-state-manager.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'advance-stage-int-'));
}

/**
 * Build a kernel-like object backed by a real WorkflowStateManager.
 * The kernel needs:
 *   • showState()       — reads current state (used by advance-stage to get currentStage)
 *   • advanceStage()    — delegates to stateManager (the new path)
 *   • recordVerificationEvidence() — still called for audit (legacy path, can be a no-op)
 */
function createRealKernel(stateManager) {
  return {
    showState() {
      try {
        const s = stateManager.getState();
        // Translate v2 state shape → legacy shape the tool expects
        return {
          state: {
            mode: s.mode,
            current_stage: s.stage,
            current_owner: s.owner,
            gates: s.gates || {},
            verification_evidence: [],
          },
        };
      } catch {
        return null;
      }
    },
    advanceStage(targetStage, newOwner, metadata) {
      return stateManager.advanceStage(targetStage, newOwner, metadata);
    },
    setApproval(gateName, approved, approver, metadata) {
      return stateManager.setApproval(gateName, approved, approver, metadata);
    },
    recordVerificationEvidence() {
      // no-op for integration tests; audit log tested separately
    },
  };
}

function readStateFromDisk(baseDir) {
  const mirrorPath = path.join(baseDir, 'workflow-state.json');
  if (!fs.existsSync(mirrorPath)) return null;
  return JSON.parse(fs.readFileSync(mirrorPath, 'utf-8'));
}

// ── Root Cause #1: state must persist to disk ─────────────────────────────────

test('advance-stage persists new stage to disk after successful transition', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-001', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'MasterOrchestrator' });

    const kernel = createRealKernel(stateManager);
    const tool = createAdvanceStageTool({ workflowKernel: kernel });

    const result = tool.execute({
      targetStage: 'quick_plan',
      evidence: { understanding_confirmed: true },
    });

    assert.equal(result.status, 'ok', `Expected ok but got: ${JSON.stringify(result)}`);
    assert.equal(result.newStage, 'quick_plan');

    // Confirm disk reflects the new stage
    const onDisk = readStateFromDisk(tmpDir);
    assert.ok(onDisk, 'workflow-state.json must exist after advance');
    assert.equal(onDisk.stage, 'quick_plan', `Disk stage should be 'quick_plan', got '${onDisk.stage}'`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('advance-stage disk state matches in-memory state after transition', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-002', baseDir: tmpDir });
    stateManager.initialize({ mode: 'full', owner: 'MasterOrchestrator' });

    const kernel = createRealKernel(stateManager);
    const tool = createAdvanceStageTool({ workflowKernel: kernel });

    const result = tool.execute({ targetStage: 'full_product' });

    assert.equal(result.status, 'ok');

    // In-memory state manager should also reflect the new stage
    const inMemory = stateManager.getState();
    assert.equal(inMemory.stage, 'full_product');
    assert.equal(inMemory.owner, 'ProductLead');

    // Disk must match in-memory
    const onDisk = readStateFromDisk(tmpDir);
    assert.equal(onDisk.stage, inMemory.stage);
    assert.equal(onDisk.owner, inMemory.owner);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('advance-stage persists state so a second read returns the new stage', () => {
  // This is the exact bug described in the design spec:
  // "Next read returns old stage → agent restarts from beginning"
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-003', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'MasterOrchestrator' });

    const kernel = createRealKernel(stateManager);
    const tool = createAdvanceStageTool({ workflowKernel: kernel });

    tool.execute({
      targetStage: 'quick_plan',
      evidence: { understanding_confirmed: true },
    });

    // Simulate a "fresh read" by creating a NEW manager pointing at the same files
    const freshManager = new WorkflowStateManager({ workItemId: 'wi-003', baseDir: tmpDir });
    const freshState = freshManager.getState();

    assert.equal(
      freshState.stage,
      'quick_plan',
      `Fresh read should see 'quick_plan' not 'quick_intake'. Got: '${freshState.stage}'`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('advance-stage persists owner change to disk', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-004', baseDir: tmpDir });
    stateManager.initialize({ mode: 'full', owner: 'MasterOrchestrator' });

    const kernel = createRealKernel(stateManager);
    const tool = createAdvanceStageTool({ workflowKernel: kernel });

    const result = tool.execute({ targetStage: 'full_product' });

    assert.equal(result.status, 'ok');
    assert.equal(result.newOwner, 'ProductLead');

    const onDisk = readStateFromDisk(tmpDir);
    assert.equal(onDisk.owner, 'ProductLead');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('advance-stage returns error status when stateManager.advanceStage throws', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-005', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'MasterOrchestrator' });

    // Corrupt the kernel so advanceStage always throws
    const kernel = {
      showState() {
        return {
          state: {
            mode: 'quick',
            current_stage: 'quick_intake',
            current_owner: 'MasterOrchestrator',
            gates: {},
            verification_evidence: [],
          },
        };
      },
      advanceStage() {
        throw new Error('Simulated disk write failure');
      },
      recordVerificationEvidence() {},
    };

    const tool = createAdvanceStageTool({ workflowKernel: kernel });
    // quick_intake → quick_plan requires understanding_confirmed; use gateOverrides to bypass
    const result = tool.execute({
      targetStage: 'quick_plan',
      gateOverrides: { understanding_confirmed: true },
    });

    assert.equal(result.status, 'error');
    assert.ok(
      result.reason.includes('Simulated disk write failure') ||
      result.reason.toLowerCase().includes('failed'),
      `Error reason should mention the failure: ${result.reason}`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('advance-stage returns error when kernel has no stateManager (null advanceStage return)', () => {
  const tmpDir = makeTempDir();
  try {
    // Kernel without a stateManager — advanceStage returns null
    const kernel = {
      showState() {
        return {
          state: {
            mode: 'quick',
            current_stage: 'quick_intake',
            current_owner: 'MasterOrchestrator',
            gates: {},
            verification_evidence: [],
          },
        };
      },
      advanceStage() {
        return null; // stateManager not injected
      },
      recordVerificationEvidence() {},
    };

    const tool = createAdvanceStageTool({ workflowKernel: kernel });
    const result = tool.execute({
      targetStage: 'quick_plan',
      gateOverrides: { understanding_confirmed: true },
    });

    // With no stateManager, the tool must report failure — it must NOT silently
    // return { status: 'ok' } while nothing was persisted to disk.
    assert.equal(result.status, 'error');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('advance-stage multiple transitions each persist to disk', () => {
  const tmpDir = makeTempDir();
  try {
    const stateManager = new WorkflowStateManager({ workItemId: 'wi-006', baseDir: tmpDir });
    stateManager.initialize({ mode: 'quick', owner: 'MasterOrchestrator' });

    const kernel = createRealKernel(stateManager);
    const tool = createAdvanceStageTool({ workflowKernel: kernel });

    // First transition: quick_intake → quick_plan (needs understanding_confirmed)
    const r1 = tool.execute({
      targetStage: 'quick_plan',
      evidence: { understanding_confirmed: true },
    });
    assert.equal(r1.status, 'ok');
    assert.equal(readStateFromDisk(tmpDir).stage, 'quick_plan');

    // Second transition: quick_plan → quick_implement (needs plan_confirmed gate)
    const r2 = tool.execute({
      targetStage: 'quick_implement',
      evidence: { plan_confirmed: true },
    });
    assert.equal(r2.status, 'ok');
    assert.equal(readStateFromDisk(tmpDir).stage, 'quick_implement');

    // Third transition: quick_implement → quick_test (no gate)
    const r3 = tool.execute({ targetStage: 'quick_test' });
    assert.equal(r3.status, 'ok');
    assert.equal(readStateFromDisk(tmpDir).stage, 'quick_test');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
