import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectVietnameseInventory } from '../../src/audit/vietnamese-detection.js';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function runGit(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
}

function initTempGitRepo() {
  const projectRoot = makeTempDir();
  const initResult = runGit(['init'], projectRoot);
  assert.equal(initResult.status, 0, initResult.stderr);
  return projectRoot;
}

test('openkit --help shows top-level help', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+<command>/);
  assert.match(result.stdout, /Commands:\s+[\s\S]*\binit\b/);
  assert.doesNotMatch(result.stdout, /internal-audit-vietnamese/);
  assert.equal(result.stderr, '');
});

test('openkit init --help shows init help', () => {
  const result = runCli(['init', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+init/);
  assert.equal(result.stderr, '');
});

test('openkit install --help shows install help', () => {
  const result = runCli(['install', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+install/);
  assert.equal(result.stderr, '');
});

test('openkit run --help shows run help', () => {
  const result = runCli(['run', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+run/);
  assert.equal(result.stderr, '');
});

test('openkit doctor --help shows doctor help', () => {
  const result = runCli(['doctor', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+doctor/);
  assert.match(result.stdout, /ready for managed OpenKit use/i);
  assert.equal(result.stderr, '');
});

test('openkit internal-audit-vietnamese --help shows maintainer audit help', () => {
  const result = runCli(['internal-audit-vietnamese', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+internal-audit-vietnamese/);
  assert.match(result.stdout, /maintainer audit helper/i);
  assert.match(result.stdout, /heuristic/i);
  assert.equal(result.stderr, '');
});

test('detectVietnameseInventory only scans checked-in files', () => {
  const projectRoot = initTempGitRepo();
  const trackedSample = 'Vietnamese sample with accents: ti\u1ebfng vi\u1ec7t\n';
  const untrackedSample = 'Vietnamese sample with accents: t\u1ea1m bi\u1ec7t\n';

  writeText(path.join(projectRoot, 'tracked.md'), trackedSample);
  writeText(path.join(projectRoot, 'untracked.md'), untrackedSample);

  const addResult = runGit(['add', 'tracked.md'], projectRoot);
  assert.equal(addResult.status, 0, addResult.stderr);

  const inventory = detectVietnameseInventory(projectRoot);

  assert.equal(inventory.detectionScope, 'repo-wide checked-in files');
  assert.deepEqual(
    inventory.vietnameseBearingFiles.map((match) => match.path),
    ['tracked.md']
  );
});

test('openkit internal-audit-vietnamese reports stable heuristic inventory details', () => {
  const result = runCli(['internal-audit-vietnamese'], { cwd: worktreeRoot });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Inventory status:\s+(matches-found|clear)/);
  assert.match(result.stdout, /Detection scope:\s+repo-wide checked-in files/i);
  assert.match(result.stdout, /Detection mode:\s+heuristic/i);
  assert.match(result.stdout, /Heuristic review:\s+required/i);
  assert.match(result.stdout, /Pairing map coverage:\s+complete/);
  assert.match(result.stdout, /Machine-facing literals:\s+(out-of-scope confirmed|review needed)/);
  assert.match(result.stdout, /Source-versus-derived pairing map:/);
});

test('openkit help init shows init help', () => {
  const result = runCli(['help', 'init']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+init/);
  assert.equal(result.stderr, '');
});

test('openkit help install shows install help', () => {
  const result = runCli(['help', 'install']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+install/);
  assert.equal(result.stderr, '');
});

test('openkit help run shows run help', () => {
  const result = runCli(['help', 'run']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+run/);
  assert.equal(result.stderr, '');
});

test('openkit help doctor shows doctor help', () => {
  const result = runCli(['help', 'doctor']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+doctor/);
  assert.equal(result.stderr, '');
});

test('openkit help internal-audit-vietnamese shows maintainer audit help', () => {
  const result = runCli(['help', 'internal-audit-vietnamese']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:\s+openkit\s+internal-audit-vietnamese/);
  assert.equal(result.stderr, '');
});

test('openkit init initializes the current repo by default', () => {
  const projectRoot = makeTempDir();

  const result = runCli(['init'], { cwd: projectRoot });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /initialized openkit wrapper/i);
  assert.equal(result.stderr, '');
});

test('openkit install installs into the current repo by default', () => {
  const projectRoot = makeTempDir();
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    runtime: 'existing-open-code-config',
  });

  const result = runCli(['install'], { cwd: projectRoot });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /installed openkit wrapper/i);
  assert.equal(result.stderr, '');
});

