import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildAgentModelConfigOverrides } from './agent-models.js';
import { deepMergeConfig, parseInlineConfig } from './config-merge.js';
import { ensureWorkspaceBootstrap } from './workspace-state.js';
import { getToolingEnv } from './tooling.js';
import { createManagedWorktree, getManagedWorktree, updateManagedWorktreeMetadata } from './worktree-manager.js';
import { COPY_ENV_WARNING, propagateWorktreeEnvFiles, resolveEnvPropagationMode } from './worktree-env.js';
import { parseRunOptions } from '../cli/commands/run-options.js';
import { bootstrapRuntimeFoundation, createRuntimeFoundationEnvironment } from '../runtime/index.js';
import { selectActiveWorkItem, showWorkItemState } from '../../.opencode/lib/workflow-state-controller.js';

function formatMissingOpenCodeError() {
  return [
    'Could not find `opencode` on your PATH.',
    'Install OpenCode or add `opencode` to PATH, then retry `openkit run`.',
  ].join('\n');
}

const ALLOWED_WORKTREE_MODES = new Set(['new', 'reuse', 'reopen', 'none']);

function normalizeLaunchRequest(argsOrRequest = []) {
  if (Array.isArray(argsOrRequest)) {
    return parseRunOptions(argsOrRequest);
  }

  if (argsOrRequest && typeof argsOrRequest === 'object') {
    return {
      workItemId: argsOrRequest.workItemId ?? null,
      worktreeMode: argsOrRequest.worktreeMode ?? null,
      envPropagation: argsOrRequest.envPropagation ?? null,
      passthroughArgs: Array.isArray(argsOrRequest.passthroughArgs) ? argsOrRequest.passthroughArgs : [],
    };
  }

  return parseRunOptions([]);
}

function isTerminalWorkItemState(workItemState) {
  const status = workItemState?.state?.status;
  const stage = workItemState?.state?.current_stage;
  return status === 'done' || (typeof stage === 'string' && stage.endsWith('_done'));
}

function appendUniqueNotices(target, ...entries) {
  for (const entry of entries) {
    if (typeof entry !== 'string' || entry.length === 0 || target.includes(entry)) {
      continue;
    }
    target.push(entry);
  }
}

function resolveRequestedWorktreeMode(workItemState, explicitMode, retainedWorktree) {
  const normalizedMode = typeof explicitMode === 'string' ? explicitMode.trim().toLowerCase() : null;
  if (normalizedMode && !ALLOWED_WORKTREE_MODES.has(normalizedMode)) {
    return {
      status: 'blocked',
      reason: `Unknown worktree mode '${normalizedMode}'. Expected one of: new, reuse, reopen, none.`,
      mode: null,
      source: 'explicit',
    };
  }

  if (normalizedMode) {
    if (normalizedMode === 'reuse' && isTerminalWorkItemState(workItemState)) {
      return {
        status: 'blocked',
        reason: 'Requested worktree mode "reuse" requires an active same-lineage work item. This work item is already done; use --worktree-mode reopen or choose another explicit mode.',
        mode: null,
        source: 'explicit',
      };
    }

    if (normalizedMode === 'reopen' && !isTerminalWorkItemState(workItemState)) {
      return {
        status: 'blocked',
        reason: 'Requested worktree mode "reopen" is for work items returning after a completion boundary. This work item is still active; use --worktree-mode reuse or choose another explicit mode.',
        mode: null,
        source: 'explicit',
      };
    }

    return {
      status: 'resolved',
      mode: normalizedMode,
      source: 'explicit',
      reason: null,
    };
  }

  if (!retainedWorktree?.worktree_path || !fs.existsSync(retainedWorktree.worktree_path)) {
    return {
      status: 'prompt_required',
      mode: null,
      source: 'default',
      reason: 'No usable retained managed worktree exists for this work item. Choose an explicit worktree mode.',
    };
  }

  if (isTerminalWorkItemState(workItemState)) {
    return {
      status: 'resolved',
      mode: 'reopen',
      source: 'default',
      reason: 'Selected reopen because the work item is already done and can be resumed in retained context.',
    };
  }

  return {
    status: 'resolved',
    mode: 'reuse',
    source: 'default',
    reason: 'Selected reuse because the work item is active and can continue in retained context.',
  };
}

