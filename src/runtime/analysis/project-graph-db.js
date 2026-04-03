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

/**
 * Current schema version.  Bump this whenever we ALTER / CREATE new tables
 * and add a corresponding migration block in _runMigrations().
 */
const SCHEMA_VERSION = 1;

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
    scope       TEXT    NOT NULL DEFAULT 'module',
    start_line  INTEGER NOT NULL DEFAULT 0,
    end_line    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS symbol_refs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id             INTEGER NOT NULL,
    name                TEXT    NOT NULL,
    line                INTEGER NOT NULL,
    col                 INTEGER NOT NULL DEFAULT 0,
    ref_kind            TEXT    NOT NULL DEFAULT 'usage',
    resolved_symbol_id  INTEGER,
    FOREIGN KEY (node_id)            REFERENCES nodes(id)   ON DELETE CASCADE,
    FOREIGN KEY (resolved_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS call_edges (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_node_id          INTEGER NOT NULL,
    caller_symbol_name      TEXT    NOT NULL,
    callee_name             TEXT    NOT NULL,
    line                    INTEGER NOT NULL,
    resolved_callee_node_id INTEGER,
    FOREIGN KEY (caller_node_id)          REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_callee_node_id) REFERENCES nodes(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_path      ON nodes(path);
  CREATE INDEX IF NOT EXISTS idx_edges_from      ON edges(from_node);
  CREATE INDEX IF NOT EXISTS idx_edges_to        ON edges(to_node);
  CREATE INDEX IF NOT EXISTS idx_symbols_node    ON symbols(node_id);
  CREATE INDEX IF NOT EXISTS idx_symbols_name    ON symbols(name);
  CREATE INDEX IF NOT EXISTS idx_refs_node       ON symbol_refs(node_id);
  CREATE INDEX IF NOT EXISTS idx_refs_name       ON symbol_refs(name);
  CREATE INDEX IF NOT EXISTS idx_refs_resolved   ON symbol_refs(resolved_symbol_id);
  CREATE INDEX IF NOT EXISTS idx_call_caller     ON call_edges(caller_node_id);
  CREATE INDEX IF NOT EXISTS idx_call_callee     ON call_edges(callee_name);
`;

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
    this._runMigrations();
    this._prepareStatements();
  }

  // -----------------------------------------------------------------------
  // Schema migration — idempotent, version-tracked via PRAGMA user_version
  // -----------------------------------------------------------------------

  _runMigrations() {
    const currentVersion = this._db.pragma('user_version', { simple: true });

    if (currentVersion === 0) {
      // Fresh database — apply full schema and set version.
      this._db.exec(SCHEMA_SQL);
      this._db.pragma(`user_version = ${SCHEMA_VERSION}`);
      return;
    }

    // Future migration blocks go here, guarded by `if (currentVersion < N)`.
    // Example for version 2:
    //   if (currentVersion < 2) {
    //     this._db.exec('ALTER TABLE ...');
    //     this._db.pragma('user_version = 2');
    //   }
  }

  // -----------------------------------------------------------------------
  // Prepared statements
  // -----------------------------------------------------------------------

  _prepareStatements() {
    this._stmts = {
      // -- nodes --
      upsertNode: this._db.prepare(
        `INSERT INTO nodes (path, kind, mtime) VALUES (@path, @kind, @mtime)
         ON CONFLICT(path) DO UPDATE SET kind = @kind, mtime = @mtime`
      ),
      getNode: this._db.prepare('SELECT * FROM nodes WHERE path = @path'),
      getNodeById: this._db.prepare('SELECT * FROM nodes WHERE id = @id'),
      deleteNode: this._db.prepare('DELETE FROM nodes WHERE id = @id'),
      allNodes: this._db.prepare('SELECT * FROM nodes ORDER BY path'),
      nodeCount: this._db.prepare('SELECT COUNT(*) as count FROM nodes'),

      // -- edges --
      deleteEdgesFrom: this._db.prepare('DELETE FROM edges WHERE from_node = @nodeId'),
      insertEdge: this._db.prepare(
        'INSERT INTO edges (from_node, to_node, edge_type, line) VALUES (@fromNode, @toNode, @edgeType, @line)'
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
      edgeCount: this._db.prepare('SELECT COUNT(*) as count FROM edges'),

      // -- symbols (enriched: signature, doc_comment, scope, start/end line) --
      deleteSymbolsFor: this._db.prepare('DELETE FROM symbols WHERE node_id = @nodeId'),
      insertSymbol: this._db.prepare(
        `INSERT INTO symbols (node_id, name, kind, is_export, line, signature, doc_comment, scope, start_line, end_line)
         VALUES (@nodeId, @name, @kind, @isExport, @line, @signature, @docComment, @scope, @startLine, @endLine)`
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
      symbolCount: this._db.prepare('SELECT COUNT(*) as count FROM symbols'),

      // -- symbol_refs --
      deleteRefsFor: this._db.prepare('DELETE FROM symbol_refs WHERE node_id = @nodeId'),
      insertRef: this._db.prepare(
        `INSERT INTO symbol_refs (node_id, name, line, col, ref_kind, resolved_symbol_id)
         VALUES (@nodeId, @name, @line, @col, @refKind, @resolvedSymbolId)`
      ),
      getRefsByNode: this._db.prepare(
        'SELECT * FROM symbol_refs WHERE node_id = @nodeId ORDER BY line, col'
      ),
      getRefsByName: this._db.prepare(
        `SELECT r.*, n.path
         FROM symbol_refs r
         JOIN nodes n ON n.id = r.node_id
         WHERE r.name = @name`
      ),
      refCount: this._db.prepare('SELECT COUNT(*) as count FROM symbol_refs'),

      // -- call_edges --
      deleteCallEdgesFor: this._db.prepare('DELETE FROM call_edges WHERE caller_node_id = @nodeId'),
      insertCallEdge: this._db.prepare(
        `INSERT INTO call_edges (caller_node_id, caller_symbol_name, callee_name, line, resolved_callee_node_id)
         VALUES (@callerNodeId, @callerSymbolName, @calleeName, @line, @resolvedCalleeNodeId)`
      ),
      getCallEdgesByCaller: this._db.prepare(
        `SELECT ce.*, n.path as caller_path
         FROM call_edges ce
         JOIN nodes n ON n.id = ce.caller_node_id
         WHERE ce.caller_node_id = @nodeId`
      ),
      getCallEdgesByCallee: this._db.prepare(
        `SELECT ce.*, n.path as caller_path
         FROM call_edges ce
         JOIN nodes n ON n.id = ce.caller_node_id
         WHERE ce.callee_name = @calleeName`
      ),
      callEdgeCount: this._db.prepare('SELECT COUNT(*) as count FROM call_edges'),
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
          scope: sym.scope ?? 'module',
          startLine: sym.startLine ?? sym.line ?? 0,
          endLine: sym.endLine ?? sym.line ?? 0,
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

  // -----------------------------------------------------------------------
  // Symbol references
  // -----------------------------------------------------------------------

  replaceRefsFor(nodeId, refs) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteRefsFor.run({ nodeId });
      for (const ref of refs) {
        this._stmts.insertRef.run({
          nodeId,
          name: ref.name,
          line: ref.line ?? 0,
          col: ref.col ?? 0,
          refKind: ref.refKind ?? 'usage',
          resolvedSymbolId: ref.resolvedSymbolId ?? null,
        });
      }
    });
    tx();
  }

  getRefsByNode(nodeId) {
    return this._stmts.getRefsByNode.all({ nodeId });
  }

  getRefsByName(name) {
    return this._stmts.getRefsByName.all({ name });
  }

  // -----------------------------------------------------------------------
  // Call edges
  // -----------------------------------------------------------------------

  replaceCallEdgesFor(nodeId, callEdges) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteCallEdgesFor.run({ nodeId });
      for (const ce of callEdges) {
        this._stmts.insertCallEdge.run({
          callerNodeId: nodeId,
          callerSymbolName: ce.callerSymbolName ?? '<module>',
          calleeName: ce.calleeName,
          line: ce.line ?? 0,
          resolvedCalleeNodeId: ce.resolvedCalleeNodeId ?? null,
        });
      }
    });
    tx();
  }

  getCallEdgesByCaller(nodeId) {
    return this._stmts.getCallEdgesByCaller.all({ nodeId });
  }

  getCallEdgesByCallee(calleeName) {
    return this._stmts.getCallEdgesByCallee.all({ calleeName });
  }

  // -----------------------------------------------------------------------
  // Transactional bulk update
  // -----------------------------------------------------------------------

  /**
   * Index a single file atomically: upsert node, replace edges, replace symbols,
   * replace references, replace call edges.
   *
   * @param {{ filePath: string, kind?: string, mtime: number,
   *           edges: Array<{ toPath: string, edgeType?: string, line?: number }>,
   *           symbols: Array<{ name: string, kind?: string, isExport?: boolean, line?: number,
   *                            signature?: string, docComment?: string, scope?: string,
   *                            startLine?: number, endLine?: number }>,
   *           refs?: Array<{ name: string, line?: number, col?: number, refKind?: string }>,
   *           callEdges?: Array<{ callerSymbolName?: string, calleeName: string, line?: number }> }} data
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

      // References
      if (data.refs) {
        this.replaceRefsFor(node.id, data.refs);
      }

      // Call edges
      if (data.callEdges) {
        this.replaceCallEdgesFor(node.id, data.callEdges);
      }

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
      refs: this._stmts.refCount.get().count,
      callEdges: this._stmts.callEdgeCount.get().count,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  close() {
    this._db.close();
  }
}
