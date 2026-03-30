import fs from 'node:fs';
import path from 'node:path';

import { listBuiltinRuntimeCommands } from './builtin-commands.js';

export function loadRuntimeCommands({ projectRoot = process.cwd() } = {}) {
  return listBuiltinRuntimeCommands().filter((command) =>
    fs.existsSync(path.join(projectRoot, command.path))
  );
}
