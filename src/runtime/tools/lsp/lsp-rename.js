import { previewRename } from './heuristic-lsp.js';

export function createLspRenameTool({ projectRoot = process.cwd() } = {}) {
  return {
    id: 'tool.lsp-rename',
    name: 'LSP Rename Tool',
    description: 'Previews multi-file rename impact without mutating files.',
    family: 'lsp',
    stage: 'foundation',
    status: 'degraded',
    execute(input = {}) {
      return {
        status: 'preview-only',
        ...previewRename(projectRoot, input),
      };
    },
  };
}
