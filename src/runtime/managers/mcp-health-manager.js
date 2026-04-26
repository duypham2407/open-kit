import { listMcpCatalogEntries } from '../../capabilities/mcp-catalog.js';
import { buildMcpStatus, listMcpStatuses } from '../../global/mcp/health-checks.js';

export class McpHealthManager {
  constructor({ env = process.env } = {}) {
    this.env = env;
  }

  list({ scope = 'openkit' } = {}) {
    return listMcpStatuses({ scope, env: this.env }).map((entry) => {
      const catalog = listMcpCatalogEntries().find((candidate) => candidate.id === entry.mcpId);
      return {
        ...entry,
        policy: catalog?.policy ?? {},
      };
    });
  }

  get(mcpId, { scope = 'openkit' } = {}) {
    const catalog = listMcpCatalogEntries().find((entry) => entry.id === mcpId);
    if (!catalog) {
      return null;
    }
    return {
      ...buildMcpStatus(catalog, { scope, env: this.env }),
      policy: catalog.policy ?? {},
    };
  }
}
