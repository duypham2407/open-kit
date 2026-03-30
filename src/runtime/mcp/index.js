import { listBuiltinMcps } from './builtin-mcps.js';
import { loadMcpConfig } from './mcp-config-loader.js';
import { createMcpOAuthSummary } from './mcp-oauth.js';

export function createMcpPlatform({ projectRoot = process.cwd(), env = process.env, config = {} } = {}) {
  const builtin = listBuiltinMcps();
  const loaded = loadMcpConfig({ projectRoot, env });

  return {
    builtin,
    loaded,
    oauth: createMcpOAuthSummary(),
    enabledBuiltinIds: Object.entries(config?.mcps?.builtin ?? {})
      .filter(([, enabled]) => enabled !== false)
      .map(([id]) => id),
  };
}
