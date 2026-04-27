import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getGlobalPaths } from '../../src/global/paths.js';
import { addCustomMcpEntry } from '../../src/global/mcp/custom-mcp-store.js';
import { McpConfigService } from '../../src/global/mcp/mcp-config-service.js';
import {
  inspectSecretFile,
  loadSecretsEnv,
  repairSecretStorePermissions,
  setSecretValue,
  unsetSecretValue,
} from '../../src/global/mcp/secret-manager.js';
import { redactKnownSecrets, redactObject } from '../../src/global/mcp/redaction.js';

const SENTINEL = 'sk-openkit-secret-sentinel-941';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-mcp-secret-'));
}

function fileMode(filePath) {
  return fs.statSync(filePath).mode & 0o777;
}

test('setSecretValue stores secrets under OPENCODE_HOME openkit path with secure permissions', () => {
  const tempHome = makeTempHome();
  const paths = getGlobalPaths({ env: { OPENCODE_HOME: tempHome } });

  const result = setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env: { OPENCODE_HOME: tempHome } });

  assert.equal(result.status, 'stored');
  assert.equal(result.envVar, 'CONTEXT7_API_KEY');
  assert.equal(result.secretPath, path.join(paths.settingsRoot, 'secrets.env'));
  assert.equal(fs.readFileSync(result.secretPath, 'utf8').includes(SENTINEL), true);

  if (process.platform !== 'win32') {
    assert.equal(fileMode(paths.settingsRoot), 0o700);
    assert.equal(fileMode(result.secretPath), 0o600);
  }
});

test('secret manager preserves unrelated variables and collapses duplicate target keys', () => {
  const tempHome = makeTempHome();
  const paths = getGlobalPaths({ env: { OPENCODE_HOME: tempHome } });
  fs.mkdirSync(paths.settingsRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(paths.secretsEnvPath, 'OTHER=value\nCONTEXT7_API_KEY=old\nCONTEXT7_API_KEY=older\n', { mode: 0o600 });

  setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env: { OPENCODE_HOME: tempHome } });

  const content = fs.readFileSync(paths.secretsEnvPath, 'utf8');
  assert.match(content, /OTHER=value/);
  assert.equal((content.match(/CONTEXT7_API_KEY=/g) ?? []).length, 1);
  assert.match(content, new RegExp(`CONTEXT7_API_KEY=${SENTINEL}`));
});

test('loadSecretsEnv parses local secrets without logging raw values', () => {
  const tempHome = makeTempHome();
  setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env: { OPENCODE_HOME: tempHome } });

  const loaded = loadSecretsEnv({ env: { OPENCODE_HOME: tempHome } });

  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.redacted, { CONTEXT7_API_KEY: 'present_redacted' });
  assert.equal(loaded.values.CONTEXT7_API_KEY, SENTINEL);
  assert.equal(JSON.stringify(loaded.redacted).includes(SENTINEL), false);
});

test('unsetSecretValue removes only the target value and never returns the old secret', () => {
  const tempHome = makeTempHome();
  setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env: { OPENCODE_HOME: tempHome } });
  setSecretValue('WEBSEARCH_API_KEY', 'web-secret', { env: { OPENCODE_HOME: tempHome } });

  const unset = unsetSecretValue('CONTEXT7_API_KEY', { env: { OPENCODE_HOME: tempHome } });
  const loaded = loadSecretsEnv({ env: { OPENCODE_HOME: tempHome } });

  assert.equal(unset.status, 'removed');
  assert.equal(JSON.stringify(unset).includes(SENTINEL), false);
  assert.equal(loaded.values.CONTEXT7_API_KEY, undefined);
  assert.equal(loaded.values.WEBSEARCH_API_KEY, 'web-secret');
});

test('malformed secret file fails closed without destructive rewrite', () => {
  const tempHome = makeTempHome();
  const paths = getGlobalPaths({ env: { OPENCODE_HOME: tempHome } });
  fs.mkdirSync(paths.settingsRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(paths.secretsEnvPath, 'not a valid env line\n', { mode: 0o600 });

  assert.throws(
    () => setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env: { OPENCODE_HOME: tempHome } }),
    /malformed/i
  );
  assert.equal(fs.readFileSync(paths.secretsEnvPath, 'utf8'), 'not a valid env line\n');
});

