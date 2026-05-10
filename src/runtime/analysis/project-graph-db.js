import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { SchemaManager } from './schema-migrations.js';

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
    callee_symbol_id  INTEGER DEFAULT NULL,
    line              INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (caller_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (callee_node_id)   REFERENCES nodes(id)   ON DELETE CASCADE,
    FOREIGN KEY (callee_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
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
    chunk_text TEXT   DEFAULT NULL,
    embedding BLOB    NOT NULL,
    model     TEXT    NOT NULL,
    created   REAL    NOT NULL,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
    chunk_text,
    content='embeddings',
    content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS embeddings_ai AFTER INSERT ON embeddings BEGIN
    INSERT INTO embeddings_fts(rowid, chunk_text) VALUES (new.id, COALESCE(new.chunk_text, ''));
  END;

  CREATE TRIGGER IF NOT EXISTS embeddings_ad AFTER DELETE ON embeddings BEGIN
    INSERT INTO embeddings_fts(embeddings_fts, rowid, chunk_text) VALUES('delete', old.id, COALESCE(old.chunk_text, ''));
  END;

  CREATE TRIGGER IF NOT EXISTS embeddings_au AFTER UPDATE ON embeddings BEGIN
    INSERT INTO embeddings_fts(embeddings_fts, rowid, chunk_text) VALUES('delete', old.id, COALESCE(old.chunk_text, ''));
    INSERT INTO embeddings_fts(rowid, chunk_text) VALUES (new.id, COALESCE(new.chunk_text, ''));
  END;

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
    'ALTER TABLE embeddings ADD COLUMN chunk_text TEXT DEFAULT NULL',
    'ALTER TABLE call_graph ADD COLUMN callee_symbol_id INTEGER DEFAULT NULL',
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
        chunk_text,
        content='embeddings',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS embeddings_ai AFTER INSERT ON embeddings BEGIN
        INSERT INTO embeddings_fts(rowid, chunk_text) VALUES (new.id, COALESCE(new.chunk_text, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS embeddings_ad AFTER DELETE ON embeddings BEGIN
        INSERT INTO embeddings_fts(embeddings_fts, rowid, chunk_text) VALUES('delete', old.id, COALESCE(old.chunk_text, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS embeddings_au AFTER UPDATE ON embeddings BEGIN
        INSERT INTO embeddings_fts(embeddings_fts, rowid, chunk_text) VALUES('delete', old.id, COALESCE(old.chunk_text, ''));
        INSERT INTO embeddings_fts(rowid, chunk_text) VALUES (new.id, COALESCE(new.chunk_text, ''));
      END;
    `);
  } catch {
    // best-effort: SQLite build may not expose FTS5
  }
}

// ---------------------------------------------------------------------------
// L1 (Structural) schema extensions — managed via SchemaManager so that new
// columns can be added safely on top of the base schema and the legacy
// `migrateSchema` ALTER TABLE list.  Each migration is applied at most once,
// tracked by version in the `schema_version` table.
//
// Note: `signature`, `scope`, `start_line`, `end_line` (added by the legacy
// migration above) are intentionally NOT re-added here.  L1 introduces new
// columns alongside them.
// ---------------------------------------------------------------------------

// L1_MIGRATIONS uses a local versioning sequence starting at 1.
// Downstream tasks (1.3, 1.4, 2.x, 3.x) should continue with versions 3, 4, 5...
// This is tracked independently in the schema_version table via SchemaManager.
const L1_MIGRATIONS = [
  {
    version: 1,
    name: 'add_l1_node_extensions',
    up: (db) => {
      db.exec(`
        ALTER TABLE nodes ADD COLUMN module_type   TEXT;
        ALTER TABLE nodes ADD COLUMN package_name  TEXT;
        ALTER TABLE nodes ADD COLUMN is_test       INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE nodes ADD COLUMN is_config     INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    version: 2,
    name: 'add_l1_symbol_extensions',
    up: (db) => {
      db.exec(`
        ALTER TABLE symbols ADD COLUMN return_type      TEXT;
        ALTER TABLE symbols ADD COLUMN params_json      TEXT;
        ALTER TABLE symbols ADD COLUMN decorators_json  TEXT;
        ALTER TABLE symbols ADD COLUMN parent_symbol_id INTEGER;
        ALTER TABLE symbols ADD COLUMN scope_chain      TEXT;
        ALTER TABLE symbols ADD COLUMN start_col        INTEGER;
        ALTER TABLE symbols ADD COLUMN end_col          INTEGER;

        CREATE INDEX IF NOT EXISTS idx_symbols_parent ON symbols(parent_symbol_id);
      `);
    },
  },
  {
    version: 3,
    name: 'create_type_flows_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS type_flows (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          from_symbol_id  INTEGER NOT NULL,
          to_symbol_id    INTEGER NOT NULL,
          flow_type       TEXT    NOT NULL,
          node_id         INTEGER NOT NULL,
          line            INTEGER NOT NULL,
          confidence      REAL    DEFAULT 1.0,
          FOREIGN KEY (from_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
          FOREIGN KEY (to_symbol_id)   REFERENCES symbols(id) ON DELETE CASCADE,
          FOREIGN KEY (node_id)        REFERENCES nodes(id)   ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_type_flows_from ON type_flows(from_symbol_id);
        CREATE INDEX IF NOT EXISTS idx_type_flows_to   ON type_flows(to_symbol_id);
      `);
    },
  },
  {
    version: 4,
    name: 'create_scope_contexts_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scope_contexts (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          node_id         INTEGER NOT NULL,
          scope_type      TEXT    NOT NULL,
          parent_scope_id INTEGER,
          start_line      INTEGER NOT NULL,
          end_line        INTEGER NOT NULL,
          bindings_json   TEXT,
          FOREIGN KEY (node_id)         REFERENCES nodes(id)          ON DELETE CASCADE,
          FOREIGN KEY (parent_scope_id) REFERENCES scope_contexts(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_scope_contexts_node   ON scope_contexts(node_id);
        CREATE INDEX IF NOT EXISTS idx_scope_contexts_parent ON scope_contexts(parent_scope_id);
      `);
    },
  },
  {
    version: 6,
    name: 'create_code_patterns_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS code_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_type TEXT NOT NULL,
          primary_symbol_id INTEGER NOT NULL,
          related_symbols_json TEXT,
          node_id INTEGER NOT NULL,
          example_code TEXT,
          frequency INTEGER DEFAULT 1,
          confidence REAL DEFAULT 1.0,
          FOREIGN KEY (primary_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
          FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_code_patterns_type ON code_patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_code_patterns_symbol ON code_patterns(primary_symbol_id);
      `);
    },
  },
];

function applyL1Migrations(db) {
  const manager = new SchemaManager(db);
  manager.migrate(L1_MIGRATIONS);
}

// ---------------------------------------------------------------------------
// ProjectGraphDb
// ---------------------------------------------------------------------------

export class ProjectGraphDb {
  /**
   * @param {string|{ dbPath: string, readonly?: boolean }} dbPathOrOptions
   *   Either an absolute path to the SQLite database file (use ':memory:' for
   *   testing) or an options object with `dbPath` and optional `readonly`.
   * @param {{ readonly?: boolean }} [options]
   */
  constructor(dbPathOrOptions, { readonly = false } = {}) {
    let dbPath;
    if (typeof dbPathOrOptions === 'object' && dbPathOrOptions !== null) {
      dbPath = dbPathOrOptions.dbPath;
      if (typeof dbPathOrOptions.readonly === 'boolean') {
        readonly = dbPathOrOptions.readonly;
      }
    } else {
      dbPath = dbPathOrOptions;
    }

    const Db = loadDatabase();
    this._readonly = readonly;

    if (readonly && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      // Read-only mode with existing DB: open without schema writes.
      this._db = new Db(dbPath, { readonly: true, fileMustExist: true });
    } else if (readonly) {
      // Read-only mode must not create directories or write project/workspace files.
      // Fall back to an in-memory schema so queries remain available.
      this._db = new Db(':memory:');
      this._db.exec(SCHEMA_SQL);
      migrateSchema(this._db);
      applyL1Migrations(this._db);
    } else {
      // Read-write mode, or read-only mode where DB does not exist yet.
      // In the latter case we create the schema so the DB is queryable
      // (returning empty results) and mark it readonly afterwards.
      if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }
      this._db = new Db(dbPath);
      this._db.pragma('journal_mode = WAL');
      this._db.exec(SCHEMA_SQL);
      migrateSchema(this._db);
      applyL1Migrations(this._db);
    }

    this._db.pragma('foreign_keys = ON');
    this._prepareStatements();
  }

  // -----------------------------------------------------------------------
  // Prepared statements
  // -----------------------------------------------------------------------

  _prepareStatements() {
    this._stmts = {
      upsertNode: this._db.prepare(
        `INSERT INTO nodes (path, kind, mtime, module_type, package_name, is_test, is_config)
         VALUES (@path, @kind, @mtime, @module_type, @package_name, @is_test, @is_config)
         ON CONFLICT(path) DO UPDATE SET
           kind         = @kind,
           mtime        = @mtime,
           module_type  = @module_type,
           package_name = @package_name,
           is_test      = @is_test,
           is_config    = @is_config`
      ),
      getNode: this._db.prepare('SELECT * FROM nodes WHERE path = @path'),
      getNodeById: this._db.prepare('SELECT * FROM nodes WHERE id = @id'),
      deleteEdgesFrom: this._db.prepare('DELETE FROM edges WHERE from_node = @nodeId'),
      deleteSymbolsFor: this._db.prepare('DELETE FROM symbols WHERE node_id = @nodeId'),
      insertEdge: this._db.prepare(
        'INSERT INTO edges (from_node, to_node, edge_type, line) VALUES (@fromNode, @toNode, @edgeType, @line)'
      ),
      insertSymbol: this._db.prepare(
        `INSERT INTO symbols (
           node_id, name, kind, is_export, line,
           signature, doc_comment, scope, start_line, end_line,
           return_type, params_json, decorators_json,
           parent_symbol_id, scope_chain, start_col, end_col
         ) VALUES (
           @nodeId, @name, @kind, @isExport, @line,
           @signature, @docComment, @scope, @startLine, @endLine,
           @returnType, @paramsJson, @decoratorsJson,
           @parentSymbolId, @scopeChain, @startCol, @endCol
         )`
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
      getSymbolById: this._db.prepare('SELECT * FROM symbols WHERE id = @id'),
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
        `INSERT INTO call_graph (caller_symbol_id, callee_name, callee_node_id, callee_symbol_id, line)
         VALUES (@callerSymbolId, @calleeName, @calleeNodeId, @calleeSymbolId, @line)`
      ),
      getCallsFrom: this._db.prepare(
        `SELECT cg.*, s.name AS caller_name, n.path AS callee_path, cs.name AS callee_symbol_name
         FROM call_graph cg
         JOIN symbols s ON s.id = cg.caller_symbol_id
         LEFT JOIN nodes n ON n.id = cg.callee_node_id
         LEFT JOIN symbols cs ON cs.id = cg.callee_symbol_id
         WHERE cg.caller_symbol_id = @symbolId
         ORDER BY cg.line`
      ),
      getCallsTo: this._db.prepare(
        `SELECT cg.*, s.name AS caller_name, sn.path AS caller_path, cs.name AS callee_symbol_name
         FROM call_graph cg
         JOIN symbols s ON s.id = cg.caller_symbol_id
         JOIN nodes sn ON sn.id = s.node_id
         LEFT JOIN symbols cs ON cs.id = cg.callee_symbol_id
         WHERE cg.callee_name = @calleeName
         ORDER BY sn.path, cg.line`
      ),
      callCount: this._db.prepare('SELECT COUNT(*) as count FROM call_graph'),

      // -- embeddings --
      deleteEmbeddingsForNode: this._db.prepare('DELETE FROM embeddings WHERE node_id = @nodeId'),
      insertEmbedding: this._db.prepare(
        `INSERT INTO embeddings (node_id, chunk_id, chunk_hash, metadata_json, chunk_text, embedding, model, created)
         VALUES (@nodeId, @chunkId, @chunkHash, @metadataJson, @chunkText, @embedding, @model, @created)`
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
      searchEmbeddingsFallback: this._db.prepare(
        `SELECT e.*, n.path
         FROM embeddings e
         JOIN nodes n ON n.id = e.node_id
         WHERE LOWER(e.chunk_text) LIKE LOWER(@pattern)
         ORDER BY e.created DESC
         LIMIT @limit`
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

      // -- type_flows (L1: data flow between symbols) --
      insertTypeFlow: this._db.prepare(
        `INSERT INTO type_flows (from_symbol_id, to_symbol_id, flow_type, node_id, line, confidence)
         VALUES (@from_symbol_id, @to_symbol_id, @flow_type, @node_id, @line, @confidence)`
      ),
      getTypeFlowsBySymbol: this._db.prepare(
        `SELECT * FROM type_flows
         WHERE from_symbol_id = @symbolId OR to_symbol_id = @symbolId
         ORDER BY line`
      ),

      // -- scope_contexts (L1: lexical scope hierarchy and bindings) --
      insertScopeContext: this._db.prepare(
        `INSERT INTO scope_contexts (node_id, scope_type, parent_scope_id, start_line, end_line, bindings_json)
         VALUES (@node_id, @scope_type, @parent_scope_id, @start_line, @end_line, @bindings_json)`
      ),
      getScopeContextsByNode: this._db.prepare(
        `SELECT * FROM scope_contexts WHERE node_id = @nodeId ORDER BY start_line`
      ),

      // -- code_patterns (L2: recognized patterns from static analysis) --
      insertCodePattern: this._db.prepare(
        `INSERT INTO code_patterns (
           pattern_type, primary_symbol_id, related_symbols_json, node_id,
           example_code, frequency, confidence
         ) VALUES (
           @pattern_type, @primary_symbol_id, @related_symbols_json, @node_id,
           @example_code, @frequency, @confidence
         )`
      ),
      getCodePatternsByType: this._db.prepare(
        `SELECT * FROM code_patterns WHERE pattern_type = ?`
      ),
      getCodePatternsBySymbol: this._db.prepare(
        `SELECT * FROM code_patterns WHERE primary_symbol_id = ?`
      ),
    };

    try {
      this._stmts.searchEmbeddingsFts = this._db.prepare(
        `SELECT e.*, n.path, bm25(embeddings_fts) AS rank
         FROM embeddings_fts
         JOIN embeddings e ON e.id = embeddings_fts.rowid
         JOIN nodes n ON n.id = e.node_id
         WHERE embeddings_fts MATCH @query
         ORDER BY rank
         LIMIT @limit`
      );
    } catch {
      this._stmts.searchEmbeddingsFts = null;
    }
  }

  // -----------------------------------------------------------------------
  // Node operations
  // -----------------------------------------------------------------------

  upsertNode({
    filePath,
    kind = 'module',
    mtime = 0,
    moduleType = null,
    packageName = null,
    isTest = false,
    isConfig = false,
  }) {
    this._stmts.upsertNode.run({
      path: filePath,
      kind,
      mtime,
      module_type: moduleType,
      package_name: packageName,
      is_test: isTest ? 1 : 0,
      is_config: isConfig ? 1 : 0,
    });
    return this._stmts.getNode.get({ path: filePath });
  }

  /**
   * Thin wrapper around upsertNode that accepts the downstream `path` field
   * convention (rather than `filePath`) and returns the rowid as a number.
   * Downstream tasks (1.3, 1.4, 2.x, 3.x) call this method.
   *
   * @param {{ path: string, kind?: string, mtime?: number, moduleType?: string|null,
   *           packageName?: string|null, isTest?: boolean, isConfig?: boolean }} params
   * @returns {number} The rowid of the inserted/updated node row.
   */
  insertNode(params) {
    const { path: nodePath, ...rest } = params;
    const row = this.upsertNode({ filePath: nodePath, ...rest });
    return row.id;
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
          returnType: sym.returnType ?? null,
          paramsJson: sym.paramsJson ?? null,
          decoratorsJson: sym.decoratorsJson ?? null,
          parentSymbolId: sym.parentSymbolId ?? null,
          scopeChain: sym.scopeChain ?? null,
          startCol: sym.startCol ?? null,
          endCol: sym.endCol ?? null,
        });
      }
    });
    tx();
  }

  getSymbolsByNode(nodeId) {
    return this._stmts.getSymbolsByNode.all({ nodeId });
  }

  /**
   * Alias for getSymbolsByNode for downstream task compatibility.
   * @param {number} nodeId
   * @returns {Array}
   */
  getSymbols(nodeId) {
    return this.getSymbolsByNode(nodeId);
  }

  /**
   * Fetch a single symbol row by its rowid.
   * @param {number} symbolId
   * @returns {object|null}
   */
  getSymbol(symbolId) {
    return this._stmts.getSymbolById.get({ id: symbolId }) ?? null;
  }

  /**
   * Insert a single symbol additively (does NOT delete existing symbols for
   * the node) and return its rowid as a number. Downstream tasks (1.3, 1.4,
   * 2.x, 3.x) rely on this method to build symbol-to-symbol relationships
   * (type flow, call graph, parent hierarchy) where each returned rowid must
   * remain stable for use as a foreign key.
   *
   * @param {{ nodeId: number, name: string, kind?: string, isExport?: boolean,
   *           line?: number, signature?: string|null, docComment?: string|null,
   *           scope?: string|null, startLine?: number|null, endLine?: number|null,
   *           returnType?: string|null, paramsJson?: string|null,
   *           decoratorsJson?: string|null, parentSymbolId?: number|null,
   *           scopeChain?: string|null, startCol?: number|null,
   *           endCol?: number|null }} params
   * @returns {number} The rowid of the inserted symbol row.
   */
  insertSymbol(params) {
    const result = this._stmts.insertSymbol.run({
      nodeId: params.nodeId,
      name: params.name,
      kind: params.kind ?? 'unknown',
      isExport: params.isExport ? 1 : 0,
      line: params.line ?? 0,
      signature: params.signature ?? null,
      docComment: params.docComment ?? null,
      scope: params.scope ?? null,
      startLine: params.startLine ?? null,
      endLine: params.endLine ?? null,
      returnType: params.returnType ?? null,
      paramsJson: params.paramsJson ?? null,
      decoratorsJson: params.decoratorsJson ?? null,
      parentSymbolId: params.parentSymbolId ?? null,
      scopeChain: params.scopeChain ?? null,
      startCol: params.startCol ?? null,
      endCol: params.endCol ?? null,
    });
    return Number(result.lastInsertRowid);
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
   * @param {Array<{ callerSymbolId: number, calleeName: string, calleeNodeId?: number, calleeSymbolId?: number, line: number }>} calls
   */
  replaceCallsForNode(nodeId, calls) {
    const tx = this._db.transaction(() => {
      this._stmts.deleteCallsForCaller.run({ nodeId });
      for (const call of calls) {
        this._stmts.insertCall.run({
          callerSymbolId: call.callerSymbolId,
          calleeName: call.calleeName,
          calleeNodeId: call.calleeNodeId ?? null,
          calleeSymbolId: call.calleeSymbolId ?? null,
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
  // Type flow operations (L1: data flow between symbols)
  // -----------------------------------------------------------------------

  /**
   * Insert a single type-flow edge between two symbols and return its rowid.
   * A flow records that data moves from `fromSymbolId` to `toSymbolId` via
   * the given `flowType` (e.g. 'assignment', 'parameter', 'return',
   * 'property_access') at a specific source location.
   *
   * @param {{ fromSymbolId: number, toSymbolId: number, flowType: string,
   *           nodeId: number, line: number, confidence?: number }} params
   * @returns {number} The rowid of the inserted type_flows row.
   */
  insertTypeFlow({ fromSymbolId, toSymbolId, flowType, nodeId, line, confidence = 1.0 }) {
    const result = this._stmts.insertTypeFlow.run({
      from_symbol_id: fromSymbolId,
      to_symbol_id: toSymbolId,
      flow_type: flowType,
      node_id: nodeId,
      line,
      confidence,
    });
    return Number(result.lastInsertRowid);
  }

  /**
   * Fetch type-flow edges touching a given symbol. Provide either
   * `fromSymbolId` or `toSymbolId` (or both — they are OR'd together so the
   * caller can ask for "all flows involving this symbol" by passing either).
   * Returns an empty array when neither id is supplied.
   *
   * @param {{ fromSymbolId?: number|null, toSymbolId?: number|null }} params
   * @returns {Array<object>}
   */
  getTypeFlows({ fromSymbolId = null, toSymbolId = null } = {}) {
    const hasFrom = fromSymbolId !== null && fromSymbolId !== undefined;
    const hasTo = toSymbolId !== null && toSymbolId !== undefined;

    // When both ids are supplied, union the per-symbol result sets and
    // deduplicate by row id (a single flow row can match both lookups when
    // it touches both symbols).
    if (hasFrom && hasTo) {
      const fromFlows = this._stmts.getTypeFlowsBySymbol.all({ symbolId: fromSymbolId });
      const toFlows = this._stmts.getTypeFlowsBySymbol.all({ symbolId: toSymbolId });
      const seen = new Set();
      const merged = [];
      for (const flow of fromFlows) {
        if (!seen.has(flow.id)) {
          seen.add(flow.id);
          merged.push(flow);
        }
      }
      for (const flow of toFlows) {
        if (!seen.has(flow.id)) {
          seen.add(flow.id);
          merged.push(flow);
        }
      }
      return merged;
    }

    if (hasFrom) {
      return this._stmts.getTypeFlowsBySymbol.all({ symbolId: fromSymbolId });
    }
    if (hasTo) {
      return this._stmts.getTypeFlowsBySymbol.all({ symbolId: toSymbolId });
    }
    return [];
  }

  // -----------------------------------------------------------------------
  // Scope context operations (L1: lexical scope hierarchy and bindings)
  // -----------------------------------------------------------------------

  /**
   * Insert a single lexical scope context for a file node and return its
   * rowid. A scope describes a lexical region (module, class, function,
   * block, ...) with optional parent scope and an optional JSON map of
   * variable bindings declared inside it (e.g. `{ a: 'parameter', b: 'let' }`).
   *
   * @param {{ nodeId: number, scopeType: string, parentScopeId?: number|null,
   *           startLine: number, endLine: number,
   *           bindingsJson?: string|null }} params
   * @returns {number} The rowid of the inserted scope_contexts row.
   */
  insertScopeContext({
    nodeId,
    scopeType,
    parentScopeId = null,
    startLine,
    endLine,
    bindingsJson = null,
  }) {
    const result = this._stmts.insertScopeContext.run({
      node_id: nodeId,
      scope_type: scopeType,
      parent_scope_id: parentScopeId,
      start_line: startLine,
      end_line: endLine,
      bindings_json: bindingsJson,
    });
    return Number(result.lastInsertRowid);
  }

  /**
   * Fetch all scope contexts for a given file node, ordered by `start_line`.
   * The ordering yields the natural top-to-bottom scope sequence within a
   * file, which is useful for callers that walk the scope tree to resolve
   * symbol bindings.
   *
   * @param {{ nodeId: number }} params
   * @returns {Array<object>}
   */
  getScopeContexts({ nodeId }) {
    return this._stmts.getScopeContextsByNode.all({ nodeId });
  }

  // -----------------------------------------------------------------------
  // Code pattern operations (L2: recognized patterns from static analysis)
  // -----------------------------------------------------------------------

  /**
   * Insert a single recognized code pattern and return its rowid.
   *
   * Pattern types include `api-usage`, `validation`, `error-handling`,
   * `architectural`, `test-pattern`, etc.  `relatedSymbolsJson` is a free-form
   * JSON string the caller may use to record secondary symbols that
   * participate in the pattern.  `confidence` is a [0..1] score reflecting
   * how confident the detector is that the example demonstrates the pattern.
   *
   * @param {{ patternType: string, primarySymbolId: number,
   *           relatedSymbolsJson?: string|null, nodeId: number,
   *           exampleCode?: string|null, frequency?: number,
   *           confidence?: number }} params
   * @returns {number} The rowid of the inserted code_patterns row.
   */
  insertCodePattern({
    patternType,
    primarySymbolId,
    relatedSymbolsJson = null,
    nodeId,
    exampleCode = null,
    frequency = 1,
    confidence = 1.0,
  }) {
    const result = this._stmts.insertCodePattern.run({
      pattern_type: patternType,
      primary_symbol_id: primarySymbolId,
      related_symbols_json: relatedSymbolsJson,
      node_id: nodeId,
      example_code: exampleCode,
      frequency,
      confidence,
    });
    return Number(result.lastInsertRowid);
  }

  /**
   * Fetch code patterns by either `patternType` or `symbolId`.  Returns an
   * empty array when neither filter is supplied.  When both are supplied,
   * `patternType` takes precedence.
   *
   * @param {{ patternType?: string|null, symbolId?: number|null }} params
   * @returns {Array<object>}
   */
  getCodePatterns({ patternType = null, symbolId = null } = {}) {
    if (patternType) {
      return this._stmts.getCodePatternsByType.all(patternType);
    }
    if (symbolId) {
      return this._stmts.getCodePatternsBySymbol.all(symbolId);
    }
    return [];
  }

  // -----------------------------------------------------------------------
  // Embedding operations
  // -----------------------------------------------------------------------

  /**
   * Replace all embeddings for a given file node.
   * @param {number} nodeId
   * @param {Array<{ chunkId: string, chunkHash?: string|null, metadataJson?: string|null, chunkText?: string|null, embedding: Buffer, model: string }>} chunks
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
          chunkText: chunk.chunkText ?? null,
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

  searchEmbeddingsKeyword(query, limit = 20) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const normalizedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(200, limit)) : 20;

    if (this._stmts.searchEmbeddingsFts) {
      try {
        return this._stmts.searchEmbeddingsFts.all({ query, limit: normalizedLimit });
      } catch {
        // fall through to LIKE fallback for malformed FTS syntax
      }
    }

    return this._stmts.searchEmbeddingsFallback.all({
      pattern: `%${query}%`,
      limit: normalizedLimit,
    });
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
