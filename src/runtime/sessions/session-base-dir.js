import path from 'node:path';

export function resolveSessionBaseDir({
  baseDir,
  env = process.env,
  repoRoot = null,
  projectRoot = null,
  cwd = process.cwd(),
} = {}) {
  if (baseDir) return path.resolve(baseDir);
  if (env?.OPENKIT_BASE_DIR) return path.resolve(env.OPENKIT_BASE_DIR);
  if (env?.OPENKIT_SESSION_BASE_DIR) return path.resolve(env.OPENKIT_SESSION_BASE_DIR);

  const root =
    env?.OPENKIT_REPOSITORY_ROOT ||
    env?.OPENKIT_PROJECT_ROOT ||
    repoRoot ||
    projectRoot ||
    cwd;

  return path.join(path.resolve(root), '.opencode');
}