test('redaction helpers remove known secrets from strings and objects', () => {
  const text = `provider failed with ${SENTINEL}`;
  const redactedText = redactKnownSecrets(text, { secrets: [SENTINEL], envVars: ['CONTEXT7_API_KEY'] });
  const redactedObject = redactObject({ error: text, key: SENTINEL }, { secrets: [SENTINEL] });

  assert.equal(redactedText.includes(SENTINEL), false);
  assert.match(redactedText, /\[REDACTED_SECRET\]/);
  assert.equal(JSON.stringify(redactedObject).includes(SENTINEL), false);
});

test('inspectSecretFile reports missing and unsafe states without raw values', () => {
  const tempHome = makeTempHome();
  const missing = inspectSecretFile({ env: { OPENCODE_HOME: tempHome } });
  assert.equal(missing.status, 'missing');

  setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env: { OPENCODE_HOME: tempHome } });
  const present = inspectSecretFile({ env: { OPENCODE_HOME: tempHome } });
  assert.equal(present.status, 'ok');
  assert.equal(JSON.stringify(present).includes(SENTINEL), false);
});

test('inspectSecretFile is read-only and repairSecretStorePermissions scopes POSIX permission repair', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  fs.mkdirSync(paths.settingsRoot, { recursive: true, mode: 0o755 });
  fs.writeFileSync(paths.secretsEnvPath, `CONTEXT7_API_KEY=${SENTINEL}\n`, { mode: 0o644 });

  const inspected = inspectSecretFile({ env });
  assert.equal(inspected.status, process.platform === 'win32' ? 'ok' : 'unsafe');
  if (process.platform !== 'win32') {
    assert.equal(fileMode(paths.settingsRoot), 0o755);
    assert.equal(fileMode(paths.secretsEnvPath), 0o644);
  }
  assert.equal(JSON.stringify(inspected).includes(SENTINEL), false);

  const repaired = repairSecretStorePermissions({ env });
  assert.ok(['ok', 'limited'].includes(repaired.status));
  assert.equal(JSON.stringify(repaired).includes(SENTINEL), false);
  if (process.platform !== 'win32') {
    assert.equal(fileMode(paths.settingsRoot), 0o700);
    assert.equal(fileMode(paths.secretsEnvPath), 0o600);
  }
});

test('custom MCP set-key requires declared env binding and preserves placeholder-only generated profiles', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: false, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom.js'], environment: { CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}' } },
    secretBindings: [{ id: 'custom-token', envVar: 'CUSTOM_MCP_TOKEN', required: true, placeholder: '${CUSTOM_MCP_TOKEN}', source: 'custom' }],
    riskWarnings: ['Local custom MCP execution can run code on this machine.'],
  }, { env });
  const service = new McpConfigService({ env });

  const result = service.setKey('custom-local', SENTINEL, { envVar: 'CUSTOM_MCP_TOKEN', scope: 'openkit' });

  assert.equal(result.keyState, 'present_redacted');
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.match(fs.readFileSync(paths.secretsEnvPath, 'utf8'), new RegExp(SENTINEL));
  const profile = JSON.parse(fs.readFileSync(paths.profileManifestPath, 'utf8'));
  assert.equal(profile.mcp['custom-local'].environment.CUSTOM_MCP_TOKEN, '${CUSTOM_MCP_TOKEN}');
  assert.equal(JSON.stringify(profile).includes(SENTINEL), false);
});

test('custom MCP set-key rejects undeclared env bindings without writing secrets', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: false, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom.js'], environment: {} },
    secretBindings: [],
    riskWarnings: [],
  }, { env });
  const service = new McpConfigService({ env });

  assert.throws(() => service.setKey('custom-local', SENTINEL, { envVar: 'CUSTOM_MCP_TOKEN', scope: 'openkit' }), /does not define/);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'secrets.env')), false);
});
