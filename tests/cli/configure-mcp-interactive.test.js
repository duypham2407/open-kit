import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runConfigureMcp } from '../../src/global/mcp/mcp-configurator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(projectRoot, 'bin', 'openkit.js');
const SENTINEL = 'sk-openkit-interactive-sentinel-945';

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-configure-mcp-interactive-'));
}

function runCli(args, { env = {}, input = null } = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input,
  });
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

function scriptedPrompts({ answers = [], secrets = [] } = {}) {
  const prompts = [];
  return {
    prompts,
    adapter: {
      isInteractive: true,
      async promptLine(message) {
        prompts.push(message);
        return answers.shift() ?? 'finish';
      },
      async promptSecret(message) {
        prompts.push(message);
        return secrets.shift() ?? '';
      },
      close() {},
    },
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('interactive flag fails fast in non-TTY mode with no mutation and safe alternatives', () => {
  const tempHome = makeTempHome();
  const result = runCli(['configure', 'mcp', '--interactive'], {
    env: { OPENCODE_HOME: tempHome },
    input: '',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires an interactive terminal/i);
  assert.match(result.stderr, /openkit configure mcp set-key <mcp-id> --scope openkit --stdin/);
  assert.doesNotMatch(result.stderr, /--value/);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'mcp-config.json')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'secrets.env')), false);
});

test('interactive mode rejects json output before prompting or mutating', () => {
  const tempHome = makeTempHome();
  const result = runCli(['configure', 'mcp', '--interactive', '--json'], {
    env: { OPENCODE_HOME: tempHome },
    input: '',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--json cannot be combined with --interactive/);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'mcp-config.json')), false);
});

test('scripted interactive inventory exit is read-only and redacted', async () => {
  const tempHome = makeTempHome();
  const { io, output } = createIo();
  const prompts = scriptedPrompts({ answers: ['finish'] });

  const exitCode = await runConfigureMcp(['--interactive'], io, {
    env: { OPENCODE_HOME: tempHome, PATH: '' },
    promptAdapter: prompts.adapter,
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /Interactive MCP Setup Wizard/);
  assert.match(output.stdout, /Scope: openkit/);
  assert.match(output.stdout, /context7/);
  assert.match(output.stdout, /Final summary/);
  assert.doesNotMatch(output.stdout, /sk-openkit/);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'mcp-config.json')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'secrets.env')), false);
});

test('scripted interactive set-key stores raw value only in secrets and materializes both scopes with redacted summary', async () => {
  const tempHome = makeTempHome();
  const { io, output } = createIo();
  const prompts = scriptedPrompts({
    answers: ['select', 'context7', 'set-key', 'local_env_file', 'yes', 'finish'],
    secrets: [SENTINEL],
  });

  const exitCode = await runConfigureMcp(['--interactive', '--scope', 'both'], io, {
    env: { OPENCODE_HOME: tempHome, PATH: '' },
    promptAdapter: prompts.adapter,
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /Direct OpenCode launches do not load OpenKit secrets/);
  assert.match(output.stdout, /CONTEXT7_API_KEY: present \(redacted\)/);
  assert.match(output.stdout, /openkit=success/);
  assert.match(output.stdout, /global=success/);
  assert.doesNotMatch(output.stdout, new RegExp(SENTINEL));
  assert.doesNotMatch(output.stderr, new RegExp(SENTINEL));

  const secretFile = fs.readFileSync(path.join(tempHome, 'openkit', 'secrets.env'), 'utf8');
  assert.match(secretFile, new RegExp(SENTINEL));
  assert.equal(JSON.stringify(readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json'))).includes(SENTINEL), false);
  assert.equal(JSON.stringify(readJson(path.join(tempHome, 'opencode.json'))).includes(SENTINEL), false);
  assert.equal(readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json')).mcp.context7.environment.CONTEXT7_API_KEY, '${CONTEXT7_API_KEY}');
  assert.equal(readJson(path.join(tempHome, 'opencode.json')).mcp.context7.environment.CONTEXT7_API_KEY, '${CONTEXT7_API_KEY}');
});

test('scripted interactive both-scope enable reports global unmanaged conflict without overwriting it', async () => {
  const tempHome = makeTempHome();
  fs.writeFileSync(path.join(tempHome, 'opencode.json'), JSON.stringify({
    mcp: {
      context7: { type: 'local', command: ['custom-context7'], enabled: true },
    },
  }, null, 2));
  const { io, output } = createIo();
  const prompts = scriptedPrompts({ answers: ['select', 'context7', 'enable', 'yes', 'finish'] });

  const exitCode = await runConfigureMcp(['--interactive', '--scope', 'both'], io, {
    env: { OPENCODE_HOME: tempHome, PATH: '' },
    promptAdapter: prompts.adapter,
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /openkit=success/);
  assert.match(output.stdout, /global=conflict/);
  assert.match(output.stdout, /existing user-managed global OpenCode entry was preserved/);
  assert.equal(readJson(path.join(tempHome, 'opencode.json')).mcp.context7.command[0], 'custom-context7');
  assert.equal(readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json')).mcp.context7.enabled, true);
});

test('scripted interactive both-scope selected health renders global-only status separately', async () => {
  const tempHome = makeTempHome();
  runConfigureMcp(['enable', 'context7', '--scope', 'global'], createIo().io, {
    env: { OPENCODE_HOME: tempHome, PATH: '' },
  });
  const { io, output } = createIo();
  const prompts = scriptedPrompts({ answers: ['select', 'context7', 'test', 'finish'] });

  const exitCode = await runConfigureMcp(['--interactive', '--scope', 'both'], io, {
    env: { OPENCODE_HOME: tempHome, PATH: '' },
    promptAdapter: prompts.adapter,
  });

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /context7 \[openkit\]: skipped \(disabled\)/);
  assert.match(output.stdout, /context7 \[global\]: not_configured \(missing_key\)/);
});
