import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectGlobalDoctor } from '../../src/global/doctor.js';
import { getOpenKitVersion } from '../../src/version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worktreeRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(worktreeRoot, 'bin', 'openkit.js');

function runCli(args, { cwd = worktreeRoot, env, timeout = 30_000, input = null } = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: env ?? process.env,
    timeout,
    input,
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

test('openkit run --help includes worktree and env propagation flags', () => {
  const result = runCli(['run', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /--worktree-mode <new\|reuse\|reopen\|none>/);
  assert.match(result.stdout, /--env-propagation <none\|symlink\|copy>/);
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
  assert.equal(fs.existsSync(path.join(kitRoot, 'commands', 'refactor.md')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'skills', 'git-master', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'src', 'runtime', 'index.js')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'assets', 'openkit.runtime.jsonc.template')), true);
  assert.equal(fs.existsSync(path.join(profileRoot, 'opencode.json')), true);
  assert.equal(readJson(path.join(profileRoot, 'opencode.json')).default_agent, 'master-orchestrator');
  assert.equal(fs.existsSync(path.join(kitRoot, 'opencode.json')), true);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'ast-grep')), true);
  assert.equal(readJson(path.join(kitRoot, 'install-state.json')).kit.version, getOpenKitVersion());
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
  assert.match(result.stdout, /OpenKit version:/);
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
  writeExecutable(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'ast-grep'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'semgrep'), '#!/bin/sh\nexit 0\n');

  const result = runCli(['doctor'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /OpenKit version:/);
  assert.match(result.stdout, /Status: healthy/);
  assert.match(result.stdout, /Workspace root:/);
  assert.match(result.stdout, /Workspace state path:/);
  assert.match(result.stdout, /Compatibility shim root:/);
  assert.match(result.stdout, /Workspace shim root:/);
  assert.match(result.stdout, /Path model: config loads from the global kit root, runtime state lives under the workspace root, and project \.opencode paths are compatibility shims\./);
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
  writeExecutable(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'ast-grep'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'semgrep'), '#!/bin/sh\nexit 0\n');

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
  path: process.env.PATH,
  configDir: process.env.OPENCODE_CONFIG_DIR,
  runtimeFoundation: process.env.OPENKIT_RUNTIME_FOUNDATION,
  runtimeFoundationVersion: process.env.OPENKIT_RUNTIME_FOUNDATION_VERSION,
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
  assert.deepEqual([fs.realpathSync(invocation.argv[0]), ...invocation.argv.slice(1)], [
    fs.realpathSync(projectRoot),
    '--mode',
    'quick',
  ]);
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(projectRoot));
  assert.equal(fs.realpathSync(invocation.projectRoot), fs.realpathSync(projectRoot));
  assert.equal(invocation.configDir, path.join(tempHome, 'kits', 'openkit'));
  assert.equal(invocation.runtimeFoundation, '1');
  assert.equal(invocation.runtimeFoundationVersion, '1');
  assert.match(invocation.workflowState, /workspaces\/.*\/openkit\/\.opencode\/workflow-state\.json$/);
  assert.equal(invocation.kitRoot, path.join(tempHome, 'kits', 'openkit'));
  assert.equal(invocation.path.startsWith(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'context', 'core', 'workflow.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.json')).isSymbolicLink() || fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.json')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.js')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'profile-switch.js')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.opencode', 'openkit', 'work-items')).isSymbolicLink() || fs.existsSync(path.join(projectRoot, '.opencode', 'openkit', 'work-items')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, 'context', 'core', 'workflow.md')), true);
  assert.equal(fs.lstatSync(path.join(projectRoot, '.opencode', 'workflow-state.json')).isSymbolicLink() || fs.existsSync(path.join(projectRoot, '.opencode', 'workflow-state.json')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'workflow-state.js')), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'profile-switch.js')), true);
});

