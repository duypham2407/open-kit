import { collectProjectSymbols } from './heuristic-lsp.js';

export function createLspGotoDefinitionTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.lsp-goto-definition',
    name: 'LSP Goto Definition Tool',
    description: 'Finds heuristic symbol definitions when a full LSP is unavailable.',
    family: 'lsp',
    stage: 'foundation',
    status: 'degraded',
    execute({ symbol, filePath = null } = {}) {
      return {
        status: 'heuristic',
        provider: 'heuristic-index',
        symbol,
        definitions: collectProjectSymbols(projectRoot, { symbol, filePath }),
      };
    },
  };
}
