export function createLspRenameTool() {
  return {
    id: 'tool.lsp-rename',
    execute() {
      return { status: 'planned', provider: 'lsp' };
    },
  };
}