function resolveWorktreeLaunch({ paths, workItemState, workItemId, worktreeMode, envPropagation }) {
  const runtimeRoot = paths.workspaceRoot;
  const repositoryRoot = paths.projectRoot;
  const retainedWorktree = getManagedWorktree({ runtimeRoot, workItemId });
  const requestedMode = resolveRequestedWorktreeMode(workItemState, worktreeMode, retainedWorktree);

  if (requestedMode.status === 'prompt_required') {
    return {
      status: 'prompt_required',
      reason: requestedMode.reason,
      launchProjectRoot: null,
      launchSelection: null,
    };
  }

  if (requestedMode.status === 'blocked') {
    return {
      status: 'blocked',
      reason: requestedMode.reason,
      launchProjectRoot: null,
      launchSelection: null,
    };
  }

  const mode = requestedMode.mode;

  if (mode === 'none') {
    const notices = [];
    if (typeof envPropagation === 'string' && envPropagation.trim().length > 0 && envPropagation.trim() !== 'none') {
      notices.push(`Env propagation '${envPropagation.trim()}' is not applicable for worktree-mode=none; continuing without env propagation.`);
    }

    return {
      status: 'ready',
      launchProjectRoot: repositoryRoot,
      launchSelection: {
        worktreeMode: 'none',
        resolvedBy: requestedMode.source,
        reason: requestedMode.reason,
        envPropagation: {
          mode: 'none',
          status: 'not_applicable',
          warning: null,
          sourceFiles: [],
        },
        retainedWorktree: retainedWorktree ?? null,
      },
      notices,
    };
  }

  if (!retainedWorktree?.worktree_path || !fs.existsSync(retainedWorktree.worktree_path)) {
    if (mode === 'new') {
      const created = createManagedWorktree({
        repositoryRoot,
        runtimeRoot,
        workItemId,
        mode: workItemState?.state?.mode,
      });

      if (!created.metadata?.worktree_path || !fs.existsSync(created.metadata.worktree_path)) {
        return {
          status: 'blocked',
          reason: created.reason ?? `Unable to create a managed worktree for '${workItemId}'.`,
          launchProjectRoot: null,
          launchSelection: null,
        };
      }

      const resolvedEnvMode = resolveEnvPropagationMode({
        requestedMode: envPropagation,
        retainedMode: created.metadata?.env_propagation?.mode,
      });
      const notices = [];
      if (resolvedEnvMode === 'copy') {
        appendUniqueNotices(notices, COPY_ENV_WARNING);
      }
      const envResult = propagateWorktreeEnvFiles({
        repositoryRoot,
        worktreePath: created.metadata.worktree_path,
        mode: resolvedEnvMode,
      });

      if (envResult.status === 'unsupported' || envResult.status === 'conflict') {
        return {
          status: 'blocked',
          reason: envResult.warning,
          launchProjectRoot: null,
          launchSelection: null,
        };
      }

      const updatedMetadata = updateManagedWorktreeMetadata({
        runtimeRoot,
        workItemId,
        envPropagation: {
          mode: envResult.mode,
          applied_at: envResult.status === 'applied' ? new Date().toISOString() : null,
          source_files: envResult.sourceFiles,
        },
      });

      return {
        status: 'ready',
        launchProjectRoot: created.metadata.worktree_path,
        launchSelection: {
          worktreeMode: 'new',
          resolvedBy: requestedMode.source,
          reason: requestedMode.reason,
          envPropagation: {
            mode: envResult.mode,
            status: envResult.status,
            warning: envResult.warning,
            sourceFiles: envResult.sourceFiles,
          },
          retainedWorktree: updatedMetadata ?? created.metadata,
        },
        notices: (() => {
          appendUniqueNotices(notices, envResult.warning);
          return notices;
        })(),
      };
    }

    return {
      status: 'blocked',
      reason: `Requested worktree mode '${mode}' requires a retained managed worktree for '${workItemId}', but no usable retained worktree exists.`,
      launchProjectRoot: null,
      launchSelection: null,
    };
  }

  if (mode === 'new') {
    return {
      status: 'blocked',
      reason: `Managed worktree '${retainedWorktree.worktree_path}' is already retained for '${workItemId}'. Use --worktree-mode reuse/reopen/none or run explicit cleanup first.`,
      launchProjectRoot: null,
      launchSelection: null,
    };
  }

  if (mode === 'reuse' || mode === 'reopen') {
    const resolvedEnvMode = resolveEnvPropagationMode({
      requestedMode: envPropagation,
      retainedMode: retainedWorktree.env_propagation?.mode,
    });
    const notices = [];
    if (resolvedEnvMode === 'copy') {
      appendUniqueNotices(notices, COPY_ENV_WARNING);
    }
    const envResult = propagateWorktreeEnvFiles({
      repositoryRoot,
      worktreePath: retainedWorktree.worktree_path,
      mode: resolvedEnvMode,
    });

    if (envResult.status === 'unsupported' || envResult.status === 'conflict') {
      return {
        status: 'blocked',
        reason: envResult.warning,
        launchProjectRoot: null,
        launchSelection: null,
      };
    }

    const updatedMetadata = updateManagedWorktreeMetadata({
      runtimeRoot,
      workItemId,
      envPropagation: {
        mode: envResult.mode,
        applied_at: envResult.status === 'applied' ? new Date().toISOString() : retainedWorktree.env_propagation?.applied_at ?? null,
        source_files: envResult.status === 'applied' ? envResult.sourceFiles : retainedWorktree.env_propagation?.source_files ?? [],
      },
    });

    appendUniqueNotices(notices, envResult.warning);

    return {
      status: 'ready',
      launchProjectRoot: retainedWorktree.worktree_path,
      launchSelection: {
        worktreeMode: mode,
        resolvedBy: requestedMode.source,
        reason: requestedMode.reason,
        envPropagation: {
          mode: envResult.mode,
          status: envResult.status,
          warning: envResult.warning,
          sourceFiles: envResult.sourceFiles,
        },
        retainedWorktree: updatedMetadata ?? retainedWorktree,
      },
      notices,
    };
  }

  return {
    status: 'blocked',
    reason: `Unable to resolve worktree launch mode '${mode}'.`,
    launchProjectRoot: null,
    launchSelection: null,
  };
}

