import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildOpenCodeLayering,
} from '../../src/runtime/opencode-layering.js';
import { createInitialWorkflowState, ensureWorkspaceBootstrap } from '../../src/global/workspace-state.js';
import { getWorkspacePaths } from '../../src/global/paths.js';
import { launchManagedOpenCode } from '../../src/runtime/launcher.js';
import { launchGlobalOpenKit } from '../../src/global/launcher.js';
import { writeWorkItemIndex, writeWorkItemState, writeWorkItemWorktree } from '../../.opencode/lib/work-item-store.js';
import { buildSecretBindingRef, setSecretValue } from '../../src/global/mcp/secret-manager.js';
import { recordSecretBinding } from '../../src/global/mcp/mcp-config-store.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-launcher-'));
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

test('buildOpenCodeLayering uses the managed config dir when no baseline config is set', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'master-orchestrator',
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
    default_agent: 'master-orchestrator',
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
  assert.equal(layeredContent.default_agent, 'master-orchestrator');
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
    default_agent: 'master-orchestrator',
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
      '  runtimeFoundation: process.env.OPENKIT_RUNTIME_FOUNDATION ?? null,',
      '  runtimeFoundationVersion: process.env.OPENKIT_RUNTIME_FOUNDATION_VERSION ?? null,',
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
  assert.equal(layeredContent.default_agent, 'master-orchestrator');
  assert.deepEqual(layeredContent.instructions, ['AGENTS.md', 'context/navigation.md']);
  assert.equal(payload.runtimeFoundation, '1');
  assert.equal(payload.runtimeFoundationVersion, '1');
});

test('launchManagedOpenCode records a runtime session snapshot', () => {
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(projectRoot, 'bin');

  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    $schema: 'https://opencode.ai/config.json',
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = launchManagedOpenCode(['status'], {
    projectRoot,
    env: {
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    stdio: 'pipe',
  });

  assert.equal(result.exitCode, 0);

  const sessionIndexPath = path.join(projectRoot, '.opencode', 'runtime-sessions', 'index.json');
  assert.equal(fs.existsSync(sessionIndexPath), true);

  const sessions = JSON.parse(fs.readFileSync(sessionIndexPath, 'utf8')).sessions;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].launcher, 'managed');
  assert.deepEqual(sessions[0].args, ['status']);
});

test('launchGlobalOpenKit injects saved per-agent model overrides into inline config', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCall = null;

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  fs.mkdirSync(path.join(openCodeHome, 'kits', 'openkit'), { recursive: true });
  fs.mkdirSync(path.join(openCodeHome, 'profiles', 'openkit'), { recursive: true });

  writeJson(path.join(openCodeHome, 'kits', 'openkit', 'registry.json'), {
    components: {
      agents: [
        {
          id: 'agent.qa-agent',
          name: 'QA Agent',
          role: 'team',
          path: 'agents/qa-agent.md',
        },
      ],
    },
  });

  writeJson(path.join(openCodeHome, 'openkit', 'agent-models.json'), {
    schema: 'openkit/agent-model-settings@1',
    stateVersion: 1,
    updatedAt: '2026-03-24T00:00:00.000Z',
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5',
        variant: 'high',
        fallback_models: [
          'openai/gpt-5-mini',
          { model: 'anthropic/claude-sonnet-4-5', variant: 'high' },
        ],
        auto_fallback: {
          enabled: true,
          after_failures: 3,
        },
        profiles: [
          { model: 'openai/gpt-5', variant: 'high' },
          { model: 'azure/gpt-5', variant: 'high' },
        ],
      },
    },
  });

  const result = launchGlobalOpenKit(['status'], {
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        customSetting: true,
      }),
    },
    stdio: 'pipe',
    spawn: (command, args, options) => {
      spawnCall = { command, args, options };
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(spawnCall.command, 'opencode');
  assert.deepEqual(spawnCall.args, [projectRoot, 'status']);

  const inlineConfig = JSON.parse(spawnCall.options.env.OPENCODE_CONFIG_CONTENT);
  assert.equal(inlineConfig.customSetting, true);
  assert.equal(inlineConfig.agent['qa-agent'].model, 'openai/gpt-5');
  assert.equal(inlineConfig.agent['qa-agent'].variant, 'high');
  assert.deepEqual(inlineConfig.agent['qa-agent'].fallback_models, [
    'openai/gpt-5-mini',
    { model: 'anthropic/claude-sonnet-4-5', variant: 'high' },
  ]);
  assert.deepEqual(inlineConfig.agent['qa-agent'].auto_fallback, {
    enabled: true,
    after_failures: 3,
  });
  assert.deepEqual(inlineConfig.agent['qa-agent'].profiles, [
    { model: 'openai/gpt-5', variant: 'high' },
    { model: 'azure/gpt-5', variant: 'high' },
  ]);
});

