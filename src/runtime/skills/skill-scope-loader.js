import os from 'node:os';
import path from 'node:path';

export function getSkillScopes({ projectRoot = process.cwd(), env = process.env } = {}) {
  const homeDir = env.HOME ?? os.homedir();
  return {
    project: path.join(projectRoot, 'skills'),
    projectOpencode: path.join(projectRoot, '.opencode', 'skills'),
    user: homeDir ? path.join(homeDir, '.config', 'opencode', 'skills') : null,
  };
}
