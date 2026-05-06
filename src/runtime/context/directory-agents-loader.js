import fs from 'node:fs';
import path from 'node:path';

export function loadDirectoryAgents(projectRoot) {
  const projectAgentsPath = path.join(projectRoot, 'src/kit/AGENTS.md');
  if (fs.existsSync(projectAgentsPath)) {
    return projectAgentsPath;
  }

  const openKitShimAgentsPath = path.join(projectRoot, '.opencode', 'openkit', 'src/kit/AGENTS.md');
  return fs.existsSync(openKitShimAgentsPath) ? openKitShimAgentsPath : null;
}
