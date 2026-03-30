import fs from 'node:fs';

export function createLookAtTool() {
  return {
    id: 'tool.look-at',
    execute(filePath) {
      return {
        filePath,
        exists: fs.existsSync(filePath),
      };
    },
  };
}
