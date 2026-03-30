import fs from 'node:fs';
import path from 'node:path';

export function loadProjectReadme(projectRoot) {
  const filePath = path.join(projectRoot, 'README.md');
  return fs.existsSync(filePath) ? filePath : null;
}
