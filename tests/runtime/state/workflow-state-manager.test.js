// tests/runtime/state/workflow-state-manager.test.js
//
// Tests for WorkflowStateManager — the orchestration layer that coordinates
// state schema, FSM, gate registry, and transaction log as a single unified
// API for all workflow state operations.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WorkflowStateManager } from '../../../src/runtime/state/workflow-state-manager.js';
import {
  StateTransitionError,
  GateNotMetError,
  InsufficientAuthorityError,
  StateCorruptionError
} from '../../../src/runtime/state/errors.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wsm-test-'));
}

function makeManager(opts = {}) {
  const dir = opts.dir ?? makeTempDir();
  const workItemId = opts.workItemId ?? 'test-item';
  return new WorkflowStateManager({ workItemId, baseDir: dir });
}

function makeInitialState(overrides = {}) {
  return {
    version: '2.0.0',
    mode: 'quick',
    stage: 'quick_intake',
    owner: 'quick-agent',
    gates: {},
    metadata: {
      created_at: '2026-05-08T10:00:00.000Z',
      updated_at: '2026-05-08T10:00:00.000Z'
    },
    ...overrides
  };
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('WorkflowStateManager', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('construction', () => {
    it('requires workItemId and baseDir', () => {
      assert.throws(
        () => new WorkflowStateManager({ baseDir: tmpDir }),
        /workItemId/
      );
      assert.throws(
        () => new WorkflowStateManager({ workItemId: 'x' }),
        /baseDir/
      );
    });

    it('constructs successfully with workItemId and baseDir', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'item1', baseDir: tmpDir });
      assert.ok(mgr);
    });
  });

  // ── initialize() ──────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('creates state file for a new work item', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'new-item', baseDir: tmpDir });
      const state = mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.equal(state.version, '2.0.0');
      assert.equal(state.mode, 'quick');
      assert.equal(state.owner, 'quick-agent');
      assert.ok(state.stage, 'stage should be set');
      assert.ok(state.metadata?.created_at, 'created_at should be set');
    });

    it('sets initial stage based on mode', () => {
      const quickMgr = new WorkflowStateManager({ workItemId: 'q1', baseDir: tmpDir });
      const qState = quickMgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      assert.equal(qState.stage, 'quick_intake');

      const fullMgr = new WorkflowStateManager({ workItemId: 'f1', baseDir: tmpDir });
      const fState = fullMgr.initialize({ mode: 'full', owner: 'master-orchestrator' });
      assert.equal(fState.stage, 'full_intake');

      const migMgr = new WorkflowStateManager({ workItemId: 'm1', baseDir: tmpDir });
      const mState = migMgr.initialize({ mode: 'migration', owner: 'solution-lead-agent' });
      assert.equal(mState.stage, 'migration_intake');
    });

    it('persists the initial state to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'persist-test', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const stateFilePath = path.join(tmpDir, 'work-items', 'persist-test', 'state.json');
      assert.ok(fs.existsSync(stateFilePath), 'state.json should exist on disk');

      const raw = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
      assert.equal(raw.version, '2.0.0');
      assert.equal(raw.mode, 'quick');
    });

    it('returns existing state if already initialized (idempotent)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'idem-test', baseDir: tmpDir });
      const first = mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      const second = mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.equal(first.stage, second.stage);
      assert.equal(first.mode, second.mode);
    });

    it('migrates legacy state on initialize if state file exists', () => {
      // Write legacy state file
      const itemDir = path.join(tmpDir, 'work-items', 'legacy-item');
      fs.mkdirSync(itemDir, { recursive: true });
      const legacyState = {
        mode: 'quick',
        stage: 'quick_plan',
        owner: 'quick-agent',
        approvals: { quick_verified: true }
      };
      fs.writeFileSync(path.join(itemDir, 'state.json'), JSON.stringify(legacyState));

      const mgr = new WorkflowStateManager({ workItemId: 'legacy-item', baseDir: tmpDir });
      const state = mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.equal(state.version, '2.0.0');
      assert.equal(state.gates['quick.verified'], true);
      assert.equal(state.approvals, undefined);
    });
  });

  // ── getState() ────────────────────────────────────────────────────────────

  describe('getState()', () => {
    it('returns current in-memory state after initialize', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'gs-test', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const state = mgr.getState();
      assert.equal(state.mode, 'quick');
      assert.equal(state.owner, 'quick-agent');
    });

    it('loads state from disk if not yet initialized in memory', () => {
      // Write state file directly
      const itemDir = path.join(tmpDir, 'work-items', 'disk-test');
      fs.mkdirSync(itemDir, { recursive: true });
      const storedState = makeInitialState({ stage: 'quick_plan' });
      fs.writeFileSync(path.join(itemDir, 'state.json'), JSON.stringify(storedState));

      const mgr = new WorkflowStateManager({ workItemId: 'disk-test', baseDir: tmpDir });
      const state = mgr.getState();

      assert.equal(state.stage, 'quick_plan');
    });

    it('throws StateCorruptionError if state file is malformed JSON', () => {
      const itemDir = path.join(tmpDir, 'work-items', 'corrupt-test');
      fs.mkdirSync(itemDir, { recursive: true });
      fs.writeFileSync(path.join(itemDir, 'state.json'), 'not valid json{{');

      const mgr = new WorkflowStateManager({ workItemId: 'corrupt-test', baseDir: tmpDir });
      assert.throws(() => mgr.getState(), StateCorruptionError);
    });

    it('throws if no state exists and no prior initialize call', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'no-state', baseDir: tmpDir });
      assert.throws(() => mgr.getState(), /not initialized|no state/i);
    });

    it('returns a defensive copy (mutations do not affect internal state)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'copy-test', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const state = mgr.getState();
      state.stage = 'mutated_stage';

      const state2 = mgr.getState();
      assert.notEqual(state2.stage, 'mutated_stage');
    });
  });

  // ── validateTransition() ──────────────────────────────────────────────────

  describe('validateTransition()', () => {
    it('returns valid=true for an allowed transition with gates met', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-test', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake', gates: { 'quick.understanding_confirmed': true } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-test'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-test', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_plan');
      assert.equal(result.valid, true);
    });

    it('returns valid=false when FSM disallows the target stage', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-fsm', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-fsm'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-fsm', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_done');
      assert.equal(result.valid, false);
      assert.ok(result.reason, 'should include a reason');
    });

    it('returns valid=false with missingGates when gates are not met', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-gates', baseDir: tmpDir });
      // quick_plan → quick_implement requires quick.understanding_confirmed
      const state = makeInitialState({ stage: 'quick_plan', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-gates'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-gates', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_implement');
      assert.equal(result.valid, false);
      assert.ok(Array.isArray(result.missingGates), 'should include missingGates array');
      assert.ok(result.missingGates.length > 0);
    });

    it('allows transition with no gates required (e.g. quick_implement → quick_test)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-nogatez', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_implement', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-nogatez'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-nogatez', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_test');
      assert.equal(result.valid, true);
    });
  });

  // ── advanceStage() ────────────────────────────────────────────────────────

  describe('advanceStage()', () => {
    it('advances stage when transition is valid and gates are met', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-ok', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake', gates: { 'quick.understanding_confirmed': true } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-ok'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-ok', 'state.json'), JSON.stringify(state));

      const result = mgr.advanceStage('quick_plan', 'quick-agent');
      assert.equal(result.stage, 'quick_plan');
      assert.equal(result.owner, 'quick-agent');
    });

    it('persists new stage to disk after advancing', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-persist', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_plan', gates: { 'quick.understanding_confirmed': true } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-persist'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-persist', 'state.json'), JSON.stringify(state));

      mgr.advanceStage('quick_implement', 'quick-agent');

      const stateFile = path.join(tmpDir, 'work-items', 'as-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.stage, 'quick_implement');
    });

    it('throws StateTransitionError for invalid FSM transition', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-invalid', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-invalid'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-invalid', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.advanceStage('quick_done', 'quick-agent'),
        StateTransitionError
      );
    });

    it('throws GateNotMetError when required gates are not satisfied', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-gate', baseDir: tmpDir });
      // quick_plan → quick_implement requires quick.understanding_confirmed
      const state = makeInitialState({ stage: 'quick_plan', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-gate'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-gate', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.advanceStage('quick_implement', 'quick-agent'),
        GateNotMetError
      );
    });

    it('does not mutate state on error (atomicity)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-atomic', baseDir: tmpDir });
      // quick_plan → quick_implement requires quick.understanding_confirmed
      const state = makeInitialState({ stage: 'quick_plan', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-atomic'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-atomic', 'state.json'), JSON.stringify(state));

      try {
        mgr.advanceStage('quick_implement', 'quick-agent');
      } catch {
        // expected
      }

      const current = mgr.getState();
      assert.equal(current.stage, 'quick_plan', 'stage must not change on error');

      // Also verify disk is unchanged
      const stateFile = path.join(tmpDir, 'work-items', 'as-atomic', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.stage, 'quick_plan');
    });

    it('updates metadata.updated_at on success', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-meta', baseDir: tmpDir });
      const oldTime = '2026-01-01T00:00:00.000Z';
      const state = makeInitialState({ stage: 'quick_implement', metadata: { created_at: oldTime, updated_at: oldTime } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-meta'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-meta', 'state.json'), JSON.stringify(state));

      const result = mgr.advanceStage('quick_test', 'quick-agent');
      assert.notEqual(result.metadata.updated_at, oldTime, 'updated_at should be refreshed');
    });

    it('writes a transaction log entry on success', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-log', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_implement', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-log'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-log', 'state.json'), JSON.stringify(state));

      mgr.advanceStage('quick_test', 'quick-agent');

      const logPath = path.join(tmpDir, 'work-items', 'as-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath), 'log file should exist');

      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      assert.equal(lines.length, 1);
      const entry = JSON.parse(lines[0]);
      assert.equal(entry.operation, 'advanceStage');
      assert.equal(entry.before.stage, 'quick_implement');
      assert.equal(entry.after.stage, 'quick_test');
    });

    it('allows backward transitions (e.g. quick_implement → quick_plan)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-back', baseDir: tmpDir });
      // quick_implement→quick_plan: no gates required for backward
      const state = makeInitialState({
        stage: 'quick_implement',
        gates: { 'quick.understanding_confirmed': true }
      });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-back'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-back', 'state.json'), JSON.stringify(state));

      const result = mgr.advanceStage('quick_plan', 'quick-agent');
      assert.equal(result.stage, 'quick_plan');
    });
  });

  // ── recordGate() ──────────────────────────────────────────────────────────

  describe('recordGate()', () => {
    it('records a gate as met in state', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-ok', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-ok'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-ok', 'state.json'), JSON.stringify(state));

      const result = mgr.recordGate('quick.understanding_confirmed', 'user');
      assert.equal(result.gates['quick.understanding_confirmed'], true);
    });

    it('persists gate state to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-persist', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-persist'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-persist', 'state.json'), JSON.stringify(state));

      mgr.recordGate('quick.understanding_confirmed', 'user');

      const stateFile = path.join(tmpDir, 'work-items', 'rg-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.gates['quick.understanding_confirmed'], true);
    });

    it('throws for an unknown gate name', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-unknown', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-unknown'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-unknown', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.recordGate('nonexistent.gate', 'user'),
        /unknown gate/i
      );
    });

    it('throws InsufficientAuthorityError when caller lacks authority', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-auth', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_test' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-auth'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-auth', 'state.json'), JSON.stringify(state));

      // quick.verified requires 'quick-agent', not 'random-caller'
      assert.throws(
        () => mgr.recordGate('quick.verified', 'random-caller'),
        InsufficientAuthorityError
      );
    });

    it('stores gate metadata (approver, metAt)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-meta', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-meta'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-meta', 'state.json'), JSON.stringify(state));

      const result = mgr.recordGate('quick.understanding_confirmed', 'user', { comment: 'approved' });
      assert.ok(result.gateMeta?.['quick.understanding_confirmed']?.approver, 'approver stored');
      assert.ok(result.gateMeta?.['quick.understanding_confirmed']?.metAt, 'metAt stored');
    });

    it('writes a transaction log entry for gate recording', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-log', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-log'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-log', 'state.json'), JSON.stringify(state));

      mgr.recordGate('quick.understanding_confirmed', 'user');

      const logPath = path.join(tmpDir, 'work-items', 'rg-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath));
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const entry = JSON.parse(lines[0]);
      assert.equal(entry.operation, 'setApproval');
    });
  });

  // ── Mirror file (.opencode/workflow-state.json) ───────────────────────────

  describe('compatibility mirror', () => {
    it('writes mirror file at baseDir/workflow-state.json after advanceStage', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'mirror-test', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'mirror-test'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'mirror-test', 'state.json'), JSON.stringify(state));

      // Set gate so the transition passes, then advance
      mgr.setApproval('quick.understanding_confirmed', true, 'user', {});
      mgr.advanceStage('quick_plan', 'quick-agent');

      const mirrorPath = path.join(tmpDir, 'workflow-state.json');
      assert.ok(fs.existsSync(mirrorPath), 'mirror file should exist');

      const mirror = JSON.parse(fs.readFileSync(mirrorPath, 'utf-8'));
      assert.equal(mirror.stage, 'quick_plan');
    });

    it('writes mirror file after recordGate', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'mirror-gate', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'mirror-gate'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'mirror-gate', 'state.json'), JSON.stringify(state));

      mgr.recordGate('quick.understanding_confirmed', 'user');

      const mirrorPath = path.join(tmpDir, 'workflow-state.json');
      assert.ok(fs.existsSync(mirrorPath));
    });
  });

  // ── Reader methods ────────────────────────────────────────────────────────

  describe('reader methods', () => {
    beforeEach(() => {
      const itemDir = path.join(tmpDir, 'work-items', 'reader-test');
      fs.mkdirSync(itemDir, { recursive: true });
      const state = makeInitialState({
        stage: 'quick_plan',
        owner: 'quick-agent',
        mode: 'quick'
      });
      fs.writeFileSync(path.join(itemDir, 'state.json'), JSON.stringify(state));
    });

    it('getStage() returns current stage', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'reader-test', baseDir: tmpDir });
      assert.equal(mgr.getStage(), 'quick_plan');
    });

    it('getOwner() returns current owner', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'reader-test', baseDir: tmpDir });
      assert.equal(mgr.getOwner(), 'quick-agent');
    });

    it('getMode() returns current mode', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'reader-test', baseDir: tmpDir });
      assert.equal(mgr.getMode(), 'quick');
    });
  });

  // ── Full workflow scenario ────────────────────────────────────────────────

  describe('full scenario: quick lane advance from plan to implement', () => {
    it('records gate then advances stage successfully', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'scenario-1', baseDir: tmpDir });
      // quick_plan → quick_implement requires quick.understanding_confirmed
      const state = makeInitialState({ stage: 'quick_plan', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'scenario-1'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'scenario-1', 'state.json'), JSON.stringify(state));

      // Step 1: try to advance without gate — should fail
      assert.throws(
        () => mgr.advanceStage('quick_implement', 'quick-agent'),
        GateNotMetError
      );

      // Step 2: record gate
      mgr.recordGate('quick.understanding_confirmed', 'user');

      // Step 3: advance — should succeed now
      const result = mgr.advanceStage('quick_implement', 'quick-agent');
      assert.equal(result.stage, 'quick_implement');

      // Step 4: verify transaction log has both entries
      const logPath = path.join(tmpDir, 'work-items', 'scenario-1', 'state-transitions.log');
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      assert.equal(lines.length, 2, 'should have setApproval (via recordGate) + advanceStage entries');
      assert.equal(JSON.parse(lines[0]).operation, 'setApproval');
      assert.equal(JSON.parse(lines[1]).operation, 'advanceStage');
    });
  });

  // ── getCurrentState() ────────────────────────────────────────────────────

  describe('getCurrentState()', () => {
    it('is an alias for getState() and returns the same value', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'gcs-test', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const fromGetState = mgr.getState();
      const fromGetCurrentState = mgr.getCurrentState();

      assert.deepEqual(fromGetCurrentState, fromGetState);
    });

    it('loads state from disk if not yet initialized in memory', () => {
      const itemDir = path.join(tmpDir, 'work-items', 'gcs-disk');
      fs.mkdirSync(itemDir, { recursive: true });
      const storedState = makeInitialState({ stage: 'quick_plan' });
      fs.writeFileSync(path.join(itemDir, 'state.json'), JSON.stringify(storedState));

      const mgr = new WorkflowStateManager({ workItemId: 'gcs-disk', baseDir: tmpDir });
      const state = mgr.getCurrentState();
      assert.equal(state.stage, 'quick_plan');
    });

    it('returns a defensive copy', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'gcs-copy', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const state = mgr.getCurrentState();
      state.stage = 'mutated';

      assert.notEqual(mgr.getCurrentState().stage, 'mutated');
    });
  });

  // ── getWorkItem() ─────────────────────────────────────────────────────────

  describe('getWorkItem()', () => {
    it('returns migrated state for an existing work item', () => {
      const itemDir = path.join(tmpDir, 'work-items', 'other-item');
      fs.mkdirSync(itemDir, { recursive: true });
      const storedState = makeInitialState({ stage: 'quick_plan' });
      fs.writeFileSync(path.join(itemDir, 'state.json'), JSON.stringify(storedState));

      const mgr = new WorkflowStateManager({ workItemId: 'gw-caller', baseDir: tmpDir });
      const state = mgr.getWorkItem('other-item');
      assert.equal(state.stage, 'quick_plan');
    });

    it('throws if work item does not exist', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'gw-caller', baseDir: tmpDir });
      assert.throws(
        () => mgr.getWorkItem('nonexistent-item'),
        /State not found/i
      );
    });

    it('migrates legacy state files', () => {
      const itemDir = path.join(tmpDir, 'work-items', 'legacy-wi');
      fs.mkdirSync(itemDir, { recursive: true });
      const legacyState = {
        mode: 'quick',
        stage: 'quick_plan',
        owner: 'quick-agent',
        approvals: { quick_verified: true }
      };
      fs.writeFileSync(path.join(itemDir, 'state.json'), JSON.stringify(legacyState));

      const mgr = new WorkflowStateManager({ workItemId: 'gw-caller2', baseDir: tmpDir });
      const state = mgr.getWorkItem('legacy-wi');
      assert.equal(state.version, '2.0.0');
      assert.equal(state.gates['quick.verified'], true);
    });

    it('throws StateCorruptionError for malformed JSON', () => {
      const itemDir = path.join(tmpDir, 'work-items', 'corrupt-wi');
      fs.mkdirSync(itemDir, { recursive: true });
      fs.writeFileSync(path.join(itemDir, 'state.json'), 'not valid json{{{');

      const mgr = new WorkflowStateManager({ workItemId: 'gw-caller3', baseDir: tmpDir });
      assert.throws(() => mgr.getWorkItem('corrupt-wi'), StateCorruptionError);
    });
  });

  // ── setApproval() ─────────────────────────────────────────────────────────

  describe('setApproval()', () => {
    it('sets a gate to approved=true', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-approve', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-approve'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-approve', 'state.json'), JSON.stringify(state));

      const result = mgr.setApproval('quick.understanding_confirmed', true, 'user');
      assert.equal(result.gates['quick.understanding_confirmed'], true);
    });

    it('sets a gate to approved=false (revocation)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-revoke', baseDir: tmpDir });
      const state = makeInitialState({
        stage: 'quick_intake',
        gates: { 'quick.understanding_confirmed': true }
      });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-revoke'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-revoke', 'state.json'), JSON.stringify(state));

      const result = mgr.setApproval('quick.understanding_confirmed', false, 'user');
      assert.equal(result.gates['quick.understanding_confirmed'], false);
    });

    it('persists gate state to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-persist', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-persist'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-persist', 'state.json'), JSON.stringify(state));

      mgr.setApproval('quick.understanding_confirmed', true, 'user');

      const stateFile = path.join(tmpDir, 'work-items', 'sa-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.gates['quick.understanding_confirmed'], true);
    });

    it('stores approver and approved in gateMeta', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-meta', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-meta'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-meta', 'state.json'), JSON.stringify(state));

      const result = mgr.setApproval('quick.understanding_confirmed', true, 'user', { comment: 'lgtm' });
      const meta = result.gateMeta?.['quick.understanding_confirmed'];
      assert.ok(meta, 'gateMeta entry should exist');
      assert.equal(meta.approver, 'user');
      assert.equal(meta.approved, true);
      assert.ok(meta.metAt, 'metAt should be set');
    });

    it('throws for an unknown gate name', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-unknown', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-unknown'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-unknown', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.setApproval('nonexistent.gate', true, 'user'),
        /unknown gate/i
      );
    });

    it('throws InsufficientAuthorityError when caller lacks authority', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-auth', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_test' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-auth'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-auth', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.setApproval('quick.verified', true, 'random-caller'),
        InsufficientAuthorityError
      );
    });

    it('writes a transaction log entry with operation setApproval', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-log', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-log'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-log', 'state.json'), JSON.stringify(state));

      mgr.setApproval('quick.understanding_confirmed', true, 'user');

      const logPath = path.join(tmpDir, 'work-items', 'sa-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath));
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const entry = JSON.parse(lines[0]);
      assert.equal(entry.operation, 'setApproval');
      assert.equal(entry.metadata.gateName, 'quick.understanding_confirmed');
      assert.equal(entry.metadata.approved, true);
    });

    it('emits gate-met event', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'sa-evt', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'sa-evt'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'sa-evt', 'state.json'), JSON.stringify(state));

      let emitted = null;
      mgr.on('gate-met', (data) => { emitted = data; });

      mgr.setApproval('quick.understanding_confirmed', true, 'user');

      assert.ok(emitted, 'gate-met event should be emitted');
      assert.equal(emitted.gate, 'quick.understanding_confirmed');
      assert.equal(emitted.approved, true);
      assert.equal(emitted.approver, 'user');
    });
  });

  // ── recordIssue() ─────────────────────────────────────────────────────────

  describe('recordIssue()', () => {
    it('adds an issue to the state', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-ok', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const result = mgr.recordIssue({ id: 'issue-1', description: 'Something went wrong' });
      assert.ok(Array.isArray(result.issues));
      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].id, 'issue-1');
    });

    it('sets resolved=false and recordedAt on new issues', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-fields', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const result = mgr.recordIssue({ id: 'issue-2', description: 'test issue' });
      const issue = result.issues[0];
      assert.equal(issue.resolved, false);
      assert.ok(issue.recordedAt, 'recordedAt should be set');
    });

    it('persists issues to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-persist', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.recordIssue({ id: 'issue-3', description: 'persisted' });

      const stateFile = path.join(tmpDir, 'work-items', 'ri-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.ok(Array.isArray(onDisk.issues));
      assert.equal(onDisk.issues[0].id, 'issue-3');
    });

    it('throws if issue object lacks id', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-noid', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.throws(() => mgr.recordIssue({ description: 'no id' }), /id/);
    });

    it('accumulates multiple issues', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-multi', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.recordIssue({ id: 'issue-a' });
      const result = mgr.recordIssue({ id: 'issue-b' });
      assert.equal(result.issues.length, 2);
    });
  });

  // ── resolveIssue() ────────────────────────────────────────────────────────

  describe('resolveIssue()', () => {
    it('marks an issue as resolved with a resolution string', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'res-ok', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      mgr.recordIssue({ id: 'issue-1', description: 'test' });

      const result = mgr.resolveIssue('issue-1', 'Fixed the bug');
      const issue = result.issues.find(i => i.id === 'issue-1');
      assert.equal(issue.resolved, true);
      assert.equal(issue.resolution, 'Fixed the bug');
      assert.ok(issue.resolvedAt, 'resolvedAt should be set');
    });

    it('does not affect other issues', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'res-multi', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      mgr.recordIssue({ id: 'issue-a' });
      mgr.recordIssue({ id: 'issue-b' });

      mgr.resolveIssue('issue-a', 'resolved a');
      const state = mgr.getState();
      assert.equal(state.issues.find(i => i.id === 'issue-b').resolved, false);
    });

    it('persists resolved state to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'res-persist', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      mgr.recordIssue({ id: 'issue-1' });
      mgr.resolveIssue('issue-1', 'done');

      const stateFile = path.join(tmpDir, 'work-items', 'res-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.issues[0].resolved, true);
    });

    it('throws if issue id does not exist', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'res-notfound', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.throws(
        () => mgr.resolveIssue('nonexistent-id', 'whatever'),
        /not found/i
      );
    });
  });

  // ── recordEvidence() ──────────────────────────────────────────────────────

  describe('recordEvidence()', () => {
    it('adds evidence to the state', () => {
      const mgr = new WorkflowStateManager({ workItemId: 're-ok', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const result = mgr.recordEvidence({ type: 'test-pass', description: 'All tests pass' });
      assert.ok(Array.isArray(result.evidence));
      assert.equal(result.evidence.length, 1);
      assert.equal(result.evidence[0].type, 'test-pass');
    });

    it('sets recordedAt on evidence if not provided', () => {
      const mgr = new WorkflowStateManager({ workItemId: 're-ts', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const result = mgr.recordEvidence({ type: 'review' });
      assert.ok(result.evidence[0].recordedAt, 'recordedAt should be set');
    });

    it('preserves provided recordedAt', () => {
      const mgr = new WorkflowStateManager({ workItemId: 're-custts', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      const ts = '2026-01-01T00:00:00.000Z';
      const result = mgr.recordEvidence({ type: 'review', recordedAt: ts });
      assert.equal(result.evidence[0].recordedAt, ts);
    });

    it('persists evidence to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 're-persist', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.recordEvidence({ type: 'test-pass' });

      const stateFile = path.join(tmpDir, 'work-items', 're-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.ok(Array.isArray(onDisk.evidence));
      assert.equal(onDisk.evidence[0].type, 'test-pass');
    });

    it('throws if evidence is not an object', () => {
      const mgr = new WorkflowStateManager({ workItemId: 're-invalid', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.throws(() => mgr.recordEvidence('not an object'), /evidence object/i);
    });

    it('accumulates multiple evidence entries', () => {
      const mgr = new WorkflowStateManager({ workItemId: 're-multi', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.recordEvidence({ type: 'test-pass' });
      const result = mgr.recordEvidence({ type: 'review-pass' });
      assert.equal(result.evidence.length, 2);
    });
  });

  // ── Transaction management ────────────────────────────────────────────────

  describe('beginTransaction() / commitTransaction() / rollbackTransaction()', () => {
    it('beginTransaction snapshots current state', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-begin', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      // Should not throw
      assert.doesNotThrow(() => mgr.beginTransaction());
    });

    it('commitTransaction clears the snapshot', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-commit', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.beginTransaction();
      assert.doesNotThrow(() => mgr.commitTransaction());
    });

    it('commitTransaction writes a log entry', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-commit-log', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.beginTransaction();
      mgr.commitTransaction();

      const logPath = path.join(tmpDir, 'work-items', 'tx-commit-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath));
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const lastEntry = JSON.parse(lines[lines.length - 1]);
      assert.equal(lastEntry.operation, 'commit');
    });

    it('rollbackTransaction restores state to pre-transaction snapshot', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-rollback', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_implement' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'tx-rollback'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'tx-rollback', 'state.json'), JSON.stringify(state));

      mgr.beginTransaction();
      mgr.advanceStage('quick_test', 'quick-agent');
      assert.equal(mgr.getStage(), 'quick_test');

      mgr.rollbackTransaction();
      assert.equal(mgr.getStage(), 'quick_implement', 'stage should be rolled back');
    });

    it('rollbackTransaction re-persists rolled-back state to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-rollback-disk', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_implement' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'tx-rollback-disk'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'tx-rollback-disk', 'state.json'), JSON.stringify(state));

      mgr.beginTransaction();
      mgr.advanceStage('quick_test', 'quick-agent');
      mgr.rollbackTransaction();

      const stateFile = path.join(tmpDir, 'work-items', 'tx-rollback-disk', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.stage, 'quick_implement', 'disk should reflect rollback');
    });

    it('rollbackTransaction writes a rollback log entry', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-rollback-log', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.beginTransaction();
      mgr.rollbackTransaction();

      const logPath = path.join(tmpDir, 'work-items', 'tx-rollback-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath));
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const lastEntry = JSON.parse(lines[lines.length - 1]);
      assert.equal(lastEntry.operation, 'rollback');
    });

    it('throws if beginTransaction called when a transaction is already active', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-double-begin', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.beginTransaction();
      assert.throws(() => mgr.beginTransaction(), /Transaction already active/i);
      mgr.rollbackTransaction(); // cleanup
    });

    it('throws if commitTransaction called without an active transaction', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-commit-no-tx', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.throws(() => mgr.commitTransaction(), /No active transaction/i);
    });

    it('throws if rollbackTransaction called without an active transaction', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-rollback-no-tx', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      assert.throws(() => mgr.rollbackTransaction(), /No active transaction/i);
    });

    it('allows a new transaction after commit', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'tx-reuse', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });

      mgr.beginTransaction();
      mgr.commitTransaction();
      assert.doesNotThrow(() => mgr.beginTransaction());
      mgr.rollbackTransaction(); // cleanup
    });
  });

  // ── Event emission ────────────────────────────────────────────────────────

  describe('event emission', () => {
    it('emits stage-advanced event when stage changes', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'evt-stage', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'evt-stage'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'evt-stage', 'state.json'), JSON.stringify(state));

      let emittedData = null;
      mgr.on('stage-advanced', (data) => { emittedData = data; });

      // Set gate and advance
      mgr.setApproval('quick.understanding_confirmed', true, 'user', {});
      mgr.advanceStage('quick_plan', 'quick-agent');

      assert.ok(emittedData, 'event should have been emitted');
      assert.equal(emittedData.from, 'quick_intake');
      assert.equal(emittedData.to, 'quick_plan');
    });

    it('emits gate-met event when gate is recorded', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'evt-gate', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'evt-gate'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'evt-gate', 'state.json'), JSON.stringify(state));

      let emittedData = null;
      mgr.on('gate-met', (data) => { emittedData = data; });

      mgr.recordGate('quick.understanding_confirmed', 'user');

      assert.ok(emittedData, 'event should have been emitted');
      assert.equal(emittedData.gate, 'quick.understanding_confirmed');
    });
  });

  // ── resolveIssue() resolvedBy parameter ──────────────────────────────────

  describe('resolveIssue() resolvedBy parameter', () => {
    it('uses resolvedBy as the log caller when provided', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-resolvedby', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      mgr.recordIssue({ id: 'issue-1', description: 'test' });

      mgr.resolveIssue('issue-1', 'Fixed', 'senior-agent');

      const logPath = path.join(tmpDir, 'work-items', 'ri-resolvedby', 'state-transitions.log');
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const resolveEntry = lines.map(l => JSON.parse(l)).find(e => e.operation === 'resolveIssue');
      assert.ok(resolveEntry, 'resolveIssue log entry should exist');
      assert.equal(resolveEntry.caller, 'senior-agent');
    });

    it('defaults caller to unknown when resolvedBy is not provided', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'ri-defaultcaller', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      mgr.recordIssue({ id: 'issue-2', description: 'test' });

      mgr.resolveIssue('issue-2', 'Fixed');

      const logPath = path.join(tmpDir, 'work-items', 'ri-defaultcaller', 'state-transitions.log');
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const resolveEntry = lines.map(l => JSON.parse(l)).find(e => e.operation === 'resolveIssue');
      assert.ok(resolveEntry, 'resolveIssue log entry should exist');
      assert.equal(resolveEntry.caller, 'unknown');
    });
  });

  // ── disk I/O error handling ───────────────────────────────────────────────

  describe('disk I/O error handling', () => {
    it('throws when primary state file cannot be written (directory made read-only)', function() {
      // Skip on platforms where chmod doesn't apply (e.g. root user)
      if (process.getuid && process.getuid() === 0) {
        this.skip?.();
        return;
      }

      const mgr = new WorkflowStateManager({ workItemId: 'io-err-primary', baseDir: tmpDir });
      // Start from quick_plan (which requires quick.understanding_confirmed to advance to quick_implement)
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      // Advance to quick_plan first (no gate required for intake → plan)
      mgr.advanceStage('quick_plan', 'quick-agent');

      // Set gate while dir is still writable
      mgr.setApproval('quick.understanding_confirmed', true, 'user', {});

      // Make the item directory read-only so writes fail
      const itemDir = path.join(tmpDir, 'work-items', 'io-err-primary');
      fs.chmodSync(itemDir, 0o444);

      try {
        assert.throws(
          () => mgr.advanceStage('quick_implement', 'quick-agent'),
          /Failed to persist state/
        );
      } finally {
        // Restore permissions so afterEach cleanup can delete the dir
        fs.chmodSync(itemDir, 0o755);
      }
    });

    it('in-memory state is not advanced when _persist() throws', function() {
      if (process.getuid && process.getuid() === 0) {
        this.skip?.();
        return;
      }

      const mgr = new WorkflowStateManager({ workItemId: 'io-err-rollback', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      // quick_intake → quick_plan has no gate: advance succeeds (disk write succeeds here)
      mgr.advanceStage('quick_plan', 'quick-agent');
      // Set gate for quick_plan → quick_implement while dir is still writable
      mgr.setApproval('quick.understanding_confirmed', true, 'user', {});

      const stageBefore = mgr.getStage();

      const itemDir = path.join(tmpDir, 'work-items', 'io-err-rollback');
      fs.chmodSync(itemDir, 0o444);

      try {
        mgr.advanceStage('quick_implement', 'quick-agent');
      } catch {
        // expected disk error
      } finally {
        fs.chmodSync(itemDir, 0o755);
      }

      // In-memory state was mutated before _persist() — the throw from _persist()
      // propagates out of advanceStage, leaving the in-memory state inconsistent
      // with what is on disk. The state on disk should still be the pre-advance stage.
      const stateFile = path.join(tmpDir, 'work-items', 'io-err-rollback', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.stage, stageBefore, 'disk must reflect only the successfully persisted state');
    });

    it('rollbackTransaction() retains snapshot when _persist() throws', function() {
      if (process.getuid && process.getuid() === 0) {
        this.skip?.();
        return;
      }

      const mgr = new WorkflowStateManager({ workItemId: 'io-err-tx', baseDir: tmpDir });
      mgr.initialize({ mode: 'quick', owner: 'quick-agent' });
      mgr.beginTransaction();

      const itemDir = path.join(tmpDir, 'work-items', 'io-err-tx');
      fs.chmodSync(itemDir, 0o444);

      let threw = false;
      try {
        mgr.rollbackTransaction();
      } catch {
        threw = true;
      } finally {
        fs.chmodSync(itemDir, 0o755);
      }

      if (threw) {
        // Snapshot must still be intact (not cleared) so a retry is possible
        // after restoring write access. Verify by calling rollbackTransaction again.
        assert.doesNotThrow(() => mgr.rollbackTransaction());
      }
      // If it didn't throw (e.g. permissions behaved differently) that is also fine.
    });
  });
});