test('openkit run loads OpenKit secrets env without printing or serializing raw values', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const logPath = path.join(tempHome, 'opencode-secret-run.json');
  const sentinel = 'sk-openkit-run-sentinel-941';

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  const setKey = runCli(['configure', 'mcp', 'set-key', 'context7', '--stdin'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    input: `${sentinel}\n`,
  });
  assert.equal(setKey.status, 0);
  assert.doesNotMatch(setKey.stdout, new RegExp(sentinel));

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    `#!/usr/bin/env node
import fs from 'node:fs';
fs.writeFileSync(process.env.OPENKIT_TEST_LOG_PATH, JSON.stringify({
  context7: process.env.CONTEXT7_API_KEY,
  runtimeConfigContent: process.env.OPENKIT_RUNTIME_CONFIG_CONTENT,
  opencodeConfigContent: process.env.OPENCODE_CONFIG_CONTENT,
}, null, 2));
process.stdout.write('secret env launch complete\\n');
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
  assert.match(result.stdout, /secret env launch complete/);
  assert.doesNotMatch(result.stdout, new RegExp(sentinel));
  assert.doesNotMatch(result.stderr, new RegExp(sentinel));
  const invocation = readJson(logPath);
  assert.equal(invocation.context7, sentinel);
  assert.equal((invocation.runtimeConfigContent ?? '').includes(sentinel), false);
  assert.equal((invocation.opencodeConfigContent ?? '').includes(sentinel), false);
});

test('openkit run preserves explicit process env over secrets.env values', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const logPath = path.join(tempHome, 'opencode-secret-precedence.json');
  const sentinel = 'sk-openkit-secret-file-value';
  const explicit = 'sk-openkit-explicit-env-value';

  assert.equal(runCli(['install-global'], { env: { ...process.env, OPENCODE_HOME: tempHome } }).status, 0);
  assert.equal(runCli(['configure', 'mcp', 'set-key', 'context7', '--stdin'], {
    env: { ...process.env, OPENCODE_HOME: tempHome },
    input: `${sentinel}\n`,
  }).status, 0);

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    `#!/usr/bin/env node
import fs from 'node:fs';
fs.writeFileSync(process.env.OPENKIT_TEST_LOG_PATH, JSON.stringify({ context7: process.env.CONTEXT7_API_KEY }, null, 2));
`
  );

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      CONTEXT7_API_KEY: explicit,
      OPENKIT_TEST_LOG_PATH: logPath,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.equal(readJson(logPath).context7, explicit);
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
  path: process.env.PATH,
  configDir: process.env.OPENCODE_CONFIG_DIR,
  runtimeFoundation: process.env.OPENKIT_RUNTIME_FOUNDATION,
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
  assert.deepEqual(invocation.argv.map((entry) => fs.realpathSync(entry)), [
    fs.realpathSync(projectRoot),
  ]);
  assert.equal(invocation.kitRoot, path.join(tempHome, 'kits', 'openkit'));
  assert.equal(invocation.runtimeFoundation, '1');
  assert.equal(invocation.path.startsWith(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin')), true);
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
  assert.match(workspaceWrapper, /OPENKIT_PROJECT_ROOT/);
  assert.doesNotMatch(workspaceWrapper, /import \{ spawnSync \} from 'node:child_process';/);

  const profileSwitchWrapper = fs.readFileSync(path.join(projectRoot, '.opencode', 'openkit', 'profile-switch.js'), 'utf8');
  assert.match(profileSwitchWrapper, /profile-switch-cli\.js/);
  assert.match(profileSwitchWrapper, /OPENKIT_WORKFLOW_STATE/);
  assert.doesNotMatch(profileSwitchWrapper, /import \{ spawnSync \} from 'node:child_process';/);

  const wrapperRun = spawnSync(process.execPath, ['.opencode/openkit/workflow-state.js', 'help'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(wrapperRun.status, 0);
  assert.match(wrapperRun.stdout, /Usage:/);
  assert.doesNotMatch(wrapperRun.stderr, /MODULE_TYPELESS_PACKAGE_JSON/);
});

test('profile-switch wrapper updates live workspace selection state during a managed session', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  let result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'set', '--agent', 'specialist.oracle', '--profile', '1'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.equal(result.status, 0);
  const selection = JSON.parse(result.stdout);
  assert.equal(selection.status, 'ok');
  assert.equal(selection.selection.agentId, 'specialist.oracle');
  assert.equal(selection.selection.profileIndex, 1);

  const [workspaceId] = fs.readdirSync(path.join(tempHome, 'workspaces'));
  const statePath = path.join(tempHome, 'workspaces', workspaceId, 'openkit', '.opencode', 'agent-profile-switches.json');
  const state = readJson(statePath);
  assert.equal(state.manualSelections['specialist.oracle'].profileIndex, 1);
});

test('profile-switch wrapper supports short in-session syntax', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  let result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'specialist.oracle', '1'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).selection.profileIndex, 1);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'specialist.oracle'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).selection.profileIndex, 1);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'specialist.oracle', 't'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).selection.profileIndex, 0);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'specialist.oracle'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).selection.profileIndex, 0);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'specialist.oracle', 'c'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).status, 'ok');
  assert.equal(JSON.parse(result.stdout).selection, null);
});

test('profile-switch wrapper rejects invalid profile indices', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');
  fs.mkdirSync(path.join(projectRoot, '.opencode'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    JSON.stringify(
      {
        agents: {
          'specialist.oracle': {
            profiles: [{ model: 'openai/gpt-5.4' }, { model: 'azure/gpt-5.4' }],
          },
        },
      },
      null,
      2
    ),
    'utf8'
  );

  let result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);

  result = spawnSync(process.execPath, ['.opencode/profile-switch.js', 'specialist.oracle', '7'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid profile/i);
});

test('openkit run hydrates workspace state from repo-local work-items before wrapper status commands', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const workItemId = 'feature-123';
  const state = {
    work_item_id: workItemId,
    feature_id: 'FEATURE-123',
    feature_slug: 'feature-123',
    mode: 'full',
    mode_reason: 'Hydration regression coverage.',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'adjacent',
      selection_reason: 'Hydration regression coverage.',
    },
    parallelization: {
      parallel_mode: 'none',
      why: null,
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: null,
    },
    current_stage: 'full_intake',
    status: 'in_progress',
    current_owner: 'MasterOrchestrator',
    artifacts: {
      task_card: null,
      scope_package: null,
      solution_package: null,
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      solution_to_fullstack: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    last_auto_scaffold: null,
    updated_at: '2026-03-30T00:00:00.000Z',
  };

  writeJson(path.join(projectRoot, '.opencode', 'workflow-state.json'), state);
  writeJson(path.join(projectRoot, '.opencode', 'work-items', 'index.json'), {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: 'FEATURE-123',
        feature_slug: 'feature-123',
        mode: 'full',
        status: 'in_progress',
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'work-items', workItemId, 'state.json'), state);

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

  const wrapperRun = spawnSync(process.execPath, ['.opencode/openkit/workflow-state.js', 'status'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(wrapperRun.status, 0);
  assert.match(wrapperRun.stdout, /active work item id: feature-123/);
  assert.doesNotMatch(wrapperRun.stdout, /Active work item pointer missing/);

  const [workspaceId] = fs.readdirSync(path.join(tempHome, 'workspaces'));
  const workspaceIndex = readJson(path.join(tempHome, 'workspaces', workspaceId, 'openkit', '.opencode', 'work-items', 'index.json'));
  assert.equal(workspaceIndex.active_work_item_id, workItemId);
});

test('openkit run reports missing opencode after first-time setup completes', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const nodeBinDir = path.dirname(process.execPath);

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: nodeBinDir,
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Performing first-time setup/);
  assert.match(result.stdout, /Installed OpenKit globally/);
  assert.match(result.stderr, /Could not find `opencode` on your PATH/);
});

test('openkit run returns structured launcher failure for unexpected spawn errors', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(
    path.join(fakeBinDir, 'opencode'),
    '#!/usr/bin/env node\nprocess.stderr.write("spawn failed\\n");\nprocess.exit(3);\n'
  );

  const result = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /spawn failed/);
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
      kit: { name: 'OpenKit', version: '0.3.12' },
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

test('openkit run returns non-zero when worktree selection is required in non-interactive mode', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const workItemId = 'feature-936';

  const installResult = runCli(['install-global'], {
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  assert.equal(installResult.status, 0);

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  // Materialize workspace state first.
  const firstRun = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });
  assert.equal(firstRun.status, 0);

  const [workspaceDirectory] = fs.readdirSync(path.join(tempHome, 'workspaces'));
  const workspaceRoot = path.join(tempHome, 'workspaces', workspaceDirectory, 'openkit', '.opencode');
  const statePath = path.join(workspaceRoot, 'workflow-state.json');
  const indexPath = path.join(workspaceRoot, 'work-items', 'index.json');
  const workItemStatePath = path.join(workspaceRoot, 'work-items', workItemId, 'state.json');

  const workflowState = {
    work_item_id: workItemId,
    feature_id: 'FEATURE-936',
    feature_slug: 'worktree-ux-selection-retention',
    mode: 'full',
    mode_reason: 'feature fixture',
    lane_source: 'user_explicit',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'feature fixture',
    },
    migration_context: {
      baseline_summary: null,
      target_outcome: null,
      preserved_invariants: [],
      allowed_behavior_changes: [],
      compatibility_hotspots: [],
      baseline_evidence_refs: [],
      rollback_checkpoints: [],
    },
    parallelization: {
      parallel_mode: 'none',
      why: null,
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: null,
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/2026-04-19-worktree-ux-selection-retention.md',
      solution_package: 'docs/solution/2026-04-19-worktree-ux-selection-retention.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'SolutionLead', approved_at: '2026-04-20', notes: null },
      solution_to_fullstack: { status: 'approved', approved_by: 'FullstackAgent', approved_at: '2026-04-20', notes: null },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    last_auto_scaffold: null,
    updated_at: '2026-04-20T00:00:00.000Z',
  };

  writeJson(indexPath, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: 'FEATURE-936',
        feature_slug: 'worktree-ux-selection-retention',
        mode: 'full',
        status: 'in_progress',
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeJson(workItemStatePath, workflowState);
  writeJson(statePath, workflowState);

  const result = runCli(['run', '--work-item', workItemId], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
      CI: '1',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /No usable retained managed worktree exists/);
  assert.match(result.stderr, /Run again with --worktree-mode <new\|reuse\|reopen\|none>/);
});

test('openkit run surfaces copy warning before retained-context lines', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');
  const logPath = path.join(tempHome, 'opencode-run-copy-warning.json');
  const workItemId = 'feature-938';

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
}, null, 2));
process.stdout.write('mock opencode launched\\n');
`
  );

  const firstRun = runCli(['run'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      OPENKIT_TEST_LOG_PATH: logPath,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });
  assert.equal(firstRun.status, 0);

  fs.writeFileSync(path.join(projectRoot, '.env'), 'ROOT=true\n', 'utf8');

  const [workspaceDirectory] = fs.readdirSync(path.join(tempHome, 'workspaces'));
  const workspaceRoot = path.join(tempHome, 'workspaces', workspaceDirectory, 'openkit', '.opencode');
  const statePath = path.join(workspaceRoot, 'workflow-state.json');
  const indexPath = path.join(workspaceRoot, 'work-items', 'index.json');
  const workItemStatePath = path.join(workspaceRoot, 'work-items', workItemId, 'state.json');
  const worktreeMetadataPath = path.join(workspaceRoot, 'work-items', workItemId, 'worktree.json');
  const retainedWorktreePath = path.join(projectRoot, '.worktrees', workItemId);
  fs.mkdirSync(retainedWorktreePath, { recursive: true });

  const workflowState = {
    work_item_id: workItemId,
    feature_id: 'FEATURE-938',
    feature_slug: 'copy-warning-order',
    mode: 'full',
    mode_reason: 'copy warning fixture',
    lane_source: 'user_explicit',
    routing_profile: {
      work_intent: 'feature',
      behavior_delta: 'extend',
      dominant_uncertainty: 'product',
      scope_shape: 'cross_boundary',
      selection_reason: 'copy warning fixture',
    },
    migration_context: {
      baseline_summary: null,
      target_outcome: null,
      preserved_invariants: [],
      allowed_behavior_changes: [],
      compatibility_hotspots: [],
      baseline_evidence_refs: [],
      rollback_checkpoints: [],
    },
    parallelization: {
      parallel_mode: 'none',
      why: null,
      safe_parallel_zones: [],
      sequential_constraints: [],
      integration_checkpoint: null,
      max_active_execution_tracks: null,
    },
    current_stage: 'full_implementation',
    status: 'in_progress',
    current_owner: 'FullstackAgent',
    artifacts: {
      task_card: null,
      scope_package: 'docs/scope/2026-04-19-worktree-ux-selection-retention.md',
      solution_package: 'docs/solution/2026-04-19-worktree-ux-selection-retention.md',
      migration_report: null,
      qa_report: null,
      adr: [],
    },
    approvals: {
      product_to_solution: { status: 'approved', approved_by: 'SolutionLead', approved_at: '2026-04-20', notes: null },
      solution_to_fullstack: { status: 'approved', approved_by: 'FullstackAgent', approved_at: '2026-04-20', notes: null },
      fullstack_to_code_review: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      code_review_to_qa: { status: 'pending', approved_by: null, approved_at: null, notes: null },
      qa_to_done: { status: 'pending', approved_by: null, approved_at: null, notes: null },
    },
    issues: [],
    verification_evidence: [],
    retry_count: 0,
    escalated_from: null,
    escalation_reason: null,
    last_auto_scaffold: null,
    updated_at: '2026-04-20T00:00:00.000Z',
  };

  writeJson(indexPath, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: 'FEATURE-938',
        feature_slug: 'copy-warning-order',
        mode: 'full',
        status: 'in_progress',
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeJson(workItemStatePath, workflowState);
  writeJson(statePath, workflowState);
  writeJson(worktreeMetadataPath, {
    schema: 'openkit/worktree@2',
    work_item_id: workItemId,
    workflow_mode: 'full',
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: 'main',
    branch: `openkit/full/${workItemId}`,
    worktree_path: retainedWorktreePath,
    created_at: '2026-04-20T00:00:00.000Z',
    env_propagation: {
      mode: 'none',
      applied_at: null,
      source_files: [],
    },
  });

  const result = runCli(['run', '--work-item', workItemId, '--worktree-mode', 'reuse', '--env-propagation', 'copy', 'status'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      OPENKIT_TEST_LOG_PATH: logPath,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /copy mode duplicates env files/);
  assert.match(result.stdout, /Retained managed worktree:/);
  assert.ok(result.stdout.indexOf('copy mode duplicates env files') < result.stdout.indexOf('Retained managed worktree:'));
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
  writeExecutable(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'semgrep'), '#!/bin/sh\nexit 0\n');

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
