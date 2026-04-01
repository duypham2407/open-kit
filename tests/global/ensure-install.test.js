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

test('ensureGlobalInstall returns none when install is healthy', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(tempHome, 'openkit', 'tooling', 'node_modules', '.bin', 'semgrep'), '#!/bin/sh\nexit 0\n');

  const result = ensureGlobalInstall({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.action, 'none');
  assert.equal(result.installed, false);
  assert.equal(result.doctor.status, 'healthy');
  assert.equal(fs.existsSync(path.join(tempHome, 'workspaces')), false);
});

test('ensureGlobalInstall materializes the global install when it is missing', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(fakeBinDir, 'semgrep'), '#!/bin/sh\nexit 0\n');

  const result = ensureGlobalInstall({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.action, 'installed');
  assert.equal(result.installed, true);
  assert.equal(result.doctor.status, 'healthy');
  assert.equal(fs.existsSync(path.join(tempHome, 'kits', 'openkit', '.opencode', 'workflow-state.js')), true);
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
  });

  const settings = readJson(settingsPath);
  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
  assert.equal(settings.agentModels['qa-agent'].variant, 'high');
  assert.equal(settings.agentModels['fullstack-agent'].model, 'anthropic/claude-sonnet-4-5');
});

test('materializeGlobalInstall copies src/global/tooling.js into the managed kit', () => {
  const tempHome = makeTempDir();

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  assert.equal(fs.existsSync(path.join(tempHome, 'kits', 'openkit', 'src', 'global', 'tooling.js')), true);
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
  });

  assert.equal(result.tooling.action, 'failed');
  assert.equal(result.tooling.installed, false);
});