test('openkit init initializes a plain repo', () => {
  const projectRoot = makeTempDir();

  const result = runCli(['init'], { cwd: projectRoot });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /initialized openkit wrapper/i);
  assert.equal(result.stderr, '');

  assert.deepEqual(readJson(path.join(projectRoot, 'opencode.json')), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'managed-opencode-wrapper',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  const installState = readJson(path.join(projectRoot, '.openkit', 'openkit-install.json'));
  assert.equal(installState.schema, 'openkit/install-state@1');
  assert.equal(installState.installation.profile, 'openkit-core');
  assert.deepEqual(installState.assets.managed, [
    { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
    { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
  ]);
  assert.deepEqual(installState.assets.adopted, []);
  assert.deepEqual(installState.conflicts, []);
});

test('openkit install adds wrapper files to a repo with existing OpenCode config', () => {
  const projectRoot = makeTempDir();
  const runtimeManifestPath = path.join(projectRoot, '.opencode', 'opencode.json');

  writeJson(runtimeManifestPath, {
    runtime: 'existing-open-code-config',
  });

  const beforeRuntimeManifest = fs.readFileSync(runtimeManifestPath, 'utf8');
  const result = runCli(['install'], { cwd: projectRoot });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /detected existing opencode runtime/i);
  assert.equal(result.stderr, '');
  assert.equal(fs.readFileSync(runtimeManifestPath, 'utf8'), beforeRuntimeManifest);
  assert.equal(readJson(path.join(projectRoot, 'opencode.json')).productSurface.current, 'managed-opencode-wrapper');
  assert.equal(readJson(path.join(projectRoot, '.openkit', 'openkit-install.json')).installation.profile, 'openkit-core');
});

test('openkit install reports conflicts through CLI output', () => {
  const projectRoot = makeTempDir();
  const existingWrapperConfig = {
    theme: 'light',
    productSurface: {
      current: 'custom-surface',
    },
  };

  writeJson(path.join(projectRoot, 'opencode.json'), existingWrapperConfig);

  const result = runCli(['install'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /install aborted due to conflicts/i);
  assert.match(result.stderr, /opencode\.json/);
  assert.match(result.stderr, /unsupported-top-level-key/i);
  assert.match(result.stderr, /manual-review-required/i);
  assert.deepEqual(readJson(path.join(projectRoot, 'opencode.json')), existingWrapperConfig);
});

test('openkit init stays non-destructive when user assets already exist', () => {
  const projectRoot = makeTempDir();
  const existingWrapperConfig = {
    plugin: ['existing-plugin'],
  };
  const existingInstallState = {
    schema: 'custom/install-state',
    owner: 'user',
  };

  writeJson(path.join(projectRoot, 'opencode.json'), existingWrapperConfig);
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), existingInstallState);

  const result = runCli(['init'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /init aborted due to conflicts/i);
  assert.match(result.stderr, /\.openkit\/openkit-install\.json/);
  assert.match(result.stderr, /existing-managed-asset/i);
  assert.match(result.stderr, /manual-review-required/i);
  assert.deepEqual(readJson(path.join(projectRoot, 'opencode.json')), existingWrapperConfig);
  assert.deepEqual(readJson(path.join(projectRoot, '.openkit', 'openkit-install.json')), existingInstallState);
});

test('openkit install stays non-destructive when a user-owned install state already exists', () => {
  const projectRoot = makeTempDir();
  const existingInstallState = {
    schema: 'custom/install-state',
    owner: 'user',
  };

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    runtime: 'existing-open-code-config',
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), existingInstallState);

  const result = runCli(['install'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /install aborted due to conflicts/i);
  assert.match(result.stderr, /\.openkit\/openkit-install\.json/);
  assert.match(result.stderr, /existing-managed-asset/i);
  assert.match(result.stderr, /manual-review-required/i);
  assert.deepEqual(readJson(path.join(projectRoot, '.openkit', 'openkit-install.json')), existingInstallState);
});

