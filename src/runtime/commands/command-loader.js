import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listBuiltinRuntimeCommands } from './builtin-commands.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KIT_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');

function resolveKitRoot(env = process.env) {
  if (env.OPENKIT_KIT_ROOT) {
    return path.resolve(env.OPENKIT_KIT_ROOT);
  }
  return DEFAULT_KIT_ROOT;
}

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
        runtimeBacked: false,
        compatibility: listBuiltinRuntimeCommands().some((command) => command.path === path.join('commands', entry.name))
          ? 'builtin-compatible'
          : 'project-local',
      };
    });
}

export function loadRuntimeCommands({ projectRoot = process.cwd(), env = process.env } = {}) {
  const kitRoot = resolveKitRoot(env);
  const builtin = listBuiltinRuntimeCommands()
    .filter((command) => fs.existsSync(path.join(kitRoot, 'src', 'kit', command.path)))
      .map((command) => ({
        ...command,
        source: 'builtin',
        runtimeBacked: typeof command.handler === 'string',
        compatibility: 'builtin-compatible',
        executionPriority: command.executionPriority ?? 'default',
        bypassLaneSelection: command.bypassLaneSelection === true,
      }));

  // Kit-level commands from the global install
  const kitCommandsDir = path.join(kitRoot, 'src', 'kit', 'commands');
  let kitCommands = [];
  if (fs.existsSync(kitCommandsDir)) {
    kitCommands = fs.readdirSync(kitCommandsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => {
        const name = `/${entry.name.replace(/\.md$/, '')}`;
        return {
          id: `runtime-command.${entry.name.replace(/\.md$/, '')}`,
          name,
          path: path.join('commands', entry.name),
          source: 'kit',
          runtimeBacked: false,
          compatibility: listBuiltinRuntimeCommands().some((command) => command.path === path.join('commands', entry.name))
            ? 'builtin-compatible'
            : 'kit-local',
        };
      });
  }

  const projectCommands = loadProjectCommands(projectRoot);
  const merged = new Map();

  // Builtins first (have handler metadata like runtimeBacked), then kit commands, then project overrides
  for (const command of [...builtin, ...kitCommands, ...projectCommands]) {
    if (!merged.has(command.path)) {
      merged.set(command.path, command);
    }
  }

  return [...merged.values()];
}
