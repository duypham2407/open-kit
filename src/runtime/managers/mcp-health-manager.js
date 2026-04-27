import { listMcpCatalogEntries } from '../../capabilities/mcp-catalog.js';
import { buildCustomMcpStatus, buildMcpStatus, listMcpStatuses } from '../../global/mcp/health-checks.js';
import { getCustomMcpEntry } from '../../global/mcp/custom-mcp-store.js';
import { listMcpInventory } from '../../global/mcp/mcp-inventory.js';

export class McpHealthManager {
  constructor({ env = process.env } = {}) {
    this.env = env;
  }

  list({ scope = 'openkit' } = {}) {
    return listMcpInventory({ scope, env: this.env }).map((entry) => {
      const catalog = listMcpCatalogEntries().find((candidate) => candidate.id === entry.mcpId);
      return {
        kind: entry.kind ?? 'bundled',
        origin: entry.origin ?? 'bundled',
        ownership: entry.ownership ?? 'openkit-bundled',
        ...entry,
        policy: catalog?.policy ?? {},
      };
    });
  }

  get(mcpId, { scope = 'openkit' } = {}) {
    const catalog = listMcpCatalogEntries().find((entry) => entry.id === mcpId);
    if (!catalog) {
      const custom = getCustomMcpEntry(mcpId, { env: this.env });
      if (!custom) {
        return null;
      }
      return {
        ...buildCustomMcpStatus(custom, { scope, env: this.env }),
        policy: {},
      };
    }
    return {
      kind: 'bundled',
      origin: 'bundled',
      ownership: 'openkit-bundled',
      ...buildMcpStatus(catalog, { scope, env: this.env }),
      policy: catalog.policy ?? {},
    };
  }
}
