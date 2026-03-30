import { collectSymbolReferences } from './heuristic-lsp.js';

export function createLspFindReferencesTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.lsp-find-references',
    name: 'LSP Find References Tool',
    description: 'Finds heuristic symbol references when a full LSP is unavailable.',
    family: 'lsp',
    stage: 'foundation',
    status: 'degraded',
    execute({ symbol } = {}) {
      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        symbol,
        references: symbol ? collectSymbolReferences(projectRoot, symbol) : [],
      };
    },
  };
}
