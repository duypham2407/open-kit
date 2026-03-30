export function createLspFindReferencesTool() {
  return {
    id: 'tool.lsp-find-references',
    execute() {
      return { status: 'planned', provider: 'lsp' };
    },
  };
}
