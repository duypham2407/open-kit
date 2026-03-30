export function createLspGotoDefinitionTool() {
  return {
    id: 'tool.lsp-goto-definition',
    execute() {
      return { status: 'planned', provider: 'lsp' };
    },
  };
}
