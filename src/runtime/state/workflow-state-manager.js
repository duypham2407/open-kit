// src/runtime/state/workflow-state-manager.js
//
// WorkflowStateManager — the orchestration layer for all workflow state.
//
// This is the single source of truth for reading and writing workflow state.
// All consumers (MCP tools, CLI commands, agents) must go through this class.
// It coordinates:
//   • state-schema.js  — versioning and migration
//   • transition-engine.js — FSM validation
//   • gate-registry.js — gate requirement enforcement
//   • transaction-log.js  — append-only audit trail
//   • errors.js           — structured error types
//
// State persistence layout:
//   Primary:  <baseDir>/work-items/<workItemId>/state.json
//   Log:      <baseDir>/work-items/<workItemId>/state-transitions.log
//   Mirror:   <baseDir>/workflow-state.json  (compatibility, written after every mutation)

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { migrateState, STATE_VERSION } from './state-schema.js';
import { TransitionEngine } from './transition-engine.js';
import { GateRegistry } from './gate-registry.js';
import { TransactionLog } from './transaction-log.js';
import {
  StateTransitionError,
  GateNotMetError,
  InsufficientAuthorityError,
  StateCorruptionError
} from './errors.js';

// Initial stage for each mode.
const MODE_INITIAL_STAGE = {
  quick: 'quick_intake',
  full: 'full_intake',
  migration: 'migration_intake'
};

