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
    this.emit('stageAdvanced', { from: fromStage, to: targetStage, owner: newOwner });

    return this._snapshot();
  }

  /**
   * Record that a gate has been met.
   * Validates gate existence and caller authority before writing.
   * Persists to disk and writes a transaction log entry on success.
   *
   * @param {string} gateName   - Registered gate id (e.g. 'quick.understanding_confirmed')
   * @param {string} caller     - Identity of the actor setting the gate
   * @param {Object} [metadata={}] - Extra metadata stored with gate and log
   * @returns {Object} The updated state
   * @throws {Error} if gateName is unknown
   * @throws {InsufficientAuthorityError} if caller lacks authority
   */
  recordGate(gateName, caller, metadata = {}) {
    // Ensure state is loaded
    this.getState();

    // 1. Validate gate exists
    const gateDef = this._gates.getGate(gateName);
    if (!gateDef) {
      throw new Error(`Unknown gate: '${gateName}'`);
    }

    // 2. Validate authority
    if (gateDef.authority !== caller) {
      throw new InsufficientAuthorityError({
        gateName,
        requiredAuthority: gateDef.authority,
        actualCaller: caller
      });
    }

    // 3. Apply mutation
    const before = this._snapshot();
    const now = new Date().toISOString();

    this._state = {
      ...this._state,
      gates: {
        ...this._state.gates,
        [gateName]: true
      },
      gateMeta: {
        ...this._state.gateMeta,
        [gateName]: {
          approver: caller,
          metAt: now,
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
      operation: 'recordGate',
      workItemId: this.workItemId,
      caller,
      before: { gates: before.gates },
      after: { gates: this._state.gates },
      metadata: { gateName, ...metadata }
    });

    // 6. Emit event
    this.emit('gateMet', { gate: gateName, caller });

    return this._snapshot();
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
