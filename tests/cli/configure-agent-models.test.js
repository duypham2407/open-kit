import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worktreeRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(worktreeRoot, 'bin', 'openkit.js');

process.env.OPENCODE_CLIENT = 'test';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-configure-agent-models-'));
}

async function runCli(args, { cwd = worktreeRoot, env, input, prompt } = {}) {
  const { runCli } = await import('../../src/cli/index.js');
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const originalCwd = process.cwd();
  const originalEnv = process.env;

  let stdoutText = '';
  let stderrText = '';
  stdout.setEncoding('utf8');
  stderr.setEncoding('utf8');
  stdout.on('data', (chunk) => {
    stdoutText += chunk;
  });
  stderr.on('data', (chunk) => {
    stderrText += chunk;
  });

  process.env = env ?? process.env;
  process.chdir(cwd);

  try {
    const runPromise = runCli(args, { stdout, stderr, stdin, prompt });

    if (typeof input === 'string') {
      stdin.write(input);
      stdin.end();
    } else {
      stdin.end();
    }

    const timeoutMs = 20_000;
    const status = await Promise.race([
      runPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`runCli timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    return {
      status,
      stdout: stdoutText,
      stderr: stderrText,
    };
  } finally {
    process.chdir(originalCwd);
    process.env = originalEnv;
    stdout.destroy();
    stderr.destroy();
    stdin.destroy();
  }
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('configure-agent-models lists agents and saves a provider-qualified override', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nif [ "$1" = "models" ]; then\n  printf "openai/gpt-5\\nanthropic/claude-sonnet-4-5\\n"\n  exit 0\nfi\nexit 0\n');

  let result = await runCli(['configure-agent-models', '--list'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /master-orchestrator/);
  assert.match(result.stdout, /qa-agent/);

  result = await runCli(['configure-agent-models', '--models', 'openai', '--agent', 'qa-agent', '--model', 'openai/gpt-5'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /openai\/gpt-5/);
  assert.match(result.stdout, /Saved openai\/gpt-5 for qa-agent/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
});

test('configure-agent-models preserves fallback policy fields already stored for an agent', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');
  fs.mkdirSync(path.join(tempHome, 'openkit'), { recursive: true });
  fs.writeFileSync(
    path.join(tempHome, 'openkit', 'agent-models.json'),
    `${JSON.stringify(
      {
        schema: 'openkit/agent-model-settings@1',
        stateVersion: 1,
        updatedAt: '2026-03-24T00:00:00.000Z',
        agentModels: {
          'qa-agent': {
            model: 'openai/gpt-5',
            fallback_models: ['openai/gpt-5-mini'],
            auto_fallback: { enabled: true, after_failures: 3 },
            profiles: [
              { model: 'openai/gpt-5' },
              { model: 'azure/gpt-5' },
            ],
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const result = await runCli(['configure-agent-models', '--agent', 'qa-agent', '--model', 'anthropic/claude-sonnet-4-5'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 0);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'].model, 'anthropic/claude-sonnet-4-5');
  assert.deepEqual(settings.agentModels['qa-agent'].fallback_models, ['openai/gpt-5-mini']);
  assert.deepEqual(settings.agentModels['qa-agent'].auto_fallback, { enabled: true, after_failures: 3 });
  assert.deepEqual(settings.agentModels['qa-agent'].profiles, [
    { model: 'openai/gpt-5' },
    { model: 'azure/gpt-5' },
  ]);
});

test('configure-agent-models rejects invalid model ids and can clear overrides', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  let result = await runCli(['configure-agent-models', '--agent', 'qa-agent', '--model', 'gpt-5'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /provider\/model/);

  result = await runCli(['configure-agent-models', '--agent', 'qa-agent', '--model', 'openai/gpt-5'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 0);

  result = await runCli(['configure-agent-models', '--agent', 'qa-agent', '--clear'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Cleared model override for qa-agent/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'], undefined);
});

test('configure-agent-models supports an interactive setup flow', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    '#!/bin/sh\nif [ "$1" = "models" ]; then\n  if [ "$2" = "--verbose" ]; then\n    cat <<\'EOF\'\nopenai/gpt-5\n{\n  "variants": {\n    "none": {},\n    "minimal": {},\n    "low": {},\n    "medium": {},\n    "high": {},\n    "xhigh": {}\n  }\n}\nopenai/gpt-5-mini\n{\n  "variants": {}\n}\nanthropic/claude-sonnet-4-5\n{\n  "variants": {\n    "high": {},\n    "max": {}\n  }\n}\nEOF\n    exit 0\n  fi\n  printf "openai/gpt-5\\nopenai/gpt-5-mini\\nanthropic/claude-sonnet-4-5\\n"\n  exit 0\nfi\nexit 0\n'
  );

  const answers = ['5', '3', '2', 'n'];
  const result = await runCli(['configure-agent-models', '--interactive'], {
    cwd: worktreeRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Interactive OpenKit agent model setup/);
  assert.match(result.stdout, /Saved openai\/gpt-5-mini for qa-agent/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5-mini');
});

test('configure-agent-models interactive flow supports provider search without typing full model ids', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    '#!/bin/sh\nif [ "$1" = "models" ]; then\n  if [ "$2" = "--verbose" ]; then\n    cat <<\'EOF\'\nopenai/gpt-5\n{\n  "variants": {\n    "high": {}\n  }\n}\nopenai/gpt-5-mini\n{\n  "variants": {}\n}\nanthropic/claude-sonnet-4-5\n{\n  "variants": {\n    "high": {},\n    "max": {}\n  }\n}\ngoogle/gemini-2.5-pro\n{\n  "variants": {\n    "low": {},\n    "high": {}\n  }\n}\nEOF\n    exit 0\n  fi\n  printf "openai/gpt-5\\nopenai/gpt-5-mini\\nanthropic/claude-sonnet-4-5\\ngoogle/gemini-2.5-pro\\n"\n  exit 0\nfi\nexit 0\n'
  );

  const answers = ['4', 's', 'gemini', '1', 'n'];
  const result = await runCli(['configure-agent-models', '--interactive'], {
    cwd: worktreeRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Available providers/);
  assert.match(result.stdout, /Matching models/);
  assert.match(result.stdout, /Saved google\/gemini-2.5-pro for fullstack-agent/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['fullstack-agent'].model, 'google/gemini-2.5-pro');
});

test('configure-agent-models interactive flow can save a variant for supported providers', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    '#!/bin/sh\nif [ "$1" = "models" ]; then\n  if [ "$2" = "--verbose" ]; then\n    cat <<\'EOF\'\nopenai/gpt-5\n{\n  "variants": {\n    "none": {},\n    "minimal": {},\n    "low": {},\n    "medium": {},\n    "high": {},\n    "xhigh": {}\n  }\n}\nopenai/gpt-5-mini\n{\n  "variants": {}\n}\nanthropic/claude-sonnet-4-5\n{\n  "variants": {\n    "high": {},\n    "max": {}\n  }\n}\nEOF\n    exit 0\n  fi\n  printf "openai/gpt-5\\nopenai/gpt-5-mini\\nanthropic/claude-sonnet-4-5\\n"\n  exit 0\nfi\nexit 0\n'
  );

  const answers = ['5', '3', '1', '7', 'n'];
  const result = await runCli(['configure-agent-models', '--interactive'], {
    cwd: worktreeRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Available variants for openai\/gpt-5/);
  assert.match(result.stdout, /Saved openai\/gpt-5 \(variant: xhigh\) for qa-agent/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
  assert.equal(settings.agentModels['qa-agent'].variant, 'xhigh');
});

test('configure-agent-models falls back to plain model selection when verbose discovery is unusable', async () => {
  const tempHome = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    '#!/bin/sh\nif [ "$1" = "models" ]; then\n  if [ "$2" = "--verbose" ]; then\n    printf "model catalog unavailable\\n" >&2\n    exit 1\n  fi\n  printf "openai/gpt-5\\nopenai/gpt-5-mini\\nanthropic/claude-sonnet-4-5\\n"\n  exit 0\nfi\nexit 0\n'
  );

  const answers = ['5', '3', '2', 'n'];
  const result = await runCli(['configure-agent-models', '--interactive'], {
    cwd: worktreeRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stderr, /Falling back to plain `opencode models` output/);
  assert.doesNotMatch(result.stdout, /Available variants/);
  assert.match(result.stdout, /Saved openai\/gpt-5-mini for qa-agent/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5-mini');
  assert.equal(settings.agentModels['qa-agent'].variant, undefined);
});
