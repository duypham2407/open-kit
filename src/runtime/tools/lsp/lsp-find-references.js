import { collectSymbolReferences } from './heuristic-lsp.js';

export function createLspFindReferencesTool({ projectRoot = process.cwd(), projectGraphManager = null } = {}) {
  const graphAvailable = projectGraphManager?.available === true;
  return {
    id: 'tool.lsp-find-references',
    name: 'LSP Find References Tool',
    description: 'Finds symbol references across the project. Uses the project graph database ' +
      'when available, falls back to heuristic regex.',
    family: 'lsp',
    stage: 'foundation',
    status: graphAvailable ? 'active' : 'degraded',
    execute({ symbol } = {}) {
      if (!symbol) {
        return { status: 'error', reason: 'symbol is required.' };
      }

      // Graph-backed path
      if (graphAvailable) {
        const result = projectGraphManager.findReferences(symbol);
        if (result.status === 'ok' && (result.definitions.length > 0 || result.totalCount > 0)) {
          return {
            status: 'graph-backed',
            provider: 'project-graph',
            symbol,
            definitions: result.definitions,
            references: result.references,
            totalCount: result.totalCount,
          };
        }
      }

      // Heuristic fallback
      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        symbol,
        references: collectSymbolReferences(projectRoot, symbol),
      };
    },
  };
}
