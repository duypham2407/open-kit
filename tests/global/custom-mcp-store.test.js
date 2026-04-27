import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { listMcpCatalogIds } from '../../src/capabilities/mcp-catalog.js';
import { getGlobalPaths } from '../../src/global/paths.js';
import {
  addCustomMcpEntry,
  readCustomMcpConfig,
  removeCustomMcpEntry,
  setCustomMcpEnabled,
} from '../../src/global/mcp/custom-mcp-store.js';

const SENTINEL = 'sk-openkit-custom-store-sentinel-948';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-custom-mcp-store-'));
}

function makeLocalEntry(overrides = {}) {
  return {
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: {
      type: 'local',
      command: ['node', '/tmp/server.js'],
      cwd: null,
      environment: {
        CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}',
      },
    },
    secretBindings: [
      {
        id: 'custom-mcp-token',
        envVar: 'CUSTOM_MCP_TOKEN',
        label: 'Custom MCP token',
        required: true,
        placeholder: '${CUSTOM_MCP_TOKEN}',
        source: 'custom',
      },
    ],
    riskWarnings: ['Local custom MCP execution can run code on this machine.'],
    ...overrides,
  };
}

test('readCustomMcpConfig returns empty custom registry without creating a file', () => {
  const tempHome = makeTempHome();
  const paths = getGlobalPaths({ env: { OPENCODE_HOME: tempHome } });

  const config = readCustomMcpConfig({ env: { OPENCODE_HOME: tempHome } });

  assert.equal(config.schema, 'openkit/custom-mcp-config@1');
  assert.deepEqual(config.entries, {});
  assert.deepEqual(config.imports, {});
  assert.equal(fs.existsSync(paths.customMcpConfigPath), false);
});

test('addCustomMcpEntry persists custom ownership metadata and never writes raw secrets', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const paths = getGlobalPaths({ env });

  addCustomMcpEntry(makeLocalEntry(), { env });

  const config = readCustomMcpConfig({ env });
  assert.equal(config.entries['custom-local'].origin, 'local');
  assert.equal(config.entries['custom-local'].ownership, 'openkit-managed-custom');
  assert.equal(config.entries['custom-local'].definition.environment.CUSTOM_MCP_TOKEN, '${CUSTOM_MCP_TOKEN}');
  assert.equal(JSON.stringify(config).includes(SENTINEL), false);
  assert.equal(fs.readFileSync(paths.customMcpConfigPath, 'utf8').includes(SENTINEL), false);
});

test('custom registry remains separate from bundled catalog ids', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };

  addCustomMcpEntry(makeLocalEntry(), { env });

  assert.equal(listMcpCatalogIds().includes('custom-local'), false);
  assert.equal(readCustomMcpConfig({ env }).entries['custom-local'].id, 'custom-local');
});

test('setCustomMcpEnabled updates selected scopes idempotently', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  addCustomMcpEntry(makeLocalEntry({ enabled: { openkit: false, global: false } }), { env });

  setCustomMcpEnabled('custom-local', true, { scope: 'both', env });
  setCustomMcpEnabled('custom-local', true, { scope: 'openkit', env });

  const config = readCustomMcpConfig({ env });
  assert.equal(config.entries['custom-local'].enabled.openkit, true);
  assert.equal(config.entries['custom-local'].enabled.global, true);
});

test('removeCustomMcpEntry deletes only custom definitions and reports already-absent state', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  addCustomMcpEntry(makeLocalEntry(), { env });

  assert.equal(removeCustomMcpEntry('custom-local', { env }).status, 'removed');
  assert.equal(removeCustomMcpEntry('custom-local', { env }).status, 'already_absent');
  assert.equal(readCustomMcpConfig({ env }).entries['custom-local'], undefined);
});

test('addCustomMcpEntry rejects entries containing raw secret-looking values', () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome };
  const unsafe = makeLocalEntry({
    definition: {
      type: 'local',
      command: ['node', '/tmp/server.js'],
      environment: { CUSTOM_MCP_TOKEN: SENTINEL },
    },
  });

  assert.throws(() => addCustomMcpEntry(unsafe, { env }), /raw secret/i);
  assert.equal(readCustomMcpConfig({ env }).entries['custom-local'], undefined);
});
