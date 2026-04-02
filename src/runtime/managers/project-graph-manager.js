import fs from 'node:fs';
import path from 'node:path';

import { ProjectGraphDb, isBetterSqliteAvailable } from '../analysis/project-graph-db.js';
import { buildFileGraph } from '../analysis/import-graph-builder.js';
import { trackReferences } from '../analysis/reference-tracker.js';
import { buildCallGraph, symbolKey } from '../analysis/call-graph-builder.js';
import { listProjectFiles } from '../tools/shared/project-file-utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = ['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx'];
const DEFAULT_MAX_FILES = 2000;

// ---------------------------------------------------------------------------
// ProjectGraphManager
//
// High-level coordinator that owns a ProjectGraphDb instance, drives the
// import-graph-builder, and exposes query methods for tools.
// ---------------------------------------------------------------------------

export class ProjectGraphManager {
  /**
   * @param {{ projectRoot: string, runtimeRoot?: string, syntaxIndexManager: object, dbPath?: string, mode?: string }} opts
   */
  constructor({ projectRoot, runtimeRoot, syntaxIndexManager, dbPath, mode = 'read-write' }) {
    this.projectRoot = projectRoot;
    this.syntaxIndexManager = syntaxIndexManager;
    this._available = mode !== 'read-only' && isBetterSqliteAvailable();
    this._db = null;
    this._dbPath = dbPath ?? null;
    this._indexingInProgress = false;
    this._lastIndexTime = 0;
    this._indexedFileCount = 0;
    /** @type {((filePath: string) => void) | null} */
    this._onFileIndexed = null;

    if (this._available) {
      try {
        const resolvedDbPath = this._dbPath ?? path.join(
          runtimeRoot ?? projectRoot,
          '.opencode',
          'project-graph.db',
        );
        this._dbPath = resolvedDbPath;
        this._db = new ProjectGraphDb(resolvedDbPath);
      } catch {
        this._available = false;
      }
    }
  }

  /**
   * Register a callback that is invoked (best-effort, non-blocking) after a
   * file is successfully indexed.  Replaces any previously registered callback.
   *
   * @param {(filePath: string) => void} callback
   */
  onFileIndexed(callback) {
    this._onFileIndexed = typeof callback === 'function' ? callback : null;
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  describe() {
    if (!this._available || !this._db) {
      return {
        status: 'unavailable',
        reason: 'better-sqlite3 is not available or failed to initialize',
        dbPath: this._dbPath,
      };
    }

    return {
      status: 'active',
      dbPath: this._dbPath,
      indexingInProgress: this._indexingInProgress,
      lastIndexTime: this._lastIndexTime,
      indexedFileCount: this._indexedFileCount,
      stats: this._db.stats(),
    };
  }

  get available() {
    return this._available && this._db !== null;
  }

  // -----------------------------------------------------------------------
  // Single-file indexing
  // -----------------------------------------------------------------------

  async indexFile(filePath) {
    if (!this.available) {
      return { status: 'unavailable' };
    }

    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);

    // Check mtime — skip if unchanged
    const existingNode = this._db.getNode(absPath);
    if (existingNode) {
      try {
        const stat = fs.statSync(absPath);
        if (stat.mtimeMs === existingNode.mtime) {
          return { status: 'unchanged', filePath: absPath };
        }
      } catch {
        // File may have been deleted — remove from graph
        this._db.deleteNode(absPath);
        return { status: 'deleted', filePath: absPath };
      }
    }

    const graphData = await buildFileGraph({
      syntaxIndexManager: this.syntaxIndexManager,
      filePath: absPath,
      projectRoot: this.projectRoot,
    });

    if (!graphData) {
      return { status: 'parse-failed', filePath: absPath };
    }

    // Convert import edges to the shape expected by indexFile
    const edges = graphData.imports
      .filter((imp) => imp.resolvedPath !== null)
      .map((imp) => ({
        toPath: imp.resolvedPath,
        edgeType: imp.kind,
        line: imp.line,
      }));

    this._db.indexFile({
      filePath: absPath,
      mtime: graphData.mtime,
      edges,
      symbols: graphData.symbols,
    });

    // Phase 3: track references and call graph if we have a parsed tree
    // These require the symbols to be in the DB first, so they run after indexFile.
    try {
      const node = this._db.getNode(absPath);
      if (node) {
        // Build a map of symbol name+line → DB symbol ID for this file
        const dbSymbols = this._db.getSymbolsByNode(node.id);
        const symbolIds = new Map();
        for (const s of dbSymbols) {
          symbolIds.set(`${s.name}:${s.line}:${s.scope ?? ''}`, s.id);
        }

        // Re-read the parsed tree to walk for references and calls
        const parsed = await this.syntaxIndexManager.readFile(absPath);
        if (parsed.status === 'parsed') {
          // Reference tracking
          const refs = trackReferences({
            tree: parsed.tree,
            source: parsed.source,
            filePath: absPath,
            imports: graphData.imports,
            symbols: graphData.symbols,
            db: this._db,
          });
          this._db.replaceRefsForNode(node.id, refs);

          // Call graph building
          const calls = buildCallGraph({
            tree: parsed.tree,
            source: parsed.source,
            filePath: absPath,
            symbols: graphData.symbols,
            imports: graphData.imports,
            db: this._db,
            symbolIds,
          });
          this._db.replaceCallsForNode(node.id, calls);
        }
      }
    } catch {
      // Reference/call tracking is best-effort — do not fail indexing
    }

    this._firePostIndex(absPath);
    return { status: 'indexed', filePath: absPath };
  }

