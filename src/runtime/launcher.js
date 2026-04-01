import { spawnSync } from 'node:child_process';

import { bootstrapRuntimeFoundation, createRuntimeFoundationEnvironment } from './index.js';
import { buildOpenCodeLayering } from './opencode-layering.js';

function formatMissingOpenCodeError() {
  return [
    'Could not find `opencode` on your PATH.',
    'The supported launcher path is `openkit run`, which applies managed config layering for this session.',
    'Install OpenCode or add `opencode` to PATH, then retry.',
  ].join('\n');
}

export function launchManagedOpenCode(
  args = [],
  {
    projectRoot = process.cwd(),
    env = process.env,
    spawn = spawnSync,
    stdio = 'inherit',
  } = {}
) {
  const layering = buildOpenCodeLayering({ projectRoot, env });
  const runtimeFoundation = bootstrapRuntimeFoundation({ projectRoot, env: layering.env });
  const runtimeEnv = createRuntimeFoundationEnvironment(runtimeFoundation);
  const result = spawn('opencode', args, {
    cwd: projectRoot,
    env: {
      ...layering.env,
      ...runtimeEnv,
    },
    encoding: 'utf8',
    stdio,
  });

  if (result.error?.code === 'ENOENT') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatMissingOpenCodeError()}\n`,
      layering,
      runtimeFoundation,
    };
  }

  if (result.error) {
    return {
      exitCode: 1,
      stdout: result.stdout ?? '',
      stderr: result.error.message ?? result.stderr ?? 'Failed to launch opencode.',
      layering,
      runtimeFoundation,
    };
  }

  runtimeFoundation.managers.sessionStateManager?.recordRuntimeSession({
    launcher: 'managed',
    workflowKernel: runtimeFoundation.managers.workflowKernel,
    backgroundManager: runtimeFoundation.managers.backgroundManager,
    continuationStateManager: runtimeFoundation.managers.continuationStateManager,
    args,
    exitCode: typeof result.status === 'number' ? result.status : 1,
  });

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    layering,
    runtimeFoundation,
  };
}
