import path from 'node:path';

function resolveRootFromWorkflowStatePath(statePath) {
  const resolved = path.resolve(statePath);
  const sessionDir = path.dirname(resolved);
  const sessionsDir = path.dirname(sessionDir);
  const opencodeDir = path.dirname(sessionsDir);

  if (path.basename(resolved) === 'workflow-state.json' &&
      path.basename(sessionsDir) === 'sessions' &&
      path.basename(opencodeDir) === '.opencode') {
    return path.dirname(opencodeDir);
  }

  return path.dirname(path.dirname(resolved));
}

export function resolveRuntimeRoot({ projectRoot = process.cwd(), env = process.env } = {}) {
  if (env.OPENKIT_WORKFLOW_STATE) {
    return resolveRootFromWorkflowStatePath(env.OPENKIT_WORKFLOW_STATE);
  }

  return path.resolve(projectRoot);
}
