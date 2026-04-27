import { listMcpStatuses, listCustomMcpStatuses } from './health-checks.js';

export function listMcpInventory({ scope = 'openkit', includeBundled = true, includeCustom = true, env = process.env } = {}) {
  return [
    ...(includeBundled ? listMcpStatuses({ scope, env }) : []),
    ...(includeCustom ? listCustomMcpStatuses({ scope, env }) : []),
  ];
}
