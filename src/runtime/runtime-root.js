import path from 'node:path';

export function resolveRuntimeRoot({ projectRoot = process.cwd(), env = process.env } = {}) {
  if (env.OPENKIT_WORKFLOW_STATE) {
    return path.dirname(path.dirname(path.resolve(env.OPENKIT_WORKFLOW_STATE)));
  }

  return path.resolve(projectRoot);
}
