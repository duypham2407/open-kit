import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Lazy load better-sqlite3 — it is a native module that may fail on some
// platforms.  Callers should use isBetterSqliteAvailable() before creating
// a ProjectGraphDb instance.
// ---------------------------------------------------------------------------

let Database = null;

function loadDatabase() {
  if (!Database) {
    Database = require('better-sqlite3');
  }
  return Database;
}

export function isBetterSqliteAvailable() {
  try {
    loadDatabase();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS nodes (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    path  TEXT    NOT NULL UNIQUE,
    kind  TEXT    NOT NULL DEFAULT 'module',
    mtime REAL    NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS edges (
    from_node INTEGER NOT NULL,
    to_node   INTEGER NOT NULL,
    edge_type TEXT    NOT NULL DEFAULT 'import',
    line      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (from_node) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (to_node)   REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS symbols (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    kind        TEXT    NOT NULL DEFAULT 'unknown',
    is_export   INTEGER NOT NULL DEFAULT 0,
    line        INTEGER NOT NULL DEFAULT 0,
    signature   TEXT    DEFAULT NULL,
    doc_comment TEXT    DEFAULT NULL,
    scope       TEXT    DEFAULT NULL,
    start_line  INTEGER DEFAULT NULL,
    end_line    INTEGER DEFAULT NULL,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS symbol_references (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id INTEGER NOT NULL,
    node_id   INTEGER NOT NULL,
    line      INTEGER NOT NULL,
    col       INTEGER NOT NULL DEFAULT 0,
    kind      TEXT    NOT NULL DEFAULT 'usage',
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id)   REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS call_graph (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_symbol_id  INTEGER NOT NULL,
    callee_name       TEXT    NOT NULL,
    callee_node_id    INTEGER DEFAULT NULL,
    line              INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (caller_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (callee_node_id)   REFERENCES nodes(id)   ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_path       ON nodes(path);
  CREATE INDEX IF NOT EXISTS idx_edges_from       ON edges(from_node);
  CREATE INDEX IF NOT EXISTS idx_edges_to         ON edges(to_node);
  CREATE INDEX IF NOT EXISTS idx_symbols_node     ON symbols(node_id);
  CREATE INDEX IF NOT EXISTS idx_symbols_name     ON symbols(name);
  CREATE INDEX IF NOT EXISTS idx_refs_symbol      ON symbol_references(symbol_id);
  CREATE INDEX IF NOT EXISTS idx_refs_node        ON symbol_references(node_id);
  CREATE INDEX IF NOT EXISTS idx_call_caller      ON call_graph(caller_symbol_id);
  CREATE INDEX IF NOT EXISTS idx_call_callee_name ON call_graph(callee_name);

  CREATE TABLE IF NOT EXISTS embeddings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id   INTEGER NOT NULL,
    chunk_id  TEXT    NOT NULL,
    chunk_hash TEXT   DEFAULT NULL,
    metadata_json TEXT DEFAULT NULL,
    embedding BLOB    NOT NULL,
    model     TEXT    NOT NULL,
    created   REAL    NOT NULL,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_touches (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL,
    node_id    INTEGER NOT NULL,
    action     TEXT    NOT NULL DEFAULT 'read',
    timestamp  REAL    NOT NULL,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_embed_node       ON embeddings(node_id);
  CREATE INDEX IF NOT EXISTS idx_embed_chunk       ON embeddings(chunk_id);
  CREATE INDEX IF NOT EXISTS idx_session_session   ON session_touches(session_id);
  CREATE INDEX IF NOT EXISTS idx_session_node      ON session_touches(node_id);
`;

// ---------------------------------------------------------------------------
// Schema migration — add new columns to existing databases that were created
// with the Phase 2 schema.  ALTER TABLE … ADD COLUMN is safe in SQLite (it
// is a no-op if the column already exists when wrapped in a try/catch).
// ---------------------------------------------------------------------------

function migrateSchema(db) {
  const migrations = [
    'ALTER TABLE symbols ADD COLUMN signature   TEXT DEFAULT NULL',
    'ALTER TABLE symbols ADD COLUMN doc_comment TEXT DEFAULT NULL',
    'ALTER TABLE symbols ADD COLUMN scope       TEXT DEFAULT NULL',
    'ALTER TABLE symbols ADD COLUMN start_line  INTEGER DEFAULT NULL',
    'ALTER TABLE symbols ADD COLUMN end_line    INTEGER DEFAULT NULL',
    'ALTER TABLE embeddings ADD COLUMN chunk_hash TEXT DEFAULT NULL',
    'ALTER TABLE embeddings ADD COLUMN metadata_json TEXT DEFAULT NULL',
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

// ---------------------------------------------------------------------------
// ProjectGraphDb
// ---------------------------------------------------------------------------

export class ProjectGraphDb {
  /**
   * @param {string} dbPath  Absolute path to the SQLite database file.
   *                         Use ':memory:' for testing.
   */
  constructor(dbPath) {
    const Db = loadDatabase();
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this._db = new Db(dbPath);
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('foreign_keys = ON');
    this._db.exec(SCHEMA_SQL);
    migrateSchema(this._db);
    this._prepareStatements();
  }

  // -----------------------------------------------------------------------
  // Prepared statements
  // -----------------------------------------------------------------------

  _prepareStatements() {
    this._stmts = {
      upsertNode: this._db.prepare(
        `INSERT INTO nodes (path, kind, mtime) VALUES (@path, @kind, @mtime)
         ON CONFLICT(path) DO UPDATE SET kind = @kind, mtime = @mtime`
      ),
      getNode: this._db.prepare('SELECT * FROM nodes WHERE path = @path'),
      getNodeById: this._db.prepare('SELECT * FROM nodes WHERE id = @id'),
      deleteEdgesFrom: this._db.prepare('DELETE FROM edges WHERE from_node = @nodeId'),
      deleteSymbolsFor: this._db.prepare('DELETE FROM symbols WHERE node_id = @nodeId'),
      insertEdge: this._db.prepare(
        'INSERT INTO edges (from_node, to_node, edge_type, line) VALUES (@fromNode, @toNode, @edgeType, @line)'
      ),
      insertSymbol: this._db.prepare(
        `INSERT INTO symbols (node_id, name, kind, is_export, line, signature, doc_comment, scope, start_line, end_line)
         VALUES (@nodeId, @name, @kind, @isExport, @line, @signature, @docComment, @scope, @startLine, @endLine)`
      ),
      getDependencies: this._db.prepare(
        `SELECT n.path, e.edge_type, e.line
         FROM edges e
         JOIN nodes n ON n.id = e.to_node
         WHERE e.from_node = @nodeId`
      ),
      getDependents: this._db.prepare(
        `SELECT n.path, e.edge_type, e.line
         FROM edges e
         JOIN nodes n ON n.id = e.from_node
         WHERE e.to_node = @nodeId`
      ),
      getSymbolsByNode: this._db.prepare(
        'SELECT * FROM symbols WHERE node_id = @nodeId ORDER BY line'
      ),
      findSymbolByName: this._db.prepare(
        `SELECT s.*, n.path
         FROM symbols s
         JOIN nodes n ON n.id = s.node_id
         WHERE s.name = @name`
      ),
      findSymbolByNameLike: this._db.prepare(
        `SELECT s.*, n.path
         FROM symbols s
         JOIN nodes n ON n.id = s.node_id
         WHERE LOWER(s.name) = LOWER(@name)`
      ),
      allNodes: this._db.prepare('SELECT * FROM nodes ORDER BY path'),
      nodeCount: this._db.prepare('SELECT COUNT(*) as count FROM nodes'),
      edgeCount: this._db.prepare('SELECT COUNT(*) as count FROM edges'),
      symbolCount: this._db.prepare('SELECT COUNT(*) as count FROM symbols'),
      deleteNode: this._db.prepare('DELETE FROM nodes WHERE id = @id'),

      // -- symbol_references --
      deleteRefsForNode: this._db.prepare('DELETE FROM symbol_references WHERE node_id = @nodeId'),
      insertRef: this._db.prepare(
        `INSERT INTO symbol_references (symbol_id, node_id, line, col, kind)
         VALUES (@symbolId, @nodeId, @line, @col, @kind)`
      ),
      getRefsBySymbol: this._db.prepare(
        `SELECT r.*, n.path
         FROM symbol_references r
         JOIN nodes n ON n.id = r.node_id
         WHERE r.symbol_id = @symbolId
         ORDER BY n.path, r.line`
      ),
      getRefsByNode: this._db.prepare(
        'SELECT * FROM symbol_references WHERE node_id = @nodeId ORDER BY line'
      ),
      refCount: this._db.prepare('SELECT COUNT(*) as count FROM symbol_references'),

      // -- call_graph --
      deleteCallsForCaller: this._db.prepare(
        `DELETE FROM call_graph WHERE caller_symbol_id IN
         (SELECT id FROM symbols WHERE node_id = @nodeId)`
      ),
      insertCall: this._db.prepare(
        `INSERT INTO call_graph (caller_symbol_id, callee_name, callee_node_id, line)
         VALUES (@callerSymbolId, @calleeName, @calleeNodeId, @line)`
      ),
      getCallsFrom: this._db.prepare(
        `SELECT cg.*, s.name AS caller_name, n.path AS callee_path
         FROM call_graph cg
         JOIN symbols s ON s.id = cg.caller_symbol_id
         LEFT JOIN nodes n ON n.id = cg.callee_node_id
         WHERE cg.caller_symbol_id = @symbolId
         ORDER BY cg.line`
      ),
      getCallsTo: this._db.prepare(
        `SELECT cg.*, s.name AS caller_name, sn.path AS caller_path
         FROM call_graph cg
         JOIN symbols s ON s.id = cg.caller_symbol_id
         JOIN nodes sn ON sn.id = s.node_id
         WHERE cg.callee_name = @calleeName
         ORDER BY sn.path, cg.line`
      ),
      callCount: this._db.prepare('SELECT COUNT(*) as count FROM call_graph'),

      // -- embeddings --
      deleteEmbeddingsForNode: this._db.prepare('DELETE FROM embeddings WHERE node_id = @nodeId'),
      insertEmbedding: this._db.prepare(
        `INSERT INTO embeddings (node_id, chunk_id, chunk_hash, metadata_json, embedding, model, created)
         VALUES (@nodeId, @chunkId, @chunkHash, @metadataJson, @embedding, @model, @created)`
      ),
      getEmbeddingsByNode: this._db.prepare(
        'SELECT * FROM embeddings WHERE node_id = @nodeId ORDER BY chunk_id'
      ),
      getEmbeddingByChunk: this._db.prepare(
        'SELECT * FROM embeddings WHERE chunk_id = @chunkId'
      ),
      allEmbeddings: this._db.prepare(
        `SELECT e.*, n.path
         FROM embeddings e
         JOIN nodes n ON n.id = e.node_id
         ORDER BY n.path, e.chunk_id`
      ),
      embeddingCount: this._db.prepare('SELECT COUNT(*) as count FROM embeddings'),

      // -- session_touches --
      insertSessionTouch: this._db.prepare(
        `INSERT INTO session_touches (session_id, node_id, action, timestamp)
         VALUES (@sessionId, @nodeId, @action, @timestamp)`
      ),
      getSessionTouches: this._db.prepare(
        `SELECT st.*, n.path
         FROM session_touches st
         JOIN nodes n ON n.id = st.node_id
         WHERE st.session_id = @sessionId
         ORDER BY st.timestamp DESC`
      ),
      getNodeTouchHistory: this._db.prepare(
        `SELECT st.*, n.path
         FROM session_touches st
         JOIN nodes n ON n.id = st.node_id
         WHERE st.node_id = @nodeId
         ORDER BY st.timestamp DESC`
      ),
      getRecentTouches: this._db.prepare(
        `SELECT st.*, n.path
         FROM session_touches st
         JOIN nodes n ON n.id = st.node_id
         ORDER BY st.timestamp DESC
         LIMIT @limit`
      ),
      sessionTouchCount: this._db.prepare('SELECT COUNT(*) as count FROM session_touches'),
    };
  }

  // -----------------------------------------------------------------------
  // Node operations
  // -----------------------------------------------------------------------

  upsertNode({ filePath, kind = 'module', mtime = 0 }) {
    this._stmts.upsertNode.run({ path: filePath, kind, mtime });
    return this._stmts.getNode.get({ path: filePath });
  }

  getNode(filePath) {
    return this._stmts.getNode.get({ path: filePath }) ?? null;
  }

  getNodeById(id) {
    return this._stmts.getNodeById.get({ id }) ?? null;
  }

  allNodes() {
    return this._stmts.allNodes.all();
  }

  deleteNode(filePath) {
    const node = this.getNode(filePath);
    if (!node) return false;
    this._stmts.deleteNode.run({ id: node.id });
    return true;
  }

  // -----------------------------------------------------------------------
  // Edge operations
  // -----------------------------------------------------------------------

  /**
   * Replace all outgoing edges for a node with the provided set.
   * This is the primary way to update the import graph for a file.
   */
  replaceEdgesFrom(nodeId, edges) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteEdgesFrom.run({ nodeId });
      for (const edge of edges) {
        this._stmts.insertEdge.run({
          fromNode: nodeId,
          toNode: edge.toNodeId,
          edgeType: edge.edgeType ?? 'import',
          line: edge.line ?? 0,
        });
      }
    });
    tx();
  }

  getDependencies(nodeId) {
    return this._stmts.getDependencies.all({ nodeId });
  }

  getDependents(nodeId) {
    return this._stmts.getDependents.all({ nodeId });
  }

  // -----------------------------------------------------------------------
  // Symbol operations
  // -----------------------------------------------------------------------

  replaceSymbolsFor(nodeId, symbols) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteSymbolsFor.run({ nodeId });
      for (const sym of symbols) {
        this._stmts.insertSymbol.run({
          nodeId,
          name: sym.name,
          kind: sym.kind ?? 'unknown',
          isExport: sym.isExport ? 1 : 0,
          line: sym.line ?? 0,
          signature: sym.signature ?? null,
          docComment: sym.docComment ?? null,
          scope: sym.scope ?? null,
          startLine: sym.startLine ?? null,
          endLine: sym.endLine ?? null,
        });
      }
    });
    tx();
  }

  getSymbolsByNode(nodeId) {
    return this._stmts.getSymbolsByNode.all({ nodeId });
  }

  findSymbolByName(name) {
    return this._stmts.findSymbolByName.all({ name });
  }

  /**
   * Case-insensitive symbol name search.
   * @param {string} name
   * @returns {Array}
   */
  findSymbolByNameLike(name) {
    return this._stmts.findSymbolByNameLike.all({ name });
  }

  // -----------------------------------------------------------------------
  // Reference operations
  // -----------------------------------------------------------------------

  /**
   * Replace all symbol references originating from a given file node.
   * @param {number} nodeId  The file node whose references are being replaced.
   * @param {Array<{ symbolId: number, line: number, col?: number, kind?: string }>} refs
   */
  replaceRefsForNode(nodeId, refs) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteRefsForNode.run({ nodeId });
      for (const ref of refs) {
        this._stmts.insertRef.run({
          symbolId: ref.symbolId,
          nodeId,
          line: ref.line,
          col: ref.col ?? 0,
          kind: ref.kind ?? 'usage',
        });
      }
    });
    tx();
  }

  getRefsBySymbol(symbolId) {
    return this._stmts.getRefsBySymbol.all({ symbolId });
  }

  getRefsByNode(nodeId) {
    return this._stmts.getRefsByNode.all({ nodeId });
  }

  // -----------------------------------------------------------------------
  // Call graph operations
  // -----------------------------------------------------------------------

  /**
   * Replace all outgoing calls for symbols declared in the given file node.
   * @param {number} nodeId
   * @param {Array<{ callerSymbolId: number, calleeName: string, calleeNodeId?: number, line: number }>} calls
   */
  replaceCallsForNode(nodeId, calls) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteCallsForCaller.run({ nodeId });
      for (const call of calls) {
        this._stmts.insertCall.run({
          callerSymbolId: call.callerSymbolId,
          calleeName: call.calleeName,
          calleeNodeId: call.calleeNodeId ?? null,
          line: call.line,
        });
      }
    });
    tx();
  }

  getCallsFrom(symbolId) {
    return this._stmts.getCallsFrom.all({ symbolId });
  }

  getCallsTo(calleeName) {
    return this._stmts.getCallsTo.all({ calleeName });
  }

  // -----------------------------------------------------------------------
  // Embedding operations
  // -----------------------------------------------------------------------

  /**
   * Replace all embeddings for a given file node.
   * @param {number} nodeId
   * @param {Array<{ chunkId: string, chunkHash?: string|null, metadataJson?: string|null, embedding: Buffer, model: string }>} chunks
   */
  replaceEmbeddingsForNode(nodeId, chunks) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteEmbeddingsForNode.run({ nodeId });
      const now = Date.now();
      for (const chunk of chunks) {
        this._stmts.insertEmbedding.run({
          nodeId,
          chunkId: chunk.chunkId,
          chunkHash: chunk.chunkHash ?? null,
          metadataJson: chunk.metadataJson ?? null,
          embedding: chunk.embedding,
          model: chunk.model,
          created: now,
        });
      }
    });
    tx();
  }

  getEmbeddingsByNode(nodeId) {
    return this._stmts.getEmbeddingsByNode.all({ nodeId });
  }

  getEmbeddingByChunk(chunkId) {
    return this._stmts.getEmbeddingByChunk.get({ chunkId }) ?? null;
  }

  allEmbeddings() {
    return this._stmts.allEmbeddings.all();
  }

  // -----------------------------------------------------------------------
  // Session touch operations
  // -----------------------------------------------------------------------

  /**
   * Record that a file was accessed during a session.
   * @param {{ sessionId: string, nodeId: number, action: string }} touch
   */
  recordSessionTouch({ sessionId, nodeId, action = 'read' }) {
    this._stmts.insertSessionTouch.run({
      sessionId,
      nodeId,
      action,
      timestamp: Date.now(),
    });
  }

  getSessionTouches(sessionId) {
    return this._stmts.getSessionTouches.all({ sessionId });
  }

  getNodeTouchHistory(nodeId) {
    return this._stmts.getNodeTouchHistory.all({ nodeId });
  }

  getRecentTouches(limit = 50) {
    return this._stmts.getRecentTouches.all({ limit });
  }

  // -----------------------------------------------------------------------
  // Transactional bulk update
  // -----------------------------------------------------------------------

  /**
   * Index a single file atomically: upsert node, replace edges, replace symbols.
   *
   * @param {{ filePath: string, kind?: string, mtime: number,
   *           edges: Array<{ toPath: string, edgeType?: string, line?: number }>,
   *           symbols: Array<{ name: string, kind?: string, isExport?: boolean, line?: number }> }} data
   */
  indexFile(data) {
    const tx = this._db.transaction(() => {
      const node = this.upsertNode({
        filePath: data.filePath,
        kind: data.kind ?? 'module',
        mtime: data.mtime,
      });

      // Edges — resolve target paths to node ids (creating stub nodes if missing)
      const edgeRecords = [];
      for (const edge of data.edges ?? []) {
        let targetNode = this.getNode(edge.toPath);
        if (!targetNode) {
          targetNode = this.upsertNode({ filePath: edge.toPath, kind: 'external', mtime: 0 });
        }
        edgeRecords.push({
          toNodeId: targetNode.id,
          edgeType: edge.edgeType ?? 'import',
          line: edge.line ?? 0,
        });
      }
      this.replaceEdgesFrom(node.id, edgeRecords);

      // Symbols
      this.replaceSymbolsFor(node.id, data.symbols ?? []);

      return node;
    });
    return tx();
  }

  // -----------------------------------------------------------------------
  // Stats / health
  // -----------------------------------------------------------------------

  stats() {
    return {
      nodes: this._stmts.nodeCount.get().count,
      edges: this._stmts.edgeCount.get().count,
      symbols: this._stmts.symbolCount.get().count,
      references: this._stmts.refCount.get().count,
      calls: this._stmts.callCount.get().count,
      embeddings: this._stmts.embeddingCount.get().count,
      sessionTouches: this._stmts.sessionTouchCount.get().count,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  close() {
    this._db.close();
  }
}
