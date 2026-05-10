import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  validateConfigFile,
  validateConfigSchema,
  loadRuntimeConfigWithDiagnostics,
  getDefaultRuntimeConfig,
} from '../../runtime/runtime-config-loader.js';

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

test('loadRuntimeConfigWithDiagnostics falls back to defaults when config missing', () => {
  const tempDir = createTempDir();
  // No project config, no user config (via overridden home)
  const fakeHome = path.join(tempDir, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });

  const result = loadRuntimeConfigWithDiagnostics(tempDir, { home: fakeHome });

  assert.equal(result.success, true);
  assert.equal(result.source, 'defaults');
  assert.equal(result.error, null);
  assert.ok(result.data && typeof result.data === 'object');
  // Defaults must satisfy the schema
  const schemaResult = validateConfigSchema(result.data);
  assert.equal(schemaResult.valid, true, `defaults must be schema-valid: ${schemaResult.errors.join(', ')}`);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test('loadRuntimeConfigWithDiagnostics tries project config first', () => {
  const tempDir = createTempDir();
  const projectConfigDir = path.join(tempDir, '.opencode');
  fs.mkdirSync(projectConfigDir, { recursive: true });
  const projectConfigPath = path.join(projectConfigDir, 'openkit.runtime.jsonc');
  fs.writeFileSync(projectConfigPath, '{"profiles": {"default": "project-profile"}}');

  // Build a user config that should be ignored when project config is found
  const fakeHome = path.join(tempDir, 'home');
  const userConfigDir = path.join(fakeHome, '.config', 'openkit');
  fs.mkdirSync(userConfigDir, { recursive: true });
  fs.writeFileSync(path.join(userConfigDir, 'config.jsonc'), '{"profiles": {"default": "user-profile"}}');

  const result = loadRuntimeConfigWithDiagnostics(tempDir, { home: fakeHome });

  assert.equal(result.success, true);
  assert.equal(result.source, 'project');
  assert.equal(result.error, null);
  assert.equal(result.data.profiles.default, 'project-profile');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test('loadRuntimeConfigWithDiagnostics logs diagnostic on parse error and falls back', () => {
  const tempDir = createTempDir();
  const projectConfigDir = path.join(tempDir, '.opencode');
  fs.mkdirSync(projectConfigDir, { recursive: true });
  const projectConfigPath = path.join(projectConfigDir, 'openkit.runtime.jsonc');
  // Write invalid JSON
  fs.writeFileSync(projectConfigPath, '{ invalid json content !!!');

  const fakeHome = path.join(tempDir, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });

  const result = loadRuntimeConfigWithDiagnostics(tempDir, { home: fakeHome });

  // Loader should not throw; should fall back to defaults.
  assert.equal(result.success, true);
  assert.equal(result.source, 'defaults');
  assert.ok(result.data && typeof result.data === 'object');

  // Diagnostics file should now exist with a parse_error event recorded
  const diagnosticsPath = path.join(tempDir, '.opencode', 'diagnostics.json');
  assert.equal(fs.existsSync(diagnosticsPath), true, 'diagnostics file should be created');
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));
  assert.ok(Array.isArray(diagnostics.events));
  const parseEvent = diagnostics.events.find((event) => event.category === 'config_loading' && /parse/i.test(event.message));
  assert.ok(parseEvent, `expected a config_loading parse-error event, got: ${JSON.stringify(diagnostics.events)}`);
  assert.ok(['warning', 'error'].includes(parseEvent.level), `expected warning or error level, got: ${parseEvent.level}`);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test('getDefaultRuntimeConfig returns a fresh, schema-valid object', () => {
  const a = getDefaultRuntimeConfig();
  const b = getDefaultRuntimeConfig();

  assert.ok(a && typeof a === 'object');
  assert.notEqual(a, b, 'should return a fresh copy each call');

  const schemaResult = validateConfigSchema(a);
  assert.equal(schemaResult.valid, true, `defaults must be schema-valid: ${schemaResult.errors.join(', ')}`);
});
