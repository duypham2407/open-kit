import fs from 'node:fs';
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

export function loadDirectoryAgents(projectRoot, env = process.env) {
  // 1. Project root AGENTS.md (user-authored, at root level)
  const projectAgentsPath = path.join(projectRoot, 'AGENTS.md');
  if (fs.existsSync(projectAgentsPath)) {
    return projectAgentsPath;
  }

  // 2. Workspace shim AGENTS.md
  const openKitShimAgentsPath = path.join(projectRoot, '.opencode', 'openkit', 'src', 'kit', 'AGENTS.md');
  if (fs.existsSync(openKitShimAgentsPath)) {
    return openKitShimAgentsPath;
  }

  // 3. Kit root AGENTS.md (from global install)
  const kitRoot = resolveKitRoot(env);
  const kitAgentsPath = path.join(kitRoot, 'src', 'kit', 'AGENTS.md');
  return fs.existsSync(kitAgentsPath) ? kitAgentsPath : null;
}
