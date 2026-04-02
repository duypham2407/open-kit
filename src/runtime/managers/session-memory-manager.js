// ---------------------------------------------------------------------------
// Session Memory Manager
//
// Tracks which files an agent reads and modifies during a session.
// Persists touch records to the project graph DB for cross-session recall.
// Also exposes the semantic search entry point (when embeddings are available).
// ---------------------------------------------------------------------------

import { extractCodeChunks, cosineSimilarity } from '../analysis/code-chunk-extractor.js';

function clampScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

export class SessionMemoryManager {
  /**
   * @param {{
   *   projectGraphManager: object,
   *   embeddingProvider?: import('../analysis/embedding-provider.js').BaseEmbeddingProvider | null,
   *   sessionId?: string,
   * }} opts
   */
  constructor({ projectGraphManager, embeddingProvider = null, sessionId = null }) {
    this._graphManager = projectGraphManager;
    this._embeddingProvider = embeddingProvider ?? null;
    this._sessionId = sessionId ?? `session-${Date.now()}`;
    this._touchCache = new Map(); // filePath → last action
  }

  get available() {
    return this._graphManager?.available === true;
  }

  get sessionId() {
    return this._sessionId;
  }

  // -----------------------------------------------------------------------
  // Session touch tracking
  // -----------------------------------------------------------------------

  /**
   * Record that a file was read or modified in this session.
   *
   * @param {string} filePath  Absolute file path.
   * @param {'read'|'write'|'edit'} action
   */
  recordTouch(filePath, action = 'read') {
    if (!this.available) return;

    const db = this._graphManager._db;
    if (!db) return;

    const node = db.getNode(filePath);
    if (!node) return;

    db.recordSessionTouch({
      sessionId: this._sessionId,
      nodeId: node.id,
      action,
    });
    this._touchCache.set(filePath, action);
  }

  /**
   * Get all files touched in this session.
   *
   * @returns {Array<{ path: string, action: string, timestamp: number }>}
   */
  getSessionTouches() {
    if (!this.available) return [];

    const db = this._graphManager._db;
    if (!db) return [];

    return db.getSessionTouches(this._sessionId).map((t) => ({
      path: t.path,
      action: t.action,
      timestamp: t.timestamp,
    }));
  }

  /**
   * Get touch history for a specific file across all sessions.
   *
   * @param {string} filePath
   * @returns {Array<{ sessionId: string, action: string, timestamp: number }>}
   */
  getFileHistory(filePath) {
    if (!this.available) return [];

    const db = this._graphManager._db;
    if (!db) return [];

    const node = db.getNode(filePath);
    if (!node) return [];

    return db.getNodeTouchHistory(node.id).map((t) => ({
      sessionId: t.session_id,
      path: t.path,
      action: t.action,
      timestamp: t.timestamp,
    }));
  }

  /**
   * Get the most recent file touches across all sessions.
   *
   * @param {number} limit
   * @returns {Array<{ sessionId: string, path: string, action: string, timestamp: number }>}
   */
  getRecentActivity(limit = 50) {
    if (!this.available) return [];

    const db = this._graphManager._db;
    if (!db) return [];

    return db.getRecentTouches(limit).map((t) => ({
      sessionId: t.session_id,
      path: t.path,
      action: t.action,
      timestamp: t.timestamp,
    }));
  }

  // -----------------------------------------------------------------------
  // Semantic search (embedding-based)
  // -----------------------------------------------------------------------

