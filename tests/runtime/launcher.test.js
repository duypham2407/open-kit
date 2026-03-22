import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CONFIG_DIR_RELATIVE_PATHS,
  buildOpenCodeLayering,
} from '../../src/runtime/opencode-layering.js';
import { launchManagedOpenCode } from '../../src/runtime/launcher.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-launcher-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('buildOpenCodeLayering uses the managed config dir when no baseline config is set', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
    commands_dir: 'commands',
  });

  const result = buildOpenCodeLayering({ projectRoot, env: {} });

  assert.equal(result.env.OPENCODE_CONFIG_DIR, path.join(projectRoot, '.opencode'));
  assert.equal(result.env.OPENCODE_CONFIG_CONTENT, undefined);
  assert.equal(result.managedConfig.runtimeManifestPath, path.join(projectRoot, '.opencode', 'opencode.json'));
  assert.equal(result.baseline.configDir, null);
  assert.equal(result.baseline.hasConfigContent, false);
});

test('buildOpenCodeLayering preserves baseline config while layering managed content', () => {
  const projectRoot = makeTempDir();
  const baselineConfigDir = path.join(projectRoot, 'user-config');

  writeJson(path.join(baselineConfigDir, 'opencode.json'), {
    commands_dir: 'user-commands',
    hooks: {
      config: 'user-hooks/hooks.json',
    },
  });

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
    agents_dir: 'agents',
    commands_dir: 'commands',
    hooks: {
      config: 'hooks/hooks.json',
    },
  });

  const result = buildOpenCodeLayering({
    projectRoot,
    env: {
      OPENCODE_CONFIG_DIR: baselineConfigDir,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        model: 'baseline-model',
        customSetting: true,
        skills_dir: 'user-skills',
        hooks: {
          enabled: true,
        },
      }),
    },
  });

  assert.equal(result.env.OPENCODE_CONFIG_DIR, path.join(projectRoot, '.opencode'));

  const layeredContent = JSON.parse(result.env.OPENCODE_CONFIG_CONTENT);
  assert.equal(layeredContent.customSetting, true);
  assert.equal(layeredContent.model, 'managed-model');
  assert.equal(layeredContent.commands_dir, 'commands');
  assert.equal(layeredContent.agents_dir, 'agents');
  assert.equal(layeredContent.skills_dir, path.join(baselineConfigDir, 'user-skills'));
  assert.deepEqual(layeredContent.hooks, {
    enabled: true,
    config: 'hooks/hooks.json',
  });
  assert.equal(result.baseline.configDir, baselineConfigDir);
  assert.equal(result.baseline.config.commands_dir, path.join(baselineConfigDir, 'user-commands'));
  assert.equal(
    result.baseline.config.hooks.config,
    path.join(baselineConfigDir, 'user-hooks', 'hooks.json')
  );
  assert.equal(result.baseline.config.model, 'baseline-model');
});

test('buildOpenCodeLayering only normalizes the documented config-dir-relative keys', () => {
  const projectRoot = makeTempDir();
  const baselineConfigDir = path.join(projectRoot, 'user-config');

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = buildOpenCodeLayering({
    projectRoot,
    env: {
      OPENCODE_CONFIG_DIR: baselineConfigDir,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        model: 'baseline-model',
        agents_dir: 'agents',
        skills_dir: 'skills',
        commands_dir: 'commands',
        hooks: {
          config: 'hooks/hooks.json',
        },
        otherRelativePath: 'notes/local.md',
      }),
    },
  });

  assert.deepEqual(CONFIG_DIR_RELATIVE_PATHS, ['agents_dir', 'commands_dir', 'skills_dir', 'hooks.config']);
  assert.equal(result.baseline.config.agents_dir, path.join(baselineConfigDir, 'agents'));
  assert.equal(result.baseline.config.skills_dir, path.join(baselineConfigDir, 'skills'));
  assert.equal(result.baseline.config.commands_dir, path.join(baselineConfigDir, 'commands'));
  assert.equal(result.baseline.config.hooks.config, path.join(baselineConfigDir, 'hooks', 'hooks.json'));
  assert.equal(result.baseline.config.otherRelativePath, 'notes/local.md');
});

test('launchManagedOpenCode reports a clear error when opencode is unavailable', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = launchManagedOpenCode([], {
    projectRoot,
    env: {},
    spawn: () => ({
      error: Object.assign(new Error('spawn opencode ENOENT'), { code: 'ENOENT' }),
      status: null,
      stdout: '',
      stderr: '',
    }),
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Could not find `opencode` on your PATH/i);
  assert.match(result.stderr, /supported launcher path is `openkit run`/i);
});

test('launchManagedOpenCode uses interactive stdio by default for the real launcher path', () => {
  const projectRoot = makeTempDir();
  let spawnCall = null;

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = launchManagedOpenCode(['status'], {
    projectRoot,
    env: {},
    spawn: (command, args, options) => {
      spawnCall = { command, args, options };
      return { status: 0 };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(spawnCall.command, 'opencode');
  assert.deepEqual(spawnCall.args, ['status']);
  assert.equal(spawnCall.options.stdio, 'inherit');
});

test('launchManagedOpenCode forwards layered config to opencode on the supported path', () => {
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(projectRoot, 'bin');
  const fakeOpencodePath = path.join(fakeBinDir, 'opencode');
  const baselineConfigDir = path.join(projectRoot, 'user-config');

  writeJson(path.join(baselineConfigDir, 'opencode.json'), {
    skills_dir: 'baseline-skills',
  });

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
    commands_dir: 'commands',
    agents_dir: 'agents',
  });

  fs.mkdirSync(fakeBinDir, { recursive: true });
  fs.writeFileSync(
    fakeOpencodePath,
    [
      '#!/usr/bin/env node',
      'const payload = {',
      '  args: process.argv.slice(2),',
      '  configDir: process.env.OPENCODE_CONFIG_DIR ?? null,',
      '  configContent: process.env.OPENCODE_CONFIG_CONTENT ?? null,',
      '};',
      'process.stdout.write(JSON.stringify(payload));',
    ].join('\n'),
    'utf8'
  );
  fs.chmodSync(fakeOpencodePath, 0o755);

  const result = launchManagedOpenCode(['status'], {
    projectRoot,
    env: {
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
      OPENCODE_CONFIG_DIR: baselineConfigDir,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        customSetting: true,
      }),
    },
    stdio: 'pipe',
  });

  assert.equal(result.exitCode, 0);

  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.args, ['status']);
  assert.equal(payload.configDir, path.join(projectRoot, '.opencode'));

  const layeredContent = JSON.parse(payload.configContent);
  assert.equal(layeredContent.customSetting, true);
  assert.equal(layeredContent.model, 'managed-model');
  assert.equal(layeredContent.commands_dir, 'commands');
  assert.equal(layeredContent.agents_dir, 'agents');
  assert.equal(layeredContent.skills_dir, path.join(baselineConfigDir, 'baseline-skills'));
});