  // Fire post-index callback best-effort (non-blocking, swallows errors)
  _firePostIndex(filePath) {
    if (!this._onFileIndexed) return;
    try {
      // Intentionally not awaited — the callback may be async but we do not
      // want to delay the indexFile return path or propagate errors.
      const result = this._onFileIndexed(filePath);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {}); // swallow async errors
      }
    } catch {
      // swallow synchronous errors
    }
  }

  // -----------------------------------------------------------------------
  // Project-wide indexing
  // -----------------------------------------------------------------------

  async indexProject({ maxFiles = DEFAULT_MAX_FILES } = {}) {
    if (!this.available) {
      return { status: 'unavailable' };
    }

    if (this._indexingInProgress) {
      return { status: 'already-indexing' };
    }

    this._indexingInProgress = true;
    const startTime = Date.now();
    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const files = listProjectFiles(this.projectRoot, {
        extensions: SOURCE_EXTENSIONS,
        maxFiles,
      });

      for (const file of files) {
        try {
          const result = await this.indexFile(file);
          if (result.status === 'indexed') {
            indexed++;
          } else if (result.status === 'unchanged') {
            skipped++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      this._lastIndexTime = Date.now();
      this._indexedFileCount = indexed + skipped;

      return {
        status: 'complete',
        total: files.length,
        indexed,
        skipped,
        failed,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this._indexingInProgress = false;
    }
  }

  // -----------------------------------------------------------------------
  // Query: dependencies of a file
  // -----------------------------------------------------------------------

  getDependencies(filePath, { depth = 1 } = {}) {
    if (!this.available) {
      return { status: 'unavailable', dependencies: [] };
    }

    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);
    const node = this._db.getNode(absPath);
    if (!node) {
      return { status: 'not-indexed', filePath: absPath, dependencies: [] };
    }

    if (depth <= 1) {
      const deps = this._db.getDependencies(node.id);
      return {
        status: 'ok',
        filePath: absPath,
        dependencies: deps.map((d) => ({
          path: this._relativePath(d.path),
          absolutePath: d.path,
          edgeType: d.edge_type,
          line: d.line,
        })),
      };
    }

    // Multi-depth BFS
    const visited = new Set([absPath]);
    const result = [];
    let frontier = [{ nodeId: node.id, fromPath: absPath, depthLevel: 0 }];

    while (frontier.length > 0 && frontier[0].depthLevel < depth) {
      const nextFrontier = [];
      for (const entry of frontier) {
        const deps = this._db.getDependencies(entry.nodeId);
        for (const dep of deps) {
          if (visited.has(dep.path)) continue;
          visited.add(dep.path);
          const targetNode = this._db.getNode(dep.path);
          result.push({
            path: this._relativePath(dep.path),
            absolutePath: dep.path,
            edgeType: dep.edge_type,
            line: dep.line,
            depth: entry.depthLevel + 1,
          });
          if (targetNode) {
            nextFrontier.push({ nodeId: targetNode.id, fromPath: dep.path, depthLevel: entry.depthLevel + 1 });
          }
        }
      }
      frontier = nextFrontier;
    }

    return { status: 'ok', filePath: absPath, dependencies: result };
  }

  // -----------------------------------------------------------------------
  // Query: dependents (reverse dependencies) of a file
  // -----------------------------------------------------------------------

  getDependents(filePath, { depth = 1 } = {}) {
    if (!this.available) {
      return { status: 'unavailable', dependents: [] };
    }

    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);
    const node = this._db.getNode(absPath);
    if (!node) {
      return { status: 'not-indexed', filePath: absPath, dependents: [] };
    }

    if (depth <= 1) {
      const deps = this._db.getDependents(node.id);
      return {
        status: 'ok',
        filePath: absPath,
        dependents: deps.map((d) => ({
          path: this._relativePath(d.path),
          absolutePath: d.path,
          edgeType: d.edge_type,
          line: d.line,
        })),
      };
    }

    // Multi-depth BFS
    const visited = new Set([absPath]);
    const result = [];
    let frontier = [{ nodeId: node.id, depthLevel: 0 }];

    while (frontier.length > 0 && frontier[0].depthLevel < depth) {
      const nextFrontier = [];
      for (const entry of frontier) {
        const deps = this._db.getDependents(entry.nodeId);
        for (const dep of deps) {
          if (visited.has(dep.path)) continue;
          visited.add(dep.path);
          const targetNode = this._db.getNode(dep.path);
          result.push({
            path: this._relativePath(dep.path),
            absolutePath: dep.path,
            edgeType: dep.edge_type,
            line: dep.line,
            depth: entry.depthLevel + 1,
          });
          if (targetNode) {
            nextFrontier.push({ nodeId: targetNode.id, depthLevel: entry.depthLevel + 1 });
          }
        }
      }
      frontier = nextFrontier;
    }

    return { status: 'ok', filePath: absPath, dependents: result };
  }

  // -----------------------------------------------------------------------
  // Query: find symbol by name
  // -----------------------------------------------------------------------

  findSymbol(name) {
    if (!this.available) {
      return { status: 'unavailable', matches: [] };
    }

    const rows = this._db.findSymbolByName(name);
    return {
      status: 'ok',
      name,
      matches: rows.map((row) => ({
        path: this._relativePath(row.path),
        absolutePath: row.path,
        kind: row.kind,
        isExport: row.is_export === 1,
        line: row.line,
        signature: row.signature ?? null,
        docComment: row.doc_comment ?? null,
        scope: row.scope ?? null,
        startLine: row.start_line ?? null,
        endLine: row.end_line ?? null,
      })),
    };
  }

  /**
   * Case-insensitive symbol lookup (fallback for search).
   */
  findSymbolLike(name) {
    if (!this.available) {
      return { status: 'unavailable', matches: [] };
    }

    const rows = this._db.findSymbolByNameLike(name);
    return {
      status: 'ok',
      name,
      matches: rows.map((row) => ({
        path: this._relativePath(row.path),
        absolutePath: row.path,
        kind: row.kind,
        isExport: row.is_export === 1,
        line: row.line,
        signature: row.signature ?? null,
        docComment: row.doc_comment ?? null,
        scope: row.scope ?? null,
        startLine: row.start_line ?? null,
        endLine: row.end_line ?? null,
      })),
    };
  }

  // -----------------------------------------------------------------------
  // Query: references to a symbol
  // -----------------------------------------------------------------------

  findReferences(symbolName) {
    if (!this.available) {
      return { status: 'unavailable', references: [] };
    }

    // First find the symbol(s) by name
    const symbolRows = this._db.findSymbolByName(symbolName);
    if (symbolRows.length === 0) {
      return { status: 'not-found', name: symbolName, references: [] };
    }

    // Collect references for all matching symbols
    const allRefs = [];
    for (const sym of symbolRows) {
      const refs = this._db.getRefsBySymbol(sym.id);
      for (const ref of refs) {
        allRefs.push({
          symbolName: sym.name,
          symbolPath: this._relativePath(sym.path),
          symbolKind: sym.kind,
          referencePath: this._relativePath(ref.path),
          absoluteReferencePath: ref.path,
          line: ref.line,
          col: ref.col,
          kind: ref.kind,
        });
      }
    }

    return {
      status: 'ok',
      name: symbolName,
      definitions: symbolRows.map((s) => ({
        path: this._relativePath(s.path),
        absolutePath: s.path,
        kind: s.kind,
        line: s.line,
        isExport: s.is_export === 1,
      })),
      references: allRefs,
      totalCount: allRefs.length,
    };
  }

  // -----------------------------------------------------------------------
  // Query: call hierarchy (incoming / outgoing)
  // -----------------------------------------------------------------------

  getCallHierarchy(symbolName, { direction = 'outgoing' } = {}) {
    if (!this.available) {
      return { status: 'unavailable', calls: [] };
    }

    if (direction === 'outgoing') {
      // Find symbol, then get all calls from it
      const symbolRows = this._db.findSymbolByName(symbolName);
      const allCalls = [];
      for (const sym of symbolRows) {
        const calls = this._db.getCallsFrom(sym.id);
        for (const call of calls) {
          allCalls.push({
            callerName: symbolName,
            calleeName: call.callee_name,
            calleePath: call.callee_path ? this._relativePath(call.callee_path) : null,
            line: call.line,
          });
        }
      }
      return { status: 'ok', direction, symbolName, calls: allCalls };
    }

    if (direction === 'incoming') {
      // Find all calls TO this symbol name
      const calls = this._db.getCallsTo(symbolName);
      return {
        status: 'ok',
        direction,
        symbolName,
        calls: calls.map((call) => ({
          callerName: call.caller_name,
          callerPath: this._relativePath(call.caller_path),
          line: call.line,
        })),
      };
    }

    return { status: 'error', reason: `Invalid direction: ${direction}` };
  }

  // -----------------------------------------------------------------------
  // Query: graph summary (for runtime interface)
  // -----------------------------------------------------------------------

  getGraphSummary() {
    if (!this.available) {
      return { status: 'unavailable' };
    }

    const stats = this._db.stats();
    return {
      status: 'ok',
      ...stats,
      dbPath: this._dbPath,
      indexingInProgress: this._indexingInProgress,
      lastIndexTime: this._lastIndexTime,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  dispose() {
    if (this._db) {
      try {
        this._db.close();
      } catch {
        // best-effort
      }
      this._db = null;
    }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  _relativePath(absPath) {
    return path.relative(this.projectRoot, absPath);
  }
}
