export function createGraphGotoDefinitionTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-goto-definition',
    name: 'Graph Go-to-Definition',
    description:
      'Find where a symbol is defined using the project import graph. ' +
      'Pass { symbol } to find all definition sites, or { symbol, exportOnly: true } to only find exported definitions.',
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

      const result = projectGraphManager.findSymbol(symbol);
      if (result.status !== 'ok') return result;

      let definitions = result.matches;

      // If exportOnly requested, filter to exported symbols only
      if (input.exportOnly) {
        definitions = definitions.filter((d) => d.isExport);
      }

      return {
        status: 'ok',
        symbol,
        definitions: definitions.map((d) => ({
          path: d.path,
          absolutePath: d.absolutePath,
          line: d.line,
          kind: d.kind,
          isExport: d.isExport,
          signature: d.signature,
          scope: d.scope,
          startLine: d.startLine,
          endLine: d.endLine,
        })),
      };
    },
  };
}
