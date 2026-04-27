import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(projectRoot, 'bin', 'openkit.js');
const SENTINEL = 'sk-openkit-custom-cli-sentinel-948';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-configure-mcp-custom-'));
}

function runCli(args, { env = {}, input = null } = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input,
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('custom list reports empty set without mutating config', () => {
  const tempHome = makeTempHome();
  const result = runCli(['configure', 'mcp', 'custom', 'list', '--json'], { env: { OPENCODE_HOME: tempHome } });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'ok');
  assert.deepEqual(payload.customMcps, []);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'custom-mcp-config.json')), false);
});

test('custom add-local stores argv definition and materializes placeholder-only profile', () => {
  const tempHome = makeTempHome();
  const result = runCli([
    'configure', 'mcp', 'custom', 'add-local', 'custom-local',
    '--cmd', 'node', '--arg', '/tmp/server.js', '--env', 'CUSTOM_MCP_TOKEN=${CUSTOM_MCP_TOKEN}',
    '--scope', 'openkit', '--enable', '--yes', '--json',
  ], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.action, 'custom-add-local');
  assert.equal(payload.customMcp.mcpId, 'custom-local');
  assert.ok(payload.warnings.some((warning) => /local custom MCP execution/i.test(warning)));
  const profile = readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json'));
  assert.deepEqual(profile.mcp['custom-local'].command, ['node', '/tmp/server.js']);
  assert.equal(profile.mcp['custom-local'].environment.CUSTOM_MCP_TOKEN, '${CUSTOM_MCP_TOKEN}');
  assert.equal(JSON.stringify(profile).includes(SENTINEL), false);
});

test('custom add-local rejects shell operators with no mutation', () => {
  const tempHome = makeTempHome();
  const result = runCli([
    'configure', 'mcp', 'custom', 'add-local', 'custom-local',
    '--cmd', 'node', '--arg', 'server.js', '--arg', '&&', '--arg', 'rm', '--yes',
  ], { env: { OPENCODE_HOME: tempHome } });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /shell operator/i);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'custom-mcp-config.json')), false);
});

test('custom add-remote rejects unsafe raw authorization header without leaking value', () => {
  const tempHome = makeTempHome();
  const result = runCli([
    'configure', 'mcp', 'custom', 'add-remote', 'custom-remote',
    '--url', 'https://example.invalid/mcp', '--header', `Authorization=Bearer ${SENTINEL}`, '--yes',
  ], { env: { OPENCODE_HOME: tempHome } });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /placeholder-only|raw header secrets/i);
  assert.doesNotMatch(result.stderr, new RegExp(SENTINEL));
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'custom-mcp-config.json')), false);
});

test('custom add-remote rejects token-looking query parameter values without leaking value', () => {
  const tempHome = makeTempHome();
  const result = runCli([
    'configure', 'mcp', 'custom', 'add-remote', 'custom-remote',
    '--url', `https://example.invalid/mcp?debug=${SENTINEL}`, '--yes',
  ], { env: { OPENCODE_HOME: tempHome } });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /query parameters/i);
  assert.doesNotMatch(result.stderr, new RegExp(SENTINEL));
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'custom-mcp-config.json')), false);
});

test('custom add-remote accepts localhost http with warning and placeholder headers', () => {
  const tempHome = makeTempHome();
  const result = runCli([
    'configure', 'mcp', 'custom', 'add-remote', 'custom-remote',
    '--url', 'http://localhost:8787/mcp', '--transport', 'http', '--header', 'Authorization=${CUSTOM_MCP_AUTHORIZATION}', '--yes', '--json',
  ], { env: { OPENCODE_HOME: tempHome } });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.warnings.some((warning) => /localhost HTTP/i.test(warning)));
  const profile = readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json'));
  assert.equal(profile.mcp['custom-remote'].url, 'http://localhost:8787/mcp');
  assert.equal(profile.mcp['custom-remote'].headers.Authorization, '${CUSTOM_MCP_AUTHORIZATION}');
});

