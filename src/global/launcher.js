import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildAgentModelConfigOverrides } from './agent-models.js';
import { deepMergeConfig, parseInlineConfig } from './config-merge.js';
import { ensureWorkspaceBootstrap } from './workspace-state.js';
import { getToolingEnv } from './tooling.js';
import { finalizeManagedWorktree, getManagedWorktree } from './worktree-manager.js';
import { bootstrapRuntimeFoundation, createRuntimeFoundationEnvironment } from '../runtime/index.js';
import { selectActiveWorkItem, showWorkItemState } from '../../.opencode/lib/workflow-state-controller.js';

function formatMissingOpenCodeError() {
  return [
    'Could not find `opencode` on your PATH.',
    'Install OpenCode or add `opencode` to PATH, then retry `openkit run`.',
  ].join('\n');
}

function parseRunArgs(args = []) {
  const passthroughArgs = [];
  let workItemId = null;

  for (let index = 0; index < args.length; index++) {
    const current = args[index];
    if (current === '--work-item') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Missing value for --work-item.');
      }
      workItemId = value;
      index += 1;
      continue;
    }
    passthroughArgs.push(current);
  }

  return { workItemId, passthroughArgs };
}

function finalizeCompletedWorktree({ paths, launchProjectRoot, workItemId }) {
  if (!workItemId) {
    return null;
  }

  const workItemState = showWorkItemState(workItemId, paths.workflowStatePath);
  if (workItemState?.state?.status !== 'done') {
    return null;
  }

  const worktree = getManagedWorktree({
    runtimeRoot: paths.workspaceRoot,
    workItemId,
  });

  if (!worktree?.worktree_path || !fs.existsSync(worktree.worktree_path)) {
    return null;
  }

  if (path.resolve(worktree.worktree_path) !== path.resolve(launchProjectRoot)) {
    return null;
  }

  return finalizeManagedWorktree({
    repositoryRoot: paths.projectRoot,
    runtimeRoot: paths.workspaceRoot,
    workItemId,
  });
}

export function launchGlobalOpenKit(args = [], { projectRoot = process.cwd(), env = process.env, spawn = spawnSync, stdio = 'inherit' } = {}) {
  let parsedArgs;
  try {
    parsedArgs = parseRunArgs(args);
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${error.message}\n`,
      paths: null,
      runtimeFoundation: null,
    };
  }

  const paths = ensureWorkspaceBootstrap({ projectRoot, env });
  let launchProjectRoot = paths.projectRoot;

  if (parsedArgs.workItemId) {
    selectActiveWorkItem(parsedArgs.workItemId, paths.workflowStatePath);
    const worktree = getManagedWorktree({ runtimeRoot: paths.workspaceRoot, workItemId: parsedArgs.workItemId });
    if (!worktree?.worktree_path || !fs.existsSync(worktree.worktree_path)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Work item '${parsedArgs.workItemId}' does not have an available managed worktree.\n`,
        paths,
        runtimeFoundation: null,
      };
    }
    launchProjectRoot = worktree.worktree_path;
  }

  const baselineInlineConfig = parseInlineConfig(env.OPENCODE_CONFIG_CONTENT, 'OPENCODE_CONFIG_CONTENT') ?? {};
  const agentModelOverrides = buildAgentModelConfigOverrides(paths.agentModelSettingsPath);
  const layeredInlineConfig = deepMergeConfig(baselineInlineConfig, agentModelOverrides);
  const runtimeBootstrapEnv = {
    ...env,
    OPENKIT_GLOBAL_MODE: '1',
    OPENKIT_PROJECT_ROOT: launchProjectRoot,
    OPENKIT_REPOSITORY_ROOT: paths.projectRoot,
    OPENKIT_WORKFLOW_STATE: paths.workflowStatePath,
    OPENKIT_KIT_ROOT: paths.kitRoot,
    OPENKIT_HOME: paths.openCodeHome,
    OPENCODE_CONFIG_DIR: paths.kitRoot,
  };
  const runtimeFoundation = bootstrapRuntimeFoundation({ projectRoot: launchProjectRoot, env: runtimeBootstrapEnv });
  const runtimeEnv = createRuntimeFoundationEnvironment(runtimeFoundation);
  const launcherEnv = {
    ...getToolingEnv(runtimeBootstrapEnv),
    ...runtimeEnv,
    OPENCODE_CONFIG_CONTENT: Object.keys(layeredInlineConfig).length > 0
      ? JSON.stringify(layeredInlineConfig)
      : undefined,
  };

  if (launcherEnv.OPENCODE_CONFIG_CONTENT === undefined) {
    delete launcherEnv.OPENCODE_CONFIG_CONTENT;
  }

  const result = spawn('opencode', [launchProjectRoot, ...parsedArgs.passthroughArgs], {
    cwd: launchProjectRoot,
    env: launcherEnv,
    encoding: 'utf8',
    stdio,
  });

  if (result.error?.code === 'ENOENT') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatMissingOpenCodeError()}\n`,
      paths,
      runtimeFoundation,
    };
  }

  if (result.error) {
    return {
      exitCode: 1,
      stdout: result.stdout ?? '',
      stderr: result.error.message ?? result.stderr ?? 'Failed to launch opencode.',
      paths,
      runtimeFoundation,
    };
  }

  runtimeFoundation.managers.sessionStateManager?.recordRuntimeSession({
    launcher: 'global',
    workflowKernel: runtimeFoundation.managers.workflowKernel,
    backgroundManager: runtimeFoundation.managers.backgroundManager,
    args: parsedArgs.passthroughArgs,
    exitCode: typeof result.status === 'number' ? result.status : 1,
  });

  const worktreeCleanup = finalizeCompletedWorktree({
    paths,
    launchProjectRoot,
    workItemId: parsedArgs.workItemId,
  });
  const cleanupLine = worktreeCleanup
    ? worktreeCleanup.status === 'merged'
      ? `Managed worktree merged and removed for '${parsedArgs.workItemId}'.\n`
      : `Managed worktree cleanup skipped for '${parsedArgs.workItemId}': ${worktreeCleanup.reason}\n`
    : '';

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: `${result.stdout ?? ''}${worktreeCleanup?.status === 'merged' ? cleanupLine : ''}`,
    stderr: `${result.stderr ?? ''}${worktreeCleanup && worktreeCleanup.status !== 'merged' ? cleanupLine : ''}`,
    paths,
    runtimeFoundation,
    worktreeCleanup,
  };
}
