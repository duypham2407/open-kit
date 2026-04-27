import fs from 'node:fs';
import path from 'node:path';

import { expandMcpScope } from '../../capabilities/status.js';
import { getGlobalPaths } from '../paths.js';

const CUSTOM_MCP_SCHEMA = 'openkit/custom-mcp-config@1';
const CUSTOM_MCP_OWNERSHIP = 'openkit-managed-custom';
const PLACEHOLDER_PATTERN = /^\$\{[A-Z][A-Z0-9_]*\}$/u;
const RAW_SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/u,
  /\b(?:api[_-]?key|token|secret|password|bearer)\b\s*[:=]\s*[^\s}$]+/iu,
  /^Bearer\s+\S+/iu,
];

function timestamp() {
  return new Date().toISOString();
}

function createDefaultCustomConfig() {
  return {
    schema: CUSTOM_MCP_SCHEMA,
    version: 1,
    updatedAt: timestamp(),
    entries: {},
    imports: {},
  };
}

function normalizeEnabled(enabled = {}) {
  return {
    openkit: enabled.openkit === true,
    global: enabled.global === true,
  };
}

function mergeCustomConfig(config = {}) {
  return {
    ...createDefaultCustomConfig(),
    ...config,
    schema: CUSTOM_MCP_SCHEMA,
    version: 1,
    entries: Object.fromEntries(Object.entries(config.entries ?? {}).map(([id, entry]) => [id, normalizeCustomMcpEntry(entry)])),
    imports: { ...(config.imports ?? {}) },
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function containsRawSecret(value) {
  if (typeof value === 'string') {
    if (PLACEHOLDER_PATTERN.test(value)) {
      return false;
    }
    return RAW_SECRET_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsRawSecret(entry));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, entry]) => {
      if (/secret|token|password|api[_-]?key|authorization|cookie/i.test(key) && typeof entry === 'string' && !PLACEHOLDER_PATTERN.test(entry)) {
        return true;
      }
      return containsRawSecret(entry);
    });
  }
  return false;
}

export function normalizeCustomMcpEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Custom MCP entry must be an object.');
  }
  const id = String(entry.id ?? '').trim();
  if (!id) {
    throw new Error('Custom MCP entry requires a non-empty id.');
  }
  const now = timestamp();
  return {
    id,
    displayName: String(entry.displayName ?? id),
    origin: entry.origin ?? entry.definition?.type ?? 'local',
    ownership: CUSTOM_MCP_OWNERSHIP,
    enabled: normalizeEnabled(entry.enabled),
    definition: structuredClone(entry.definition ?? {}),
    secretBindings: structuredClone(entry.secretBindings ?? []),
    riskWarnings: [...new Set(entry.riskWarnings ?? [])],
    validationWarnings: [...new Set(entry.validationWarnings ?? [])],
    createdAt: entry.createdAt ?? now,
    updatedAt: entry.updatedAt ?? now,
  };
}

export function assertNoRawSecrets(value) {
  if (containsRawSecret(value)) {
    throw new Error('Custom MCP config cannot contain raw secret values; use placeholders such as ${CUSTOM_MCP_TOKEN}.');
  }
}

export function readCustomMcpConfig(options = {}) {
  const paths = getGlobalPaths(options);
  if (!fs.existsSync(paths.customMcpConfigPath)) {
    return createDefaultCustomConfig();
  }
  return mergeCustomConfig(JSON.parse(fs.readFileSync(paths.customMcpConfigPath, 'utf8')));
}

export function writeCustomMcpConfig(config, options = {}) {
  const paths = getGlobalPaths(options);
  const next = mergeCustomConfig({ ...config, updatedAt: timestamp() });
  assertNoRawSecrets(next);
  writeJson(paths.customMcpConfigPath, next);
  return readCustomMcpConfig(options);
}

export function getCustomMcpEntry(customId, options = {}) {
  return readCustomMcpConfig(options).entries[String(customId ?? '').trim()] ?? null;
}

export function listCustomMcpEntries(options = {}) {
  return Object.values(readCustomMcpConfig(options).entries).sort((left, right) => left.id.localeCompare(right.id));
}

export function addCustomMcpEntry(entry, options = {}) {
  const normalized = normalizeCustomMcpEntry(entry);
  assertNoRawSecrets(normalized);
  const config = readCustomMcpConfig(options);
  if (config.entries[normalized.id] && options.replace !== true) {
    throw new Error(`Custom MCP '${normalized.id}' already exists. Remove it first or use an explicit replace flow.`);
  }
  config.entries[normalized.id] = { ...normalized, updatedAt: timestamp() };
  if (options.importSource) {
    config.imports[normalized.id] = {
      source: options.importSource.source ?? 'global-opencode',
      sourceId: options.importSource.sourceId ?? normalized.id,
      importedAt: timestamp(),
    };
  }
  return writeCustomMcpConfig(config, options);
}

export function setCustomMcpEnabled(customId, enabled, options = {}) {
  const id = String(customId ?? '').trim();
  const scopes = expandMcpScope(options.scope ?? 'openkit');
  const config = readCustomMcpConfig(options);
  const entry = config.entries[id];
  if (!entry) {
    throw new Error(`Unknown custom MCP '${id}'.`);
  }
  for (const scope of scopes) {
    entry.enabled[scope] = Boolean(enabled);
  }
  entry.updatedAt = timestamp();
  return writeCustomMcpConfig(config, options);
}

export function removeCustomMcpEntry(customId, options = {}) {
  const id = String(customId ?? '').trim();
  const config = readCustomMcpConfig(options);
  if (!config.entries[id]) {
    return { status: 'already_absent', customId: id, config };
  }
  delete config.entries[id];
  delete config.imports[id];
  const nextConfig = writeCustomMcpConfig(config, options);
  return { status: 'removed', customId: id, config: nextConfig };
}

export { CUSTOM_MCP_OWNERSHIP, CUSTOM_MCP_SCHEMA };
