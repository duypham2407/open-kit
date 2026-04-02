import fs from 'node:fs';
import path from 'node:path';

import { ProjectGraphDb, isBetterSqliteAvailable } from '../analysis/project-graph-db.js';
import { buildFileGraph } from '../analysis/import-graph-builder.js';
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

    return { status: 'indexed', filePath: absPath };
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
      })),
    };
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
