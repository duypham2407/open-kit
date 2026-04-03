import { collectProjectSymbols } from './heuristic-lsp.js';
import { toSymbolInfo } from '../../analysis/lsp-formatters.js';

export function createLspGotoDefinitionTool({ projectRoot = process.cwd(), projectGraphManager = null } = {}) {
  const graphAvailable = projectGraphManager?.available === true;
  return {
    id: 'tool.lsp-goto-definition',
    name: 'LSP Goto Definition Tool',
    description: 'Finds symbol definitions. Uses the project graph database when available, ' +
      'falls back to heuristic regex.',
    family: 'lsp',
    stage: 'foundation',
    status: graphAvailable ? 'active' : 'degraded',
    execute({ symbol, filePath = null } = {}) {
      // Graph-backed path
      if (graphAvailable && symbol) {
        const result = projectGraphManager.findSymbol(symbol);
        if (result.status === 'ok' && result.matches.length > 0) {
          // Prefer exported definitions
          const exported = result.matches.filter((m) => m.isExport);
          const defs = (exported.length > 0 ? exported : result.matches);
          return {
            status: 'graph-backed',
            provider: 'project-graph',
            symbol,
            definitions: defs.map((m) => toSymbolInfo({
              name: symbol,
              ...m,
              path: m.absolutePath,
              is_export: m.isExport ? 1 : 0,
            }, projectRoot)),
          };
        }
      }

      // Heuristic fallback
      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        symbol,
        definitions: collectProjectSymbols(projectRoot, { symbol, filePath }),
      };
    },
  };
}
