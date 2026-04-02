// ---------------------------------------------------------------------------
// Embedding Indexing Pipeline
//
// Coordinates the end-to-end flow of:
//   1. Extracting code chunks from indexed files
//   2. Generating embeddings via a pluggable EmbeddingProvider
//   3. Storing embeddings in the project graph DB
//
// Designed to run as a background task after file indexing completes.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import { extractCodeChunks } from './code-chunk-extractor.js';

export class EmbeddingIndexer {
  /**
   * @param {{
   *   projectGraphManager: object,
   *   embeddingProvider: import('./embedding-provider.js').BaseEmbeddingProvider,
   *   batchSize?: number,
   * }} opts
   */
  constructor({ projectGraphManager, embeddingProvider, batchSize = 20 }) {
    this._graphManager = projectGraphManager;
    this._provider = embeddingProvider;
    this._batchSize = batchSize;
    this._indexingInProgress = false;
    this._stats = { filesProcessed: 0, chunksEmbedded: 0, errors: 0, lastRunMs: 0 };
  }

  get available() {
    return this._graphManager?.available === true && this._provider != null;
  }

  get stats() {
    return { ...this._stats };
  }

  // -----------------------------------------------------------------------
  // Index a single file's embeddings
  // -----------------------------------------------------------------------

  /**
   * Extract chunks from a file, generate embeddings, and store them.
   *
   * @param {string} filePath  Absolute path to the source file.
   * @returns {Promise<{ status: string, chunks?: number }>}
   */
  async indexFileEmbeddings(filePath) {
    if (!this.available) {
      return { status: 'unavailable' };
    }

    const db = this._graphManager._db;
    if (!db) return { status: 'unavailable' };

    const node = db.getNode(filePath);
    if (!node) return { status: 'not-indexed', filePath };

    // Read source
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return { status: 'read-error', filePath };
    }

    // Get symbols and imports from DB
    const symbols = db.getSymbolsByNode(node.id).map((s) => ({
      name: s.name,
      kind: s.kind,
      startLine: s.start_line,
      endLine: s.end_line,
      scope: s.scope,
      docComment: s.doc_comment,
    }));

    const deps = db.getDependencies(node.id);
    const imports = deps.map((d) => ({
      specifier: d.path,
      importedNames: [], // We don't need detailed names for chunk context
    }));

    // Extract chunks
    const chunks = extractCodeChunks({
      source,
      filePath,
      symbols,
      imports,
      projectRoot: this._graphManager.projectRoot,
    });

    if (chunks.length === 0) {
      return { status: 'no-chunks', filePath };
    }

    // Generate embeddings in batches
    const embeddingRecords = [];
    for (let i = 0; i < chunks.length; i += this._batchSize) {
      const batch = chunks.slice(i, i + this._batchSize);
      const texts = batch.map((c) => this._buildEmbeddingText(c));

      try {
        const vectors = await this._provider.embed(texts);
        for (let j = 0; j < batch.length; j++) {
          if (vectors[j]) {
            embeddingRecords.push({
              chunkId: batch[j].chunkId,
              embedding: Buffer.from(vectors[j].buffer),
              model: this._provider.model,
            });
          }
        }
      } catch {
        this._stats.errors++;
      }
    }

    // Store in DB
    if (embeddingRecords.length > 0) {
      db.replaceEmbeddingsForNode(node.id, embeddingRecords);
    }

    return { status: 'ok', filePath, chunks: embeddingRecords.length };
  }

  // -----------------------------------------------------------------------
  // Index all files in the project
  // -----------------------------------------------------------------------

  /**
   * Run the embedding indexer over all indexed files in the graph DB.
   *
   * @param {{ maxFiles?: number, force?: boolean }} opts
   * @returns {Promise<{ status: string, filesProcessed: number, chunksEmbedded: number, errors: number, durationMs: number }>}
   */
  async indexProject({ maxFiles = 2000, force = false } = {}) {
    if (!this.available) {
      return { status: 'unavailable', filesProcessed: 0, chunksEmbedded: 0, errors: 0, durationMs: 0 };
    }

    if (this._indexingInProgress) {
      return { status: 'already-indexing', filesProcessed: 0, chunksEmbedded: 0, errors: 0, durationMs: 0 };
    }

    this._indexingInProgress = true;
    const startTime = Date.now();
    let filesProcessed = 0;
    let chunksEmbedded = 0;
    let errors = 0;

    try {
      const db = this._graphManager._db;
      const nodes = db.allNodes();
      const limit = Math.min(nodes.length, maxFiles);

      for (let i = 0; i < limit; i++) {
        const node = nodes[i];

        // Skip external/stub nodes (mtime 0)
        if (node.mtime === 0) continue;

        // Skip files that already have embeddings (unless force)
        if (!force) {
          const existing = db.getEmbeddingsByNode(node.id);
          if (existing.length > 0) continue;
        }

        try {
          const result = await this.indexFileEmbeddings(node.path);
          if (result.status === 'ok') {
            filesProcessed++;
            chunksEmbedded += result.chunks;
          } else if (result.status === 'read-error' || result.status === 'not-indexed') {
            errors++;
          }
        } catch {
          errors++;
        }
      }

      const durationMs = Date.now() - startTime;
      this._stats = { filesProcessed, chunksEmbedded, errors, lastRunMs: durationMs };

      return { status: 'complete', filesProcessed, chunksEmbedded, errors, durationMs };
    } finally {
      this._indexingInProgress = false;
    }
  }

  // -----------------------------------------------------------------------
  // Internal: build the text to embed for a chunk
  // -----------------------------------------------------------------------

  /**
   * Combine chunk content with metadata to form the text that gets embedded.
   * Including the file path, symbol name, and doc comment gives the
   * embedding model richer semantic signal.
   */
  _buildEmbeddingText(chunk) {
    const parts = [];

    if (chunk.metadata.filePath) {
      parts.push(`File: ${chunk.metadata.filePath}`);
    }
    if (chunk.metadata.symbolName) {
      parts.push(`Symbol: ${chunk.metadata.symbolName} (${chunk.metadata.kind})`);
    }
    if (chunk.metadata.docComment) {
      parts.push(`Doc: ${chunk.metadata.docComment}`);
    }
    if (chunk.metadata.imports) {
      parts.push(`Imports: ${chunk.metadata.imports}`);
    }

    parts.push(chunk.content);
    return parts.join('\n');
  }

  describe() {
    return {
      available: this.available,
      provider: this._provider?.describe?.() ?? null,
      batchSize: this._batchSize,
      stats: this._stats,
    };
  }
}
