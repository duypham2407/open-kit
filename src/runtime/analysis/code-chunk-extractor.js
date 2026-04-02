import path from 'node:path';

// ---------------------------------------------------------------------------
// Code Chunk Extractor
//
// Splits a parsed file into semantic chunks (function-level, class-level)
// suitable for embedding and semantic search.  Each chunk carries source
// code plus metadata (file path, line range, symbol name, imports).
// ---------------------------------------------------------------------------

/**
 * Extract semantic code chunks from a parsed file's symbol list.
 *
 * @param {{
 *   source: string,
 *   filePath: string,
 *   symbols: Array<{ name: string, kind: string, startLine?: number, endLine?: number, scope?: string, docComment?: string }>,
 *   imports: Array<{ specifier: string, importedNames: string[] }>,
 *   projectRoot: string,
 * }} opts
 * @returns {Array<{ chunkId: string, content: string, metadata: object }>}
 */
export function extractCodeChunks({ source, filePath, symbols, imports, projectRoot }) {
  const lines = source.split('\n');
  const relPath = path.relative(projectRoot, filePath);
  const chunks = [];

  // Build import summary for context
  const importSummary = imports
    .filter((imp) => imp.importedNames.length > 0)
    .map((imp) => `${imp.importedNames.join(', ')} from '${imp.specifier}'`)
    .join('; ');

  // Extract a chunk for each top-level symbol with line range
  for (const sym of symbols) {
    if (sym.startLine == null || sym.endLine == null) continue;
    if (sym.scope) continue; // skip class members — they're part of the class chunk

    const startIdx = sym.startLine - 1;
    const endIdx = Math.min(sym.endLine, lines.length);
    const content = lines.slice(startIdx, endIdx).join('\n');

    if (content.trim().length === 0) continue;

    const chunkId = `${relPath}:${sym.name}:${sym.startLine}`;
    chunks.push({
      chunkId,
      content,
      metadata: {
        filePath: relPath,
        absolutePath: filePath,
        symbolName: sym.name,
        kind: sym.kind,
        startLine: sym.startLine,
        endLine: sym.endLine,
        docComment: sym.docComment ?? null,
        imports: importSummary,
      },
    });
  }

  // If no symbol-based chunks, create a single file-level chunk
  if (chunks.length === 0 && source.trim().length > 0) {
    chunks.push({
      chunkId: `${relPath}:module:1`,
      content: source.slice(0, 4000), // cap at ~4000 chars for embedding
      metadata: {
        filePath: relPath,
        absolutePath: filePath,
        symbolName: null,
        kind: 'module',
        startLine: 1,
        endLine: lines.length,
        docComment: null,
        imports: importSummary,
      },
    });
  }

  return chunks;
}

/**
 * Brute-force cosine similarity between two Float32 vectors.
 *
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number} Cosine similarity in [-1, 1]
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
