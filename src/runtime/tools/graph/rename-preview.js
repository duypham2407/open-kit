import fs from 'node:fs';

export function createGraphRenamePreviewTool({ projectGraphManager }) {
  return {
    id: 'tool.graph-rename-preview',
    name: 'Graph Rename Preview',
    description:
      'Preview a rename across all files: definitions, references, and import specifiers. ' +
      'Pass { symbol, newName } to see all changes without applying them.',
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

      const symbol = input.symbol;
      const newName = input.newName;
      if (!symbol) {
        return { status: 'error', reason: 'symbol is required.' };
      }
      if (!newName) {
        return { status: 'error', reason: 'newName is required.' };
      }
      if (symbol === newName) {
        return { status: 'error', reason: 'newName must be different from symbol.' };
      }

      // Check for naming conflict
      const conflictResult = projectGraphManager.findSymbol(newName);
      const conflicts = conflictResult.status === 'ok' ? conflictResult.matches : [];

      // Find all definitions
      const symResult = projectGraphManager.findSymbol(symbol);
      const definitions = symResult.status === 'ok' ? symResult.matches : [];

      // Find all references
      const refResult = projectGraphManager.findReferences(symbol);
      const references = refResult.status === 'ok' ? refResult.references : [];

      // Build per-file edit previews
      const fileEditsMap = new Map();
      const addEdit = (absPath, relPath, line, col) => {
        if (!fileEditsMap.has(absPath)) {
          fileEditsMap.set(absPath, { path: relPath, absolutePath: absPath, edits: [] });
        }
        fileEditsMap.get(absPath).edits.push({ line, column: col ?? 0, oldText: symbol, newText: newName });
      };

      for (const def of definitions) {
        addEdit(def.absolutePath, def.path, def.line, 0);
      }
      for (const ref of references) {
        addEdit(ref.absolutePath, ref.path, ref.line, ref.col);
      }

      // Enrich edits with line content from source files
      for (const [absPath, fileEntry] of fileEditsMap) {
        try {
          const content = fs.readFileSync(absPath, 'utf8');
          const lines = content.split('\n');
          for (const edit of fileEntry.edits) {
            const lineIdx = edit.line - 1;
            edit.lineContent = lineIdx >= 0 && lineIdx < lines.length ? lines[lineIdx] : null;
          }
        } catch {
          // File may not exist on disk — leave lineContent as undefined
        }
        // Sort edits by line
        fileEntry.edits.sort((a, b) => a.line - b.line || a.column - b.column);
      }

      const changes = [...fileEditsMap.values()];
      const totalOccurrences = changes.reduce((sum, f) => sum + f.edits.length, 0);

      return {
        status: conflicts.length > 0 ? 'conflict' : 'preview-ready',
        symbol,
        newName,
        totalOccurrences,
        conflicts: conflicts.map((c) => ({
          path: c.path,
          absolutePath: c.absolutePath,
          kind: c.kind,
          line: c.line,
        })),
        changes,
      };
    },
  };
}
