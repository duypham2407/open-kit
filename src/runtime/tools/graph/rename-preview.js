// ---------------------------------------------------------------------------
// tool.graph-rename-preview
//
// Preview a rename operation: find all occurrences of a symbol
// (definitions + references + imports) and show what would change.
// Does NOT apply changes — output is read-only.
//
// Input: { symbol: 'oldName', newName: 'newName' }
// Output: { changes: [{ path, edits: [{ line, oldText, newText }] }] }
// ---------------------------------------------------------------------------

export function createRenamePreviewTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-rename-preview',
    name: 'Graph Rename Preview',
    description:
      'Preview a rename: find all definitions, references, and import sites ' +
      'of a symbol and show what would change. Does not apply changes. ' +
      'Pass { symbol: "oldName", newName: "newName" }.',
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
      const newName = input.newName;

      if (!symbolName) {
        return { status: 'error', reason: 'symbol name is required. Pass { symbol: "oldName", newName: "newName" }.' };
      }
      if (!newName) {
        return { status: 'error', reason: 'newName is required. Pass { symbol: "oldName", newName: "newName" }.' };
      }
      if (symbolName === newName) {
        return { status: 'error', reason: 'symbol and newName must be different.' };
      }

      // Get definitions + references
      const refResult = projectGraphManager.findReferences(symbolName);
      if (refResult.status !== 'ok') {
        return refResult;
      }

      // Group changes by file
      const changesByPath = new Map();

      // Add definition sites
      for (const def of refResult.definitions) {
        const key = def.path;
        if (!changesByPath.has(key)) {
          changesByPath.set(key, { path: key, absolutePath: def.absolutePath, edits: [] });
        }
        changesByPath.get(key).edits.push({
          line: def.line,
          type: 'definition',
          oldText: symbolName,
          newText: newName,
        });
      }

      // Add reference sites
      for (const ref of refResult.references) {
        const key = ref.referencePath;
        if (!changesByPath.has(key)) {
          changesByPath.set(key, { path: key, absolutePath: ref.absoluteReferencePath, edits: [] });
        }
        changesByPath.get(key).edits.push({
          line: ref.line,
          col: ref.col,
          type: ref.kind,
          oldText: symbolName,
          newText: newName,
        });
      }

      // Sort edits within each file by line
      for (const change of changesByPath.values()) {
        change.edits.sort((a, b) => a.line - b.line);
      }

      const changes = Array.from(changesByPath.values()).sort((a, b) => a.path.localeCompare(b.path));

      return {
        status: 'preview-only',
        symbol: symbolName,
        newName,
        changes,
        totalFiles: changes.length,
        totalEdits: changes.reduce((sum, c) => sum + c.edits.length, 0),
      };
    },
  };
}
