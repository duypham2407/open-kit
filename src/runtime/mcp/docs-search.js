import { findExternalMcp, invokeExternalMcp } from './dispatch.js';

export function createDocsSearchMcp() {
  return {
    id: 'mcp.docs-search',
    name: 'docs-search',
    aliases: ['docsSearch'],
    transport: 'builtin',
    status: 'active',
    async execute(input = {}, { mcpPlatform } = {}) {
      const query = typeof input === 'string' ? input : input.query;
      if (!query || typeof query !== 'string') {
        return {
          status: 'invalid-input',
          mcp: 'docs-search',
          reason: 'query is required and must be a non-empty string.',
        };
      }

      const external = findExternalMcp(mcpPlatform?.loadedServers ?? [], {
        capability: 'docs-search',
      });
      if (!external) {
        return {
          status: 'no-provider',
          mcp: 'docs-search',
          hint: 'Configure a docs-search MCP server in .mcp.json or .opencode/mcp.json.',
        };
      }

      const delegated = await invokeExternalMcp(external, {
        query,
        ...(input && typeof input === 'object' && !Array.isArray(input) ? input : {}),
      });

      return {
        ...delegated,
        mcp: delegated.mcp ?? 'docs-search',
      };
    },
  };
}
