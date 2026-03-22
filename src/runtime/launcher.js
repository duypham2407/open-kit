import { spawnSync } from 'node:child_process';

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
  const result = spawn('opencode', args, {
    cwd: projectRoot,
    env: layering.env,
    encoding: 'utf8',
    stdio,
  });

  if (result.error?.code === 'ENOENT') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${formatMissingOpenCodeError()}\n`,
      layering,
    };
  }

  if (result.error) {
    throw result.error;
  }

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    layering,
  };
}