test('openkit init and install render conflict diagnostics consistently', () => {
  const initProjectRoot = makeTempDir();
  const installProjectRoot = makeTempDir();

  writeJson(path.join(initProjectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'custom/install-state',
    owner: 'user',
  });
  writeJson(path.join(installProjectRoot, '.opencode', 'opencode.json'), {
    runtime: 'existing-open-code-config',
  });
  writeJson(path.join(installProjectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'custom/install-state',
    owner: 'user',
  });

  const initResult = runCli(['init'], { cwd: initProjectRoot });
  const installResult = runCli(['install'], { cwd: installProjectRoot });

  assert.equal(initResult.status, 1);
  assert.equal(installResult.status, 1);

  const initDetail = initResult.stderr.split('\n').slice(1).join('\n').trim();
  const installDetail = installResult.stderr.split('\n').slice(1).join('\n').trim();

  assert.equal(initDetail, installDetail);
  assert.match(initDetail, /\.openkit\/openkit-install\.json/);
  assert.match(initDetail, /existing-managed-asset/);
  assert.match(initDetail, /manual-review-required/);
});

test('openkit run exits non-zero when not implemented', () => {
  const projectRoot = makeTempDir();
  const result = runCli(['run'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /not implemented yet|managed runtime manifest was not found/i);
});

test('openkit doctor reports missing install state for an unmanaged project', () => {
  const projectRoot = makeTempDir();
  const result = runCli(['doctor'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Status:\s+install-missing/);
  assert.match(result.stdout, /Owned by OpenKit:\s+none/);
  assert.match(result.stdout, /Drifted assets:\s+none/);
  assert.match(result.stdout, /managed wrapper entrypoint was not found/i);
});

test('openkit doctor reports healthy after install into an existing runtime repo', () => {
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(projectRoot, 'fake-bin');

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    runtime: 'existing-open-code-config',
  });

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const installResult = runCli(['install'], { cwd: projectRoot });
  assert.equal(installResult.status, 0);

  const result = runCli(['doctor'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Status:\s+healthy/);
  assert.match(result.stdout, /Owned by OpenKit:\s+opencode\.json, \.openkit\/openkit-install\.json/);
  assert.match(result.stdout, /Drifted assets:\s+none/);
  assert.match(result.stdout, /openkit run can proceed cleanly/i);
  assert.equal(result.stderr, '');
});

test('openkit doctor reports drifted managed assets', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'managed-opencode-wrapper',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });

  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'drifted-surface',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  const result = runCli(['doctor'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Status:\s+drift-detected/);
  assert.match(result.stdout, /Drifted assets:\s+opencode\.json/);
  assert.match(result.stdout, /Drift detected for managed asset: opencode\.json/);
});

