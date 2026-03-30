import { collectProjectSymbols } from './heuristic-lsp.js';

export function createLspSymbolsTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.lsp-symbols',
    name: 'LSP Symbols Tool',
    description: 'Heuristic project symbol index for JavaScript and TypeScript sources.',
    family: 'lsp',
    stage: 'foundation',
    status: 'degraded',
    execute(input = {}) {
      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        symbols: collectProjectSymbols(projectRoot, input ?? {}),
      };
    },
  };
}
