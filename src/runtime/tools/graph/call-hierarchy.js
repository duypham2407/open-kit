// ---------------------------------------------------------------------------
// tool.graph-call-hierarchy
//
// Navigate the call hierarchy of a symbol: who calls it (incoming) and
// what it calls (outgoing).
// Input: { symbol: 'name', direction?: 'incoming' | 'outgoing' }
// Output: { calls: [...] }
// ---------------------------------------------------------------------------

export function createCallHierarchyTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-call-hierarchy',
    name: 'Graph Call Hierarchy',
    description:
      'Navigate the call hierarchy of a symbol. ' +
      'Pass { symbol, direction: "outgoing" } to see what it calls, ' +
      'or { symbol, direction: "incoming" } to see who calls it.',
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

      const symbolName = typeof input === 'string' ? input : input.symbol;
      const direction = input.direction ?? 'outgoing';

      if (!symbolName) {
        return { status: 'error', reason: 'symbol name is required. Pass { symbol: "name" }.' };
      }

      if (direction !== 'incoming' && direction !== 'outgoing') {
        return { status: 'error', reason: 'direction must be "incoming" or "outgoing".' };
      }

      return projectGraphManager.getCallHierarchy(symbolName, { direction });
    },
  };
}
