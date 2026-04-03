import { collectProjectSymbols } from './heuristic-lsp.js';
import { toSymbolInfo } from '../../analysis/lsp-formatters.js';

export function createLspSymbolsTool({ projectRoot = process.cwd(), projectGraphManager = null } = {}) {
  const graphAvailable = projectGraphManager?.available === true;
  return {
    id: 'tool.lsp-symbols',
    name: 'LSP Symbols Tool',
    description: 'Project symbol index for JavaScript and TypeScript sources. ' +
      'Uses the project graph database when available, falls back to heuristic regex.',
    family: 'lsp',
    stage: 'foundation',
    status: graphAvailable ? 'active' : 'degraded',
    execute(input = {}) {
      // Graph-backed path: query the DB for symbols by name or all
      if (graphAvailable) {
        const symbolName = input?.symbol ?? null;
        if (symbolName) {
          const result = projectGraphManager.findSymbol(symbolName);
          if (result.status === 'ok' && result.matches.length > 0) {
            return {
              status: 'graph-backed',
              provider: 'project-graph',
              symbols: result.matches.map((m) => toSymbolInfo({
                name: m.path ? symbolName : symbolName,
                ...m,
                path: m.absolutePath,
                is_export: m.isExport ? 1 : 0,
              }, projectRoot)),
            };
          }
        }
        // For full project symbols or when graph query fails, fall through to heuristic
      }

      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        symbols: collectProjectSymbols(projectRoot, input ?? {}),
      };
    },
  };
}