test('openkit doctor does not certify an incompatible adopted root manifest as healthy', () => {
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(projectRoot, 'fake-bin');

  writeJson(path.join(projectRoot, 'opencode.json'), {
    plugin: ['existing-plugin'],
    productSurface: {
      current: 'custom-surface',
    },
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [
        {
          assetId: 'runtime.opencode-manifest',
          path: 'opencode.json',
          adoptedFrom: 'user-existing',
          status: 'adopted',
        },
      ],
    },
    warnings: [],
    conflicts: [
      {
        assetId: 'runtime.opencode-manifest',
        path: 'opencode.json',
        reason: 'unsupported-top-level-key',
        resolution: 'manual-review-required',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = runCli(['doctor'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Status:\s+install-incomplete/);
  assert.match(result.stdout, /Adopted by OpenKit:\s+opencode\.json/);
  assert.match(result.stdout, /incompatible with the managed wrapper contract/i);
});

test('openkit doctor reports malformed wrapper-owned JSON without crashing', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    runtime: 'existing-open-code-config',
  });

  const installResult = runCli(['install'], { cwd: projectRoot });
  assert.equal(installResult.status, 0);

  writeText(path.join(projectRoot, 'opencode.json'), '{"installState": ');

  const result = runCli(['doctor'], { cwd: projectRoot });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Status:\s+drift-detected/);
  assert.match(result.stdout, /Drifted assets:\s+opencode\.json/);
  assert.match(result.stdout, /Managed asset JSON is malformed: opencode\.json/);
});

test('openkit run launches opencode with layered config from wrapper install', () => {
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(projectRoot, 'fake-bin');
  const logPath = path.join(projectRoot, 'opencode-invocation.json');
  const baselineConfigDir = path.join(projectRoot, 'baseline-config');

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    runtime: 'existing-open-code-config',
    model: 'managed-model',
    agents_dir: './agents',
    commands_dir: './commands',
    hooks: {
      config: './hooks/hooks.json',
    },
  });

  writeJson(path.join(baselineConfigDir, 'opencode.json'), {
    skills_dir: 'user-skills',
    hooks: {
      config: 'baseline-hooks/hooks.json',
    },
  });

  const installResult = runCli(['install'], { cwd: projectRoot });
  assert.equal(installResult.status, 0);

  assert.equal(readJson(path.join(projectRoot, 'opencode.json')).productSurface.current, 'managed-opencode-wrapper');
  assert.equal(
    readJson(path.join(projectRoot, '.openkit', 'openkit-install.json')).assets.managed[0].path,
    'opencode.json'
  );

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    `#!/usr/bin/env node
import fs from 'node:fs';

const logPath = process.env.OPENKIT_TEST_LOG_PATH;
const payload = {
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  configDir: process.env.OPENCODE_CONFIG_DIR,
  configContent: process.env.OPENCODE_CONFIG_CONTENT,
};

fs.writeFileSync(logPath, JSON.stringify(payload, null, 2));
process.stdout.write('mock opencode launched\\n');
`
  );

  const result = runCli(['run', '--mode', 'quick'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
      OPENKIT_TEST_LOG_PATH: logPath,
      OPENCODE_CONFIG_DIR: baselineConfigDir,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        customSetting: true,
        commands_dir: 'baseline-commands',
        hooks: {
          enabled: true,
        },
      }),
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /mock opencode launched/);
  assert.equal(result.stderr, '');

  const invocation = readJson(logPath);
  assert.deepEqual(invocation.argv, ['--mode', 'quick']);
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(projectRoot));
  assert.equal(fs.realpathSync(invocation.configDir), fs.realpathSync(path.join(projectRoot, '.opencode')));

  const layeredContent = JSON.parse(invocation.configContent);
  assert.equal(layeredContent.customSetting, true);
  assert.equal(layeredContent.model, 'managed-model');
  assert.equal(layeredContent.agents_dir, './agents');
  assert.equal(layeredContent.commands_dir, './commands');
  assert.equal(layeredContent.skills_dir, path.join(baselineConfigDir, 'user-skills'));
  assert.deepEqual(layeredContent.hooks, {
    enabled: true,
    config: './hooks/hooks.json',
  });
});

test('openkit exits non-zero for an unknown command', () => {
  const result = runCli(['unknown-command']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: unknown-command/);
  assert.match(result.stderr, /Run `openkit --help` to see available commands\./);
});
