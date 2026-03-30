export function createLspDiagnosticsTool() {
  return {
    id: 'tool.lsp-diagnostics',
    execute() {
      return { status: 'planned', provider: 'lsp' };
    },
  };
}
