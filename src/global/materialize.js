import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGlobalInstallState, writeJson } from './install-state.js';
import { createEmptyAgentModelSettings, readAgentModelSettings, writeAgentModelSettings } from './agent-models.js';
import { getGlobalPaths } from './paths.js';
import { materializeMcpProfiles } from './mcp/profile-materializer.js';
import { ensureAstGrepInstalled, ensureSemgrepInstalled } from './tooling.js';
import {
  createPermissionedOpenCodeConfigProjection,
  loadDefaultCommandPermissionPolicy,
} from '../permissions/command-permission-policy.js';
import { sanitizeOpenCodeConfig } from '../opencode/config-schema.js';
import { getOpenKitVersion } from '../version.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');

// Audit fix [2-M-2]: this list previously contained 'bin' and
// 'src/mcp-server' twice each. fs.cpSync tolerated the duplicates by
// re-overwriting, but it was wasted work and a copy/paste bug.
//
// Post-reorganization (2026-05): top-level kit content has moved under
// src/ — the install bundle now ships from `src/...` paths instead of
// repo-root paths.
const GLOBAL_KIT_ASSETS = [
  { source: 'src/openkit-runtime', target: 'src/openkit-runtime' },
  { source: 'src/bin',             target: 'src/bin' },
  { source: 'src/agents',          target: 'src/agents' },
  { source: 'src/assets',          target: 'src/assets' },
  { source: 'src/skills',          target: 'src/skills' },
  { source: 'src/commands',        target: 'src/commands' },
  { source: 'src/context',         target: 'src/context' },
  { source: 'src/hooks',           target: 'src/hooks' },
  { source: 'docs',                target: 'docs' },
  { source: 'registry.json',       target: 'registry.json' },
  { source: 'AGENTS.md',           target: 'AGENTS.md' },
  { source: 'README.md',           target: 'README.md' },
  { source: 'src/cli',             target: 'src/cli' },
  { source: 'src/capabilities',    target: 'src/capabilities' },
  { source: 'src/runtime',         target: 'src/runtime' },
  { source: 'src/mcp-server',      target: 'src/mcp-server' },
  { source: 'src/global',          target: 'src/global' },
  { source: 'src/install',         target: 'src/install' },
  { source: 'src/opencode',        target: 'src/opencode' },
  { source: 'src/permissions',     target: 'src/permissions' },
  { source: 'src/command-detection.js', target: 'src/command-detection.js' },
  { source: 'src/version.js',      target: 'src/version.js' },
  { source: 'package.json',        target: 'package.json' },
];

