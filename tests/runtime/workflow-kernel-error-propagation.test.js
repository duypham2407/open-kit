import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createWorkflowKernelAdapter } from '../../src/runtime/workflow-kernel.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

function captureStderr(fn) {
  const original = process.stderr.write.bind(process.stderr);
  const captured = [];
  process.stderr.write = (chunk) => {
    captured.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return captured.join('');
}

test('safeCall logs to stderr when an internal controller call throws', () => {
  // Trigger a controller throw by passing a state path with a corrupt JSON file:
  // showState will read+parse it, JSON.parse throws, controller surfaces the
  // throw, and safeCall is supposed to log+swallow rather than silently
  // returning null. The test asserts the log appears.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-err-prop-'));
  const corruptStatePath = path.join(tempDir, 'workflow-state.json');
  fs.writeFileSync(corruptStatePath, '{ this is not valid json');

  const kernel = createWorkflowKernelAdapter({
    projectRoot: PROJECT_ROOT,
    env: { ...process.env, OPENKIT_WORKFLOW_STATE: corruptStatePath },
  });

  const stderr = captureStderr(() => {
    const result = kernel.showState();
    assert.equal(result, null, 'showState still returns null fallback on failure');
  });

  // The log line must clearly identify (a) the kernel surface and (b) the
  // underlying error so an operator can diagnose without bisecting.
  assert.match(
    stderr,
    /workflow-kernel/i,
    'stderr should identify the source surface as workflow-kernel',
  );
  assert.ok(
    stderr.length > 0,
    'safeCall should not silently swallow controller exceptions',
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});
