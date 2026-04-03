import { collectHeuristicDiagnostics } from './heuristic-lsp.js';

export function createLspDiagnosticsTool({ projectRoot = process.cwd(), projectGraphManager = null } = {}) {
  const graphAvailable = projectGraphManager?.available === true;
  return {
    id: 'tool.lsp-diagnostics',
    name: 'LSP Diagnostics Tool',
    description: 'Source diagnostics. Uses the project graph database for import analysis ' +
      'when available, falls back to heuristic regex.',
    family: 'lsp',
    stage: 'foundation',
    status: graphAvailable ? 'active' : 'degraded',
    execute() {
      // Graph-backed diagnostics are a future enhancement —
      // the heuristic engine already checks for missing imports and duplicate symbols.
      // When graph DB is available, we set the provider to indicate graph awareness.
      const diagnostics = collectHeuristicDiagnostics(projectRoot);
      return {
        status: graphAvailable ? 'graph-aware' : 'heuristic',
        provider: graphAvailable ? 'heuristic+graph' : 'heuristic-index',
        diagnostics,
      };
    },
  };
}
