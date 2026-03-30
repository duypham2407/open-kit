import fs from 'node:fs';
import path from 'node:path';

export function createLookAtTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.look-at',
    name: 'Look At Tool',
    description: 'Inspects one file or directory surface with lightweight metadata.',
    family: 'analysis',
    stage: 'foundation',
    status: 'active',
    execute(filePath) {
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
      const exists = fs.existsSync(resolvedPath);
      const stat = exists ? fs.statSync(resolvedPath) : null;
      return {
        filePath: resolvedPath,
        exists,
        kind: stat?.isDirectory() ? 'directory' : stat?.isFile() ? 'file' : 'missing',
        size: stat?.size ?? null,
      };
    },
  };
}
