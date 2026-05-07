import fs from 'node:fs';
import path from 'node:path';

import { listBuiltinRuntimeCommands } from './builtin-commands.js';

function loadProjectCommands(projectRoot) {
  const commandsDir = path.join(projectRoot, 'commands');
  if (!fs.existsSync(commandsDir)) {
    return [];
  }

  return fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      const name = `/${entry.name.replace(/\.md$/, '')}`;
      return {
        id: `runtime-command.${entry.name.replace(/\.md$/, '')}`,
        name,
        path: path.join('commands', entry.name),
        source: 'project',
        compatibility: listBuiltinRuntimeCommands().some((command) => command.path === path.join('commands', entry.name))
          ? 'builtin-compatible'
          : 'project-local',
      };
    });
}

export function loadRuntimeCommands({ projectRoot = process.cwd() } = {}) {
  const builtin = listBuiltinRuntimeCommands()
    .filter((command) => fs.existsSync(path.join(projectRoot, command.path)))
    .map((command) => ({
      ...command,
      source: 'builtin',
      compatibility: 'builtin-compatible',
    }));
  const projectCommands = loadProjectCommands(projectRoot);
  const merged = new Map();

  for (const command of [...builtin, ...projectCommands]) {
    if (!merged.has(command.path)) {
      merged.set(command.path, command);
    }
  }

  return [...merged.values()];
}
