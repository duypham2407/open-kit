export function createLspSymbolsTool() {
  return {
    id: 'tool.lsp-symbols',
    execute() {
      return { status: 'planned', provider: 'lsp' };
    },
  };
}
