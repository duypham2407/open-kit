import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function normalizeWorkspaceSeed(projectRoot, platform = process.platform) {
  const resolved = path.resolve(projectRoot);
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function canReadWrite(dirPath) {
  try {
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getFailureReason(checks) {
  if (!checks.exists) return 'path_does_not_exist';
  if (!checks.isDirectory) return 'not_a_directory';
  if (!checks.isAccessible) return 'permission_denied';
  if (!checks.hasPackageJson) return 'no_package_json';
  return null;
}

export function validateProjectRoot(candidatePath) {
  const checks = {
    exists: false,
    isDirectory: false,
    hasPackageJson: false,
    isAccessible: false,
  };

  // Check exists
  if (!fs.existsSync(candidatePath)) {
    return {
      valid: false,
      checks,
      reason: getFailureReason(checks),
    };
  }
  checks.exists = true;

  // Check is directory
  try {
    const stats = fs.statSync(candidatePath);
    checks.isDirectory = stats.isDirectory();
  } catch {
    return {
      valid: false,
      checks,
      reason: getFailureReason(checks),
    };
  }

  if (!checks.isDirectory) {
    return {
      valid: false,
      checks,
      reason: getFailureReason(checks),
    };
  }

  // Check accessible (must come before package.json check, since
  // an unreadable directory makes package.json detection unreliable)
  checks.isAccessible = canReadWrite(candidatePath);

  // Check has package.json (only meaningful if directory is accessible)
  checks.hasPackageJson = checks.isAccessible
    ? fs.existsSync(path.join(candidatePath, 'package.json'))
    : false;

  const valid =
    checks.exists && checks.isDirectory && checks.hasPackageJson && checks.isAccessible;

  return {
    valid,
    checks,
    reason: getFailureReason(checks),
  };
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
    mcpConfigPath: path.join(settingsRoot, 'mcp-config.json'),
    customMcpConfigPath: path.join(settingsRoot, 'custom-mcp-config.json'),
    mcpProfileStatePath: path.join(settingsRoot, 'mcp-profile-state.json'),
    secretsEnvPath: path.join(settingsRoot, 'secrets.env'),
    agentModelSettingsPath: path.join(settingsRoot, 'agent-models.json'),
    agentModelProfilesPath: path.join(settingsRoot, 'agent-model-profiles.json'),
    toolingRoot: path.join(settingsRoot, 'tooling'),
    toolingBinRoot: path.join(settingsRoot, 'tooling', 'node_modules', '.bin'),
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
