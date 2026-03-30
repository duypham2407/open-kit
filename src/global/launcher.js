import { spawnSync } from 'node:child_process';

import { buildAgentModelConfigOverrides } from './agent-models.js';
import { deepMergeConfig, parseInlineConfig } from './config-merge.js';
import { ensureWorkspaceBootstrap } from './workspace-state.js';
import { bootstrapRuntimeFoundation, createRuntimeFoundationEnvironment } from '../runtime/index.js';

function formatMissingOpenCodeError() {
  return [
    'Could not find `opencode` on your PATH.',
    'Install OpenCode or add `opencode` to PATH, then retry `openkit run`.',
  ].join('\n');
}

export function launchGlobalOpenKit(args = [], { projectRoot = process.cwd(), env = process.env, spawn = spawnSync, stdio = 'inherit' } = {}) {
  const paths = ensureWorkspaceBootstrap({ projectRoot, env });
  const baselineInlineConfig = parseInlineConfig(env.OPENCODE_CONFIG_CONTENT, 'OPENCODE_CONFIG_CONTENT') ?? {};
  const agentModelOverrides = buildAgentModelConfigOverrides(paths.agentModelSettingsPath);
  const layeredInlineConfig = deepMergeConfig(baselineInlineConfig, agentModelOverrides);
  const runtimeFoundation = bootstrapRuntimeFoundation({ projectRoot, env });
  const runtimeEnv = createRuntimeFoundationEnvironment(runtimeFoundation);
  const launcherEnv = {
    ...env,
    ...runtimeEnv,
    OPENKIT_GLOBAL_MODE: '1',
    OPENKIT_PROJECT_ROOT: paths.projectRoot,
    OPENKIT_WORKFLOW_STATE: paths.workflowStatePath,
    OPENKIT_KIT_ROOT: paths.kitRoot,
    OPENKIT_HOME: paths.openCodeHome,
    OPENCODE_CONFIG_DIR: paths.kitRoot,
    OPENCODE_CONFIG_CONTENT: Object.keys(layeredInlineConfig).length > 0
      ? JSON.stringify(layeredInlineConfig)
      : undefined,
  };

  if (launcherEnv.OPENCODE_CONFIG_CONTENT === undefined) {
    delete launcherEnv.OPENCODE_CONFIG_CONTENT;
  }

  const result = spawn('opencode', [paths.projectRoot, ...args], {
    cwd: paths.projectRoot,
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
    throw result.error;
  }

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    paths,
    runtimeFoundation,
  };
}
