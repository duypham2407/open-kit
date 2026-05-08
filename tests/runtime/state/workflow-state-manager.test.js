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
    stage: 'quick_brainstorm',
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
      const state = makeInitialState({ stage: 'quick_brainstorm', gates: { 'quick.understanding_confirmed': true } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-test'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-test', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_plan');
      assert.equal(result.valid, true);
    });

    it('returns valid=false when FSM disallows the target stage', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-fsm', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-fsm'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-fsm', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_done');
      assert.equal(result.valid, false);
      assert.ok(result.reason, 'should include a reason');
    });

    it('returns valid=false with missingGates when gates are not met', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-gates', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-gates'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-gates', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_plan');
      assert.equal(result.valid, false);
      assert.ok(Array.isArray(result.missingGates), 'should include missingGates array');
      assert.ok(result.missingGates.length > 0);
    });

    it('allows transition with no gates required (e.g. quick_intake → quick_brainstorm)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'vt-nogatez', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'vt-nogatez'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'vt-nogatez', 'state.json'), JSON.stringify(state));

      const result = mgr.validateTransition('quick_brainstorm');
      assert.equal(result.valid, true);
    });
  });

  // ── advanceStage() ────────────────────────────────────────────────────────

  describe('advanceStage()', () => {
    it('advances stage when transition is valid and gates are met', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-ok', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm', gates: { 'quick.understanding_confirmed': true } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-ok'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-ok', 'state.json'), JSON.stringify(state));

      const result = mgr.advanceStage('quick_plan', 'quick-agent');
      assert.equal(result.stage, 'quick_plan');
      assert.equal(result.owner, 'quick-agent');
    });

    it('persists new stage to disk after advancing', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-persist', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-persist'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-persist', 'state.json'), JSON.stringify(state));

      mgr.advanceStage('quick_brainstorm', 'quick-agent');

      const stateFile = path.join(tmpDir, 'work-items', 'as-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.stage, 'quick_brainstorm');
    });

    it('throws StateTransitionError for invalid FSM transition', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-invalid', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-invalid'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-invalid', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.advanceStage('quick_done', 'quick-agent'),
        StateTransitionError
      );
    });

    it('throws GateNotMetError when required gates are not satisfied', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-gate', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-gate'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-gate', 'state.json'), JSON.stringify(state));

      assert.throws(
        () => mgr.advanceStage('quick_plan', 'quick-agent'),
        GateNotMetError
      );
    });

    it('does not mutate state on error (atomicity)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-atomic', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-atomic'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-atomic', 'state.json'), JSON.stringify(state));

      try {
        mgr.advanceStage('quick_plan', 'quick-agent');
      } catch {
        // expected
      }

      const current = mgr.getState();
      assert.equal(current.stage, 'quick_brainstorm', 'stage must not change on error');

      // Also verify disk is unchanged
      const stateFile = path.join(tmpDir, 'work-items', 'as-atomic', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.stage, 'quick_brainstorm');
    });

    it('updates metadata.updated_at on success', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-meta', baseDir: tmpDir });
      const oldTime = '2026-01-01T00:00:00.000Z';
      const state = makeInitialState({ stage: 'quick_intake', metadata: { created_at: oldTime, updated_at: oldTime } });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-meta'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-meta', 'state.json'), JSON.stringify(state));

      const result = mgr.advanceStage('quick_brainstorm', 'quick-agent');
      assert.notEqual(result.metadata.updated_at, oldTime, 'updated_at should be refreshed');
    });

    it('writes a transaction log entry on success', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-log', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-log'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-log', 'state.json'), JSON.stringify(state));

      mgr.advanceStage('quick_brainstorm', 'quick-agent');

      const logPath = path.join(tmpDir, 'work-items', 'as-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath), 'log file should exist');

      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      assert.equal(lines.length, 1);
      const entry = JSON.parse(lines[0]);
      assert.equal(entry.operation, 'advanceStage');
      assert.equal(entry.before.stage, 'quick_intake');
      assert.equal(entry.after.stage, 'quick_brainstorm');
    });

    it('allows backward transitions (e.g. quick_plan → quick_brainstorm)', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'as-back', baseDir: tmpDir });
      // quick_plan→quick_brainstorm: no gates required for backward
      const state = makeInitialState({
        stage: 'quick_plan',
        gates: { 'quick.understanding_confirmed': true, 'quick.plan_confirmed': true }
      });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'as-back'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'as-back', 'state.json'), JSON.stringify(state));

      const result = mgr.advanceStage('quick_brainstorm', 'quick-agent');
      assert.equal(result.stage, 'quick_brainstorm');
    });
  });

  // ── recordGate() ──────────────────────────────────────────────────────────

  describe('recordGate()', () => {
    it('records a gate as met in state', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-ok', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-ok'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-ok', 'state.json'), JSON.stringify(state));

      const result = mgr.recordGate('quick.understanding_confirmed', 'user');
      assert.equal(result.gates['quick.understanding_confirmed'], true);
    });

    it('persists gate state to disk', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-persist', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-persist'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-persist', 'state.json'), JSON.stringify(state));

      mgr.recordGate('quick.understanding_confirmed', 'user');

      const stateFile = path.join(tmpDir, 'work-items', 'rg-persist', 'state.json');
      const onDisk = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      assert.equal(onDisk.gates['quick.understanding_confirmed'], true);
    });

    it('throws for an unknown gate name', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-unknown', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
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
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-meta'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-meta', 'state.json'), JSON.stringify(state));

      const result = mgr.recordGate('quick.understanding_confirmed', 'user', { comment: 'approved' });
      assert.ok(result.gateMeta?.['quick.understanding_confirmed']?.approver, 'approver stored');
      assert.ok(result.gateMeta?.['quick.understanding_confirmed']?.metAt, 'metAt stored');
    });

    it('writes a transaction log entry for gate recording', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'rg-log', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'rg-log'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'rg-log', 'state.json'), JSON.stringify(state));

      mgr.recordGate('quick.understanding_confirmed', 'user');

      const logPath = path.join(tmpDir, 'work-items', 'rg-log', 'state-transitions.log');
      assert.ok(fs.existsSync(logPath));
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      const entry = JSON.parse(lines[0]);
      assert.equal(entry.operation, 'recordGate');
    });
  });

  // ── Mirror file (.opencode/workflow-state.json) ───────────────────────────

  describe('compatibility mirror', () => {
    it('writes mirror file at baseDir/workflow-state.json after advanceStage', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'mirror-test', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'mirror-test'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'mirror-test', 'state.json'), JSON.stringify(state));

      mgr.advanceStage('quick_brainstorm', 'quick-agent');

      const mirrorPath = path.join(tmpDir, 'workflow-state.json');
      assert.ok(fs.existsSync(mirrorPath), 'mirror file should exist');

      const mirror = JSON.parse(fs.readFileSync(mirrorPath, 'utf-8'));
      assert.equal(mirror.stage, 'quick_brainstorm');
    });

    it('writes mirror file after recordGate', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'mirror-gate', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
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

  describe('full scenario: quick lane advance from brainstorm to plan', () => {
    it('records gate then advances stage successfully', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'scenario-1', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm', gates: {} });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'scenario-1'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'scenario-1', 'state.json'), JSON.stringify(state));

      // Step 1: try to advance without gate — should fail
      assert.throws(
        () => mgr.advanceStage('quick_plan', 'quick-agent'),
        GateNotMetError
      );

      // Step 2: record gate
      mgr.recordGate('quick.understanding_confirmed', 'user');

      // Step 3: advance — should succeed now
      const result = mgr.advanceStage('quick_plan', 'quick-agent');
      assert.equal(result.stage, 'quick_plan');

      // Step 4: verify transaction log has both entries
      const logPath = path.join(tmpDir, 'work-items', 'scenario-1', 'state-transitions.log');
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      assert.equal(lines.length, 2, 'should have recordGate + advanceStage entries');
      assert.equal(JSON.parse(lines[0]).operation, 'recordGate');
      assert.equal(JSON.parse(lines[1]).operation, 'advanceStage');
    });
  });

  // ── Event emission ────────────────────────────────────────────────────────

  describe('event emission', () => {
    it('emits stageAdvanced event when stage changes', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'evt-stage', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_intake' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'evt-stage'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'evt-stage', 'state.json'), JSON.stringify(state));

      let emittedData = null;
      mgr.on('stageAdvanced', (data) => { emittedData = data; });

      mgr.advanceStage('quick_brainstorm', 'quick-agent');

      assert.ok(emittedData, 'event should have been emitted');
      assert.equal(emittedData.from, 'quick_intake');
      assert.equal(emittedData.to, 'quick_brainstorm');
    });

    it('emits gateMet event when gate is recorded', () => {
      const mgr = new WorkflowStateManager({ workItemId: 'evt-gate', baseDir: tmpDir });
      const state = makeInitialState({ stage: 'quick_brainstorm' });
      fs.mkdirSync(path.join(tmpDir, 'work-items', 'evt-gate'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'work-items', 'evt-gate', 'state.json'), JSON.stringify(state));

      let emittedData = null;
      mgr.on('gateMet', (data) => { emittedData = data; });

      mgr.recordGate('quick.understanding_confirmed', 'user');

      assert.ok(emittedData, 'event should have been emitted');
      assert.equal(emittedData.gate, 'quick.understanding_confirmed');
    });
  });
});
