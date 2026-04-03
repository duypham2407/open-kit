import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureGlobalInstall } from '../../src/global/ensure-install.js';
import { materializeGlobalInstall } from '../../src/global/materialize.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-global-ensure-'));
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const noopTooling = () => ({ action: 'skipped', installed: false });

function fakeToolingStub(toolName) {
  return ({ env }) => {
    const globalPaths = {
      toolingRoot: path.join(env.OPENCODE_HOME, 'openkit', 'tooling'),
      toolingBinRoot: path.join(env.OPENCODE_HOME, 'openkit', 'tooling', 'node_modules', '.bin'),
    };
    writeExecutable(path.join(globalPaths.toolingBinRoot, toolName), '#!/bin/sh\nexit 0\n');
    return {
      action: 'installed',
      installed: true,
      toolingRoot: globalPaths.toolingRoot,
      toolingBinRoot: globalPaths.toolingBinRoot,
    };
  };
}

test('ensureGlobalInstall returns none when install is healthy', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: fakeToolingStub('ast-grep'),
    ensureSemgrep: fakeToolingStub('semgrep'),
  });

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = ensureGlobalInstall({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    ensureAstGrep: fakeToolingStub('ast-grep'),
    ensureSemgrep: fakeToolingStub('semgrep'),
  });

  assert.equal(result.action, 'none');
  assert.equal(result.installed, false);
  assert.equal(result.doctor.status, 'healthy');
});

test('ensureGlobalInstall materializes the global install when it is missing', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = ensureGlobalInstall({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    ensureAstGrep: fakeToolingStub('ast-grep'),
    ensureSemgrep: fakeToolingStub('semgrep'),
  });

  assert.equal(result.action, 'installed');
  assert.equal(result.installed, true);
  assert.equal(result.doctor.status, 'healthy');
  assert.equal(fs.existsSync(path.join(tempHome, 'kits', 'openkit', '.opencode', 'workflow-state.js')), true);
});

test('ensureGlobalInstall repairs missing tooling for existing installs', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(fakeBinDir, 'semgrep'), '#!/bin/sh\nexit 0\n');
  fs.rmSync(path.join(tempHome, 'openkit', 'tooling'), { recursive: true, force: true });

  const repairedAstGrep = {
    action: 'installed',
    installed: true,
    toolingRoot: path.join(tempHome, 'openkit', 'tooling'),
    toolingBinRoot: path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin'),
  };

  const result = ensureGlobalInstall({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    ensureAstGrep: () => {
      writeExecutable(path.join(repairedAstGrep.toolingBinRoot, 'ast-grep'), '#!/bin/sh\nexit 0\n');
      writeExecutable(path.join(repairedAstGrep.toolingBinRoot, 'sg'), '#!/bin/sh\nexit 0\n');
      return repairedAstGrep;
    },
  });

  assert.equal(result.action, 'repaired-tooling');
  assert.equal(result.installed, false);
  assert.equal(result.tooling?.astGrep?.installed, true);
  assert.equal(result.tooling?.semgrep, null);
  assert.equal(result.doctor.status, 'healthy');
});

test('ensureGlobalInstall installs ast-grep tooling into managed global state', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  fs.mkdirSync(fakeBinDir, { recursive: true });
  fs.writeFileSync(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n', 'utf8');
  fs.chmodSync(path.join(fakeBinDir, 'opencode'), 0o755);

  const fakeEnsureAstGrepInstalled = ({ env }) => {
    const toolingRoot = path.join(env.OPENCODE_HOME, 'openkit', 'tooling');
    const binRoot = path.join(toolingRoot, 'node_modules', '.bin');
    fs.mkdirSync(binRoot, { recursive: true });
    fs.writeFileSync(path.join(binRoot, 'ast-grep'), '#!/bin/sh\nexit 0\n', 'utf8');
    fs.chmodSync(path.join(binRoot, 'ast-grep'), 0o755);
    return {
      action: 'installed',
      installed: true,
      toolingRoot,
      toolingBinRoot: binRoot,
    };
  };

  const result = materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    ensureAstGrep: fakeEnsureAstGrepInstalled,
    ensureSemgrep: noopTooling,
  });

  assert.equal(result.tooling.installed, true);
  assert.equal(fs.existsSync(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'ast-grep')), true);
});