function removePathIfPresent(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function generatePrevSuffix() {
  return `.prev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function backupIfPresent(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  const backupPath = `${targetPath}${generatePrevSuffix()}`;
  fs.renameSync(targetPath, backupPath);
  return backupPath;
}

function commitBackup(backupPath) {
  if (backupPath && fs.existsSync(backupPath)) {
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
}

function rollbackBackup(targetPath, backupPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
  if (backupPath && fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, targetPath);
  }
}

function copyAsset(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function provisionManagedNodeModules(kitRoot) {
  const sourceNodeModules = path.join(PACKAGE_ROOT, 'node_modules');
  const targetNodeModules = path.join(kitRoot, 'node_modules');

  if (!fs.existsSync(sourceNodeModules)) {
    return {
      provisioned: false,
      source: sourceNodeModules,
      target: targetNodeModules,
      reason: 'Bundled node_modules directory is missing from the installed openkit package.',
    };
  }

  removePathIfPresent(targetNodeModules);

  try {
    fs.symlinkSync(sourceNodeModules, targetNodeModules, process.platform === 'win32' ? 'junction' : 'dir');
    return {
      provisioned: true,
      mode: 'symlink',
      source: sourceNodeModules,
      target: targetNodeModules,
    };
  } catch (symlinkError) {
    try {
      fs.cpSync(sourceNodeModules, targetNodeModules, { recursive: true });
      return {
        provisioned: true,
        mode: 'copy',
        source: sourceNodeModules,
        target: targetNodeModules,
      };
    } catch (copyError) {
      return {
        provisioned: false,
        source: sourceNodeModules,
        target: targetNodeModules,
        reason: copyError.message ?? symlinkError.message ?? 'Failed to provision node_modules for the managed kit.',
      };
    }
  }
}

function listManagedFiles(kitRoot) {
  const files = [];

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else {
        files.push(path.relative(kitRoot, entryPath));
      }
    }
  }

  walk(kitRoot);
  return files.sort();
}

function createOpenCodeConfig(kitRoot) {
  const mcpCommand = [process.execPath, path.join(PACKAGE_ROOT, 'src', 'bin', 'openkit-mcp.js')];
  const permissionPolicy = loadDefaultCommandPermissionPolicy();
  const permissionedConfig = createPermissionedOpenCodeConfigProjection(permissionPolicy);
  return sanitizeOpenCodeConfig({
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'master-orchestrator',
    mcp: {
      openkit: {
        type: 'local',
        command: mcpCommand,
        enabled: true,
        environment: {
          OPENKIT_PROJECT_ROOT: '{cwd}',
        },
      },
      'chrome-devtools': {
        type: 'local',
        command: ['npx', '-y', 'chrome-devtools-mcp@0.21.0'],
        enabled: true,
      },
    },
    ...permissionedConfig,
  }).config;
}

export function materializeGlobalInstall({
  env = process.env,
  kitVersion = getOpenKitVersion(),
  ensureAstGrep = ensureAstGrepInstalled,
  ensureSemgrep = ensureSemgrepInstalled,
} = {}) {
  const paths = getGlobalPaths({ env });
  const existingAgentModelSettings = fs.existsSync(paths.agentModelSettingsPath)
    ? readAgentModelSettings(paths.agentModelSettingsPath)
    : createEmptyAgentModelSettings();

  // Audit fix [2-H-1]: make upgrade atomic via backup + rollback. Previously
  // the kit-root and profiles-root were deleted unconditionally before the
  // copy loop; a mid-flight crash (permission, disk full, ENOENT on a copy
  // source) left an empty kit-root and OpenKit completely inoperable. We
  // now rename the existing roots aside, do the build, and either commit
  // (delete the backups) on success or roll back on any error.
  const kitRootBackup = backupIfPresent(paths.kitRoot);
  const profilesRootBackup = backupIfPresent(paths.profilesRoot);

  fs.mkdirSync(paths.kitRoot, { recursive: true });
  fs.mkdirSync(paths.profilesRoot, { recursive: true });

  try {

  for (const { source, target } of GLOBAL_KIT_ASSETS) {
    copyAsset(path.join(PACKAGE_ROOT, source), path.join(paths.kitRoot, target));
  }

  const runtimeDependencies = provisionManagedNodeModules(paths.kitRoot);

  const installState = createGlobalInstallState({ kitVersion, profile: 'openkit' });
  const openCodeConfig = createOpenCodeConfig(paths.kitRoot);

  writeJson(paths.kitConfigPath, openCodeConfig);
  writeJson(paths.installStatePath, installState);
  writeJson(paths.profileManifestPath, openCodeConfig);
  copyAsset(
    path.join(PACKAGE_ROOT, 'src', 'assets', 'openkit.runtime.jsonc.template'),
    path.join(paths.settingsRoot, 'openkit.runtime.jsonc.template')
  );
  writeAgentModelSettings(paths.agentModelSettingsPath, existingAgentModelSettings);
  writeJson(paths.profileHooksPath, {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup|clear|compact',
          hooks: [
            {
              type: 'command',
              command: `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(paths.kitRoot, 'src', 'hooks', 'session-start.js'))}`,
              async: false,
            },
          ],
        },
      ],
    },
  });
  materializeMcpProfiles({ scope: 'openkit', env });
  writeJson(paths.managedFilesPath, {
    schema: 'openkit/managed-files@1',
    generatedAt: new Date().toISOString(),
    files: listManagedFiles(paths.kitRoot),
  });

  const tooling = ensureAstGrep({ env });
  const semgrepTooling = ensureSemgrep({ env });

    // Materialize succeeded — discard backups.
    commitBackup(kitRootBackup);
    commitBackup(profilesRootBackup);

    return {
      ...paths,
      installState,
      runtimeDependencies,
      tooling,
      semgrepTooling,
    };
  } catch (err) {
    // Materialize failed mid-flight — restore previous install from backups.
    rollbackBackup(paths.kitRoot, kitRootBackup);
    rollbackBackup(paths.profilesRoot, profilesRootBackup);
    throw err;
  }
}