  /**
   * Search for code chunks semantically similar to a query embedding.
   * Requires that embeddings have been stored in the DB.
   *
   * @param {Float32Array|number[]} queryEmbedding  The embedding vector for the query.
   * @param {{ topK?: number, minScore?: number }} opts
   * @returns {Array<{ chunkId: string, path: string, score: number }>}
   */
  semanticSearch(queryEmbedding, { topK = 10, minScore = 0.3 } = {}) {
    if (!this.available) return [];

    const db = this._graphManager._db;
    if (!db) return [];

    const allEmbed = db.allEmbeddings();
    if (allEmbed.length === 0) return [];

    // Brute-force cosine similarity
    const results = [];
    for (const row of allEmbed) {
      const stored = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
      const score = cosineSimilarity(queryEmbedding, stored);
      if (score >= minScore) {
        results.push({
          chunkId: row.chunk_id,
          path: row.path,
          score,
          vectorScore: clampScore((score + 1) / 2),
          model: row.model,
          metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
        });
      }
    }

    // Sort by score descending, take topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Search for code chunks semantically similar to a natural-language query string.
   * Requires an embeddingProvider to be configured; falls back to empty results if not.
   *
   * @param {string} queryText  The natural-language query to search for.
   * @param {{ topK?: number, minScore?: number }} opts
   * @returns {Promise<Array<{ chunkId: string, path: string, score: number }>>}
   */
  async semanticSearchQuery(queryText, { topK = 10, minScore = 0.3 } = {}) {
    if (!this._embeddingProvider) return [];
    if (!this.available) return [];

    try {
      const queryVec = await this._embeddingProvider.embedOne(queryText);
      return this.semanticSearch(queryVec, { topK, minScore });
    } catch {
      return [];
    }
  }

  get hasEmbeddingProvider() {
    return this._embeddingProvider !== null;
  }

  // -----------------------------------------------------------------------
  // Context builder — combine graph + session + search
  // -----------------------------------------------------------------------

  /**
   * Build a rich context payload for a task, combining graph data,
   * session history, and relevant code chunks.
   *
   * @param {{ filePath?: string, symbolName?: string, recentLimit?: number }} opts
   * @returns {{ recentFiles: Array, dependencies: Array, symbols: Array, sessionTouches: Array }}
   */
  buildContext({ filePath, symbolName, recentLimit = 20 } = {}) {
    const context = {
      recentFiles: this.getRecentActivity(recentLimit),
      sessionTouches: this.getSessionTouches(),
      dependencies: [],
      symbols: [],
    };

    if (filePath && this._graphManager?.available) {
      const deps = this._graphManager.getDependencies(filePath, { depth: 2 });
      if (deps.status === 'ok') {
        context.dependencies = deps.dependencies;
      }
    }

    if (symbolName && this._graphManager?.available) {
      const sym = this._graphManager.findSymbol(symbolName);
      if (sym.status === 'ok') {
        context.symbols = sym.matches;
      }
    }

    return context;
  }

  buildResultContext(result, { dependencyDepth = 1, dependentDepth = 1, includeCallHierarchy = true } = {}) {
    if (!this.available || !result?.path) {
      return {
        dependencies: [],
        dependents: [],
        sameFileSymbols: [],
        callHierarchy: null,
      };
    }

    const absolutePath = result.absolutePath ?? result.path;
    const dependencies = this._graphManager.getDependencies(absolutePath, { depth: dependencyDepth });
    const dependents = this._graphManager.getDependents(absolutePath, { depth: dependentDepth });
    const node = this._graphManager._db?.getNode(absolutePath);
    const sameFileSymbols = node
      ? this._graphManager._db.getSymbolsByNode(node.id)
        .slice(0, 8)
        .map((symbol) => ({
          name: symbol.name,
          kind: symbol.kind,
          line: symbol.line,
          scope: symbol.scope ?? null,
        }))
      : [];

    let callHierarchy = null;
    const symbolName = result.symbolName ?? result.metadata?.symbolName ?? null;
    if (includeCallHierarchy && symbolName) {
      const outgoing = this._graphManager.getCallHierarchy(symbolName, { direction: 'outgoing' });
      const incoming = this._graphManager.getCallHierarchy(symbolName, { direction: 'incoming' });
      callHierarchy = {
        outgoing: outgoing.status === 'ok' ? outgoing.calls.slice(0, 6) : [],
        incoming: incoming.status === 'ok' ? incoming.calls.slice(0, 6) : [],
      };
    }

    return {
      dependencies: dependencies.status === 'ok' ? dependencies.dependencies.slice(0, 8) : [],
      dependents: dependents.status === 'ok' ? dependents.dependents.slice(0, 8) : [],
      sameFileSymbols,
      callHierarchy,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe() {
    return {
      sessionId: this._sessionId,
      available: this.available,
      touchedFiles: this._touchCache.size,
      hasEmbeddingProvider: this.hasEmbeddingProvider,
    };
  }
}
