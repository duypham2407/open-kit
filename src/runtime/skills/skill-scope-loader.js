import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KIT_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');

function resolveKitRoot(env = process.env) {
  if (env.OPENKIT_KIT_ROOT) {
    return path.resolve(env.OPENKIT_KIT_ROOT);
  }
  return DEFAULT_KIT_ROOT;
}

export function getSkillScopes({ projectRoot = process.cwd(), env = process.env } = {}) {
  const kitRoot = resolveKitRoot(env);
  const homeDir = env.HOME ?? os.homedir();
  return {
    kit: path.join(kitRoot, 'src', 'kit', 'skills'),
    project: path.join(projectRoot, 'skills'),
    projectOpencode: path.join(projectRoot, '.opencode', 'skills'),
    user: homeDir ? path.join(homeDir, '.config', 'opencode', 'skills') : null,
  };
}