export class WorkflowStateManager extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {string} opts.workItemId - Unique identifier for the work item
   * @param {string} opts.baseDir    - Base directory (e.g. the .opencode folder)
   */
  constructor({ workItemId, baseDir } = {}) {
    super();

    if (!workItemId) {
      throw new Error('WorkflowStateManager requires workItemId');
    }
    if (!baseDir) {
      throw new Error('WorkflowStateManager requires baseDir');
    }

    this.workItemId = workItemId;
    this.baseDir = baseDir;

    // Derived paths
    this._itemDir = path.join(baseDir, 'work-items', workItemId);
    this._stateFile = path.join(this._itemDir, 'state.json');
    this._mirrorFile = path.join(baseDir, 'workflow-state.json');
    this._logFile = path.join(this._itemDir, 'state-transitions.log');

    // Phase 1 modules
    this._engine = new TransitionEngine();
    this._gates = new GateRegistry();

    // In-memory state cache (null = not yet loaded)
    this._state = null;
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize state for this work item. If a state file already exists on
   * disk it is loaded (and migrated if legacy). Otherwise a fresh v2.0.0
   * state is created and written to disk.
   *
   * @param {Object} opts
   * @param {string} opts.mode  - Workflow mode: 'quick' | 'full' | 'migration'
   * @param {string} opts.owner - Initial owner (agent name)
   * @returns {Object} The current state
   */
  initialize({ mode, owner } = {}) {
    if (fs.existsSync(this._stateFile)) {
      // Load and (if needed) migrate existing state
      const loaded = this._loadFromDisk();
      this._state = loaded;
      return this._snapshot();
    }

    // Create fresh state
    const now = new Date().toISOString();
    const initialStage = MODE_INITIAL_STAGE[mode];
    if (!initialStage) {
      throw new Error(`Unknown mode: '${mode}'. Must be quick, full, or migration`);
    }

    const state = {
      version: STATE_VERSION,
      mode,
      stage: initialStage,
      owner,
      gates: {},
      gateMeta: {},
      metadata: {
        created_at: now,
        updated_at: now
      }
    };

    this._state = state;
    this._persist();
    return this._snapshot();
  }

  // ── State readers ──────────────────────────────────────────────────────────

  /**
   * Return a defensive copy of the current workflow state. If not yet loaded,
   * reads from disk. Throws if no state file exists.
   *
   * @returns {Object}
   */
  getState() {
    if (!this._state) {
      this._state = this._loadFromDisk();
    }
    return this._snapshot();
  }

  /**
   * Alias for getState(). Returns the current workflow state.
   *
   * @returns {Object}
   */
  getCurrentState() {
    return this.getState();
  }

  /**
   * Load and return state for a specific work item by creating a temporary
   * manager pointed at that work item's state file and reading it.
   *
   * @param {string} workItemId - The work item ID to load state for
   * @returns {Object} The state for that work item
   */
  getWorkItem(workItemId) {
    const stateFile = path.join(this.baseDir, 'work-items', workItemId, 'state.json');
    if (!fs.existsSync(stateFile)) {
      throw new Error(
        `State not found for work item '${workItemId}'. ` +
        'Ensure the work item has been initialized.'
      );
    }

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch (err) {
      throw new StateCorruptionError({
        reason: `Failed to parse state.json for work item '${workItemId}': ${err.message}`,
        state: null
      });
    }

    return migrateState(raw);
  }

  /** @returns {string} Current stage */
  getStage() {
    return this.getState().stage;
  }

  /** @returns {string} Current owner */
  getOwner() {
    return this.getState().owner;
  }

  /** @returns {string} Current mode */
  getMode() {
    return this.getState().mode;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validate whether the current state can transition to `targetStage`.
   * Checks both FSM rules and gate requirements.
   *
   * @param {string} targetStage
   * @returns {{ valid: boolean, reason?: string, missingGates?: Array }}
   */
  validateTransition(targetStage) {
    const state = this.getState();
    const { mode, stage: fromStage } = state;

    // 1. FSM check
    const fsmResult = this._engine.validateTransition(mode, fromStage, targetStage);
    if (!fsmResult.valid) {
      return { valid: false, reason: fsmResult.reason };
    }

    // 2. Gate check (only for forward transitions)
    if (!fsmResult.backward) {
      const gateResult = this._gates.canTransition(state, fromStage, targetStage);
      if (!gateResult.allowed) {
        return {
          valid: false,
          reason: `Required gates not met: ${gateResult.missingGates.map(g => g.gate).join(', ')}`,
          missingGates: gateResult.missingGates
        };
      }
    }

    return { valid: true };
  }

  // ── State writers ──────────────────────────────────────────────────────────

  /**
   * Advance the workflow to `targetStage` with `newOwner`.
   * Validates FSM transition and gate requirements before writing.
   * Persists to disk and writes a transaction log entry on success.
   * On failure, state is not mutated.
   *
   * @param {string} targetStage
   * @param {string} newOwner
   * @param {Object} [metadata={}] - Extra metadata stored in log entry
   * @returns {Object} The updated state
   * @throws {StateTransitionError} if FSM disallows the transition
   * @throws {GateNotMetError} if required gates are not met
   */
  advanceStage(targetStage, newOwner, metadata = {}) {
    const state = this.getState();
    const { mode, stage: fromStage } = state;

    // 1. FSM check
    const fsmResult = this._engine.validateTransition(mode, fromStage, targetStage);
    if (!fsmResult.valid) {
      throw new StateTransitionError({
        currentStage: fromStage,
        targetStage,
        validNextStages: this._engine.getNextStages(mode, fromStage)
      });
    }

    // 2. Gate check for forward transitions
    if (!fsmResult.backward) {
      const gateResult = this._gates.canTransition(state, fromStage, targetStage);
      if (!gateResult.allowed) {
        throw new GateNotMetError({
          currentStage: fromStage,
          targetStage,
          missingGates: gateResult.missingGates
        });
      }
    }

    // 3. Apply mutation (take snapshot of before state for log)
    const before = this._snapshot();
    const now = new Date().toISOString();

    this._state = {
      ...this._state,
      stage: targetStage,
      owner: newOwner,
      metadata: {
        ...this._state.metadata,
        updated_at: now
      }
    };

    // 4. Persist
    this._persist();

    // 5. Log
    const log = this._getLog();
    log.append({
      operation: 'advanceStage',
      workItemId: this.workItemId,
      caller: newOwner,
      before: { stage: before.stage, owner: before.owner },
      after: { stage: targetStage, owner: newOwner },
      metadata
    });

    // 6. Emit event
    this.emit('stage-advanced', { from: fromStage, to: targetStage, owner: newOwner });

    return this._snapshot();
  }

  /**
   * Set the approval status of a gate.
   * Validates gate existence and approver authority before writing.
   * Persists to disk and writes a transaction log entry on success.
   *
   * This is the spec-compliant method. See recordGate() for the legacy alias.
   *
   * @param {string} gateName   - Registered gate id (e.g. 'quick.understanding_confirmed')
   * @param {boolean} approved  - Whether the gate is being approved (true) or revoked (false)
   * @param {string} approver   - Identity of the actor setting the gate
   * @param {Object} [metadata={}] - Extra metadata stored with gate and log
   * @returns {Object} The updated state
   * @throws {Error} if gateName is unknown
   * @throws {InsufficientAuthorityError} if approver lacks authority
   */
  setApproval(gateName, approved, approver, metadata = {}) {
    // Ensure state is loaded
    this.getState();

    // 1. Validate gate exists
    const gateDef = this._gates.getGate(gateName);
    if (!gateDef) {
      throw new Error(`Unknown gate: '${gateName}'`);
    }

    // 2. Validate authority
    if (gateDef.authority !== approver) {
      throw new InsufficientAuthorityError({
        gateName,
        requiredAuthority: gateDef.authority,
        actualCaller: approver
      });
    }

    // 3. Apply mutation
    const before = this._snapshot();
    const now = new Date().toISOString();

    this._state = {
      ...this._state,
      gates: {
        ...this._state.gates,
        [gateName]: approved
      },
      gateMeta: {
        ...this._state.gateMeta,
        [gateName]: {
          approver,
          metAt: now,
          approved,
          ...metadata
        }
      },
      metadata: {
        ...this._state.metadata,
        updated_at: now
      }
    };

    // 4. Persist
    this._persist();

    // 5. Log
    const log = this._getLog();
    log.append({
      operation: 'setApproval',
      workItemId: this.workItemId,
      caller: approver,
      before: { gates: before.gates },
      after: { gates: this._state.gates },
      metadata: { gateName, approved, ...metadata }
    });

    // 6. Emit event
    this.emit('gate-met', { gate: gateName, approver, approved });

    return this._snapshot();
  }

  /**
   * Legacy alias for setApproval(gateName, true, caller, metadata).
   * Kept for backward compatibility with existing tests and code.
   *
   * @param {string} gateName   - Registered gate id
   * @param {string} caller     - Identity of the actor setting the gate
   * @param {Object} [metadata={}] - Extra metadata
   * @returns {Object} The updated state
   */
  recordGate(gateName, caller, metadata = {}) {
    return this.setApproval(gateName, true, caller, metadata);
  }

  /**
   * Add an issue to the workflow state.
   *
   * @param {Object} issue - Issue object (must have at minimum an `id` field)
   * @returns {Object} The updated state
   */
  recordIssue(issue) {
    if (!issue || !issue.id) {
      throw new Error('recordIssue requires an issue object with an id field');
    }

    // Ensure state is loaded
    this.getState();

    const before = this._snapshot();
    const now = new Date().toISOString();

    const issueWithTimestamp = {
      ...issue,
      recordedAt: issue.recordedAt || now,
      resolved: false
    };

    this._state = {
      ...this._state,
      issues: [
        ...(this._state.issues || []),
        issueWithTimestamp
      ],
      metadata: {
        ...this._state.metadata,
        updated_at: now
      }
    };

    // Persist
    this._persist();

    // Log
    const log = this._getLog();
    log.append({
      operation: 'recordIssue',
      workItemId: this.workItemId,
      caller: issue.reporter || 'unknown',
      before: { issues: before.issues || [] },
      after: { issues: this._state.issues },
      metadata: { issueId: issue.id }
    });

    return this._snapshot();
  }

  /**
   * Mark an issue as resolved.
   *
   * @param {string} issueId    - The id of the issue to resolve
   * @param {string} resolution - Description of the resolution
   * @returns {Object} The updated state
   * @throws {Error} if the issue is not found
   */
  resolveIssue(issueId, resolution) {
    // Ensure state is loaded
    this.getState();

    const issues = this._state.issues || [];
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx === -1) {
      throw new Error(`Issue '${issueId}' not found`);
    }

    const before = this._snapshot();
    const now = new Date().toISOString();

    const updatedIssues = issues.map((issue, i) => {
      if (i !== idx) return issue;
      return {
        ...issue,
        resolved: true,
        resolution,
        resolvedAt: now
      };
    });

    this._state = {
      ...this._state,
      issues: updatedIssues,
      metadata: {
        ...this._state.metadata,
        updated_at: now
      }
    };

    // Persist
    this._persist();

    // Log
    const log = this._getLog();
    log.append({
      operation: 'resolveIssue',
      workItemId: this.workItemId,
      caller: 'unknown',
      before: { issues: before.issues },
      after: { issues: this._state.issues },
      metadata: { issueId, resolution }
    });

    return this._snapshot();
  }

  /**
   * Add evidence to the workflow state.
   *
   * @param {Object} evidence - Evidence object to record
   * @returns {Object} The updated state
   */
  recordEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object') {
      throw new Error('recordEvidence requires an evidence object');
    }

    // Ensure state is loaded
    this.getState();

    const before = this._snapshot();
    const now = new Date().toISOString();

    const evidenceWithTimestamp = {
      ...evidence,
      recordedAt: evidence.recordedAt || now
    };

    this._state = {
      ...this._state,
      evidence: [
        ...(this._state.evidence || []),
        evidenceWithTimestamp
      ],
      metadata: {
        ...this._state.metadata,
        updated_at: now
      }
    };

    // Persist
    this._persist();

    // Log
    const log = this._getLog();
    log.append({
      operation: 'recordEvidence',
      workItemId: this.workItemId,
      caller: evidence.caller || 'unknown',
      before: { evidence: before.evidence || [] },
      after: { evidence: this._state.evidence },
      metadata: { evidence }
    });

    return this._snapshot();
  }

  // ── Transaction management ─────────────────────────────────────────────────

  /**
   * Begin a transaction by snapshotting the current state.
   * Subsequent mutations can be rolled back via rollbackTransaction().
   *
   * @throws {Error} if a transaction is already active
   */
  beginTransaction() {
    if (this._txSnapshot !== undefined) {
      throw new Error('Transaction already active. Commit or rollback before beginning a new one.');
    }

    // Ensure state is loaded
    this.getState();

    // Snapshot current in-memory state for potential rollback
    this._txSnapshot = JSON.parse(JSON.stringify(this._state));
  }

  /**
   * Commit the active transaction, clearing the snapshot.
   *
   * @throws {Error} if no transaction is active
   */
  commitTransaction() {
    if (this._txSnapshot === undefined) {
      throw new Error('No active transaction to commit.');
    }

    const log = this._getLog();
    log.append({
      operation: 'commit',
      workItemId: this.workItemId,
      caller: 'transaction-manager',
      before: this._txSnapshot,
      after: this._state,
      metadata: {}
    });

    this._txSnapshot = undefined;
  }

  /**
   * Rollback the active transaction, restoring the pre-transaction snapshot
   * and re-persisting the rolled-back state to disk.
   *
   * @throws {Error} if no transaction is active
   */
  rollbackTransaction() {
    if (this._txSnapshot === undefined) {
      throw new Error('No active transaction to rollback.');
    }

    const rolledBackFrom = JSON.parse(JSON.stringify(this._state));

    // Restore snapshot
    this._state = this._txSnapshot;
    this._txSnapshot = undefined;

    // Re-persist the rolled-back state
    this._persist();

    // Log the rollback
    const log = this._getLog();
    log.append({
      operation: 'rollback',
      workItemId: this.workItemId,
      caller: 'transaction-manager',
      before: rolledBackFrom,
      after: this._state,
      metadata: { reason: 'Transaction rolled back' }
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Load state from disk. Migrates legacy state if needed.
   * Throws StateCorruptionError for malformed JSON or missing required fields.
   *
   * @returns {Object}
   * @private
   */
  _loadFromDisk() {
    if (!fs.existsSync(this._stateFile)) {
      throw new Error(
        `State not initialized for work item '${this.workItemId}'. ` +
        'Call initialize() first or ensure state.json exists.'
      );
    }

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(this._stateFile, 'utf-8'));
    } catch (err) {
      throw new StateCorruptionError({
        reason: `Failed to parse state.json: ${err.message}`,
        state: null
      });
    }

    if (!raw || typeof raw !== 'object') {
      throw new StateCorruptionError({
        reason: 'state.json does not contain a JSON object',
        state: raw
      });
    }

    // Migrate if legacy
    return migrateState(raw);
  }

  /**
   * Persist the current in-memory state to disk (primary + mirror files).
   * Creates directories as needed.
   *
   * @private
   */
  _persist() {
    // Ensure item directory exists
    if (!fs.existsSync(this._itemDir)) {
      fs.mkdirSync(this._itemDir, { recursive: true });
    }

    const serialized = JSON.stringify(this._state, null, 2);
    fs.writeFileSync(this._stateFile, serialized, 'utf-8');

    // Write compatibility mirror
    const mirrorDir = path.dirname(this._mirrorFile);
    if (!fs.existsSync(mirrorDir)) {
      fs.mkdirSync(mirrorDir, { recursive: true });
    }
    fs.writeFileSync(this._mirrorFile, serialized, 'utf-8');
  }

  /**
   * Return (creating once) the TransactionLog for this work item.
   *
   * @returns {TransactionLog}
   * @private
   */
  _getLog() {
    if (!this._log) {
      this._log = new TransactionLog(this._logFile);
    }
    return this._log;
  }

  /**
   * Return a deep-copy snapshot of the current in-memory state so that
   * external callers cannot mutate the manager's internal state.
   *
   * @returns {Object}
   * @private
   */
  _snapshot() {
    return JSON.parse(JSON.stringify(this._state));
  }
}
