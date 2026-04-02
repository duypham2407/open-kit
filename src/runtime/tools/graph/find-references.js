// ---------------------------------------------------------------------------
// tool.graph-find-references
//
// Find all references to a symbol across the project using the graph DB.
// Input: { symbol: 'name' }
// Output: { definitions: [...], references: [...], totalCount }
// ---------------------------------------------------------------------------

export function createGraphFindReferencesTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-find-references',
    name: 'Graph Find References',
    description:
      'Find all references to a symbol across the project using the graph database. ' +
      'Returns both definitions and usage sites. Pass { symbol: "name" }.',
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

      if (!symbolName) {
        return { status: 'error', reason: 'symbol name is required. Pass { symbol: "name" }.' };
      }

      return projectGraphManager.findReferences(symbolName);
    },
  };
}
