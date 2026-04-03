export function createGraphCallHierarchyTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-call-hierarchy',
    name: 'Graph Call Hierarchy',
    description:
      'Show call hierarchy for a function. ' +
      'Pass { symbol, direction } where direction is "incoming" (who calls it) or "outgoing" (what it calls).',
    family: 'graph',
    stage: 'foundation',
    status: projectGraphManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!projectGraphManager?.available) {
        return {
          status: 'unavailable',
          reason: 'Project graph database is not available. Run openkit doctor for details.',
        };
      }

      const symbol = typeof input === 'string' ? input : input.symbol;
      if (!symbol) {
        return { status: 'error', reason: 'symbol is required.' };
      }

      const direction = input.direction ?? 'incoming';
      if (direction !== 'incoming' && direction !== 'outgoing') {
        return { status: 'error', reason: 'direction must be "incoming" or "outgoing".' };
      }

      return projectGraphManager.getCallHierarchy(symbol, { direction });
    },
  };
}
