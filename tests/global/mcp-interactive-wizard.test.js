import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { transitionWizardState } from '../../src/global/mcp/wizard-state-machine.js';
import { addCustomMcpEntry } from '../../src/global/mcp/custom-mcp-store.js';
import { McpConfigService } from '../../src/global/mcp/mcp-config-service.js';
import { runMcpInteractiveWizard } from '../../src/global/mcp/interactive-wizard.js';

const SENTINEL = 'sk-openkit-wizard-sentinel-945';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-mcp-wizard-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createIo() {
  const output = { stdout: '', stderr: '' };
  return {
    output,
    io: {
      stdin: { isTTY: true },
      stdout: {
        isTTY: true,
        write(chunk) {
          output.stdout += chunk;
        },
      },
      stderr: {
        isTTY: true,
        write(chunk) {
          output.stderr += chunk;
        },
      },
    },
  };
}

function scriptedPrompts(answers = []) {
  return {
    isInteractive: true,
    async promptLine() {
      return answers.shift() ?? 'finish';
    },
    close() {},
  };
}

test('wizard state machine keeps invalid choices and cancellation non-mutating', () => {
  const initial = { state: 'inventory', scope: 'openkit', selectedMcpId: null, cancelled: false };

  assert.equal(transitionWizardState(initial, { type: 'choose_scope', scope: 'invalid' }).state, 'inventory');
  assert.equal(transitionWizardState(initial, { type: 'choose_scope', scope: 'global' }).scope, 'global');
  assert.equal(transitionWizardState(initial, { type: 'choose_mcp', mcpId: 'context7' }).state, 'action_selection');
  const cancelled = transitionWizardState(initial, { type: 'cancel' });
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(cancelled.cancelled, true);
});

test('McpConfigService exposes redacted inventory and does not create files when listing', () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const result = service.list({ scope: 'openkit' });

  assert.equal(result.scope, 'openkit');
  assert.ok(result.statuses.some((status) => status.mcpId === 'context7'));
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'mcp-config.json')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'secrets.env')), false);
});

test('McpConfigService setKey writes secret once and returns per-scope redacted results for both', () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const result = service.setKey('context7', SENTINEL, { scope: 'both' });

  assert.equal(result.action, 'set-key');
  assert.equal(result.scopeResults.openkit, 'success');
  assert.equal(result.scopeResults.global, 'success');
  assert.equal(result.keyState, 'present_redacted');
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.match(fs.readFileSync(path.join(tempHome, 'openkit', 'secrets.env'), 'utf8'), new RegExp(SENTINEL));
  assert.equal(readJson(path.join(tempHome, 'openkit', 'mcp-config.json')).scopes.global.context7.enabled, true);
});

test('McpConfigService enable is idempotent and reports unchanged scopes as skipped', () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const first = service.enable('context7', { scope: 'openkit' });
  const second = service.enable('context7', { scope: 'openkit' });

  assert.equal(first.scopeResults.openkit, 'success');
  assert.equal(second.scopeResults.openkit, 'skipped');
  assert.equal(readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json')).mcp.context7.enabled, true);
});

test('McpConfigService test skips disabled and reports missing key without provider calls', () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const disabled = service.test('context7', { scope: 'openkit' });
  assert.equal(disabled.status, 'skipped');
  assert.equal(disabled.reason, 'disabled');

  service.enable('context7', { scope: 'openkit' });
  const missingKey = service.test('context7', { scope: 'openkit' });
  assert.equal(missingKey.status, 'not_configured');
  assert.equal(missingKey.reason, 'missing_key');
});

test('McpConfigService both-scope health returns openkit and global statuses separately', () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });

  service.enable('context7', { scope: 'global' });
  const selectedResults = service.test('context7', { scope: 'both' });
  const allResults = service.testAll({ scope: 'both' }).filter((result) => result.mcpId === 'context7');

  assert.deepEqual(selectedResults.map((result) => result.scope), ['openkit', 'global']);
  assert.equal(selectedResults.find((result) => result.scope === 'openkit').status, 'skipped');
  assert.equal(selectedResults.find((result) => result.scope === 'openkit').reason, 'disabled');
  assert.equal(selectedResults.find((result) => result.scope === 'global').status, 'not_configured');
  assert.equal(selectedResults.find((result) => result.scope === 'global').reason, 'missing_key');
  assert.deepEqual(allResults.map((result) => result.scope), ['openkit', 'global']);
});

test('interactive wizard both-scope all health test renders per-scope status', async () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });
  service.enable('context7', { scope: 'global' });
  const { io, output } = createIo();

  const exitCode = await runMcpInteractiveWizard({
    scope: 'both',
    io,
    env: { OPENCODE_HOME: tempHome, PATH: '' },
    promptAdapter: scriptedPrompts(['test', 'finish']),
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /context7 \[openkit\]: skipped \(disabled\)/);
  assert.match(output.stdout, /context7 \[global\]: not_configured \(missing_key\)/);
});

test('interactive wizard both-scope selected health test renders per-scope status', async () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });
  service.enable('context7', { scope: 'global' });
  const { io, output } = createIo();

  const exitCode = await runMcpInteractiveWizard({
    scope: 'both',
    io,
    env: { OPENCODE_HOME: tempHome, PATH: '' },
    promptAdapter: scriptedPrompts(['select', 'context7', 'test', 'finish']),
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /context7 \[openkit\]: skipped \(disabled\)/);
  assert.match(output.stdout, /context7 \[global\]: not_configured \(missing_key\)/);
});

test('McpConfigService rejects key mutation for MCPs without catalog secret bindings', () => {
  const tempHome = makeTempHome();
  const service = new McpConfigService({ env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.throws(() => service.setKey('openkit', SENTINEL, { scope: 'openkit' }), /does not define/);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'secrets.env')), false);
});

test('interactive wizard lists custom MCPs separately and routes creation to non-interactive commands', async () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome, PATH: '' };
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom.js'], environment: {} },
    secretBindings: [],
    riskWarnings: ['Local custom MCP execution can run code on this machine.'],
  }, { env });
  const { io, output } = createIo();

  const exitCode = await runMcpInteractiveWizard({
    scope: 'openkit',
    io,
    env,
    promptAdapter: scriptedPrompts(['custom', 'create', 'finish']),
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /Custom MCP inventory/);
  assert.match(output.stdout, /custom-local/);
  assert.match(output.stdout, /openkit configure mcp custom add-local/);
  assert.doesNotMatch(output.stdout, new RegExp(SENTINEL));
});

test('interactive wizard custom path tests custom MCPs with standard status output', async () => {
  const tempHome = makeTempHome();
  const env = { OPENCODE_HOME: tempHome, PATH: '' };
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom.js'], environment: { CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}' } },
    secretBindings: [{ id: 'custom-token', envVar: 'CUSTOM_MCP_TOKEN', required: true, placeholder: '${CUSTOM_MCP_TOKEN}', source: 'custom' }],
    riskWarnings: ['Local custom MCP execution can run code on this machine.'],
  }, { env });
  const { io, output } = createIo();

  const exitCode = await runMcpInteractiveWizard({
    scope: 'openkit',
    io,
    env,
    promptAdapter: scriptedPrompts(['custom', 'test', 'custom-local', 'finish']),
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /custom-local \[openkit\]: not_configured \(missing_key\)/);
  assert.doesNotMatch(output.stdout, new RegExp(SENTINEL));
});
