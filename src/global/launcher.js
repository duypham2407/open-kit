import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { ensureWorkspaceBootstrap } from './workspace-state.js';

function formatMissingOpenCodeError() {
  return [
    'Could not find `opencode` on your PATH.',
    'Install OpenCode or add `opencode` to PATH, then retry `openkit run`.',
  ].join('\n');
}

export function launchGlobalOpenKit(args = [], { projectRoot = process.cwd(), env = process.env, spawn = spawnSync, stdio = 'inherit' } = {}) {
  const paths = ensureWorkspaceBootstrap({ projectRoot, env });
  const launcherEnv = {
    ...env,
    OPENKIT_GLOBAL_MODE: '1',
    OPENKIT_PROJECT_ROOT: paths.projectRoot,
    OPENKIT_WORKFLOW_STATE: paths.workflowStatePath,
    OPENKIT_KIT_ROOT: paths.kitRoot,
    OPENKIT_HOME: paths.openCodeHome,
    OPENCODE_CONFIG_DIR: paths.kitRoot,
  };

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
  };
}