function buildRetainedContextLines({ workItemId, launchSelection }) {
  if (!workItemId || !launchSelection || launchSelection.worktreeMode === 'none') {
    return [];
  }

  const retained = launchSelection.retainedWorktree;
  if (!retained?.worktree_path) {
    return [];
  }

  const nextModeHint = launchSelection.worktreeMode === 'reopen' ? 'reopen' : 'reuse';
  const envMode = launchSelection.envPropagation?.mode ?? retained?.env_propagation?.mode ?? 'none';

  return [
    `Retained managed worktree: ${retained.worktree_path}`,
    `Recommended next mode: ${nextModeHint}`,
    `Last env propagation mode: ${envMode}`,
    `Cleanup when ready: node .opencode/workflow-state.js cleanup-worktree ${workItemId}`,
  ];
}

export function launchGlobalOpenKit(args = [], { projectRoot = process.cwd(), env = process.env, spawn = spawnSync, stdio = 'inherit' } = {}) {
  let parsedArgs;
  try {
    parsedArgs = normalizeLaunchRequest(args);
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
  let launchSelection = null;
  const launcherNotices = [];

  if (parsedArgs.workItemId) {
    selectActiveWorkItem(parsedArgs.workItemId, paths.workflowStatePath);
    const workItemState = showWorkItemState(parsedArgs.workItemId, paths.workflowStatePath);
    const resolution = resolveWorktreeLaunch({
      paths,
      workItemState,
      workItemId: parsedArgs.workItemId,
      worktreeMode: parsedArgs.worktreeMode,
      envPropagation: parsedArgs.envPropagation,
    });

    if (resolution.status === 'prompt_required') {
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        paths,
        runtimeFoundation: null,
        launchSelection: null,
        promptRequired: true,
        promptReason: resolution.reason,
      };
    }

    if (resolution.status !== 'ready') {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `${resolution.reason}\n`,
        paths,
        runtimeFoundation: null,
      };
    }

    launchProjectRoot = resolution.launchProjectRoot;
    launchSelection = resolution.launchSelection;
    launcherNotices.push(...(resolution.notices ?? []));
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

  const retainedContextLines = buildRetainedContextLines({
    workItemId: parsedArgs.workItemId,
    launchSelection,
  });
  const preLaunchOutput = launcherNotices.length > 0 ? `${launcherNotices.join('\n')}\n` : '';
  const retainedContextOutput = retainedContextLines.length > 0 ? `${retainedContextLines.join('\n')}\n` : '';

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: `${preLaunchOutput}${result.stdout ?? ''}${retainedContextOutput}`,
    stderr: `${result.stderr ?? ''}`,
    paths,
    runtimeFoundation,
    launchSelection,
  };
}
