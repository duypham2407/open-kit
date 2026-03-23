import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGlobalInstallState, writeJson } from './install-state.js';
import { getGlobalPaths } from './paths.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');

const GLOBAL_KIT_ASSETS = [
  '.opencode',
  'agents',
  'skills',
  'commands',
  'context',
  'hooks',
  'docs',
  'registry.json',
  'AGENTS.md',
  'README.md',
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

function createProfileManifest(kitRoot, profileHooksPath) {
  const kitManifestPath = path.join(kitRoot, '.opencode', 'opencode.json');
  const kitManifest = JSON.parse(fs.readFileSync(kitManifestPath, 'utf8'));

  return {
    model: kitManifest.model,
    agents_dir: path.join(kitRoot, 'agents'),
    skills_dir: path.join(kitRoot, 'skills'),
    commands_dir: path.join(kitRoot, 'commands'),
    hooks: {
      config: profileHooksPath,
    },
    openkit: {
      profile: 'openkit',
      kit_root: kitRoot,
      manifest: kitManifestPath,
    },
  };
}

export function materializeGlobalInstall({ env = process.env, kitVersion = '0.1.0' } = {}) {
  const paths = getGlobalPaths({ env });

  removePathIfPresent(paths.kitRoot);
  removePathIfPresent(paths.profilesRoot);

  fs.mkdirSync(paths.kitRoot, { recursive: true });
  fs.mkdirSync(paths.profilesRoot, { recursive: true });

  for (const relativeAsset of GLOBAL_KIT_ASSETS) {
    copyAsset(path.join(PACKAGE_ROOT, relativeAsset), path.join(paths.kitRoot, relativeAsset));
  }

  const installState = createGlobalInstallState({ kitVersion, profile: 'openkit' });
  writeJson(paths.installStatePath, installState);
  writeJson(paths.profileManifestPath, createProfileManifest(paths.kitRoot, paths.profileHooksPath));
  writeJson(paths.profileHooksPath, {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup|clear|compact',
          hooks: [
            {
              type: 'command',
              command: `${path.join(paths.kitRoot, 'hooks', 'session-start')}`,
              async: false,
            },
          ],
        },
      ],
    },
  });
  writeJson(paths.managedFilesPath, {
    schema: 'openkit/managed-files@1',
    generatedAt: new Date().toISOString(),
    files: listManagedFiles(paths.kitRoot),
  });

  return {
    ...paths,
    installState,
  };
}
