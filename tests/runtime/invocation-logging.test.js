import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { wrapToolExecution } from '../../src/runtime/tools/wrap-tool-execution.js';

const require = createRequire(import.meta.url);
const { createInvocationLogger, readInvocationLog, resolveLogPath } = require('../../.opencode/lib/invocation-log.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-invlog-'));
}

function createMockActionModelStateManager() {
  const records = [];
  return {
    records,
    recordSuccess({ subjectId, actionKey }) {
      records.push({ type: 'success', subjectId, actionKey });
    },
    recordFailure({ subjectId, actionKey, detail }) {
      records.push({ type: 'failure', subjectId, actionKey, detail });
    },
  };
}

// ---------------------------------------------------------------------------
// End-to-end: wrapToolExecution + invocationLogger
// ---------------------------------------------------------------------------

test('wrapped synchronous tool records invocation entry to disk on success', () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.test-sync',
    name: 'Test Sync Tool',
    execute() {
      return { status: 'ok', data: 42 };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  const result = wrapped.execute();

  assert.deepEqual(result, { status: 'ok', data: 42 });

  // Verify invocation was logged to disk
  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].tool_id, 'tool.test-sync');
  assert.equal(entries[0].status, 'success');
  assert.equal(typeof entries[0].duration_ms, 'number');
  assert.ok(entries[0].recorded_at);
});

test('wrapped synchronous tool records invocation entry on failure status', () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.test-fail',
    name: 'Test Fail Tool',
    execute() {
      return { status: 'failed', reason: 'not found' };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  wrapped.execute();

  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].tool_id, 'tool.test-fail');
  assert.equal(entries[0].status, 'failure');
});

test('wrapped synchronous tool records invocation entry on thrown error', () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.test-throw',
    name: 'Test Throw Tool',
    execute() {
      throw new Error('boom');
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  assert.throws(() => wrapped.execute(), { message: 'boom' });

  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].tool_id, 'tool.test-throw');
  assert.equal(entries[0].status, 'error');
});

test('wrapped async tool records invocation entry to disk on success', async () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.test-async',
    name: 'Test Async Tool',
    execute() {
      return Promise.resolve({ status: 'ok', result: 'done' });
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  const result = await wrapped.execute();

  assert.deepEqual(result, { status: 'ok', result: 'done' });

  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].tool_id, 'tool.test-async');
  assert.equal(entries[0].status, 'success');
});

test('wrapped async tool records invocation entry on rejected promise', async () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.test-async-error',
    name: 'Test Async Error Tool',
    execute() {
      return Promise.reject(new Error('async boom'));
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  await assert.rejects(() => wrapped.execute(), { message: 'async boom' });

  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].tool_id, 'tool.test-async-error');
  assert.equal(entries[0].status, 'error');
});

test('wrapped tool records stage and owner from __actionTracking', () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.test-tracked',
    name: 'Test Tracked Tool',
    execute() {
      return { status: 'ok' };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  wrapped.execute({
    __actionTracking: {
      subjectId: 'tool.test-tracked',
      actionKey: 'tool.test-tracked',
      stage: 'full_implementation',
      owner: 'FullstackAgent',
    },
  });

  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].stage, 'full_implementation');
  assert.equal(entries[0].owner, 'FullstackAgent');
});

