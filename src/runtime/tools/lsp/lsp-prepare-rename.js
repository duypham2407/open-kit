export function createLspPrepareRenameTool() {
  return {
    id: 'tool.lsp-prepare-rename',
    execute() {
      return { status: 'planned', provider: 'lsp' };
    },
  };
}
