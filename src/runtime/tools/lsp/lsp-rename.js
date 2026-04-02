import { previewRename } from './heuristic-lsp.js';

export function createLspRenameTool({ projectRoot = process.cwd(), projectGraphManager = null } = {}) {
  const graphAvailable = projectGraphManager?.available === true;
  return {
    id: 'tool.lsp-rename',
    name: 'LSP Rename Tool',
    description: 'Previews multi-file rename impact without mutating files. Uses the project ' +
      'graph database when available for cross-file accuracy.',
    family: 'lsp',
    stage: 'foundation',
    status: graphAvailable ? 'active' : 'degraded',
    execute(input = {}) {
      // Graph-backed rename preview
      if (graphAvailable && input.symbol && input.newName) {
        const refResult = projectGraphManager.findReferences(input.symbol);
        if (refResult.status === 'ok' && (refResult.definitions.length > 0 || refResult.totalCount > 0)) {
          const fileChanges = {};
          for (const def of refResult.definitions) {
            if (!fileChanges[def.path]) fileChanges[def.path] = 0;
            fileChanges[def.path]++;
          }
          for (const ref of refResult.references) {
            const key = ref.referencePath;
            if (!fileChanges[key]) fileChanges[key] = 0;
            fileChanges[key]++;
          }

          return {
            status: 'preview-only',
            provider: 'project-graph',
            symbol: input.symbol,
            newName: input.newName,
            definitions: refResult.definitions,
            totalReferences: refResult.totalCount,
            filesAffected: Object.keys(fileChanges).length,
            changesByFile: fileChanges,
            scopeFiltered: refResult.scopeFiltered === true,
            importScoped: refResult.importScoped === true,
          };
        }
      }

      return {
        status: 'preview-only',
        ...previewRename(projectRoot, input),
      };
    },
  };
}