test('launchGlobalOpenKit preserves shell env over saved local secrets', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCall = null;
  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  setSecretValue('CONTEXT7_API_KEY', 'local-secret', { env: { OPENCODE_HOME: openCodeHome } });

  const result = launchGlobalOpenKit(['status'], {
    projectRoot,
    env: { OPENCODE_HOME: openCodeHome, CONTEXT7_API_KEY: 'shell-secret' },
    stdio: 'pipe',
    spawn: (command, args, options) => {
      spawnCall = { command, args, options };
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(spawnCall.options.env.CONTEXT7_API_KEY, 'shell-secret');
});

test('launchGlobalOpenKit ignores unrecorded keychain items and falls back to local env file', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCall = null;
  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  const env = { OPENCODE_HOME: openCodeHome };
  const ref = buildSecretBindingRef({ mcpId: 'context7', envVar: 'CONTEXT7_API_KEY', scope: 'openkit', kind: 'bundled' });
  setSecretValue('CONTEXT7_API_KEY', 'stale-keychain-secret', { env, store: 'keychain', mcpId: 'context7', bindingRef: ref, keychainAdapter: { set: () => ({ status: 'stored', ref }) } });
  setSecretValue('CONTEXT7_API_KEY', 'local-fallback-secret', { env });

  const result = launchGlobalOpenKit(['status'], {
    projectRoot,
    env,
    stdio: 'pipe',
    spawn: (command, args, options) => {
      spawnCall = { command, args, options };
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(spawnCall.options.env.CONTEXT7_API_KEY, 'local-fallback-secret');
});

test('launchGlobalOpenKit loads keychain only when matching metadata is recorded', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCall = null;
  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  const env = { OPENCODE_HOME: openCodeHome };
  const ref = buildSecretBindingRef({ mcpId: 'context7', envVar: 'CONTEXT7_API_KEY', scope: 'openkit', kind: 'bundled' });
  recordSecretBinding('context7', ['CONTEXT7_API_KEY'], { env, store: 'keychain', envVar: 'CONTEXT7_API_KEY', ref });
  setSecretValue('CONTEXT7_API_KEY', 'local-fallback-secret', { env });
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  const originalExecPath = process.env.PATH;
  try {
    const fakeBinDir = path.join(projectRoot, 'bin');
    writeExecutable(path.join(fakeBinDir, 'security'), '#!/bin/sh\nif [ "$1" = "list-keychains" ]; then exit 0; fi\nif [ "$1" = "find-generic-password" ]; then printf keychain-secret; exit 0; fi\nexit 0\n');
    process.env.PATH = `${fakeBinDir}${path.delimiter}${originalExecPath ?? ''}`;
    const securityPath = path.join(fakeBinDir, 'security');
    const result = launchGlobalOpenKit(['status'], {
      projectRoot,
      env: { ...env, PATH: process.env.PATH, OPENKIT_SECURITY_CLI: securityPath },
      stdio: 'pipe',
      spawn: (command, args, options) => {
        spawnCall = { command, args, options };
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(spawnCall.options.env.CONTEXT7_API_KEY, 'keychain-secret');
  } finally {
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    process.env.PATH = originalExecPath;
  }
});

test('launchGlobalOpenKit falls back to local env when recorded keychain is unavailable', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCall = null;
  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  const env = { OPENCODE_HOME: openCodeHome };
  const ref = buildSecretBindingRef({ mcpId: 'context7', envVar: 'CONTEXT7_API_KEY', scope: 'openkit', kind: 'bundled' });
  recordSecretBinding('context7', ['CONTEXT7_API_KEY'], { env, store: 'keychain', envVar: 'CONTEXT7_API_KEY', ref });
  setSecretValue('CONTEXT7_API_KEY', 'local-fallback-secret', { env });

  const result = launchGlobalOpenKit(['status'], {
    projectRoot,
    env,
    stdio: 'pipe',
    spawn: (command, args, options) => {
      spawnCall = { command, args, options };
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(spawnCall.options.env.CONTEXT7_API_KEY, 'local-fallback-secret');
});

test('launchGlobalOpenKit records runtime sessions in the managed workspace root', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });

  const result = launchGlobalOpenKit(['status'], {
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
    stdio: 'pipe',
    spawn: () => ({ status: 0, stdout: '', stderr: '' }),
  });

  assert.equal(result.exitCode, 0);

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  const sessionIndexPath = path.join(workspacePaths.workspaceRoot, '.opencode', 'runtime-sessions', 'index.json');

  assert.equal(fs.existsSync(sessionIndexPath), true);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode', 'runtime-sessions')), false);

  const sessions = JSON.parse(fs.readFileSync(sessionIndexPath, 'utf8')).sessions;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].launcher, 'global');
  assert.deepEqual(sessions[0].args, ['status']);
});

test('launchGlobalOpenKit can target a managed worktree for a specific work item', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCall = null;
  const workItemId = 'task-710';
  const worktreePath = path.join(projectRoot, '.worktrees', workItemId);

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  fs.mkdirSync(worktreePath, { recursive: true });

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  ensureWorkspaceBootstrap({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });

  const quickState = {
    ...createInitialWorkflowState({ mode: 'quick', selectionReason: 'Parallel quick task' }),
    feature_id: 'TASK-710',
    feature_slug: 'parallel-quick',
    work_item_id: workItemId,
    status: 'in_progress',
    current_owner: 'QuickAgent',
    issues: [],
    verification_evidence: [],
    updated_at: '2026-04-08T00:00:00.000Z',
  };

  writeWorkItemState(workspacePaths.workspaceRoot, workItemId, quickState);
  writeWorkItemIndex(workspacePaths.workspaceRoot, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: quickState.feature_id,
        feature_slug: quickState.feature_slug,
        mode: quickState.mode,
        status: quickState.status,
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeWorkItemWorktree(workspacePaths.workspaceRoot, workItemId, {
    schema: 'openkit/worktree@2',
    work_item_id: workItemId,
    workflow_mode: 'quick',
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: 'main',
    branch: `openkit/quick/${workItemId}`,
    worktree_path: worktreePath,
    created_at: '2026-04-08T00:00:00.000Z',
    env_propagation: {
      mode: 'none',
      applied_at: null,
      source_files: [],
    },
  });

  const result = launchGlobalOpenKit(['--work-item', workItemId, 'status'], {
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
    stdio: 'pipe',
    spawn: (command, args, options) => {
      spawnCall = { command, args, options };
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(spawnCall.command, 'opencode');
  assert.match(spawnCall.args[0], /\.worktrees\/task-710$/);
  assert.deepEqual(spawnCall.args.slice(1), ['status']);
  assert.equal(spawnCall.options.cwd, spawnCall.args[0]);
  assert.equal(spawnCall.options.env.OPENKIT_REPOSITORY_ROOT, projectRoot);
  assert.equal(spawnCall.options.env.OPENKIT_PROJECT_ROOT, spawnCall.args[0]);
  assert.equal(spawnCall.options.env.OPENKIT_WORKFLOW_STATE, workspacePaths.workflowStatePath);
  assert.match(result.stdout, /Retained managed worktree:/);
  assert.match(result.stdout, /Recommended next mode: reuse/);
  assert.match(result.stdout, /Last env propagation mode: none/);
  assert.match(result.stdout, /cleanup-worktree task-710/);
});

test('launchGlobalOpenKit returns prompt_required when mode is missing and no retained worktree exists', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  const workItemId = 'task-711';

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  ensureWorkspaceBootstrap({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });

  const quickState = {
    ...createInitialWorkflowState({ mode: 'quick', selectionReason: 'Prompt required coverage' }),
    feature_id: 'TASK-711',
    feature_slug: 'prompt-required',
    work_item_id: workItemId,
    status: 'in_progress',
    current_owner: 'QuickAgent',
    issues: [],
    verification_evidence: [],
    updated_at: '2026-04-08T00:00:00.000Z',
  };

  writeWorkItemState(workspacePaths.workspaceRoot, workItemId, quickState);
  writeWorkItemIndex(workspacePaths.workspaceRoot, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: quickState.feature_id,
        feature_slug: quickState.feature_slug,
        mode: quickState.mode,
        status: quickState.status,
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });

  const result = launchGlobalOpenKit(['--work-item', workItemId, 'status'], {
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
    stdio: 'pipe',
    spawn: () => {
      throw new Error('spawn should not be called when prompt is required');
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.promptRequired, true);
  assert.match(result.promptReason, /No usable retained managed worktree exists/);
  assert.equal(result.runtimeFoundation, null);
});

test('launchGlobalOpenKit blocks explicit new when retained worktree already exists', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  const workItemId = 'task-712';
  const worktreePath = path.join(projectRoot, '.worktrees', workItemId);

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  fs.mkdirSync(worktreePath, { recursive: true });

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  ensureWorkspaceBootstrap({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });

  const quickState = {
    ...createInitialWorkflowState({ mode: 'quick', selectionReason: 'Explicit new rejection coverage' }),
    feature_id: 'TASK-712',
    feature_slug: 'explicit-new-blocked',
    work_item_id: workItemId,
    status: 'in_progress',
    current_owner: 'QuickAgent',
    issues: [],
    verification_evidence: [],
    updated_at: '2026-04-08T00:00:00.000Z',
  };

  writeWorkItemState(workspacePaths.workspaceRoot, workItemId, quickState);
  writeWorkItemIndex(workspacePaths.workspaceRoot, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: quickState.feature_id,
        feature_slug: quickState.feature_slug,
        mode: quickState.mode,
        status: quickState.status,
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeWorkItemWorktree(workspacePaths.workspaceRoot, workItemId, {
    schema: 'openkit/worktree@2',
    work_item_id: workItemId,
    workflow_mode: 'quick',
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: 'main',
    branch: `openkit/quick/${workItemId}`,
    worktree_path: worktreePath,
    created_at: '2026-04-08T00:00:00.000Z',
    env_propagation: {
      mode: 'none',
      applied_at: null,
      source_files: [],
    },
  });

  const result = launchGlobalOpenKit(
    {
      workItemId,
      worktreeMode: 'new',
      envPropagation: 'none',
      passthroughArgs: ['status'],
    },
    {
      projectRoot,
      env: {
        OPENCODE_HOME: openCodeHome,
      },
      stdio: 'pipe',
      spawn: () => {
        throw new Error('spawn should not be called when explicit new is blocked');
      },
    },
  );

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /already retained/);
  assert.match(result.stderr, /worktree-mode reuse\/reopen\/none/);
});

test('launchGlobalOpenKit blocks explicit reuse when the work item is already done', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  const workItemId = 'task-713';
  const worktreePath = path.join(projectRoot, '.worktrees', workItemId);

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  fs.mkdirSync(worktreePath, { recursive: true });

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  ensureWorkspaceBootstrap({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });

  const quickState = {
    ...createInitialWorkflowState({ mode: 'quick', selectionReason: 'Explicit reuse terminal coverage' }),
    feature_id: 'TASK-713',
    feature_slug: 'explicit-reuse-blocked',
    work_item_id: workItemId,
    status: 'done',
    current_stage: 'quick_done',
    current_owner: 'QuickAgent',
    issues: [],
    verification_evidence: [],
    updated_at: '2026-04-08T00:00:00.000Z',
  };

  writeWorkItemState(workspacePaths.workspaceRoot, workItemId, quickState);
  writeWorkItemIndex(workspacePaths.workspaceRoot, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: quickState.feature_id,
        feature_slug: quickState.feature_slug,
        mode: quickState.mode,
        status: quickState.status,
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeWorkItemWorktree(workspacePaths.workspaceRoot, workItemId, {
    schema: 'openkit/worktree@2',
    work_item_id: workItemId,
    workflow_mode: 'quick',
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: 'main',
    branch: `openkit/quick/${workItemId}`,
    worktree_path: worktreePath,
    created_at: '2026-04-08T00:00:00.000Z',
    env_propagation: {
      mode: 'none',
      applied_at: null,
      source_files: [],
    },
  });

  const result = launchGlobalOpenKit(
    {
      workItemId,
      worktreeMode: 'reuse',
      envPropagation: 'none',
      passthroughArgs: ['status'],
    },
    {
      projectRoot,
      env: {
        OPENCODE_HOME: openCodeHome,
      },
      stdio: 'pipe',
      spawn: () => {
        throw new Error('spawn should not be called when explicit reuse is blocked');
      },
    },
  );

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /requires an active same-lineage work item/);
  assert.match(result.stderr, /use --worktree-mode reopen/);
});

test('launchGlobalOpenKit blocks explicit reopen when the work item is still active', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  const workItemId = 'task-714';
  const worktreePath = path.join(projectRoot, '.worktrees', workItemId);

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  fs.mkdirSync(worktreePath, { recursive: true });

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  ensureWorkspaceBootstrap({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });

  const quickState = {
    ...createInitialWorkflowState({ mode: 'quick', selectionReason: 'Explicit reopen active coverage' }),
    feature_id: 'TASK-714',
    feature_slug: 'explicit-reopen-blocked',
    work_item_id: workItemId,
    status: 'in_progress',
    current_owner: 'QuickAgent',
    issues: [],
    verification_evidence: [],
    updated_at: '2026-04-08T00:00:00.000Z',
  };

  writeWorkItemState(workspacePaths.workspaceRoot, workItemId, quickState);
  writeWorkItemIndex(workspacePaths.workspaceRoot, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: quickState.feature_id,
        feature_slug: quickState.feature_slug,
        mode: quickState.mode,
        status: quickState.status,
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeWorkItemWorktree(workspacePaths.workspaceRoot, workItemId, {
    schema: 'openkit/worktree@2',
    work_item_id: workItemId,
    workflow_mode: 'quick',
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: 'main',
    branch: `openkit/quick/${workItemId}`,
    worktree_path: worktreePath,
    created_at: '2026-04-08T00:00:00.000Z',
    env_propagation: {
      mode: 'none',
      applied_at: null,
      source_files: [],
    },
  });

  const result = launchGlobalOpenKit(
    {
      workItemId,
      worktreeMode: 'reopen',
      envPropagation: 'none',
      passthroughArgs: ['status'],
    },
    {
      projectRoot,
      env: {
        OPENCODE_HOME: openCodeHome,
      },
      stdio: 'pipe',
      spawn: () => {
        throw new Error('spawn should not be called when explicit reopen is blocked');
      },
    },
  );

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /is for work items returning after a completion boundary/);
  assert.match(result.stderr, /use --worktree-mode reuse/);
});

test('launchGlobalOpenKit reuses retained env propagation without conflict on repeated reuse launches', () => {
  const projectRoot = makeTempDir();
  const openCodeHome = makeTempDir();
  let spawnCallCount = 0;
  const workItemId = 'task-715';
  const worktreePath = path.join(projectRoot, '.worktrees', workItemId);

  fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
  fs.mkdirSync(worktreePath, { recursive: true });
  writeJson(path.join(projectRoot, '.env'), { invalid: 'fixture' });
  fs.writeFileSync(path.join(projectRoot, '.env'), 'ROOT=true\n', 'utf8');

  const workspacePaths = getWorkspacePaths({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });
  ensureWorkspaceBootstrap({
    projectRoot,
    env: {
      OPENCODE_HOME: openCodeHome,
    },
  });

  const quickState = {
    ...createInitialWorkflowState({ mode: 'quick', selectionReason: 'Repeated reuse env coverage' }),
    feature_id: 'TASK-715',
    feature_slug: 'repeated-reuse-env',
    work_item_id: workItemId,
    status: 'in_progress',
    current_owner: 'QuickAgent',
    issues: [],
    verification_evidence: [],
    updated_at: '2026-04-08T00:00:00.000Z',
  };

  writeWorkItemState(workspacePaths.workspaceRoot, workItemId, quickState);
  writeWorkItemIndex(workspacePaths.workspaceRoot, {
    active_work_item_id: workItemId,
    work_items: [
      {
        work_item_id: workItemId,
        feature_id: quickState.feature_id,
        feature_slug: quickState.feature_slug,
        mode: quickState.mode,
        status: quickState.status,
        state_path: `.opencode/work-items/${workItemId}/state.json`,
      },
    ],
  });
  writeWorkItemWorktree(workspacePaths.workspaceRoot, workItemId, {
    schema: 'openkit/worktree@2',
    work_item_id: workItemId,
    workflow_mode: 'quick',
    lineage_key: workItemId,
    repository_root: projectRoot,
    target_branch: 'main',
    branch: `openkit/quick/${workItemId}`,
    worktree_path: worktreePath,
    created_at: '2026-04-08T00:00:00.000Z',
    env_propagation: {
      mode: 'symlink',
      applied_at: '2026-04-08T00:00:00.000Z',
      source_files: ['.env'],
    },
  });

  fs.symlinkSync(path.join(projectRoot, '.env'), path.join(worktreePath, '.env'));

  const firstResult = launchGlobalOpenKit(
    {
      workItemId,
      worktreeMode: 'reuse',
      envPropagation: null,
      passthroughArgs: ['status'],
    },
    {
      projectRoot,
      env: {
        OPENCODE_HOME: openCodeHome,
      },
      stdio: 'pipe',
      spawn: () => {
        spawnCallCount += 1;
        return { status: 0, stdout: '', stderr: '' };
      },
    },
  );

  const secondResult = launchGlobalOpenKit(
    {
      workItemId,
      worktreeMode: 'reuse',
      envPropagation: null,
      passthroughArgs: ['status'],
    },
    {
      projectRoot,
      env: {
        OPENCODE_HOME: openCodeHome,
      },
      stdio: 'pipe',
      spawn: () => {
        spawnCallCount += 1;
        return { status: 0, stdout: '', stderr: '' };
      },
    },
  );

  assert.equal(firstResult.exitCode, 0);
  assert.equal(secondResult.exitCode, 0);
  assert.equal(spawnCallCount, 2);
  assert.doesNotMatch(secondResult.stderr, /overwrite existing files/);
  assert.match(secondResult.stdout, /Last env propagation mode: symlink/);
});