test('ensureGlobalInstall returns blocked when install state is invalid', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const kitRoot = path.join(tempHome, 'kits', 'openkit');

  writeJson(path.join(kitRoot, 'install-state.json'), {
    schema: 'wrong-schema',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.12',
    },
    installation: {
      profile: 'openkit',
      status: 'installed',
      installedAt: '2026-03-24T00:00:00.000Z',
    },
  });

  const result = ensureGlobalInstall({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: process.env.PATH ?? '',
    },
  });

  assert.equal(result.action, 'blocked');
  assert.equal(result.installed, false);
  assert.equal(result.doctor.status, 'install-invalid');
  assert.equal(result.doctor.recommendedCommand, 'openkit upgrade');
});

test('materializeGlobalInstall preserves existing agent model overrides during upgrade-style refresh', () => {
  const tempHome = makeTempDir();
  const settingsPath = path.join(tempHome, 'openkit', 'agent-models.json');

  writeJson(settingsPath, {
    schema: 'openkit/agent-model-settings@1',
    stateVersion: 1,
    updatedAt: '2026-03-26T00:00:00.000Z',
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5',
        variant: 'high',
      },
      'fullstack-agent': {
        model: 'anthropic/claude-sonnet-4-5',
      },
    },
  });

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  const settings = readJson(settingsPath);
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
  assert.equal(settings.agentModels['qa-agent'].variant, 'high');
  assert.equal(settings.agentModels['fullstack-agent'].model, 'anthropic/claude-sonnet-4-5');
});

test('materializeGlobalInstall configures chrome-devtools MCP by default', () => {
  const tempHome = makeTempDir();

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  const profileConfig = readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json'));
  const kitConfig = readJson(path.join(tempHome, 'kits', 'openkit', 'opencode.json'));

  assert.deepEqual(profileConfig.mcp['chrome-devtools'], {
    type: 'local',
    command: ['npx', '-y', 'chrome-devtools-mcp@0.21.0'],
    enabled: true,
  });
  assert.deepEqual(kitConfig.mcp['chrome-devtools'], {
    type: 'local',
    command: ['npx', '-y', 'chrome-devtools-mcp@0.21.0'],
    enabled: true,
  });
});

test('materializeGlobalInstall copies the entire src/global directory into the managed kit', () => {
  const tempHome = makeTempDir();

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  const globalDir = path.join(tempHome, 'kits', 'openkit', 'src', 'global');
  assert.equal(fs.existsSync(globalDir), true);
  assert.equal(fs.existsSync(path.join(globalDir, 'tooling.js')), true);
  assert.equal(fs.existsSync(path.join(globalDir, 'paths.js')), true);
  assert.equal(fs.existsSync(path.join(globalDir, 'config-merge.js')), true);
});

test('materializeGlobalInstall provisions node_modules for the managed kit runtime', () => {
  const tempHome = makeTempDir();

  const result = materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  assert.equal(result.runtimeDependencies?.provisioned, true);
  assert.equal(fs.existsSync(path.join(tempHome, 'kits', 'openkit', 'node_modules')), true);
});

test('materializeGlobalInstall returns failed ast-grep tooling status instead of throwing on spawn error', () => {
  const tempHome = makeTempDir();

  const result = materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: ({ env }) => ({
      action: 'failed',
      installed: false,
      toolingRoot: path.join(env.OPENCODE_HOME, 'openkit', 'tooling'),
      toolingBinRoot: path.join(env.OPENCODE_HOME, 'openkit', 'tooling', 'node_modules', '.bin'),
      reason: 'spawn error',
    }),
    ensureSemgrep: noopTooling,
  });

  assert.equal(result.tooling.action, 'failed');
  assert.equal(result.tooling.installed, false);
});

test('materializeGlobalInstall produces a kit where all runtime imports resolve to existing files', () => {
  const tempHome = makeTempDir();

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  const kitRoot = path.join(tempHome, 'kits', 'openkit');
  const runtimeDir = path.join(kitRoot, 'src', 'runtime');
  const missingImports = [];

  function walkFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkFiles(entryPath);
      } else if (entry.name.endsWith('.js')) {
        const content = fs.readFileSync(entryPath, 'utf8');
        const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const importSpecifier = match[1];
          const resolvedPath = path.resolve(path.dirname(entryPath), importSpecifier);
          if (!fs.existsSync(resolvedPath) && !fs.existsSync(`${resolvedPath}.js`)) {
            missingImports.push({
              file: path.relative(kitRoot, entryPath),
              import: importSpecifier,
              resolvedPath: path.relative(kitRoot, resolvedPath),
            });
          }
        }
      }
    }
  }

  walkFiles(runtimeDir);

  assert.equal(
    missingImports.length,
    0,
    `Found ${missingImports.length} broken import(s) in the materialized kit:\n${missingImports.map((entry) => `  ${entry.file} -> ${entry.import} (resolved: ${entry.resolvedPath})`).join('\n')}`
  );
});
