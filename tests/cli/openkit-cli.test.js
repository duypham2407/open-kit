import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectGlobalDoctor } from '../../src/global/doctor.js';

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

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function removePathIfPresent(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

test('openkit --help shows global-install oriented help', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /npm install -g @duypham93\/openkit/);
  assert.match(result.stdout, /openkit doctor/);
  assert.match(result.stdout, /perform first-time setup if needed/);
  assert.match(result.stdout, /install-global/);
  assert.match(result.stdout, /upgrade/);
  assert.match(result.stdout, /uninstall/);
  assert.match(result.stdout, /onboard/);
  assert.match(result.stdout, /release/);
  assert.match(result.stdout, /Launch OpenCode and perform first-time setup if needed/);
  assert.equal(result.stderr, '');
});

test('openkit doctor --help shows global doctor help', () => {
  const result = runCli(['doctor', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /global OpenKit install and the current workspace/);
  assert.equal(result.stderr, '');
});

test('install command help reflects manual and compatibility setup paths', () => {
  const installGlobalResult = runCli(['install-global', '--help']);
  const installResult = runCli(['install', '--help']);
  const initResult = runCli(['init', '--help']);

  assert.equal(installGlobalResult.status, 0);
  assert.match(installGlobalResult.stdout, /Manually install OpenKit globally/i);
  assert.match(installGlobalResult.stdout, /Most users should run `openkit run`/i);

  assert.equal(installResult.status, 0);
  assert.match(installResult.stdout, /Compatibility alias for manual global setup/i);
  assert.match(installResult.stdout, /Most users should run `openkit run`/i);

  assert.equal(initResult.status, 0);
  assert.match(initResult.stdout, /Compatibility alias for manual global setup/i);
  assert.match(initResult.stdout, /Most users should run `openkit run`/i);
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
  assert.equal(readJson(path.join(profileRoot, 'opencode.json')).default_agent, 'master-orchestrator');
  assert.equal(fs.existsSync(path.join(kitRoot, 'opencode.json')), true);
  assert.match(readJson(path.join(kitRoot, 'install-state.json')).kit.version, /^0\.3\.1$/);
  assert.match(readJson(path.join(profileRoot, 'hooks.json')).hooks.SessionStart[0].hooks[0].command, /session-start\.js/);
  assert.deepEqual(readJson(path.join(tempHome, 'openkit', 'agent-models.json')).agentModels, {});
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
  assert.match(result.stdout, /Next: Run openkit run for first-time setup/);
  assert.match(result.stdout, /Recommended command: openkit run/);
});

test('openkit doctor reports healthy without mutating workspace metadata', () => {
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
  assert.match(result.stdout, /Next: Run openkit run/);
  assert.match(result.stdout, /Recommended command: openkit run/);
  assert.match(result.stdout, /Default session entrypoint: \/task/);
  assert.match(result.stdout, /Next action after launch:/);
  assert.equal(fs.existsSync(path.join(tempHome, 'workspaces')), false);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode')), false);
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
  assert.deepEqual(invocation.argv, [projectRoot, '--mode', 'quick']);
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(projectRoot));
  assert.equal(fs.realpathSync(invocation.projectRoot), fs.realpathSync(projectRoot));
  assert.equal(invocation.configDir, path.join(tempHome, 'kits', 'openkit'));
  assert.match(invocation.workflowState, /workspaces\/.*\/openkit\/\.opencode\/workflow-state\.json$/);
  assert.equal(invocation.kitRoot, path.join(tempHome, 'kits', 'openkit'));
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'context', 'core', 'workflow.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.json')).isSymbolicLink() || fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.json')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.js')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, 'context', 'core', 'workflow.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.opencode', 'workflow-state.json')).isSymbolicLink() || fs.existsSync(path.join(projectRoot, '.opencode', 'workflow-state.json')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'workflow-state.js')), true);
});

test('openkit run does not reinstall when the global install already exists', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\necho already-installed-run\n');

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /Performing first-time setup/);
  assert.match(result.stdout, /already-installed-run/);
});

