import { prepareRename } from './heuristic-lsp.js';

export function createLspPrepareRenameTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.lsp-prepare-rename',
    name: 'LSP Prepare Rename Tool',
    description: 'Previews rename safety using a heuristic symbol index.',
    family: 'lsp',
    stage: 'foundation',
    status: 'degraded',
    execute(input = {}) {
      return {
        status: 'heuristic',
        ...prepareRename(projectRoot, input),
      };
    },
  };
}
