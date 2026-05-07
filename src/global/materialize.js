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

const GLOBAL_KIT_ASSETS = [
  '.opencode',
  'bin',
  'agents',
  'assets',
  'bin',
  'skills',
  'commands',
  'context',
  'hooks',
  'docs',
  'registry.json',
  'AGENTS.md',
  'README.md',
  'src/cli',
  'src/capabilities',
  'src/runtime',
  'src/mcp-server',
  'src/global',
  'src/install',
  'src/opencode',
  'src/permissions',
  'src/mcp-server',
  'src/command-detection.js',
  'src/version.js',
  'package.json',
];

function removePathIfPresent(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
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
  const mcpCommand = [process.execPath, path.join(PACKAGE_ROOT, 'bin', 'openkit-mcp.js')];
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

  removePathIfPresent(paths.kitRoot);
  removePathIfPresent(paths.profilesRoot);

  fs.mkdirSync(paths.kitRoot, { recursive: true });
  fs.mkdirSync(paths.profilesRoot, { recursive: true });

  for (const relativeAsset of GLOBAL_KIT_ASSETS) {
    copyAsset(path.join(PACKAGE_ROOT, relativeAsset), path.join(paths.kitRoot, relativeAsset));
  }

  const runtimeDependencies = provisionManagedNodeModules(paths.kitRoot);

  const installState = createGlobalInstallState({ kitVersion, profile: 'openkit' });
  const openCodeConfig = createOpenCodeConfig(paths.kitRoot);

  writeJson(paths.kitConfigPath, openCodeConfig);
  writeJson(paths.installStatePath, installState);
  writeJson(paths.profileManifestPath, openCodeConfig);
  copyAsset(
    path.join(PACKAGE_ROOT, 'assets', 'openkit.runtime.jsonc.template'),
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
              command: `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(paths.kitRoot, 'hooks', 'session-start.js'))}`,
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

  return {
    ...paths,
    installState,
    runtimeDependencies,
    tooling,
    semgrepTooling,
  };
}
