import { collectHeuristicDiagnostics } from './heuristic-lsp.js';

export function createLspDiagnosticsTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.lsp-diagnostics',
    name: 'LSP Diagnostics Tool',
    description: 'Heuristic source diagnostics when a full LSP server is unavailable.',
    family: 'lsp',
    stage: 'foundation',
    status: 'degraded',
    execute() {
      const diagnostics = collectHeuristicDiagnostics(projectRoot);
      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        diagnostics,
      };
    },
  };
}
