import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateConfigFile } from '../../runtime/runtime-config-loader.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-config-test-'));
}

test('validateConfigFile returns invalid for missing file', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'nonexistent.jsonc');

  const result = validateConfigFile(configPath);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'file_not_found');
  assert.equal(result.data, null);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test('validateConfigFile handles permission denied', { skip: process.getuid && process.getuid() === 0 ? 'cannot test permission denial as root' : false }, () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'config.jsonc');
  fs.writeFileSync(configPath, '{"test": true}');
  fs.chmodSync(configPath, 0o000);

  const result = validateConfigFile(configPath);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'permission_denied');

  // Cleanup
  fs.chmodSync(configPath, 0o644);
  fs.rmSync(tempDir, { recursive: true });
});

test('validateConfigFile handles JSON parse error', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'config.jsonc');
  fs.writeFileSync(configPath, '{ invalid json }');

  const result = validateConfigFile(configPath);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'parse_error');
  assert.equal(typeof result.error, 'string');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test('validateConfigFile accepts valid JSON', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'config.jsonc');
  fs.writeFileSync(configPath, '{"profiles": {"default": "sonnet"}}');

  const result = validateConfigFile(configPath);

  assert.equal(result.valid, true);
  assert.deepEqual(result.data, { profiles: { default: 'sonnet' } });

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
