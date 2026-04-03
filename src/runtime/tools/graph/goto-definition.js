// ---------------------------------------------------------------------------
// tool.graph-goto-definition
//
// Navigate to the definition of a symbol using the project graph database.
// Input: { symbol: 'functionName' } or { filePath, line, column }
// Output: { definitions: [{ path, line, kind, signature, docComment }] }
// ---------------------------------------------------------------------------

export function createGotoDefinitionTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-goto-definition',
    name: 'Graph Go-To Definition',
    description:
      'Find the definition(s) of a symbol using the project graph database. ' +
      'Pass { symbol } to search by name, or { filePath, line } to find the symbol at a given location.',
    family: 'graph',
    stage: 'foundation',
    status: projectGraphManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!projectGraphManager?.available) {
        return {
          status: 'unavailable',
          reason: 'Project graph database is not available. Run openkit doctor for details.',
        };
      }

      const symbolName = typeof input === 'string' ? input : input.symbol;

      if (!symbolName) {
        return { status: 'error', reason: 'symbol name is required. Pass { symbol: "name" }.' };
      }

      const result = projectGraphManager.findSymbol(symbolName);
      if (result.status !== 'ok') {
        return result;
      }

      // Filter to only exported definitions (most likely the "true" definition)
      const exported = result.matches.filter((m) => m.isExport);
      const definitions = (exported.length > 0 ? exported : result.matches).map((m) => ({
        path: m.path,
        absolutePath: m.absolutePath,
        line: m.line,
        kind: m.kind,
        signature: m.signature,
        docComment: m.docComment,
        scope: m.scope,
        startLine: m.startLine,
        endLine: m.endLine,
      }));

      return {
        status: 'ok',
        symbol: symbolName,
        definitions,
        totalCount: definitions.length,
      };
    },
  };
}
