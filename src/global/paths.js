import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logDiagnostic } from '../runtime/lib/diagnostics.js';

const PROJECT_MARKER_FILES = [
  'package.json',
  'next.config.js',
  'tsconfig.json',
  '.git',
  'pnpm-workspace.yaml',
  'turbo.json',
];

const MAX_WALK_UP_LEVELS = 10;

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

/**
 * Strategy 1: Detect project root at the starting directory itself.
 * Considered a high-confidence hit if a package.json exists at startDir.
 *
 * @param {string} startDir - Directory to inspect
 * @returns {{valid: boolean, path: string, confidence: string, strategy: string}}
 */
export function detectFromCwd(startDir) {
  const resolved = path.resolve(startDir);
  const hasPackageJson = fs.existsSync(path.join(resolved, 'package.json'));

  return {
    valid: hasPackageJson,
    path: resolved,
    confidence: hasPackageJson ? 'high' : 'fallback',
    strategy: 'cwd',
  };
}

/**
 * Strategy 2: Walk up the directory tree (max 10 levels) looking for package.json.
 *
 * @param {string} startDir - Directory to start walking from
 * @returns {{valid: boolean, path: string, confidence: string, strategy: string}}
 */
export function detectByWalkingUp(startDir) {
  let current = path.resolve(startDir);
  let levels = 0;

  while (levels < MAX_WALK_UP_LEVELS) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return {
        valid: true,
        path: current,
        confidence: 'high',
        strategy: 'walk_up',
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
    levels += 1;
  }

  return {
    valid: false,
    path: path.resolve(startDir),
    confidence: 'fallback',
    strategy: 'walk_up',
  };
}

/**
 * Strategy 3: Walk up the directory tree (max 10 levels) looking for any
 * recognised project marker (next.config.js, tsconfig.json, .git,
 * pnpm-workspace.yaml, turbo.json) when package.json is missing.
 *
 * @param {string} startDir - Directory to start from
 * @returns {{valid: boolean, path: string, confidence: string, strategy: string}}
 */
export function detectByProjectMarkers(startDir) {
  let current = path.resolve(startDir);
  let levels = 0;

  while (levels < MAX_WALK_UP_LEVELS) {
    for (const marker of PROJECT_MARKER_FILES) {
      if (fs.existsSync(path.join(current, marker))) {
        return {
          valid: true,
          path: current,
          confidence: 'high',
          strategy: 'project_markers',
        };
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
    levels += 1;
  }

  return {
    valid: false,
    path: path.resolve(startDir),
    confidence: 'fallback',
    strategy: 'project_markers',
  };
}

function runDetectionStrategies(startDir) {
  const resolvedStart = path.resolve(startDir);
  const strategies = [detectFromCwd, detectByWalkingUp, detectByProjectMarkers];

  for (const strategy of strategies) {
    const result = strategy(resolvedStart);
    if (result.valid) {
      return result;
    }
  }

  return {
    valid: false,
    path: resolvedStart,
    confidence: 'fallback',
    strategy: 'fallback',
  };
}

/**
 * Detect a project root by trying multiple strategies in order:
 * 1. cwd (package.json directly at startDir)
 * 2. walk_up (find package.json by walking parents, max 10 levels)
 * 3. project_markers (find any known marker file by walking parents)
 *
 * Falls back to startDir when no strategy succeeds. Each step is logged via
 * {@link logDiagnostic} under the `project_detection` category — successful
 * detections at `info` level, fallbacks at `warning` level.
 *
 * Note: diagnostic logging materializes `<projectRoot>/.opencode/diagnostics.json`,
 * so callers that must not write to the project tree (e.g. read-only runtime
 * bootstrap) should use the silent {@link detectProjectRoot} variant instead.
 *
 * @param {string} [startDir=process.cwd()] - Directory to start detection from
 * @returns {{valid: boolean, path: string, confidence: string, strategy: string}}
 */
export function detectProjectRootWithDiagnostics(startDir = process.cwd()) {
  const result = runDetectionStrategies(startDir);
  const resolvedStart = path.resolve(startDir);

  if (result.valid) {
    logDiagnostic(
      'project_detection',
      'info',
      `Project root detected via ${result.strategy}`,
      { path: result.path, strategy: result.strategy, startDir: resolvedStart },
      result.path
    );
  } else {
    logDiagnostic(
      'project_detection',
      'warning',
      'No project root detected; falling back to startDir',
      { path: result.path, startDir: resolvedStart },
      result.path
    );
  }

  return result;
}

/**
 * Backwards-compatible silent variant. Runs the same multi-strategy detection
 * as {@link detectProjectRootWithDiagnostics} but does not write diagnostic
 * events — safe for read-only contexts.
 *
 * @param {string} [startDir=process.cwd()] - Directory to start detection from
 * @returns {string} Resolved project root (or startDir on fallback)
 */
export function detectProjectRoot(startDir = process.cwd()) {
  return runDetectionStrategies(startDir).path;
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
