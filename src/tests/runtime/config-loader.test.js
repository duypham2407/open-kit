import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateConfigFile, validateConfigSchema } from '../../runtime/runtime-config-loader.js';

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

test('validateConfigSchema accepts minimal valid config', () => {
  const result = validateConfigSchema({ profiles: { default: 'sonnet' } });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateConfigSchema rejects missing profiles.default', () => {
  const result = validateConfigSchema({ profiles: {} });

  assert.equal(result.valid, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.some((err) => /profiles\.default/.test(err)),
    `expected error mentioning profiles.default, got: ${result.errors.join(', ')}`
  );
});

test('validateConfigSchema rejects invalid field types', () => {
  const result = validateConfigSchema({
    profiles: { default: 'sonnet' },
    mcps: { servers: 'not-an-array' },
    disabled: 'not-an-object',
  });

  assert.equal(result.valid, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length >= 2);
  assert.ok(
    result.errors.some((err) => /mcps\.servers/.test(err)),
    `expected error mentioning mcps.servers, got: ${result.errors.join(', ')}`
  );
  assert.ok(
    result.errors.some((err) => /disabled/.test(err)),
    `expected error mentioning disabled, got: ${result.errors.join(', ')}`
  );
});

test('validateConfigFile rejects invalid schema', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'config.jsonc');
  // Valid JSON but missing required profiles.default
  fs.writeFileSync(configPath, '{"profiles": {}}');

  const result = validateConfigFile(configPath);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'schema_invalid');
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
