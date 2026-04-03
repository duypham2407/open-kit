export function createGraphFindReferencesTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-find-references',
    name: 'Graph Find References',
    description:
      'Find all references (usages) of a symbol across the project using the import graph. ' +
      'Pass { symbol } to find all identifier usages grouped by reference kind.',
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

      const symbol = typeof input === 'string' ? input : input.symbol;
      if (!symbol) {
        return { status: 'error', reason: 'symbol is required.' };
      }

      // Get definitions from symbols table
      const symResult = projectGraphManager.findSymbol(symbol);
      const definitions = symResult.status === 'ok' ? symResult.matches : [];

      // Get references from symbol_refs table
      const refResult = projectGraphManager.findReferences(symbol);
      const references = refResult.status === 'ok' ? refResult.references : [];

      // Group references by kind
      const grouped = { definitions: [], imports: [], usages: [], assignments: [], typeRefs: [] };
      for (const def of definitions) {
        grouped.definitions.push({
          path: def.path,
          absolutePath: def.absolutePath,
          line: def.line,
          kind: def.kind,
          isExport: def.isExport,
        });
      }
      for (const ref of references) {
        const entry = {
          path: ref.path,
          absolutePath: ref.absolutePath,
          line: ref.line,
          col: ref.col,
        };
        switch (ref.refKind) {
          case 'import':
            grouped.imports.push(entry);
            break;
          case 'assignment':
            grouped.assignments.push(entry);
            break;
          case 'type-ref':
            grouped.typeRefs.push(entry);
            break;
          default:
            grouped.usages.push(entry);
            break;
        }
      }

      return {
        status: 'ok',
        symbol,
        totalCount: definitions.length + references.length,
        ...grouped,
      };
    },
  };
}
