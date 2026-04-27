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
const SENTINEL = 'sk-openkit-cli-sentinel-941';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-configure-mcp-'));
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

test('openkit configure mcp list defaults to openkit scope with redacted key state', () => {
  const tempHome = makeTempHome();
  const result = runCli(['configure', 'mcp', 'list'], { env: { OPENCODE_HOME: tempHome } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Scope: openkit/);
  assert.match(result.stdout, /context7/);
  assert.match(result.stdout, /missing/);
  assert.doesNotMatch(result.stdout, /sk-openkit/);
});

test('enable and disable materialize selected scope without raw secrets', () => {
  const tempHome = makeTempHome();
  let result = runCli(['configure', 'mcp', 'enable', 'context7', '--scope', 'global'], { env: { OPENCODE_HOME: tempHome } });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /enabled context7 for global/);

  let globalConfig = readJson(path.join(tempHome, 'opencode.json'));
  assert.equal(globalConfig.mcp.context7.environment.CONTEXT7_API_KEY, '${CONTEXT7_API_KEY}');
  assert.equal(globalConfig.mcp.context7.enabled, true);

  result = runCli(['configure', 'mcp', 'disable', 'context7', '--scope', 'global'], { env: { OPENCODE_HOME: tempHome } });
  assert.equal(result.status, 0);
  globalConfig = readJson(path.join(tempHome, 'opencode.json'));
  assert.equal(globalConfig.mcp.context7.enabled, false);
});

test('set-key stores secret through stdin, auto-enables scope, and never prints raw value', () => {
  const tempHome = makeTempHome();
  const result = runCli(['configure', 'mcp', 'set-key', 'context7', '--stdin'], {
    env: { OPENCODE_HOME: tempHome },
    input: `${SENTINEL}\n`,
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /CONTEXT7_API_KEY: present \(redacted\)/);
  assert.doesNotMatch(result.stdout, new RegExp(SENTINEL));
  assert.doesNotMatch(result.stderr, new RegExp(SENTINEL));

  const secretFile = fs.readFileSync(path.join(tempHome, 'openkit', 'secrets.env'), 'utf8');
  assert.match(secretFile, new RegExp(SENTINEL));
  const config = readJson(path.join(tempHome, 'openkit', 'mcp-config.json'));
  assert.equal(config.scopes.openkit.context7.enabled, true);
});

test('disable keeps key and unset-key does not silently disable MCP', () => {
  const tempHome = makeTempHome();
  runCli(['configure', 'mcp', 'set-key', 'context7', '--stdin'], {
    env: { OPENCODE_HOME: tempHome },
    input: `${SENTINEL}\n`,
  });
  runCli(['configure', 'mcp', 'disable', 'context7'], { env: { OPENCODE_HOME: tempHome } });
  assert.match(fs.readFileSync(path.join(tempHome, 'openkit', 'secrets.env'), 'utf8'), new RegExp(SENTINEL));

  runCli(['configure', 'mcp', 'enable', 'context7'], { env: { OPENCODE_HOME: tempHome } });
  const result = runCli(['configure', 'mcp', 'unset-key', 'context7'], { env: { OPENCODE_HOME: tempHome } });
  const config = readJson(path.join(tempHome, 'openkit', 'mcp-config.json'));

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, new RegExp(SENTINEL));
  assert.equal(config.scopes.openkit.context7.enabled, true);
  assert.doesNotMatch(fs.readFileSync(path.join(tempHome, 'openkit', 'secrets.env'), 'utf8'), new RegExp(SENTINEL));
});

test('configure mcp rejects unknown MCP, invalid scope, and set-key for no-key MCP', () => {
  const tempHome = makeTempHome();
  assert.notEqual(runCli(['configure', 'mcp', 'enable', 'missing'], { env: { OPENCODE_HOME: tempHome } }).status, 0);
  assert.notEqual(runCli(['configure', 'mcp', 'enable', 'context7', '--scope', 'invalid'], { env: { OPENCODE_HOME: tempHome } }).status, 0);
  assert.notEqual(runCli(['configure', 'mcp', 'set-key', 'openkit', '--stdin'], { env: { OPENCODE_HOME: tempHome }, input: `${SENTINEL}\n` }).status, 0);
});

test('doctor and test output are redacted and distinguish disabled state', () => {
  const tempHome = makeTempHome();
  runCli(['configure', 'mcp', 'set-key', 'context7', '--stdin'], {
    env: { OPENCODE_HOME: tempHome },
    input: `${SENTINEL}\n`,
  });
  runCli(['configure', 'mcp', 'disable', 'context7'], { env: { OPENCODE_HOME: tempHome } });

  const doctor = runCli(['configure', 'mcp', 'doctor'], { env: { OPENCODE_HOME: tempHome } });
  const testResult = runCli(['configure', 'mcp', 'test', 'context7'], { env: { OPENCODE_HOME: tempHome } });

  assert.equal(doctor.status, 0);
  assert.doesNotMatch(doctor.stdout, new RegExp(SENTINEL));
  assert.equal(testResult.status, 0);
  assert.match(testResult.stdout, /disabled/);
  assert.doesNotMatch(testResult.stdout, new RegExp(SENTINEL));
});

test('test command with both scope reports partial per-scope status', () => {
  const tempHome = makeTempHome();
  runCli(['configure', 'mcp', 'enable', 'context7', '--scope', 'global'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  const result = runCli(['configure', 'mcp', 'test', 'context7', '--scope', 'both'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });
  const jsonResult = runCli(['configure', 'mcp', 'test', 'context7', '--scope', 'both', '--json'], { env: { OPENCODE_HOME: tempHome, PATH: '' } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /context7 \[openkit\]: skipped \(disabled\)/);
  assert.match(result.stdout, /context7 \[global\]: not_configured \(missing_key\)/);
  assert.equal(jsonResult.status, 0);
  const payload = JSON.parse(jsonResult.stdout);
  assert.deepEqual(payload.map((item) => item.scope), ['openkit', 'global']);
  assert.equal(payload.find((item) => item.scope === 'openkit').status, 'skipped');
  assert.equal(payload.find((item) => item.scope === 'global').status, 'not_configured');
});

test('configure help includes safe key input guidance', () => {
  const result = runCli(['configure', 'mcp', '--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /set-key/);
  assert.match(result.stdout, /--stdin/);
  assert.match(result.stdout, /direct OpenCode/);
});
