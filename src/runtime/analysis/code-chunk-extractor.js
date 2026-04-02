import path from 'node:path';

const DEFAULT_MAX_CHUNK_CHARS = 2200;
const DEFAULT_SUBCHUNK_OVERLAP_LINES = 2;

function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function buildChunkMetadata({
  filePath,
  absolutePath,
  symbolName,
  kind,
  startLine,
  endLine,
  docComment,
  imports,
  isExport,
  scope,
  parentSymbol,
  splitIndex = 0,
  totalSplits = 1,
  estimatedTokens,
}) {
  return {
    filePath,
    absolutePath,
    symbolName,
    kind,
    startLine,
    endLine,
    docComment: docComment ?? null,
    imports,
    isExport: Boolean(isExport),
    scope: scope ?? null,
    parentSymbol: parentSymbol ?? null,
    splitIndex,
    totalSplits,
    estimatedTokens,
  };
}

function createSymbolChunk({ relPath, filePath, symbol, content, importSummary, splitIndex = 0, totalSplits = 1 }) {
  const startLine = symbol.startLine;
  const chunkId = totalSplits > 1
    ? `${relPath}:${symbol.name}:${startLine}:part-${splitIndex + 1}`
    : `${relPath}:${symbol.name}:${startLine}`;
  const estimatedTokens = estimateTokenCount(content);

  return {
    chunkId,
    content,
    metadata: buildChunkMetadata({
      filePath: relPath,
      absolutePath: filePath,
      symbolName: symbol.name,
      kind: symbol.kind,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      docComment: symbol.docComment,
      imports: importSummary,
      isExport: symbol.isExport,
      scope: symbol.scope,
      parentSymbol: symbol.parentSymbol,
      splitIndex,
      totalSplits,
      estimatedTokens,
    }),
  };
}

function splitOversizedChunk({ relPath, filePath, symbol, lines, importSummary, maxChunkChars, overlapLines }) {
  const chunks = [];
  const totalLines = lines.length;
  let cursor = 0;
  let partIndex = 0;

  while (cursor < totalLines) {
    let end = cursor;
    let charCount = 0;

    while (end < totalLines) {
      const nextLineLength = lines[end].length + 1;
      if (end > cursor && charCount + nextLineLength > maxChunkChars) {
        break;
      }
      charCount += nextLineLength;
      end += 1;
    }

    if (end === cursor) {
      end = Math.min(cursor + 1, totalLines);
    }

    const content = lines.slice(cursor, end).join('\n');
    const chunkStartLine = symbol.startLine + cursor;
    const chunkEndLine = symbol.startLine + end - 1;
    const chunkSymbol = {
      ...symbol,
      startLine: chunkStartLine,
      endLine: chunkEndLine,
    };
    chunks.push(createSymbolChunk({
      relPath,
      filePath,
      symbol: chunkSymbol,
      content,
      importSummary,
      splitIndex: partIndex,
      totalSplits: 0, // populated after split count is known
    }));

    if (end >= totalLines) {
      break;
    }

    cursor = Math.max(end - overlapLines, cursor + 1);
    partIndex += 1;
  }

  const totalSplits = chunks.length;
  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkId: `${relPath}:${symbol.name}:${symbol.startLine}:part-${index + 1}`,
    metadata: {
      ...chunk.metadata,
      splitIndex: index,
      totalSplits,
    },
  }));
}

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

    if (content.length > DEFAULT_MAX_CHUNK_CHARS) {
      chunks.push(...splitOversizedChunk({
        relPath,
        filePath,
        symbol: sym,
        lines: lines.slice(startIdx, endIdx),
        importSummary,
        maxChunkChars: DEFAULT_MAX_CHUNK_CHARS,
        overlapLines: DEFAULT_SUBCHUNK_OVERLAP_LINES,
      }));
      continue;
    }

    chunks.push(createSymbolChunk({
      relPath,
      filePath,
      symbol: sym,
      content,
      importSummary,
    }));
  }

  // If no symbol-based chunks, create a single file-level chunk
  if (chunks.length === 0 && source.trim().length > 0) {
    chunks.push({
      chunkId: `${relPath}:module:1`,
      content: source.slice(0, 4000), // cap at ~4000 chars for embedding
      metadata: buildChunkMetadata({
        filePath: relPath,
        absolutePath: filePath,
        symbolName: null,
        kind: 'module',
        startLine: 1,
        endLine: lines.length,
        docComment: null,
        imports: importSummary,
        estimatedTokens: estimateTokenCount(source.slice(0, 4000)),
      }),
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
