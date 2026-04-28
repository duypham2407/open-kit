import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { materializeGlobalInstall } from '../../src/global/materialize.js';
import { materializeMcpProfiles } from '../../src/global/mcp/profile-materializer.js';
import { materializeInstall } from '../../src/install/materialize.js';
import { applyOpenKitMergePolicy } from '../../src/install/merge-policy.js';
import { validateAgentModelSettings } from '../../src/runtime/config-validation.js';
import {
  validateOpenCodeConfigTopLevelKeys,
} from '../../src/opencode/config-schema.js';

function makeTempDir(prefix = 'openkit-config-validation-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function noopTooling() {
  return { action: 'skipped', installed: false };
}

function assertStrictOpenCodeConfig(config, label) {
  const validation = validateOpenCodeConfigTopLevelKeys(config, { configPath: label });

  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.unknownKeys, []);
  assert.deepEqual(validation.openKitOnlyKeys, []);
}

function assertPreservedPermissionProjection(config) {
  for (const key of [
    'npm',
    'task',
    'bash',
    'edit',
    'read',
    'write',
    'glob',
    'grep',
    'list',
    'skill',
    'lsp',
    'todoread',
    'todowrite',
    'webfetch',
    'websearch',
    'codesearch',
    'external_directory',
    'doom_loop',
    'git status',
    'git log',
    'git diff',
  ]) {
    assert.equal(config.permission?.[key], 'allow', `${key} should remain allowed`);
  }

  for (const key of [
    'rm',
    'rmdir',
    'unlink',
    'git reset --hard',
    'git clean',
    'git restore',
    'git checkout',
    'git push --force',
    'git push --force-with-lease',
  ]) {
    assert.equal(config.permission?.[key], 'ask', `${key} should remain confirmation-required`);
  }
}

test('agent model settings validation warns on malformed shapes and unknown keys', () => {
  const warnings = validateAgentModelSettings({
    agentModels: {
      'qa-agent': {
        model: '',
        variant: 42,
        temperature: 0.2,
      },
      'bad-agent': 'not-an-object',
    },
  });

  assert.match(warnings.join('\n'), /agentModels\.qa-agent\.model must be a non-empty string/);
  assert.match(warnings.join('\n'), /agentModels\.qa-agent\.variant must be a string/);
  assert.match(warnings.join('\n'), /agentModels\.qa-agent\.temperature is unknown and will be ignored/);
  assert.match(warnings.join('\n'), /agentModels\.bad-agent must be an object/);
});

test('agent model settings validation accepts fallback chains and auto-fallback policy', () => {
  const warnings = validateAgentModelSettings({
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5',
        fallback_models: ['openai/gpt-5-mini', { model: 'anthropic/claude-sonnet-4-5', variant: 'high' }],
        auto_fallback: {
          enabled: true,
          after_failures: 3,
        },
      },
    },
  });

  assert.deepEqual(warnings, []);
});

test('agent model settings validation accepts up to two quick-switch profiles', () => {
  const warnings = validateAgentModelSettings({
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5.4',
        profiles: [
          { model: 'openai/gpt-5.4', variant: 'high' },
          { model: 'azure/gpt-5.4', variant: 'high' },
        ],
      },
    },
  });

  assert.deepEqual(warnings, []);
});

test('strict OpenCode config validation rejects legacy OpenKit-only top-level metadata', () => {
  const validation = validateOpenCodeConfigTopLevelKeys({
    $schema: 'https://opencode.ai/config.json',
    permission: { read: 'allow' },
    commandPermissionPolicy: { schema: 'openkit/command-permission-policy@1' },
    installState: { path: '.openkit/openkit-install.json' },
  });

  assert.equal(validation.status, 'invalid');
  assert.deepEqual(validation.openKitOnlyKeys, ['commandPermissionPolicy', 'installState']);
  assert.match(validation.errors.join('\n'), /OpenKit-only metadata must not be embedded/);
});

test('checked-in OpenCode config projections are strict-schema-safe and preserve permissions', () => {
  const template = readJson(path.join(process.cwd(), 'assets', 'opencode.json.template'));
  const repoLocal = readJson(path.join(process.cwd(), '.opencode', 'opencode.json'));

  assertStrictOpenCodeConfig(template, 'assets/opencode.json.template');
  assertStrictOpenCodeConfig(repoLocal, '.opencode/opencode.json');
  assertPreservedPermissionProjection(template);
  assertPreservedPermissionProjection(repoLocal);
});

test('global kit and profile materialization produce strict-schema-safe OpenCode configs', () => {
  const tempHome = makeTempDir('openkit-global-config-validation-');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
    ensureAstGrep: noopTooling,
    ensureSemgrep: noopTooling,
  });

  const kitConfig = readJson(path.join(tempHome, 'kits', 'openkit', 'opencode.json'));
  const profileConfig = readJson(path.join(tempHome, 'profiles', 'openkit', 'opencode.json'));

  assertStrictOpenCodeConfig(kitConfig, 'global kit opencode.json');
  assertStrictOpenCodeConfig(profileConfig, 'openkit profile opencode.json');
  assertPreservedPermissionProjection(kitConfig);
  assertPreservedPermissionProjection(profileConfig);
});

test('MCP profile materializer strips legacy invalid OpenKit-only metadata while preserving permissions', () => {
  const tempHome = makeTempDir('openkit-mcp-config-validation-');
  const profilePath = path.join(tempHome, 'profiles', 'openkit', 'opencode.json');
  const env = { OPENCODE_HOME: tempHome };

  writeJson(profilePath, {
    $schema: 'https://opencode.ai/config.json',
    commandPermissionPolicy: { schema: 'openkit/command-permission-policy@1' },
    permission: { read: 'allow' },
    mcp: {},
  });

  materializeMcpProfiles({ scope: 'openkit', env });
  const profileConfig = readJson(profilePath);

  assertStrictOpenCodeConfig(profileConfig, 'legacy openkit profile opencode.json');
  assertPreservedPermissionProjection(profileConfig);
});

test('install materializer output remains strict-schema-safe for OpenCode root config', () => {
  const projectRoot = makeTempDir('openkit-install-config-validation-');

  materializeInstall(projectRoot, {
    now: new Date('2026-04-28T00:00:00.000Z'),
  });

  const rootConfig = readJson(path.join(projectRoot, 'opencode.json'));

  assertStrictOpenCodeConfig(rootConfig, 'managed install opencode.json');
  assertPreservedPermissionProjection(rootConfig);
});

test('merge policy strips legacy OpenKit-only metadata and flags non-OpenCode unknown keys', () => {
  const result = applyOpenKitMergePolicy({
    currentConfig: {
      $schema: 'https://opencode.ai/config.json',
      commandPermissionPolicy: { schema: 'openkit/command-permission-policy@1' },
      installState: { path: '.openkit/openkit-install.json' },
      unknownWrapperState: true,
      permission: { read: 'allow' },
    },
    desiredConfig: {
      permission: { read: 'allow' },
    },
  });

  assert.equal(Object.hasOwn(result.config, 'commandPermissionPolicy'), false);
  assert.equal(Object.hasOwn(result.config, 'installState'), false);
  assert.equal(Object.hasOwn(result.config, 'unknownWrapperState'), false);
  assert.deepEqual(result.conflicts, [
    {
      field: 'unknownWrapperState',
      reason: 'schema-invalid-top-level-key',
      currentValue: true,
      desiredValue: undefined,
    },
  ]);
});
