// ---------------------------------------------------------------------------
// LSP Formatters
//
// Converts graph DB results to LSP protocol-compatible JSON structures.
// These are used by the graph-backed LSP tools to produce output that
// matches the format agents and editors expect from LSP providers.
// ---------------------------------------------------------------------------

import path from 'node:path';

/**
 * Convert a graph DB symbol row to an LSP SymbolInformation-like object.
 * Matches the output format of the heuristic LSP tools.
 *
 * @param {{ name: string, kind: string, path: string, line: number, is_export?: number, signature?: string, doc_comment?: string, scope?: string, start_line?: number, end_line?: number }} row
 * @param {string} projectRoot
 * @returns {{ symbol: string, kind: string, filePath: string, line: number, signature?: string, docComment?: string, scope?: string, isExport: boolean }}
 */
export function toSymbolInfo(row, projectRoot) {
  return {
    symbol: row.name,
    kind: row.kind,
    filePath: row.path.startsWith('/') ? path.relative(projectRoot, row.path) : row.path,
    line: row.line,
    isExport: (row.is_export ?? 0) === 1,
    ...(row.signature ? { signature: row.signature } : {}),
    ...(row.doc_comment ? { docComment: row.doc_comment } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
  };
}

/**
 * Convert a graph DB symbol to an LSP Location-like object.
 *
 * @param {{ path: string, line: number, start_line?: number, end_line?: number }} row
 * @param {string} projectRoot
 * @returns {{ uri: string, range: { start: { line: number, character: number }, end: { line: number, character: number } } }}
 */
export function toLocation(row, projectRoot) {
  const relPath = row.path.startsWith('/') ? path.relative(projectRoot, row.path) : row.path;
  return {
    uri: relPath,
    range: {
      start: { line: (row.start_line ?? row.line) - 1, character: 0 },
      end: { line: (row.end_line ?? row.line) - 1, character: 0 },
    },
  };
}

/**
 * Convert a graph DB reference row to an LSP Location-like object.
 *
 * @param {{ path: string, line: number, col?: number }} ref
 * @param {string} projectRoot
 * @returns {{ uri: string, range: { start: { line: number, character: number }, end: { line: number, character: number } } }}
 */
export function toReferenceLocation(ref, projectRoot) {
  const relPath = ref.path.startsWith('/') ? path.relative(projectRoot, ref.path) : ref.path;
  return {
    uri: relPath,
    range: {
      start: { line: ref.line - 1, character: ref.col ?? 0 },
      end: { line: ref.line - 1, character: ref.col ?? 0 },
    },
  };
}

/**
 * Convert a rename preview to an LSP WorkspaceEdit-like object.
 *
 * @param {{ changes: Array<{ path: string, edits: Array<{ line: number, oldText: string, newText: string }> }> }} preview
 * @returns {{ changes: Record<string, Array<{ range: { start: { line: number }, end: { line: number } }, newText: string }>> }}
 */
export function toWorkspaceEdit(preview) {
  const changes = {};
  for (const change of preview.changes) {
    changes[change.path] = change.edits.map((edit) => ({
      range: {
        start: { line: edit.line - 1, character: 0 },
        end: { line: edit.line - 1, character: 0 },
      },
      newText: edit.newText,
    }));
  }
  return { changes };
}
