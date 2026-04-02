import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// File Watcher — Incremental Index Updates
//
// Watches the project source tree for file changes and triggers single-file
// re-indexing in the ProjectGraphManager.  Uses Node.js fs.watch with a
// debounce to avoid spamming the indexer during rapid-fire saves.
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx']);
const DEFAULT_DEBOUNCE_MS = 300;

export class FileWatcher {
  /**
   * @param {{
   *   projectRoot: string,
   *   projectGraphManager: object,
   *   debounceMs?: number,
   *   watchDirs?: string[],
   * }} opts
   */
  constructor({ projectRoot, projectGraphManager, debounceMs = DEFAULT_DEBOUNCE_MS, watchDirs = null }) {
    this.projectRoot = projectRoot;
    this._manager = projectGraphManager;
    this._debounceMs = debounceMs;
    this._pending = new Map(); // filePath → timeout handle
    this._watchers = [];
    this._active = false;
    this._indexCount = 0;
    this._watchDirs = watchDirs ?? [projectRoot];
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  start() {
    if (this._active) return;
    this._active = true;

    for (const dir of this._watchDirs) {
      try {
        const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const absPath = path.resolve(dir, filename);
          this._onFileChange(absPath);
        });
        this._watchers.push(watcher);
      } catch {
        // Directory may not exist — safe to skip
      }
    }
  }

  stop() {
    this._active = false;
    for (const watcher of this._watchers) {
      try {
        watcher.close();
      } catch {
        // best-effort
      }
    }
    this._watchers = [];

    // Clear pending debounces
    for (const handle of this._pending.values()) {
      clearTimeout(handle);
    }
    this._pending.clear();
  }

  describe() {
    return {
      active: this._active,
      watcherCount: this._watchers.length,
      pendingUpdates: this._pending.size,
      totalIndexed: this._indexCount,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  _onFileChange(filePath) {
    if (!this._active) return;

    // Only index source files
    const ext = path.extname(filePath);
    if (!SOURCE_EXTENSIONS.has(ext)) return;

    // Skip node_modules, .git, etc.
    const rel = path.relative(this.projectRoot, filePath);
    if (rel.startsWith('node_modules') || rel.startsWith('.git') || rel.startsWith('.opencode')) {
      return;
    }

    // Debounce: if there's already a pending re-index for this file, reset the timer
    if (this._pending.has(filePath)) {
      clearTimeout(this._pending.get(filePath));
    }

    const handle = setTimeout(() => {
      this._pending.delete(filePath);
      this._reindexFile(filePath);
    }, this._debounceMs);

    this._pending.set(filePath, handle);
  }

  async _reindexFile(filePath) {
    if (!this._manager?.available) return;

    try {
      await this._manager.indexFile(filePath);
      this._indexCount++;
    } catch {
      // Best-effort — file may have been deleted or be temporarily unreadable
    }
  }
}
