import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getGlobalPaths } from '../../src/global/paths.js';
import {
  readMcpConfig,
  setMcpEnabled,
  recordSecretBinding,
} from '../../src/global/mcp/mcp-config-store.js';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-mcp-config-'));
}

test('readMcpConfig creates default state from catalog without secret values', () => {
  const tempHome = makeTempHome();
  const config = readMcpConfig({ env: { OPENCODE_HOME: tempHome } });

  assert.equal(config.schema, 'openkit/mcp-config@1');
  assert.equal(config.scopes.openkit.openkit.enabled, true);
  assert.equal(config.scopes.openkit.context7.enabled, false);
  assert.equal(JSON.stringify(config).includes('API_KEY='), false);
});

test('setMcpEnabled persists scope-specific user enablement idempotently', () => {
  const tempHome = makeTempHome();
  setMcpEnabled('context7', true, { scope: 'openkit', env: { OPENCODE_HOME: tempHome } });
  setMcpEnabled('context7', true, { scope: 'openkit', env: { OPENCODE_HOME: tempHome } });
  setMcpEnabled('context7', false, { scope: 'global', env: { OPENCODE_HOME: tempHome } });

  const config = readMcpConfig({ env: { OPENCODE_HOME: tempHome } });
  assert.equal(config.scopes.openkit.context7.enabled, true);
  assert.equal(config.scopes.openkit.context7.source, 'user');
  assert.equal(config.scopes.global.context7.enabled, false);
  assert.equal(config.scopes.global.context7.source, 'user');
});

test('recordSecretBinding stores env var metadata only', () => {
  const tempHome = makeTempHome();
  const paths = getGlobalPaths({ env: { OPENCODE_HOME: tempHome } });
  recordSecretBinding('context7', ['CONTEXT7_API_KEY'], { env: { OPENCODE_HOME: tempHome } });

  const content = fs.readFileSync(paths.mcpConfigPath, 'utf8');
  assert.match(content, /CONTEXT7_API_KEY/);
  assert.doesNotMatch(content, /sk-openkit-secret/);
  assert.deepEqual(readMcpConfig({ env: { OPENCODE_HOME: tempHome } }).secretBindings.context7.envVars, ['CONTEXT7_API_KEY']);
});

test('setMcpEnabled rejects unknown MCPs and invalid scopes without mutation', () => {
  const tempHome = makeTempHome();
  assert.throws(() => setMcpEnabled('missing', true, { env: { OPENCODE_HOME: tempHome } }), /Unknown MCP/);
  assert.throws(() => setMcpEnabled('context7', true, { scope: 'invalid', env: { OPENCODE_HOME: tempHome } }), /Invalid scope/);
});
