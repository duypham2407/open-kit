// src/runtime/state/transaction-log.js
//
// Append-only, in-memory audit trail for all workflow state changes.
//
// Every mutation that goes through the WorkflowStateManager must produce a log
// entry here.  The log is the canonical record for debugging, infinite-loop
// detection, and future rollback/replay features.
//
// Design goals:
//   • Append-only  — entries can never be removed or mutated after insertion.
//   • In-memory    — no filesystem dependency; the WorkflowStateManager is
//                    responsible for persisting the state file.  The log lives
//                    for the lifetime of the manager instance.
//   • Queryable    — getHistory(filters?) returns a filtered, order-preserving
//                    copy of the log (not a live reference).

/**
 * @typedef {'transition' | 'gate_change'} EntryType
 *
 * @typedef {Object} LogEntry
 * @property {string}    timestamp  - ISO-8601 creation time (UTC)
 * @property {EntryType} type       - Category of the state change
 * @property {string}    actor      - Agent / user / tool that triggered the change
 * @property {Object}    payload    - Change-specific data (varies by type)
 * @property {Object}    metadata   - Caller-supplied extra context
 */

export class TransactionLog {
  constructor() {
    /** @type {LogEntry[]} */
    this._entries = [];
  }

  // ── Writers ─────────────────────────────────────────────────────────────────

  /**
   * Record a stage transition.
   *
   * @param {string} from      - Stage being left
   * @param {string} to        - Stage being entered
   * @param {string} actor     - Who triggered the transition
   * @param {Object} [metadata={}] - Optional extra context
   * @returns {LogEntry} The appended entry (read-only copy)
   */
  recordTransition(from, to, actor, metadata = {}) {
    return this._append({
      type: 'transition',
      actor,
      payload: { from, to },
      metadata,
    });
  }

  /**
   * Record a gate value change.
   *
   * @param {string}  gateName - Dot-namespaced gate identifier, e.g. 'quick.verified'
   * @param {boolean} newValue - The value the gate was set to
   * @param {string}  actor    - Who set the gate
   * @param {Object}  [metadata={}] - Optional extra context
   * @returns {LogEntry} The appended entry (read-only copy)
   */
  recordGateChange(gateName, newValue, actor, metadata = {}) {
    return this._append({
      type: 'gate_change',
      actor,
      payload: { gateName, newValue },
      metadata,
    });
  }

  // ── Readers ─────────────────────────────────────────────────────────────────

  /**
   * Return a snapshot of the log, optionally filtered.
   *
   * Available filter keys (all optional, combined as AND):
   *   type   {string} - 'transition' | 'gate_change'
   *   actor  {string} - exact match on entry.actor
   *
   * @param {Object} [filters={}]
   * @returns {LogEntry[]} Ordered array of matching entries (shallow copies)
   */
  getHistory(filters = {}) {
    let entries = this._entries;

    if (filters.type !== undefined) {
      entries = entries.filter(e => e.type === filters.type);
    }

    if (filters.actor !== undefined) {
      entries = entries.filter(e => e.actor === filters.actor);
    }

    // Return copies so callers cannot mutate internal state.
    return entries.map(e => ({ ...e, payload: { ...e.payload }, metadata: { ...e.metadata } }));
  }

  /**
   * Total number of entries in the log.
   * @returns {number}
   */
  size() {
    return this._entries.length;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * @private
   * @param {{ type: EntryType, actor: string, payload: Object, metadata: Object }} opts
   * @returns {LogEntry}
   */
  _append({ type, actor, payload, metadata }) {
    const entry = Object.freeze({
      timestamp: new Date().toISOString(),
      type,
      actor,
      payload: Object.freeze({ ...payload }),
      metadata: Object.freeze({ ...metadata }),
    });

    this._entries.push(entry);
    return entry;
  }
}
