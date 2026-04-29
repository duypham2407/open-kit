import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worktreeRoot = path.resolve(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-profiles-cli-'));
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
    }

    const status = await runPromise;
    await new Promise((resolve) => setImmediate(resolve));
    return { status, stdout: stdoutText, stderr: stderrText };
  } finally {
    process.chdir(originalCwd);
    process.env = originalEnv;
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createFakeOpenCodeBin(tempHome) {
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'ast-grep'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(fakeBinDir, 'sg'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(fakeBinDir, 'semgrep'), '#!/bin/sh\nexit 0\n');
  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    `#!/bin/sh
if [ "$1" = "models" ]; then
  if [ "$2" = "--verbose" ]; then
    cat <<'EOF'
anthropic/claude-sonnet-4-5
{
  "variants": {}
}
openai/gpt-5
{
  "variants": {
    "high": {},
    "low": {}
  }
}
openai/gpt-5-mini
{
  "variants": {}
}
EOF
    exit 0
  fi
  printf "anthropic/claude-sonnet-4-5\nopenai/gpt-5\nopenai/gpt-5-mini\n"
  exit 0
fi
exit 0
`
  );

  return fakeBinDir;
}

function createEnv(tempHome) {
  const fakeBinDir = createFakeOpenCodeBin(tempHome);
  return {
    ...process.env,
    OPENCODE_HOME: tempHome,
    PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
  };
}

function profilesPath(tempHome) {
  return path.join(tempHome, 'openkit', 'agent-model-profiles.json');
}

function writeProfileStore(tempHome, profiles, defaultProfile = null) {
  writeJson(profilesPath(tempHome), {
    schema: 'openkit/agent-model-profiles@1',
    stateVersion: 1,
    updatedAt: '2026-04-29T00:00:00.000Z',
    defaultProfile,
    profiles,
  });
}

function runtimeSessionsIndexPath(tempHome, workspaceId = 'workspace-delete-guard') {
  return path.join(tempHome, 'workspaces', workspaceId, 'openkit', '.opencode', 'runtime-sessions', 'index.json');
}

test('profiles help documents only profile-management flags and the session boundary', async () => {
  const result = await runCli(['profiles', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: openkit profiles \[--create\|--edit\|--list\|--delete\|--set-default\]/);
  assert.match(result.stdout, /--create/);
  assert.match(result.stdout, /--edit/);
  assert.match(result.stdout, /--list/);
  assert.match(result.stdout, /--delete/);
  assert.match(result.stdout, /--set-default/);
  assert.match(result.stdout, /global/i);
  assert.match(result.stdout, /\/switch-profiles.*session-only/);
  assert.doesNotMatch(result.stdout, /--models/);
});

test('profiles rejects unsupported flags instead of accepting configure-agent-model options', async () => {
  const result = await runCli(['profiles', '--models']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown argument: --models/);
});

test('profiles rejects multiple action flags', async () => {
  const result = await runCli(['profiles', '--list', '--delete']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use exactly one profiles action flag/);
});

test('profiles --list succeeds with clear empty-list messaging', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);

  const result = await runCli(['profiles', '--list'], { env });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /No global agent model profiles have been created yet/);
  assert.equal(fs.existsSync(profilesPath(tempHome)), false);
});

test('profiles --create saves a sparse strict-choice profile and blocks duplicate names', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  const answers = ['daily', 'Daily QA profile', '5', '3', '2', 'n', 'y'];

  const result = await runCli(['profiles', '--create'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Saved profile daily/);

  const store = readJson(profilesPath(tempHome));
  assert.deepEqual(store.profiles.daily.agentModels, {
    'qa-agent': { model: 'openai/gpt-5-mini' },
  });
  assert.equal(store.defaultProfile, null);

  const duplicate = await runCli(['profiles', '--create'], {
    env,
    prompt: async () => 'daily',
  });

  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /Profile daily already exists/);
  assert.deepEqual(Object.keys(readJson(profilesPath(tempHome)).profiles), ['daily']);
});

test('profiles --create cancels safely before saving an empty profile', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  const answers = ['scratch', 'Temporary profile', 'q'];

  const result = await runCli(['profiles', '--create'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Profile creation cancelled/);
  assert.equal(fs.existsSync(profilesPath(tempHome)), false);
});

