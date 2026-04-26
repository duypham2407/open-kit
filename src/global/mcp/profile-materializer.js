import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expandMcpScope } from '../../capabilities/status.js';
import { getGlobalPaths } from '../paths.js';
import { loadMcpCatalog } from './catalog-loader.js';
import { readMcpConfig } from './mcp-config-store.js';

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cloneProfileEntry(entry, enabled, paths) {
  if (!entry) {
    return null;
  }
  const cloned = structuredClone(entry);
  cloned.enabled = Boolean(enabled);
  if (Array.isArray(cloned.command)) {
    cloned.command = cloned.command.map((part) => String(part).replace('{OPENKIT_KIT_ROOT}', paths.kitRoot));
  }
  return cloned;
}

function createDefaultProfileConfig(existing = {}) {
  return {
    $schema: existing.$schema ?? 'https://opencode.ai/config.json',
    ...existing,
    mcp: { ...(existing.mcp ?? {}) },
  };
}

function readProfileState(paths) {
  const existing = readJsonIfPresent(paths.mcpProfileStatePath);
  return {
    schema: 'openkit/mcp-profile-state@1',
    version: 1,
    updatedAt: existing.updatedAt ?? new Date().toISOString(),
    profiles: {
      openkit: {
        configPath: paths.profileManifestPath,
        managedEntries: {},
        ...(existing.profiles?.openkit ?? {}),
      },
      global: {
        configPath: path.join(paths.openCodeHome, 'opencode.json'),
        managedEntries: {},
        conflicts: {},
        ...(existing.profiles?.global ?? {}),
      },
    },
  };
}

function writeProfileState(paths, state) {
  writeJson(paths.mcpProfileStatePath, { ...state, updatedAt: new Date().toISOString() });
}

function materializeScope(scope, { paths, config, catalog, profileState }) {
  const configPath = scope === 'openkit' ? paths.profileManifestPath : path.join(paths.openCodeHome, 'opencode.json');
  const currentConfig = createDefaultProfileConfig(readJsonIfPresent(configPath));
  const managedEntries = profileState.profiles[scope].managedEntries ?? {};
  const conflicts = {};
  let changed = false;

  for (const entry of catalog) {
    const scopeState = config.scopes?.[scope]?.[entry.id];
    if (!scopeState || scopeState.source !== 'user') {
      continue;
    }

    const profileEntry = cloneProfileEntry(entry.profileEntry, scopeState.enabled, paths);
    if (!profileEntry) {
      continue;
    }

    const existingEntry = currentConfig.mcp?.[entry.id];
    const existingManaged = managedEntries[entry.id];
    if (scope === 'global' && existingEntry && !existingManaged) {
      conflicts[entry.id] = {
        reason: 'existing-unmanaged-entry',
        detectedAt: new Date().toISOString(),
      };
      continue;
    }

    currentConfig.mcp[entry.id] = profileEntry;
    managedEntries[entry.id] = {
      entryHash: stableHash(profileEntry),
      lastMaterializedAt: new Date().toISOString(),
    };
    changed = true;
  }

  if (changed) {
    writeJson(configPath, currentConfig);
  } else if (!fs.existsSync(configPath) && scope === 'openkit') {
    writeJson(configPath, currentConfig);
  }

  profileState.profiles[scope] = {
    ...profileState.profiles[scope],
    configPath,
    managedEntries,
    ...(scope === 'global' ? { conflicts: { ...(profileState.profiles.global.conflicts ?? {}), ...conflicts } } : {}),
  };

  return {
    status: Object.keys(conflicts).length > 0 && !changed ? 'conflict' : 'materialized',
    configPath,
    managedCount: Object.keys(managedEntries).length,
    conflicts,
  };
}

export function materializeMcpProfiles({ scope = 'openkit', env = process.env } = {}) {
  const paths = getGlobalPaths({ env });
  const scopes = expandMcpScope(scope);
  const config = readMcpConfig({ env });
  const catalog = loadMcpCatalog();
  const profileState = readProfileState(paths);
  const results = {};

  for (const targetScope of scopes) {
    results[targetScope] = materializeScope(targetScope, { paths, config, catalog, profileState });
  }

  writeProfileState(paths, profileState);
  return { status: 'ok', scope, results, profileState };
}
