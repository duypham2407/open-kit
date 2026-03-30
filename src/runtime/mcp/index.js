import { listBuiltinMcps } from './builtin-mcps.js';
import { dispatchMcpCall } from './dispatch.js';
import { loadMcpConfig } from './mcp-config-loader.js';
import { createMcpOAuthSummary } from './mcp-oauth.js';

export function createMcpPlatform({ projectRoot = process.cwd(), env = process.env, config = {} } = {}) {
  const builtin = listBuiltinMcps();
  const loaded = loadMcpConfig({ projectRoot, env });
  const configuredBuiltinIds = Object.entries(config?.mcps?.builtin ?? {})
    .filter(([, enabled]) => enabled !== false)
    .map(([id]) => id);

  return {
    builtin,
    loaded,
    oauth: createMcpOAuthSummary(),
    enabledBuiltinIds: configuredBuiltinIds,
    loadedServers: Array.isArray(loaded?.config?.servers) ? loaded.config.servers : [],
    dispatch(mcpName, input) {
      return dispatchMcpCall({ builtin }, mcpName, input);
    },
  };
}
