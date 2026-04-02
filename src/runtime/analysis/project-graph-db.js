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
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id   INTEGER NOT NULL,
    name      TEXT    NOT NULL,
    kind      TEXT    NOT NULL DEFAULT 'unknown',
    is_export INTEGER NOT NULL DEFAULT 0,
    line      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_path      ON nodes(path);
  CREATE INDEX IF NOT EXISTS idx_edges_from      ON edges(from_node);
  CREATE INDEX IF NOT EXISTS idx_edges_to        ON edges(to_node);
  CREATE INDEX IF NOT EXISTS idx_symbols_node    ON symbols(node_id);
  CREATE INDEX IF NOT EXISTS idx_symbols_name    ON symbols(name);
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
    this._db.exec(SCHEMA_SQL);
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
        'INSERT INTO symbols (node_id, name, kind, is_export, line) VALUES (@nodeId, @name, @kind, @isExport, @line)'
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
      allNodes: this._db.prepare('SELECT * FROM nodes ORDER BY path'),
      nodeCount: this._db.prepare('SELECT COUNT(*) as count FROM nodes'),
      edgeCount: this._db.prepare('SELECT COUNT(*) as count FROM edges'),
      symbolCount: this._db.prepare('SELECT COUNT(*) as count FROM symbols'),
      deleteNode: this._db.prepare('DELETE FROM nodes WHERE id = @id'),
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
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  close() {
    this._db.close();
  }
}
