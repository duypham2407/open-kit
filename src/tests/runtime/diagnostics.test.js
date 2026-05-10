import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logDiagnostic, getDiagnosticsPath } from '../../runtime/lib/diagnostics.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-diag-test-'));
}

test('logDiagnostic writes diagnostic entry to file', () => {
  const tempDir = createTempDir();
  const diagnosticsPath = path.join(tempDir, '.opencode', 'diagnostics.json');

  logDiagnostic('test_category', 'info', 'Test message', { foo: 'bar' }, tempDir);

  assert.equal(fs.existsSync(diagnosticsPath), true);
  const content = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));
  assert.equal(content.version, '1.0');
  assert.equal(content.events.length, 1);
  assert.equal(content.events[0].category, 'test_category');
  assert.equal(content.events[0].level, 'info');
  assert.equal(content.events[0].message, 'Test message');
  assert.deepEqual(content.events[0].details, { foo: 'bar' });
  assert.equal(typeof content.events[0].timestamp, 'string');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test('logDiagnostic rotates events when exceeds 1000', () => {
  const tempDir = createTempDir();

  // Add 1005 events
  for (let i = 0; i < 1005; i++) {
    logDiagnostic('test', 'info', `Message ${i}`, { index: i }, tempDir);
  }

  const diagnosticsPath = path.join(tempDir, '.opencode', 'diagnostics.json');
  const content = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));

  // Should keep only last 1000
  assert.equal(content.events.length, 1000);
  assert.equal(content.events[0].details.index, 5); // First 5 were dropped
  assert.equal(content.events[999].details.index, 1004);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
