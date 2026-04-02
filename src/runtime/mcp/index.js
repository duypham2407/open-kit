import { listBuiltinMcps } from './builtin-mcps.js';
import { dispatchMcpCall } from './dispatch.js';
import { loadMcpConfig } from './mcp-config-loader.js';
import { createMcpOAuthSummary } from './mcp-oauth.js';
import { normalizeExternalServers } from './dispatch.js';

function normalizeBuiltinId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function createMcpPlatform({
  projectRoot = process.cwd(),
  env = process.env,
  config = {},
  sessionMemoryManager = null,
} = {}) {
  const builtin = listBuiltinMcps({ sessionMemoryManager });
  const loaded = loadMcpConfig({ projectRoot, env });
  const externalServers = normalizeExternalServers(loaded?.config?.servers);
  const builtinByName = new Map();
  for (const entry of builtin) {
    builtinByName.set(normalizeBuiltinId(entry.name), entry.id);
    builtinByName.set(normalizeBuiltinId(entry.id), entry.id);
    for (const alias of entry.aliases ?? []) {
      builtinByName.set(normalizeBuiltinId(alias), entry.id);
    }
  }

  const configuredBuiltinIds = Object.entries(config?.mcps?.builtin ?? {})
    .filter(([, enabled]) => enabled !== false)
    .map(([id]) => builtinByName.get(normalizeBuiltinId(id)) ?? id);

  return {
    builtin,
    loaded,
    oauth: createMcpOAuthSummary(),
    enabledBuiltinIds: configuredBuiltinIds,
    loadedServers: externalServers,
    dispatch(mcpName, input) {
      return dispatchMcpCall({
        builtin,
        loadedServers: externalServers,
        enabledBuiltinIds: configuredBuiltinIds,
      }, mcpName, input);
    },
  };
}