test('openkit run auto-installs the global kit on first use', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const logPath = path.join(tempHome, 'opencode-auto-install.json');

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
process.stdout.write('mock opencode launched after auto-install\\n');
`
  );

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      OPENKIT_TEST_LOG_PATH: logPath,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Performing first-time setup/);
  assert.match(result.stdout, /Installed OpenKit globally/);
  assert.match(result.stdout, /mock opencode launched after auto-install/);
  assert.equal(fs.existsSync(path.join(tempHome, 'kits', 'openkit', '.opencode', 'workflow-state.js')), true);

  const invocation = readJson(logPath);
  assert.deepEqual(invocation.argv, [projectRoot]);
  assert.equal(invocation.kitRoot, path.join(tempHome, 'kits', 'openkit'));
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md')), true);
});

test('openkit run does not overwrite existing repo-local workflow files when creating shims', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  fs.mkdirSync(path.join(projectRoot, '.opencode'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'context', 'core'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), 'project agents\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'context', 'core', 'workflow.md'), 'project workflow\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, '.opencode', 'workflow-state.json'), '{"project":true}\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, '.opencode', 'workflow-state.js'), '#!/usr/bin/env node\n', 'utf8');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'), 'project agents\n');
  assert.equal(fs.readFileSync(path.join(projectRoot, 'context', 'core', 'workflow.md'), 'utf8'), 'project workflow\n');
  assert.equal(fs.readFileSync(path.join(projectRoot, '.opencode', 'workflow-state.js'), 'utf8'), '#!/usr/bin/env node\n');
  assert.equal(fs.readFileSync(path.join(projectRoot, '.opencode', 'workflow-state.json'), 'utf8'), '{"project":true}\n');
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md')), true);
});

test('openkit run refreshes managed wrappers when the workspace location changes', () => {
  const tempHomeA = makeTempDir();
  const tempHomeB = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDirA = path.join(tempHomeA, 'bin');
  const fakeBinDirB = path.join(tempHomeB, 'bin');

  writeExecutable(path.join(fakeBinDirA, 'opencode'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(fakeBinDirB, 'opencode'), '#!/bin/sh\nexit 0\n');

  let result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHomeA,
      PATH: `${fakeBinDirA}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);

  result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHomeB,
      PATH: `${fakeBinDirB}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);

  const workspaceWrapper = fs.readFileSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.js'), 'utf8');
  assert.match(workspaceWrapper, new RegExp(tempHomeB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(workspaceWrapper, new RegExp(tempHomeA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('openkit doctor recognizes opencode.cmd on Windows-style PATH', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  writeExecutable(path.join(fakeBinDir, 'opencode.cmd'), '@echo off\nexit /b 0\n');

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  const doctor = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: fakeBinDir,
      PATHEXT: '.CMD;.EXE',
    },
  });

  assert.equal(doctor.status, 'workspace-ready-with-issues');
  assert.match(doctor.issues.join('\n'), /OpenCode executable is not available on PATH/);
});

test('openkit run cleans root compatibility shims when created files are removed', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(projectRoot, 'AGENTS.md')), true);

  removePathIfPresent(path.join(projectRoot, 'AGENTS.md'));
  removePathIfPresent(path.join(projectRoot, 'context'));
  removePathIfPresent(path.join(projectRoot, '.opencode', 'workflow-state.json'));
  removePathIfPresent(path.join(projectRoot, '.opencode', 'workflow-state.js'));

  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md')), true);
});

test('openkit run creates CommonJS workflow wrappers without module-boundary warnings', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);

  const rootWrapper = fs.readFileSync(path.join(projectRoot, '.opencode', 'workflow-state.js'), 'utf8');
  assert.match(rootWrapper, /const \{ spawnSync \} = require\('node:child_process'\);/);
  assert.match(rootWrapper, /\['get', 'show'\]/);
  assert.match(rootWrapper, /\['--help', 'help'\]/);

  const workspaceWrapper = fs.readFileSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.js'), 'utf8');
  assert.match(workspaceWrapper, /const \{ spawnSync \} = require\('node:child_process'\);/);
  assert.doesNotMatch(workspaceWrapper, /import \{ spawnSync \} from 'node:child_process';/);

  const wrapperRun = spawnSync(process.execPath, ['.opencode/openkit/workflow-state.js', 'help'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(wrapperRun.status, 0);
  assert.match(wrapperRun.stdout, /Usage:/);
  assert.doesNotMatch(wrapperRun.stderr, /MODULE_TYPELESS_PACKAGE_JSON/);
});

test('openkit run reports missing opencode after first-time setup completes', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Performing first-time setup/);
  assert.match(result.stdout, /Installed OpenKit globally/);
  assert.match(result.stderr, /Could not find `opencode` on your PATH/);
});

test('openkit run blocks on invalid global install state and recommends upgrade', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const kitRoot = path.join(tempHome, 'kits', 'openkit');

  fs.mkdirSync(kitRoot, { recursive: true });
  fs.writeFileSync(
    path.join(kitRoot, 'install-state.json'),
    `${JSON.stringify({
      schema: 'wrong-schema',
      stateVersion: 1,
      kit: { name: 'OpenKit', version: '0.3.2' },
      installation: {
        profile: 'openkit',
        status: 'installed',
        installedAt: '2026-03-24T00:00:00.000Z',
      },
    }, null, 2)}\n`,
    'utf8'
  );

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: process.env.PATH ?? '',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /schema must be 'openkit\/global-install-state@1'/i);
  assert.match(result.stderr, /Next: Run openkit upgrade to refresh the global install/i);
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

  writeJson(path.join(tempHome, 'openkit', 'agent-models.json'), {
    schema: 'openkit/agent-model-settings@1',
    stateVersion: 1,
    updatedAt: '2026-03-26T00:00:00.000Z',
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5',
        variant: 'high',
      },
    },
  });

  const result = runCli(['upgrade'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Upgraded OpenKit global install/);

  const settings = readJson(path.join(tempHome, 'openkit', 'agent-models.json'));
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
  assert.equal(settings.agentModels['qa-agent'].variant, 'high');
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
