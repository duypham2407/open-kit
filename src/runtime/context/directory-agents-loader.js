import fs from 'node:fs';
import path from 'node:path';

export function loadDirectoryAgents(projectRoot) {
  const filePath = path.join(projectRoot, 'AGENTS.md');
  return fs.existsSync(filePath) ? filePath : null;
}
