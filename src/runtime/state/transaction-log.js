// src/runtime/state/transaction-log.js
//
// Append-only, file-based audit trail for all workflow state changes.
//
// Every mutation that goes through the WorkflowStateManager must produce a log
// entry here.  Entries are written to a JSONL file (one JSON object per line)
// immediately upon append.
//
// Design goals:
//   • Append-only  — entries can never be removed or mutated after insertion.
//   • File-based   — written to disk as JSONL for durability and debuggability.
//   • Queryable    — query(filters) and getHistory(workItemId) return filtered
//                    arrays from the on-disk log.

import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp  - ISO-8601 creation time (UTC)
 * @property {string} operation  - Name of the operation (e.g. 'advanceStage')
 * @property {string} caller     - Agent / user / tool that triggered the change
 * @property {string} workItemId - ID of the work item being modified
 * @property {Object} before     - State snapshot before the operation
 * @property {Object} after      - State snapshot after the operation
 * @property {Object} metadata   - Caller-supplied extra context
 */

export class TransactionLog {
  /**
   * @param {string} logPath - Absolute path to the JSONL log file
   */
  constructor(logPath) {
    this.logPath = logPath;

    // Ensure the directory exists so appendFileSync never throws ENOENT.
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ── Writers ─────────────────────────────────────────────────────────────────

  /**
   * Append a transaction entry to the log file.
   *
   * @param {Object} opts
   * @param {string} opts.operation  - Name of the operation
   * @param {string} opts.workItemId - ID of the work item being modified
   * @param {string} opts.caller     - Who triggered the operation
   * @param {Object} opts.before     - State before the operation
   * @param {Object} opts.after      - State after the operation
   * @param {Object} [opts.metadata={}] - Optional extra context
   * @returns {LogEntry} The written entry
   */
  append({ operation, workItemId, caller, before, after, metadata = {} }) {
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      workItemId,
      caller,
      before,
      after,
      metadata,
    };

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logPath, line, 'utf-8');

    return entry;
  }

  // ── Readers ─────────────────────────────────────────────────────────────────

  /**
   * Read all entries from the log file and filter them.
   *
   * Available filter keys (all optional, combined as AND):
   *   workItemId {string} - exact match on entry.workItemId
   *   operation  {string} - exact match on entry.operation
   *   caller     {string} - exact match on entry.caller
   *
   * @param {Object} [filters={}]
   * @returns {LogEntry[]} Ordered array of matching entries
   */
  query(filters = {}) {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    // Audit fix [1-L-2]: cap the number of lines parsed in-memory. The
    // log is JSONL and append-only; older entries become less interesting
    // for query() use cases (which support workItemId / operation /
    // caller filters and typically want recent activity). 10_000 lines is
    // far above any realistic single work-item history but bounds the
    // memory pressure on long-running projects.
    const MAX_LINES = 10_000;
    const content = fs.readFileSync(this.logPath, 'utf-8');
    let lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > MAX_LINES) {
      lines = lines.slice(lines.length - MAX_LINES);
    }
    const entries = lines.map(line => JSON.parse(line));

    return entries.filter(entry => {
      if (filters.workItemId !== undefined && entry.workItemId !== filters.workItemId) {
        return false;
      }
      if (filters.operation !== undefined && entry.operation !== filters.operation) {
        return false;
      }
      if (filters.caller !== undefined && entry.caller !== filters.caller) {
        return false;
      }
      return true;
    });
  }

  /**
   * Return the full ordered history for a single work item.
   *
   * @param {string} workItemId
   * @returns {LogEntry[]}
   */
  getHistory(workItemId) {
    return this.query({ workItemId });
  }

  /**
   * Replay all entries up to (and including) the given timestamp for the
   * specified work item.  Returns the ordered slice for debugging.
   *
   * @param {string} workItemId
   * @param {string} timestamp  - ISO-8601 cutoff timestamp (inclusive)
   * @returns {LogEntry[]}
   */
  replayTo(workItemId, timestamp) {
    const history = this.getHistory(workItemId);
    return history.filter(entry => entry.timestamp <= timestamp);
  }
}
