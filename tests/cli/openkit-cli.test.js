import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worktreeRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(worktreeRoot, 'bin', 'openkit.js');

function runCli(args, { cwd = worktreeRoot, env } = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: env ?? process.env,
  });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-cli-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

test('openkit --help shows global-install oriented help', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /install-global/);
  assert.match(result.stdout, /upgrade/);
  assert.match(result.stdout, /uninstall/);
  assert.match(result.stdout, /Launch OpenCode with the global OpenKit profile/);
  assert.equal(result.stderr, '');
});

test('openkit doctor --help shows global doctor help', () => {
  const result = runCli(['doctor', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /global OpenKit install and the current workspace/);
  assert.equal(result.stderr, '');
});

test('openkit install-global materializes global kit and profile files', () => {
  const tempHome = makeTempDir();
  const result = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Installed OpenKit globally/);

  const kitRoot = path.join(tempHome, 'kits', 'openkit');
  const profileRoot = path.join(tempHome, 'profiles', 'openkit');

  assert.equal(fs.existsSync(path.join(kitRoot, '.opencode', 'workflow-state.js')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'commands', 'migrate.md')), true);
  assert.equal(fs.existsSync(path.join(profileRoot, 'opencode.json')), true);
  assert.equal(readJson(path.join(profileRoot, 'opencode.json')).openkit.profile, 'openkit');
});

test('openkit init and install remain compatibility aliases for install-global', () => {
  const tempHome = makeTempDir();

  const initResult = runCli(['init'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  const installResult = runCli(['install'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.equal(initResult.status, 0);
  assert.equal(installResult.status, 0);
  assert.match(initResult.stdout, /Installed OpenKit globally/);
  assert.match(installResult.stdout, /Installed OpenKit globally/);
});

test('openkit doctor reports install-missing when global install is absent', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  const result = runCli(['doctor'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Status: install-missing/);
  assert.match(result.stdout, /Global OpenKit install was not found/);
});

test('openkit doctor reports healthy after global install and bootstraps workspace metadata', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  const result = runCli(['doctor'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status: healthy/);
  assert.match(result.stdout, /Workspace root:/);

  const workspacesRoot = path.join(tempHome, 'workspaces');
  const workspaceEntries = fs.readdirSync(workspacesRoot);
  assert.equal(workspaceEntries.length, 1);
  const workspaceMetaPath = path.join(workspacesRoot, workspaceEntries[0], 'openkit', 'workspace.json');
  assert.equal(fs.existsSync(workspaceMetaPath), true);
});

test('openkit run launches opencode with the global profile and workspace env', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const logPath = path.join(tempHome, 'opencode-run.json');

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    `#!/usr/bin/env node
import fs from 'node:fs';
fs.writeFileSync(process.env.OPENKIT_TEST_LOG_PATH, JSON.stringify({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  projectRoot: process.env.OPENKIT_PROJECT_ROOT,
  workflowState: process.env.OPENKIT_WORKFLOW_STATE,
  kitRoot: process.env.OPENKIT_KIT_ROOT,
  configDir: process.env.OPENCODE_CONFIG_DIR,
}, null, 2));
process.stdout.write('mock opencode launched\\n');
`
  );

  const result = runCli(['run', '--mode', 'quick'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      OPENKIT_TEST_LOG_PATH: logPath,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /mock opencode launched/);

  const invocation = readJson(logPath);
  assert.deepEqual(invocation.argv, ['--profile', 'openkit', '--mode', 'quick']);
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(projectRoot));
  assert.equal(fs.realpathSync(invocation.projectRoot), fs.realpathSync(projectRoot));
  assert.equal(invocation.configDir, path.join(tempHome, 'profiles', 'openkit'));
  assert.match(invocation.workflowState, /workspaces\/.*\/openkit\/\.opencode\/workflow-state\.json$/);
  assert.equal(invocation.kitRoot, path.join(tempHome, 'kits', 'openkit'));
});

test('openkit upgrade refreshes the global kit install', () => {
  const tempHome = makeTempDir();

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  const result = runCli(['upgrade'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Upgraded OpenKit global install/);
});

test('openkit uninstall removes the global kit and profile and can remove workspace state', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  let result = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);

  result = runCli(['doctor'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });
  assert.equal(result.status, 0);

  result = runCli(['uninstall', '--remove-workspaces'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Uninstalled OpenKit global kit/);
  assert.match(result.stdout, /Workspace state was removed/);
  assert.equal(fs.existsSync(path.join(tempHome, 'kits', 'openkit')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'profiles', 'openkit')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'workspaces')), false);
});

test('openkit exits non-zero for an unknown command', () => {
  const result = runCli(['unknown-command']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: unknown-command/);
});