test('custom import-global converts raw env secret to placeholder and does not mutate source global entry', () => {
  const tempHome = makeTempHome();
  writeJson(path.join(tempHome, 'opencode.json'), {
    mcp: {
      legacy: {
        type: 'local',
        command: ['node', '/tmp/legacy.js'],
        environment: { LEGACY_API_KEY: SENTINEL },
        enabled: true,
      },
    },
  });

  const result = runCli(['configure', 'mcp', 'custom', 'import-global', 'legacy', '--scope', 'openkit', '--yes', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.outcome, 'needs_secret_setup');
  assert.equal(JSON.stringify(payload).includes(SENTINEL), false);
  assert.equal(readJson(path.join(tempHome, 'opencode.json')).mcp.legacy.environment.LEGACY_API_KEY, SENTINEL);
  const customConfig = readJson(path.join(tempHome, 'openkit', 'custom-mcp-config.json'));
  assert.equal(customConfig.entries.legacy.definition.environment.LEGACY_API_KEY, '${LEGACY_API_KEY}');
});

test('custom import-global --select reports per-entry outcomes without hiding partial failures', () => {
  const tempHome = makeTempHome();
  writeJson(path.join(tempHome, 'opencode.json'), {
    mcp: {
      legacy: { type: 'local', command: ['node', '/tmp/legacy.js'], enabled: true },
      invalid: { url: 'javascript:alert(1)' },
    },
  });

  const result = runCli(['configure', 'mcp', 'custom', 'import-global', '--select', 'legacy,invalid,missing', '--scope', 'openkit', '--yes', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.action, 'custom-import-global-batch');
  assert.deepEqual(payload.results.map((item) => item.globalId), ['legacy', 'invalid', 'missing']);
  assert.equal(payload.results.find((item) => item.globalId === 'legacy').outcome, 'imported');
  assert.equal(payload.results.find((item) => item.globalId === 'invalid').outcome, 'invalid');
  assert.equal(payload.results.find((item) => item.globalId === 'missing').outcome, 'skipped');
  const customConfig = readJson(path.join(tempHome, 'openkit', 'custom-mcp-config.json'));
  assert.equal(customConfig.entries.legacy.origin, 'imported-global');
  assert.equal(customConfig.entries.invalid, undefined);
});

test('custom disable remove doctor and test are idempotent and redacted', () => {
  const tempHome = makeTempHome();
  runCli([
    'configure', 'mcp', 'custom', 'add-local', 'custom-local',
    '--cmd', 'node', '--arg', '/tmp/server.js', '--scope', 'openkit', '--enable', '--yes',
  ], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const disabled = runCli(['configure', 'mcp', 'custom', 'disable', 'custom-local', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });
  const doctor = runCli(['configure', 'mcp', 'custom', 'doctor', 'custom-local', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });
  const testResult = runCli(['configure', 'mcp', 'custom', 'test', 'custom-local', '--yes', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });
  const removed = runCli(['configure', 'mcp', 'custom', 'remove', 'custom-local', '--scope', 'all', '--yes', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });
  const removedAgain = runCli(['configure', 'mcp', 'custom', 'remove', 'custom-local', '--scope', 'all', '--yes', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(disabled.status, 0, disabled.stderr);
  assert.equal(JSON.parse(doctor.stdout).customMcps[0].enabled, false);
  assert.equal(JSON.parse(testResult.stdout).status, 'skipped');
  assert.equal(JSON.parse(removed.stdout).status, 'removed');
  assert.equal(JSON.parse(removedAgain.stdout).status, 'already_absent');
  assert.equal([disabled, doctor, testResult, removed, removedAgain].some((entry) => entry.stdout.includes(SENTINEL) || entry.stderr.includes(SENTINEL)), false);
});

test('custom doctor without id reports all custom MCPs for both scope as JSON', () => {
  const tempHome = makeTempHome();
  runCli([
    'configure', 'mcp', 'custom', 'add-local', 'custom-local',
    '--cmd', 'node', '--arg', '/tmp/server.js', '--scope', 'openkit', '--enable', '--yes',
  ], { env: { OPENCODE_HOME: tempHome, PATH: '' } });
  runCli([
    'configure', 'mcp', 'custom', 'add-remote', 'custom-remote',
    '--url', 'http://localhost:8787/mcp', '--transport', 'http', '--scope', 'global', '--enable', '--yes',
  ], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const result = runCli(['configure', 'mcp', 'custom', 'doctor', '--scope', 'both', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Unknown custom MCP '--scope'/);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.scope, 'both');
  assert.match(payload.directOpenCodeCaveat, /Direct OpenCode/);
  assert.deepEqual(payload.customMcps.map((item) => `${item.mcpId}:${item.scope}`), [
    'custom-local:openkit',
    'custom-remote:openkit',
    'custom-local:global',
    'custom-remote:global',
  ]);
  assert.equal(payload.customMcps.find((item) => item.mcpId === 'custom-local' && item.scope === 'openkit').enabled, true);
  assert.equal(payload.customMcps.find((item) => item.mcpId === 'custom-local' && item.scope === 'global').enabled, false);
  assert.equal(payload.customMcps.find((item) => item.mcpId === 'custom-remote' && item.scope === 'global').enabled, true);
});

test('custom doctor without id reports both-scope custom MCPs as text', () => {
  const tempHome = makeTempHome();
  runCli([
    'configure', 'mcp', 'custom', 'add-local', 'custom-local',
    '--cmd', 'node', '--arg', '/tmp/server.js', '--scope', 'both', '--enable', '--yes',
  ], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const result = runCli(['configure', 'mcp', 'custom', 'doctor', '--scope', 'both'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Scope: both/);
  assert.match(result.stdout, /custom-local \[openkit\]/);
  assert.match(result.stdout, /custom-local \[global\]/);
  assert.match(result.stdout, /Direct OpenCode/);
  assert.doesNotMatch(result.stderr, /Unknown custom MCP '--scope'/);
});

test('custom add-local both scope reports global unmanaged conflict while preserving openkit materialization', () => {
  const tempHome = makeTempHome();
  writeJson(path.join(tempHome, 'opencode.json'), {
    mcp: { 'custom-local': { type: 'local', command: ['user-owned'], enabled: true } },
  });

  const result = runCli([
    'configure', 'mcp', 'custom', 'add-local', 'custom-local',
    '--cmd', 'node', '--arg', '/tmp/server.js', '--scope', 'both', '--enable', '--yes', '--json',
  ], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.scopeResults.openkit, 'success');
  assert.equal(payload.scopeResults.global, 'conflict');
  assert.equal(readJson(path.join(tempHome, 'opencode.json')).mcp['custom-local'].command[0], 'user-owned');
  assert.equal(readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json')).mcp['custom-local'].enabled, true);
});

test('custom commands reject bundled id collisions and preserve bundled command behavior', () => {
  const tempHome = makeTempHome();
  const custom = runCli(['configure', 'mcp', 'custom', 'add-local', 'context7', '--cmd', 'node', '--yes'], { env: { OPENCODE_HOME: tempHome } });
  const bundled = runCli(['configure', 'mcp', 'list'], { env: { OPENCODE_HOME: tempHome } });

  assert.notEqual(custom.status, 0);
  assert.match(custom.stderr, /bundled MCP id/i);
  assert.equal(bundled.status, 0);
  assert.match(bundled.stdout, /context7/);
});