test('wrapped tool with dynamic work item getter writes to per-work-item log', () => {
  const runtimeRoot = makeTempDir();
  const workItemId = 'WI-INT-001';

  // Create the work item directory
  const wiDir = path.join(runtimeRoot, '.opencode', 'work-items', workItemId);
  fs.mkdirSync(wiDir, { recursive: true });

  const logger = createInvocationLogger({
    runtimeRoot,
    getWorkItemId: () => workItemId,
  });
  const stateManager = createMockActionModelStateManager();

  const tool = {
    id: 'tool.rule-scan',
    name: 'Rule Scan',
    execute() {
      return { status: 'ok', findings: [] };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  wrapped.execute();

  // Verify it was written to the per-work-item log
  const perWiEntries = readInvocationLog(runtimeRoot, workItemId);
  assert.equal(perWiEntries.length, 1);
  assert.equal(perWiEntries[0].tool_id, 'tool.rule-scan');
  assert.equal(perWiEntries[0].status, 'success');

  // Verify the global log is still empty
  const globalEntries = readInvocationLog(runtimeRoot, null);
  assert.equal(globalEntries.length, 0);
});

test('wrapped direct rule-scan records compact scan metadata in invocation log', () => {
  const runtimeRoot = makeTempDir();
  const workItemId = 'feature-943';
  fs.mkdirSync(path.join(runtimeRoot, '.opencode', 'work-items', workItemId), { recursive: true });

  const logger = createInvocationLogger({
    runtimeRoot,
    getWorkItemId: () => workItemId,
  });
  const stateManager = createMockActionModelStateManager();
  const tool = {
    id: 'tool.rule-scan',
    name: 'Rule Scan',
    execute() {
      return {
        status: 'ok',
        toolId: 'tool.rule-scan',
        scanKind: 'rule',
        capabilityState: 'available',
        resultState: 'succeeded',
        availability: { state: 'available', reason: null },
        target: { scopeSummary: 'project path: src/runtime/tools/audit/scan-evidence.js' },
        findingCount: 2,
        artifactRefs: ['.openkit/artifacts/rule-scan.json'],
        evidenceHint: { evidenceType: 'direct_tool' },
        details: {
          scan_evidence: {
            evidence_type: 'direct_tool',
            finding_counts: { total: 2, true_positive: 0, unclassified: 0 },
          },
        },
      };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  wrapped.execute({
    __actionTracking: {
      subjectId: 'tool.rule-scan',
      actionKey: 'tool.rule-scan',
      stage: 'full_implementation',
      owner: 'FullstackAgent',
    },
  });

  const [entry] = readInvocationLog(runtimeRoot, workItemId);
  assert.equal(entry.tool_id, 'tool.rule-scan');
  assert.equal(entry.status, 'success');
  assert.equal(entry.stage, 'full_implementation');
  assert.equal(entry.owner, 'FullstackAgent');
  assert.equal(entry.scan_kind, 'rule');
  assert.equal(entry.availability_state, 'available');
  assert.equal(entry.result_state, 'succeeded');
  assert.match(entry.target_scope_summary, /scan-evidence\.js/);
  assert.equal(entry.finding_counts.total, 2);
  assert.equal(entry.error_summary, null);
  assert.deepEqual(entry.artifact_refs, ['.openkit/artifacts/rule-scan.json']);
  assert.equal(entry.evidence_type, 'direct_tool');
});

test('wrapped unavailable direct security-scan records reached attempt metadata', () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();
  const tool = {
    id: 'tool.security-scan',
    name: 'Security Scan',
    execute() {
      return {
        status: 'unavailable',
        toolId: 'tool.security-scan',
        scanKind: 'security',
        capabilityState: 'unavailable',
        resultState: 'unavailable',
        availability: { state: 'unavailable', reason: 'Semgrep unavailable' },
        target: { scopeSummary: 'project path: src/runtime' },
        findingCount: 0,
        artifactRefs: [],
        evidenceHint: { evidenceType: 'direct_tool' },
      };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: logger });
  wrapped.execute();

  const [entry] = readInvocationLog(runtimeRoot, null);
  assert.equal(entry.tool_id, 'tool.security-scan');
  assert.equal(entry.status, 'failure');
  assert.equal(entry.scan_kind, 'security');
  assert.equal(entry.availability_state, 'unavailable');
  assert.equal(entry.result_state, 'unavailable');
  assert.equal(entry.target_scope_summary, 'project path: src/runtime');
  assert.equal(entry.finding_counts.total, 0);
  assert.match(entry.error_summary, /Semgrep unavailable/);
  assert.equal(stateManager.records[0].type, 'failure');
});

test('multiple tool invocations accumulate in the log', () => {
  const runtimeRoot = makeTempDir();
  const logger = createInvocationLogger({ runtimeRoot });
  const stateManager = createMockActionModelStateManager();

  const ruleScan = {
    id: 'tool.rule-scan',
    name: 'Rule Scan',
    execute() {
      return { status: 'ok' };
    },
  };

  const securityScan = {
    id: 'tool.security-scan',
    name: 'Security Scan',
    execute() {
      return { status: 'ok' };
    },
  };

  const wrappedRuleScan = wrapToolExecution(ruleScan, { actionModelStateManager: stateManager, invocationLogger: logger });
  const wrappedSecurityScan = wrapToolExecution(securityScan, { actionModelStateManager: stateManager, invocationLogger: logger });

  wrappedRuleScan.execute();
  wrappedSecurityScan.execute();
  wrappedRuleScan.execute();

  const entries = readInvocationLog(runtimeRoot, null);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].tool_id, 'tool.rule-scan');
  assert.equal(entries[1].tool_id, 'tool.security-scan');
  assert.equal(entries[2].tool_id, 'tool.rule-scan');
});

test('invocation logging does not block tool execution when logger fails', () => {
  // Create a logger that points to a non-writable path to simulate failures
  const runtimeRoot = makeTempDir();
  const stateManager = createMockActionModelStateManager();

  // Create a broken logger that throws on record
  const brokenLogger = {
    record() {
      throw new Error('disk full');
    },
    getEntries() { return []; },
    getEntriesForTool() { return []; },
    getSuccessfulEntries() { return []; },
    hasSuccessfulInvocation() { return false; },
    clear() {},
    logPath: null,
  };

  const tool = {
    id: 'tool.test-resilient',
    name: 'Test Resilient Tool',
    execute() {
      return { status: 'ok', data: 'works' };
    },
  };

  const wrapped = wrapToolExecution(tool, { actionModelStateManager: stateManager, invocationLogger: brokenLogger });

  // Should not throw despite broken logger
  const result = wrapped.execute();
  assert.deepEqual(result, { status: 'ok', data: 'works' });

  // Action model should still have recorded success
  assert.equal(stateManager.records.length, 1);
  assert.equal(stateManager.records[0].type, 'success');
});
