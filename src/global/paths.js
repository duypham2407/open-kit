import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function normalizeWorkspaceSeed(projectRoot, platform = process.platform) {
  const resolved = path.resolve(projectRoot);
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function getOpenCodeHome({ env = process.env, platform = process.platform, homedir = os.homedir() } = {}) {
  if (env.OPENCODE_HOME) {
    return path.resolve(env.OPENCODE_HOME);
  }

  if (platform === 'win32') {
    const base = env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
    return path.join(base, 'opencode');
  }

  const base = env.XDG_CONFIG_HOME ? path.resolve(env.XDG_CONFIG_HOME) : path.join(homedir, '.config');
  return path.join(base, 'opencode');
}

export function detectProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, '.git')) || fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

export function createWorkspaceId(projectRoot, { platform = process.platform } = {}) {
  const seed = normalizeWorkspaceSeed(projectRoot, platform);
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export function getGlobalPaths(options = {}) {
  const openCodeHome = getOpenCodeHome(options);
  const kitRoot = path.join(openCodeHome, 'kits', 'openkit');
  const profilesRoot = path.join(openCodeHome, 'profiles', 'openkit');
  const workspacesRoot = path.join(openCodeHome, 'workspaces');
  const settingsRoot = path.join(openCodeHome, 'openkit');

  return {
    openCodeHome,
    kitRoot,
    kitConfigPath: path.join(kitRoot, 'opencode.json'),
    installStatePath: path.join(kitRoot, 'install-state.json'),
    managedFilesPath: path.join(kitRoot, 'managed-files.json'),
    profilesRoot,
    profileManifestPath: path.join(profilesRoot, 'opencode.json'),
    profileHooksPath: path.join(profilesRoot, 'hooks.json'),
    workspacesRoot,
    settingsRoot,
    agentModelSettingsPath: path.join(settingsRoot, 'agent-models.json'),
  };
}

export function getWorkspacePaths({ projectRoot, env = process.env, platform = process.platform, homedir = os.homedir() } = {}) {
  const resolvedProjectRoot = detectProjectRoot(projectRoot ?? process.cwd());
  const globalPaths = getGlobalPaths({ env, platform, homedir });
  const workspaceId = createWorkspaceId(resolvedProjectRoot, { platform });
  const workspaceRoot = path.join(globalPaths.workspacesRoot, workspaceId, 'openkit');
  const opencodeDir = path.join(workspaceRoot, '.opencode');

  return {
    ...globalPaths,
    projectRoot: resolvedProjectRoot,
    workspaceId,
    workspaceRoot,
    workspaceMetaPath: path.join(workspaceRoot, 'workspace.json'),
    opencodeDir,
    workflowStatePath: path.join(opencodeDir, 'workflow-state.json'),
    workItemsDir: path.join(opencodeDir, 'work-items'),
    workItemIndexPath: path.join(opencodeDir, 'work-items', 'index.json'),
    legacyRuntimeDir: path.join(resolvedProjectRoot, '.opencode'),
    legacyWorkflowStatePath: path.join(resolvedProjectRoot, '.opencode', 'workflow-state.json'),
    legacyWorkItemsDir: path.join(resolvedProjectRoot, '.opencode', 'work-items'),
    workspaceShimDir: path.join(resolvedProjectRoot, '.opencode', 'openkit'),
    workspaceShimContextDir: path.join(resolvedProjectRoot, '.opencode', 'openkit', 'context'),
    workspaceShimTemplatesDir: path.join(resolvedProjectRoot, '.opencode', 'openkit', 'docs', 'templates'),
    workspaceShimAgentsPath: path.join(resolvedProjectRoot, '.opencode', 'openkit', 'AGENTS.md'),
    workspaceShimWorkflowStatePath: path.join(resolvedProjectRoot, '.opencode', 'openkit', 'workflow-state.json'),
    workspaceShimWorkflowCliPath: path.join(resolvedProjectRoot, '.opencode', 'openkit', 'workflow-state.js'),
    workspaceShimWorkItemsDir: path.join(resolvedProjectRoot, '.opencode', 'openkit', 'work-items'),
  };
}
