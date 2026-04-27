import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeImportedGlobalMcpEntry,
  validateLocalCustomMcpDefinition,
  validateRemoteCustomMcpDefinition,
} from '../../src/global/mcp/custom-mcp-validation.js';

const SENTINEL = 'sk-openkit-validation-sentinel-948';

test('validateLocalCustomMcpDefinition accepts argv arrays with placeholder env bindings', () => {
  const result = validateLocalCustomMcpDefinition({
    id: 'custom-local',
    displayName: 'Custom Local',
    command: ['node', '/tmp/server.js', '--stdio'],
    environment: { CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}' },
  }, { env: { PATH: '' } });

  assert.equal(result.status, 'valid');
  assert.equal(result.normalizedDefinition.type, 'local');
  assert.deepEqual(result.normalizedDefinition.command, ['node', '/tmp/server.js', '--stdio']);
  assert.equal(result.secretBindings[0].envVar, 'CUSTOM_MCP_TOKEN');
  assert.ok(result.warnings.some((warning) => /local custom MCP execution/i.test(warning)));
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('validateLocalCustomMcpDefinition rejects shell operators and shell launchers', () => {
  const chained = validateLocalCustomMcpDefinition({ id: 'custom-local', command: ['node', 'server.js', '&&', 'rm'] });
  const shell = validateLocalCustomMcpDefinition({ id: 'custom-shell', command: ['bash', '-c', 'node server.js'] });

  assert.equal(chained.status, 'invalid');
  assert.ok(chained.errors.some((error) => /shell operator/i.test(error)));
  assert.equal(shell.status, 'invalid');
  assert.ok(shell.errors.some((error) => /shell launcher/i.test(error)));
});

test('validateLocalCustomMcpDefinition rejects raw secret-looking args and env values', () => {
  const result = validateLocalCustomMcpDefinition({
    id: 'custom-local',
    command: ['node', 'server.js', `--token=${SENTINEL}`],
    environment: { CUSTOM_MCP_TOKEN: SENTINEL },
  });

  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.some((error) => /raw secret/i.test(error)));
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('validateRemoteCustomMcpDefinition accepts https and localhost-http with placeholder headers', () => {
  const https = validateRemoteCustomMcpDefinition({
    id: 'custom-remote',
    url: 'https://mcp.example.invalid/v1',
    transport: 'streamable-http',
    headers: { Authorization: '${CUSTOM_MCP_AUTHORIZATION}' },
  });
  const localhost = validateRemoteCustomMcpDefinition({
    id: 'custom-local-remote',
    url: 'http://localhost:8787/mcp',
    transport: 'http',
  });

  assert.equal(https.status, 'valid');
  assert.equal(https.normalizedDefinition.url, 'https://mcp.example.invalid/v1');
  assert.equal(https.secretBindings[0].envVar, 'CUSTOM_MCP_AUTHORIZATION');
  assert.equal(localhost.status, 'valid');
  assert.ok(localhost.warnings.some((warning) => /localhost HTTP/i.test(warning)));
});

test('validateRemoteCustomMcpDefinition rejects unsafe schemes credentials metadata hosts and raw headers', () => {
  const cases = [
    validateRemoteCustomMcpDefinition({ id: 'custom-file', url: 'file:///tmp/mcp' }),
    validateRemoteCustomMcpDefinition({ id: 'custom-creds', url: 'https://user:pass@example.invalid/mcp' }),
    validateRemoteCustomMcpDefinition({ id: 'custom-token', url: 'https://example.invalid/mcp?token=abc' }),
    validateRemoteCustomMcpDefinition({ id: 'custom-meta', url: 'https://169.254.169.254/latest' }),
    validateRemoteCustomMcpDefinition({ id: 'custom-header', url: 'https://example.invalid/mcp', headers: { Authorization: `Bearer ${SENTINEL}` } }),
  ];

  for (const result of cases) {
    assert.equal(result.status, 'invalid');
    assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  }
});

test('validateRemoteCustomMcpDefinition rejects token-looking query values and allows benign query values', () => {
  const secretValue = validateRemoteCustomMcpDefinition({
    id: 'custom-remote',
    url: `https://example.invalid/mcp?debug=${SENTINEL}`,
  });
  const bearerValue = validateRemoteCustomMcpDefinition({
    id: 'custom-bearer',
    url: `https://example.invalid/mcp?x=${encodeURIComponent(`Bearer ${SENTINEL}`)}`,
  });
  const benignValue = validateRemoteCustomMcpDefinition({
    id: 'custom-benign',
    url: 'https://example.invalid/mcp?debug=true&trace=basic',
  });

  assert.equal(secretValue.status, 'invalid');
  assert.equal(bearerValue.status, 'invalid');
  assert.equal(benignValue.status, 'valid');
  assert.equal(JSON.stringify(secretValue).includes(SENTINEL), false);
  assert.equal(JSON.stringify(bearerValue).includes(SENTINEL), false);
  assert.equal(benignValue.normalizedDefinition.url, 'https://example.invalid/mcp?debug=true&trace=basic');
});

test('normalizeImportedGlobalMcpEntry converts raw global env secrets to placeholders without copying values', () => {
  const result = normalizeImportedGlobalMcpEntry('legacy-local', {
    type: 'local',
    command: ['node', '/tmp/legacy.js'],
    environment: { LEGACY_API_KEY: SENTINEL },
  }, { customId: 'legacy-local' });

  assert.equal(result.outcome, 'needs_secret_setup');
  assert.equal(result.entry.definition.environment.LEGACY_API_KEY, '${LEGACY_API_KEY}');
  assert.equal(result.entry.origin, 'imported-global');
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('normalizeImportedGlobalMcpEntry imports remote global entries using default web transport', () => {
  const result = normalizeImportedGlobalMcpEntry('legacy-remote', {
    type: 'remote',
    url: 'https://mcp.example.invalid/v1',
    headers: { Authorization: '${LEGACY_AUTHORIZATION}' },
  });

  assert.equal(result.outcome, 'imported');
  assert.equal(result.entry.definition.type, 'remote');
  assert.equal(result.entry.definition.transport, 'streamable-http');
  assert.equal(result.entry.definition.headers.Authorization, '${LEGACY_AUTHORIZATION}');
});

test('normalizeImportedGlobalMcpEntry reports unsupported or invalid global entries per entry', () => {
  const unsupported = normalizeImportedGlobalMcpEntry('legacy-weird', { type: 'unknown' });
  const invalid = normalizeImportedGlobalMcpEntry('legacy-remote', { url: 'javascript:alert(1)' });

  assert.equal(unsupported.outcome, 'unsupported');
  assert.equal(invalid.outcome, 'invalid');
});
