import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getGlobalPaths } from '../../src/global/paths.js';
import { addCustomMcpEntry } from '../../src/global/mcp/custom-mcp-store.js';
import { setSecretValue } from '../../src/global/mcp/secret-manager.js';
import { setMcpEnabled } from '../../src/global/mcp/mcp-config-store.js';
import { materializeMcpProfiles } from '../../src/global/mcp/profile-materializer.js';

const SENTINEL = 'sk-openkit-profile-sentinel-941';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-mcp-profile-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('materializeMcpProfiles writes openkit scope entries with placeholders only', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  setSecretValue('CONTEXT7_API_KEY', SENTINEL, { env });
  setMcpEnabled('context7', true, { scope: 'openkit', env });

  const result = materializeMcpProfiles({ scope: 'openkit', env });
  const profile = readJson(paths.profileManifestPath);

  assert.equal(result.results.openkit.status, 'materialized');
  assert.equal(profile.mcp.context7.environment.CONTEXT7_API_KEY, '${CONTEXT7_API_KEY}');
  assert.equal(JSON.stringify(profile).includes(SENTINEL), false);
  assert.equal(profile.mcp.context7.enabled, true);
});

test('materializeMcpProfiles targets global and both scopes without duplicating entries', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  setMcpEnabled('websearch', true, { scope: 'openkit', env });
  setMcpEnabled('websearch', true, { scope: 'global', env });

  materializeMcpProfiles({ scope: 'both', env });
  materializeMcpProfiles({ scope: 'both', env });

  assert.equal(readJson(paths.profileManifestPath).mcp.websearch.environment.WEBSEARCH_API_KEY, '${WEBSEARCH_API_KEY}');
  assert.equal(readJson(path.join(tempHome, 'opencode.json')).mcp.websearch.environment.WEBSEARCH_API_KEY, '${WEBSEARCH_API_KEY}');
  assert.equal(Object.keys(readJson(paths.profileManifestPath).mcp).filter((key) => key === 'websearch').length, 1);
});

test('materializeMcpProfiles preserves unmanaged global same-id config and reports conflict', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  writeJson(path.join(tempHome, 'opencode.json'), {
    mcp: {
      context7: { type: 'local', command: ['custom-context7'], enabled: true },
    },
  });
  setMcpEnabled('context7', true, { scope: 'global', env });

  const result = materializeMcpProfiles({ scope: 'global', env });
  const globalConfig = readJson(path.join(tempHome, 'opencode.json'));

  assert.equal(result.results.global.status, 'conflict');
  assert.equal(globalConfig.mcp.context7.command[0], 'custom-context7');
});

test('disabled MCP remains materialized as disabled and discoverable', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  setMcpEnabled('context7', false, { scope: 'openkit', env });

  materializeMcpProfiles({ scope: 'openkit', env });
  const profile = readJson(paths.profileManifestPath);

  assert.equal(profile.mcp.context7.enabled, false);
  assert.equal(profile.mcp.context7.environment.CONTEXT7_API_KEY, '${CONTEXT7_API_KEY}');
});

test('materializeMcpProfiles writes custom entries with ownership metadata and placeholders only', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  setSecretValue('CUSTOM_MCP_TOKEN', SENTINEL, { env });
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: {
      type: 'local',
      command: ['node', '/tmp/custom-server.js'],
      environment: { CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}' },
    },
    secretBindings: [{ id: 'custom-token', envVar: 'CUSTOM_MCP_TOKEN', required: true, placeholder: '${CUSTOM_MCP_TOKEN}', source: 'custom' }],
    riskWarnings: ['Local custom MCP execution can run code on this machine.'],
  }, { env });

  materializeMcpProfiles({ scope: 'openkit', env });
  const profile = readJson(paths.profileManifestPath);
  const state = readJson(paths.mcpProfileStatePath);

  assert.equal(profile.mcp['custom-local'].environment.CUSTOM_MCP_TOKEN, '${CUSTOM_MCP_TOKEN}');
  assert.equal(JSON.stringify(profile).includes(SENTINEL), false);
  assert.equal(state.profiles.openkit.managedEntries['custom-local'].kind, 'custom');
  assert.equal(state.profiles.openkit.managedEntries['custom-local'].ownership, 'openkit-managed-custom');
});

test('materializeMcpProfiles preserves unmanaged global custom conflicts', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  writeJson(path.join(tempHome, 'opencode.json'), {
    mcp: {
      'custom-local': { type: 'local', command: ['user-owned'], enabled: true },
    },
  });
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: false, global: true },
    definition: { type: 'local', command: ['node', '/tmp/custom-server.js'], environment: {} },
    secretBindings: [],
    riskWarnings: [],
  }, { env });

  const result = materializeMcpProfiles({ scope: 'global', env });
  const globalConfig = readJson(path.join(tempHome, 'opencode.json'));

  assert.equal(result.results.global.status, 'conflict');
  assert.equal(globalConfig.mcp['custom-local'].command[0], 'user-owned');
});

test('materializeMcpProfiles removes stale custom managed entries after custom definition removal', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom-server.js'], environment: {} },
    secretBindings: [],
    riskWarnings: [],
  }, { env });

  materializeMcpProfiles({ scope: 'openkit', env });
  fs.unlinkSync(paths.customMcpConfigPath);
  materializeMcpProfiles({ scope: 'openkit', env });

  assert.equal(readJson(paths.profileManifestPath).mcp['custom-local'], undefined);
  assert.equal(readJson(paths.mcpProfileStatePath).profiles.openkit.managedEntries['custom-local'], undefined);
});