test('profiles --edit updates an existing profile without changing other profiles', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  writeProfileStore(tempHome, {
    daily: {
      name: 'daily',
      description: 'Daily profile',
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    heavy: {
      name: 'heavy',
      description: null,
      agentModels: {
        'product-lead-agent': { model: 'openai/gpt-5' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  });
  const answers = ['1', '', 'Updated daily profile', '5', 'n', '3', '1', '2', 'n', 'y'];

  const result = await runCli(['profiles', '--edit'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Updated profile daily/);

  const store = readJson(profilesPath(tempHome));
  assert.equal(store.profiles.daily.description, 'Updated daily profile');
  assert.deepEqual(store.profiles.daily.agentModels['qa-agent'], { model: 'openai/gpt-5', variant: 'high' });
  assert.deepEqual(store.profiles.heavy.agentModels, {
    'product-lead-agent': { model: 'openai/gpt-5' },
  });
});

test('profiles --edit removes a selected role and persists remaining role updates', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  writeProfileStore(tempHome, {
    daily: {
      name: 'daily',
      description: 'Daily profile',
      agentModels: {
        'product-lead-agent': { model: 'openai/gpt-5-mini' },
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  });
  const answers = ['1', '', '', '2', 'y', 'y', '5', 'n', '3', '1', '2', 'n', 'y'];

  const result = await runCli(['profiles', '--edit'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Updated profile daily/);

  const store = readJson(profilesPath(tempHome));
  assert.deepEqual(store.profiles.daily.agentModels, {
    'qa-agent': { model: 'openai/gpt-5', variant: 'high' },
  });
  assert.equal(Object.hasOwn(store.profiles.daily.agentModels, 'product-lead-agent'), false);
});

test('profiles --set-default and --delete use profile selection, confirmations, and default guard', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  writeProfileStore(tempHome, {
    daily: {
      name: 'daily',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    heavy: {
      name: 'heavy',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  });

  let answers = ['2'];
  let result = await runCli(['profiles', '--set-default'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Default profile set to heavy/);
  assert.equal(readJson(profilesPath(tempHome)).defaultProfile, 'heavy');

  answers = ['2'];
  result = await runCli(['profiles', '--delete'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot delete default profile heavy/);
  assert.equal(readJson(profilesPath(tempHome)).profiles.heavy.name, 'heavy');

  answers = ['1', 'y'];
  result = await runCli(['profiles', '--delete'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Deleted profile daily/);
  assert.deepEqual(Object.keys(readJson(profilesPath(tempHome)).profiles), ['heavy']);
});

test('profiles --delete blocks profiles active via launch default metadata in running sessions', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  writeProfileStore(tempHome, {
    daily: {
      name: 'daily',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    heavy: {
      name: 'heavy',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  }, 'heavy');
  writeJson(runtimeSessionsIndexPath(tempHome), {
    sessions: [
      {
        session_id: 'session_running_daily',
        recorded_at: '2026-04-29T00:00:00.000Z',
        exitCode: null,
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
    ],
  });

  const answers = ['1'];
  const result = await runCli(['profiles', '--delete'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot delete profile daily because it is active in running OpenKit sessions/);
  assert.match(result.stderr, /Exit affected sessions first/);
  assert.equal(readJson(profilesPath(tempHome)).profiles.daily.name, 'daily');
});

test('profiles --delete ignores stale completed sessions and removes deleted profile from later lists', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  writeProfileStore(tempHome, {
    daily: {
      name: 'daily',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    heavy: {
      name: 'heavy',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  }, 'heavy');
  writeJson(runtimeSessionsIndexPath(tempHome), {
    sessions: [
      {
        session_id: 'session_completed_daily',
        recorded_at: '2026-04-29T00:00:00.000Z',
        exitCode: 0,
        activeAgentModelProfile: {
          name: 'daily',
          source: 'global_default',
        },
      },
    ],
  });

  let answers = ['1', 'y'];
  const deleteResult = await runCli(['profiles', '--delete'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(deleteResult.status, 0);
  assert.match(deleteResult.stdout, /Deleted profile daily/);
  assert.deepEqual(Object.keys(readJson(profilesPath(tempHome)).profiles), ['heavy']);

  const listResult = await runCli(['profiles', '--list'], { env });
  assert.equal(listResult.status, 0);
  assert.doesNotMatch(listResult.stdout, /daily/);
  assert.match(listResult.stdout, /heavy/);
});

test('profiles --delete blocks profiles active via session-specific switch state', async () => {
  const tempHome = makeTempDir();
  const env = createEnv(tempHome);
  writeProfileStore(tempHome, {
    daily: {
      name: 'daily',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5-mini' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    heavy: {
      name: 'heavy',
      description: null,
      agentModels: {
        'qa-agent': { model: 'openai/gpt-5' },
      },
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  }, 'heavy');
  const sessionId = 'session_switched_daily';
  const sessionIndexPath = runtimeSessionsIndexPath(tempHome);
  writeJson(sessionIndexPath, {
    sessions: [
      {
        session_id: sessionId,
        recorded_at: '2026-04-29T00:00:00.000Z',
        exitCode: null,
        activeAgentModelProfile: {
          name: 'heavy',
          source: 'global_default',
        },
      },
    ],
  });
  writeJson(
    path.join(path.dirname(sessionIndexPath), encodeURIComponent(sessionId), 'active-agent-model-profile.json'),
    {
      schema: 'openkit/active-agent-model-profile@1',
      stateVersion: 1,
      profileName: 'daily',
      selectedAt: '2026-04-29T00:00:00.000Z',
      source: 'switch_profiles',
      sessionId,
    }
  );

  const answers = ['1'];
  const result = await runCli(['profiles', '--delete'], {
    env,
    prompt: async () => answers.shift() ?? '',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot delete profile daily because it is active in running OpenKit sessions/);
  assert.match(result.stderr, /session_switched_daily/);
  assert.equal(readJson(profilesPath(tempHome)).profiles.daily.name, 'daily');
});
