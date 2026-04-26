import { getMcpCatalogEntry, listMcpCatalogEntries } from '../../capabilities/mcp-catalog.js';

export function loadMcpCatalog() {
  return listMcpCatalogEntries();
}

export function requireMcpCatalogEntry(mcpId) {
  const entry = getMcpCatalogEntry(mcpId);
  if (!entry) {
    throw new Error(`Unknown MCP '${mcpId}'. Run openkit configure mcp list to see supported MCP ids.`);
  }
  return entry;
}
