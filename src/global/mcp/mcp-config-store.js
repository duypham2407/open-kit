import fs from 'node:fs';
import path from 'node:path';

import { expandMcpScope } from '../../capabilities/status.js';
import { getGlobalPaths } from '../paths.js';
import { loadMcpCatalog, requireMcpCatalogEntry } from './catalog-loader.js';

function timestamp() {
  return new Date().toISOString();
}

function createDefaultConfig() {
  const now = timestamp();
  const scopes = { openkit: {}, global: {} };
  for (const entry of loadMcpCatalog()) {
    scopes.openkit[entry.id] = {
      enabled: entry.defaultEnabled?.openkit === true,
      source: 'default',
      updatedAt: now,
    };
    scopes.global[entry.id] = {
      enabled: entry.defaultEnabled?.global === true,
      source: 'default',
      updatedAt: now,
    };
  }
  return {
    schema: 'openkit/mcp-config@1',
    version: 1,
    catalogVersion: 1,
    updatedAt: now,
    scopes,
    secretBindings: {},
  };
}

function mergeCatalogDefaults(config) {
  const next = {
    ...createDefaultConfig(),
    ...config,
    scopes: {
      openkit: { ...createDefaultConfig().scopes.openkit, ...(config.scopes?.openkit ?? {}) },
      global: { ...createDefaultConfig().scopes.global, ...(config.scopes?.global ?? {}) },
    },
    secretBindings: { ...(config.secretBindings ?? {}) },
  };
  return next;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readMcpConfig(options = {}) {
  const paths = getGlobalPaths(options);
  if (!fs.existsSync(paths.mcpConfigPath)) {
    return createDefaultConfig();
  }
  return mergeCatalogDefaults(JSON.parse(fs.readFileSync(paths.mcpConfigPath, 'utf8')));
}

export function writeMcpConfig(config, options = {}) {
  const paths = getGlobalPaths(options);
  writeJson(paths.mcpConfigPath, { ...config, updatedAt: timestamp() });
  return readMcpConfig(options);
}

export function setMcpEnabled(mcpId, enabled, options = {}) {
  requireMcpCatalogEntry(mcpId);
  const scopes = expandMcpScope(options.scope ?? 'openkit');
  const config = readMcpConfig(options);
  const now = timestamp();

  for (const scope of scopes) {
    config.scopes[scope][mcpId] = {
      ...(config.scopes[scope][mcpId] ?? {}),
      enabled: Boolean(enabled),
      source: 'user',
      updatedAt: now,
    };
  }

  return writeMcpConfig(config, options);
}

export function recordSecretBinding(mcpId, envVars, options = {}) {
  requireMcpCatalogEntry(mcpId);
  const config = readMcpConfig(options);
  config.secretBindings[mcpId] = {
    envVars: [...new Set(envVars)],
    updatedAt: timestamp(),
  };
  return writeMcpConfig(config, options);
}

export function getScopeMcpState(config, scope, mcpId) {
  return config?.scopes?.[scope]?.[mcpId] ?? null;
}
