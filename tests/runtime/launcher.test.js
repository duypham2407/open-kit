import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
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
    $schema: 'https://opencode.ai/config.json',
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
    model: 'baseline-model',
    instructions: ['./docs/global-instructions.md'],
    plugin: ['existing-plugin'],
  });

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    $schema: 'https://opencode.ai/config.json',
    instructions: ['AGENTS.md', 'context/navigation.md'],
  });

  const result = buildOpenCodeLayering({
    projectRoot,
    env: {
      OPENCODE_CONFIG_DIR: baselineConfigDir,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        customSetting: true,
        share: 'manual',
      }),
    },
  });

  assert.equal(result.env.OPENCODE_CONFIG_DIR, path.join(projectRoot, '.opencode'));

  const layeredContent = JSON.parse(result.env.OPENCODE_CONFIG_CONTENT);
  assert.equal(layeredContent.customSetting, true);
  assert.equal(layeredContent.share, 'manual');
  assert.equal(layeredContent.model, 'baseline-model');
  assert.equal(layeredContent.default_agent, undefined);
  assert.deepEqual(layeredContent.plugin, ['existing-plugin']);
  assert.deepEqual(layeredContent.instructions, ['AGENTS.md', 'context/navigation.md']);
  assert.equal(result.baseline.configDir, baselineConfigDir);
  assert.equal(result.baseline.config.model, 'baseline-model');
  assert.deepEqual(result.baseline.config.instructions, [
    path.join(baselineConfigDir, 'docs/global-instructions.md'),
  ]);
});

test('buildOpenCodeLayering only resolves instruction paths relative to the config dir', () => {
  const projectRoot = makeTempDir();
  const baselineConfigDir = path.join(projectRoot, 'user-config');

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    $schema: 'https://opencode.ai/config.json',
  });

  const result = buildOpenCodeLayering({
    projectRoot,
    env: {
      OPENCODE_CONFIG_DIR: baselineConfigDir,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        instructions: ['docs/local.md'],
        otherRelativePath: 'notes/local.md',
      }),
    },
  });

  assert.deepEqual(result.baseline.config.instructions, [path.join(baselineConfigDir, 'docs/local.md')]);
  assert.equal(result.baseline.config.otherRelativePath, 'notes/local.md');
});

test('launchManagedOpenCode reports a clear error when opencode is unavailable', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    $schema: 'https://opencode.ai/config.json',
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
    $schema: 'https://opencode.ai/config.json',
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
    model: 'baseline-model',
    instructions: ['./docs/global-instructions.md'],
  });

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    $schema: 'https://opencode.ai/config.json',
    instructions: ['AGENTS.md', 'context/navigation.md'],
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
  assert.equal(layeredContent.model, 'baseline-model');
  assert.equal(layeredContent.default_agent, undefined);
  assert.deepEqual(layeredContent.instructions, ['AGENTS.md', 'context/navigation.md']);
});
