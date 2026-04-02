import { prepareRename } from './heuristic-lsp.js';

export function createLspPrepareRenameTool({ projectRoot = process.cwd(), projectGraphManager = null } = {}) {
  const graphAvailable = projectGraphManager?.available === true;
  return {
    id: 'tool.lsp-prepare-rename',
    name: 'LSP Prepare Rename Tool',
    description: 'Previews rename safety. Uses the project graph database for cross-file ' +
      'analysis when available, falls back to heuristic regex.',
    family: 'lsp',
    stage: 'foundation',
    status: graphAvailable ? 'active' : 'degraded',
    execute(input = {}) {
      // Graph-backed rename preview uses the graph-rename-preview tool's logic
      if (graphAvailable && input.symbol) {
        const result = projectGraphManager.findReferences(input.symbol);
        if (result.status === 'ok' && result.definitions.length > 0) {
          return {
            status: 'graph-backed',
            provider: 'project-graph',
            symbol: input.symbol,
            definitions: result.definitions,
            referenceCount: result.totalCount,
            isReady: result.definitions.length > 0,
            conflicts: [],
            scopeFiltered: result.scopeFiltered === true,
            importScoped: result.importScoped === true,
          };
        }
      }

      return {
        status: 'heuristic',
        ...prepareRename(projectRoot, input),
      };
    },
  };
}
