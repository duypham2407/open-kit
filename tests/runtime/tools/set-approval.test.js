// tests/runtime/tools/set-approval.test.js
//
// Unit tests for the set-approval tool.
// Uses a mock workflowKernel so no filesystem I/O occurs.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSetApprovalTool } from '../../../src/runtime/tools/workflow/set-approval.js';

// ── Mock kernel factory ────────────────────────────────────────────────────

function createMockKernel({ throws = null } = {}) {
  const calls = [];
  return {
    calls,
    setApproval(gateName, approved, approver, metadata) {
      calls.push({ gateName, approved, approver, metadata });
      if (throws) {
        throw throws;
      }
    },
  };
}

// ── Input validation ───────────────────────────────────────────────────────

test('set-approval returns error when gateName is missing', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({ approved: true, approver: 'user' });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.toLowerCase().includes('gatename'), `Expected reason to mention gateName, got: ${result.reason}`);
  assert.equal(kernel.calls.length, 0);
});

test('set-approval returns error when gateName is not a string', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({ gateName: 42, approved: true, approver: 'user' });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.toLowerCase().includes('gatename'));
  assert.equal(kernel.calls.length, 0);
});

test('set-approval returns error when approved is missing', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({ gateName: 'quick.understanding_confirmed', approver: 'user' });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.toLowerCase().includes('approved'), `Expected reason to mention approved, got: ${result.reason}`);
  assert.equal(kernel.calls.length, 0);
});

test('set-approval returns error when approved is not a boolean', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({ gateName: 'quick.understanding_confirmed', approved: 'yes', approver: 'user' });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.toLowerCase().includes('approved'));
  assert.equal(kernel.calls.length, 0);
});

test('set-approval returns error when approver is missing', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({ gateName: 'quick.understanding_confirmed', approved: true });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.toLowerCase().includes('approver'), `Expected reason to mention approver, got: ${result.reason}`);
  assert.equal(kernel.calls.length, 0);
});

test('set-approval returns error when approver is not a string', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({ gateName: 'quick.understanding_confirmed', approved: true, approver: 123 });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.toLowerCase().includes('approver'));
  assert.equal(kernel.calls.length, 0);
});

test('set-approval returns error when input is a string (not an object)', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute('quick.understanding_confirmed');

  assert.equal(result.status, 'error');
  assert.equal(kernel.calls.length, 0);
});

// ── Successful execution ───────────────────────────────────────────────────

test('set-approval returns ok status on successful gate approval', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({
    gateName: 'quick.understanding_confirmed',
    approved: true,
    approver: 'user',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.gateName, 'quick.understanding_confirmed');
  assert.equal(result.approved, true);
});

test('set-approval returns ok status when revoking approval (approved: false)', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({
    gateName: 'quick.understanding_confirmed',
    approved: false,
    approver: 'user',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.gateName, 'quick.understanding_confirmed');
  assert.equal(result.approved, false);
});

test('set-approval calls kernel.setApproval with correct arguments', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  tool.execute({
    gateName: 'full.qa_passed',
    approved: true,
    approver: 'qa-agent',
  });

  assert.equal(kernel.calls.length, 1);
  const call = kernel.calls[0];
  assert.equal(call.gateName, 'full.qa_passed');
  assert.equal(call.approved, true);
  assert.equal(call.approver, 'qa-agent');
  assert.equal(call.metadata.setBy, 'tool.set-approval');
});

// ── Error handling from kernel ─────────────────────────────────────────────

test('set-approval returns error when kernel throws for unknown gate', () => {
  const kernel = createMockKernel({ throws: new Error("Unknown gate: 'nonexistent.gate'") });
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({
    gateName: 'nonexistent.gate',
    approved: true,
    approver: 'user',
  });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('nonexistent.gate'), `Expected reason to include gate name, got: ${result.reason}`);
});

test('set-approval returns error when kernel throws for authority violation', () => {
  const err = new Error("Cannot set gate 'quick.understanding_confirmed': requires authority 'user', but caller is 'qa-agent'");
  const kernel = createMockKernel({ throws: err });
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({
    gateName: 'quick.understanding_confirmed',
    approved: true,
    approver: 'qa-agent',
  });

  assert.equal(result.status, 'error');
  assert.ok(result.reason.includes('authority') || result.reason.includes('caller'), `Expected reason to mention authority, got: ${result.reason}`);
});

test('set-approval returns error when kernel throws a non-Error object', () => {
  const kernel = createMockKernel({ throws: 'string error' });
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  const result = tool.execute({
    gateName: 'quick.understanding_confirmed',
    approved: true,
    approver: 'user',
  });

  assert.equal(result.status, 'error');
  assert.ok(typeof result.reason === 'string');
  assert.ok(result.reason.length > 0);
});

// ── Tool metadata ──────────────────────────────────────────────────────────

test('set-approval tool has correct id', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  assert.equal(tool.id, 'tool.set-approval');
});

test('set-approval tool has correct family and stage', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  assert.equal(tool.family, 'workflow');
  assert.equal(tool.stage, 'foundation');
});

test('set-approval tool has active status', () => {
  const kernel = createMockKernel();
  const tool = createSetApprovalTool({ workflowKernel: kernel });

  assert.equal(tool.status, 'active');
});
