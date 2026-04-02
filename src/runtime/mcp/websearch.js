import { findExternalMcp, invokeExternalMcp } from './dispatch.js';

export function createWebsearchMcp() {
  return {
    id: 'mcp.websearch',
    name: 'websearch',
    aliases: ['webSearch'],
    transport: 'builtin',
    status: 'active',
    async execute(input = {}, { mcpPlatform } = {}) {
      const query = typeof input === 'string' ? input : input.query;
      if (!query || typeof query !== 'string') {
        return {
          status: 'invalid-input',
          mcp: 'websearch',
          reason: 'query is required and must be a non-empty string.',
        };
      }

      const external = findExternalMcp(mcpPlatform?.loadedServers ?? [], {
        capability: 'websearch',
      });
      if (!external) {
        return {
          status: 'no-provider',
          mcp: 'websearch',
          hint: 'Configure a websearch MCP server in .mcp.json or .opencode/mcp.json.',
        };
      }

      const delegated = await invokeExternalMcp(external, {
        query,
        ...(input && typeof input === 'object' && !Array.isArray(input) ? input : {}),
      });

      return {
        ...delegated,
        mcp: delegated.mcp ?? 'websearch',
      };
    },
  };
}
