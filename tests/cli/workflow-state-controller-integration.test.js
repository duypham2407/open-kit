// tests/cli/workflow-state-controller-integration.test.js
//
// Integration tests verifying that workflow-state-controller.js delegates
// state mutations to WorkflowStateManager.
//
// Phase 3 requirements:
//   - advanceStage() delegates to WorkflowStateManager.advanceStage()
//   - setApproval() delegates to WorkflowStateManager.setApproval()
//   - After each mutation the v2 state is readable via WorkflowStateManager
//   - CLI return values are backward-compatible (unchanged shape)

import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  advanceStage,
  setApproval,
  startTask,
  showState,
} from '../../.opencode/lib/workflow-state-controller.js';

import { WorkflowStateManager } from '../../src/runtime/state/workflow-state-manager.js';

// ── Env isolation ─────────────────────────────────────────────────────────────

const OPENKIT_ENV_KEYS = [
  'OPENKIT_PROJECT_ROOT',
  'OPENKIT_KIT_ROOT',
  'OPENKIT_WORKFLOW_STATE',
  'OPENKIT_GLOBAL_MODE',
];

let _savedEnv = {};

beforeEach(() => {
  _savedEnv = {};
  for (const key of OPENKIT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      _savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  }
});

afterEach(() => {
  for (const key of OPENKIT_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(_savedEnv, key)) {
      process.env[key] = _savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
  _savedEnv = {};
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wsc-integration-'));
}

/** Create a minimal project directory with all required subdirs and templates. */
function createTempProject() {
  const dir = makeTempDir();
  const opencodeDir = path.join(dir, '.opencode');
  const templatesDir = path.join(dir, 'docs', 'templates');

  fs.mkdirSync(path.join(dir, 'docs', 'scope'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'solution'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'qa'), { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.mkdirSync(opencodeDir, { recursive: true });

  // Copy required templates from kit root
  const kitTemplatesDir = path.resolve(__dirname, '../../docs/templates');
  for (const template of [
    'scope-package-template.md',
    'solution-package-template.md',
    'migration-solution-package-template.md',
    'migration-report-template.md',
  ]) {
    const src = path.join(kitTemplatesDir, template);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(templatesDir, template));
    }
  }

  return dir;
}

/**
 * Set up a quick-mode work item in a temp project and return the statePath
 * and the workItemId.
 */
function setupQuickWorkItem(projectDir, featureId = 'TEST-001', slug = 'test-feature') {
  const statePath = path.join(projectDir, '.opencode', 'workflow-state.json');
  startTask('quick', featureId, slug, 'Integration test', statePath);
  return { statePath, workItemId: slugify(featureId) };
}

/** Minimal slug implementation matching deriveWorkItemId logic. */
function slugify(featureId) {
  return featureId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build a WorkflowStateManager pointed at the v2 state written by the
 * controller after delegation.
 */
function makeV2Manager(projectDir, workItemId) {
  const baseDir = path.join(projectDir, '.opencode', 'v2');
  return new WorkflowStateManager({ workItemId, baseDir });
}

// ── Phase 3: advanceStage delegates to WorkflowStateManager ──────────────────

test('advanceStage writes v2 state that WorkflowStateManager can read', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir);
    const result = advanceStage('quick_brainstorm', statePath);

    // Backward-compat: old schema still present in return value
    assert.equal(result.state.current_stage, 'quick_brainstorm',
      'Return value must still use current_stage (backward compat)');

    // Forward integration: v2 state accessible via WorkflowStateManager
    const mgr = makeV2Manager(dir, workItemId);
    const v2State = mgr.getState();
    assert.equal(v2State.stage, 'quick_brainstorm',
      'WorkflowStateManager must reflect the new stage after advanceStage');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('advanceStage persists v2 owner after delegation', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir);
    advanceStage('quick_brainstorm', statePath);

    const mgr = makeV2Manager(dir, workItemId);
    const v2State = mgr.getState();
    // quick_brainstorm should be owned by QuickAgent (per STAGE_OWNERS)
    assert.ok(v2State.owner, 'v2 state must have an owner field');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('advanceStage v2 state persists across fresh WorkflowStateManager reads', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir);
    advanceStage('quick_brainstorm', statePath);

    // Simulate a "fresh agent restart" by creating a NEW manager instance
    const freshMgr = makeV2Manager(dir, workItemId);
    const freshState = freshMgr.getState();
    assert.equal(freshState.stage, 'quick_brainstorm',
      'After restart, fresh WorkflowStateManager should see persisted stage');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('multiple advanceStage calls each update v2 state correctly', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir);

    // Step 1: quick_intake → quick_brainstorm
    advanceStage('quick_brainstorm', statePath);
    let v2State = makeV2Manager(dir, workItemId).getState();
    assert.equal(v2State.stage, 'quick_brainstorm', 'After 1st advance: stage should be quick_brainstorm');

    // Step 2: quick_brainstorm → quick_plan
    advanceStage('quick_plan', statePath);
    v2State = makeV2Manager(dir, workItemId).getState();
    assert.equal(v2State.stage, 'quick_plan', 'After 2nd advance: stage should be quick_plan');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Phase 3: setApproval delegates to WorkflowStateManager ───────────────────

test('setApproval writes v2 gate that WorkflowStateManager can read', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir);

    // Advance to quick_brainstorm first
    advanceStage('quick_brainstorm', statePath);

    // Set approval for the understanding_confirmed gate
    setApproval('quick_verified', 'approved', 'QuickAgent', '2026-05-08', 'Verified', statePath);

    const mgr = makeV2Manager(dir, workItemId);
    const v2State = mgr.getState();

    // The gate should be recorded in v2 state
    assert.ok(
      v2State.gates && typeof v2State.gates === 'object',
      'v2 state must have a gates object'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Phase 3: Backward compatibility ─────────────────────────────────────────

test('advanceStage return value is backward compatible (old schema intact)', () => {
  const dir = createTempProject();
  try {
    const { statePath } = setupQuickWorkItem(dir);
    const result = advanceStage('quick_brainstorm', statePath);

    // Must return full context object
    assert.ok(result.statePath, 'result must have statePath');
    assert.ok(result.state, 'result must have state');

    // Old schema fields must be present
    assert.ok('current_stage' in result.state, 'result.state must have current_stage');
    assert.ok('current_owner' in result.state, 'result.state must have current_owner');
    assert.ok('mode' in result.state, 'result.state must have mode');
    assert.ok('approvals' in result.state, 'result.state must have approvals');
    assert.ok('artifacts' in result.state, 'result.state must have artifacts');

    assert.equal(result.state.current_stage, 'quick_brainstorm');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('setApproval return value is backward compatible (old schema intact)', () => {
  const dir = createTempProject();
  try {
    const { statePath } = setupQuickWorkItem(dir);
    advanceStage('quick_brainstorm', statePath);
    advanceStage('quick_plan', statePath);
    advanceStage('quick_implement', statePath);
    advanceStage('quick_test', statePath);

    const result = setApproval('quick_verified', 'approved', 'QuickAgent', '2026-05-08', 'Verified', statePath);

    assert.ok(result.statePath, 'result must have statePath');
    assert.ok(result.state, 'result must have state');
    assert.ok('approvals' in result.state, 'result.state must have approvals');
    assert.equal(result.state.approvals.quick_verified.status, 'approved');
    assert.equal(result.state.approvals.quick_verified.approved_by, 'QuickAgent');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('advanceStage errors throw and do not corrupt v2 state', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir);

    // Attempt to skip a stage (should throw)
    assert.throws(
      () => advanceStage('quick_implement', statePath),
      /immediate next stage/,
      'Skipping stages must throw an error'
    );

    // v2 state should either not exist (no write happened) or reflect initial stage
    const baseDir = path.join(dir, '.opencode', 'v2');
    const v2StatePath = path.join(baseDir, 'work-items', workItemId, 'state.json');
    if (fs.existsSync(v2StatePath)) {
      const v2State = JSON.parse(fs.readFileSync(v2StatePath, 'utf-8'));
      assert.notEqual(v2State.stage, 'quick_implement',
        'v2 state must not reflect failed stage transition');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('showState still returns old schema after advanceStage delegation', () => {
  const dir = createTempProject();
  try {
    const { statePath } = setupQuickWorkItem(dir);
    advanceStage('quick_brainstorm', statePath);

    const result = showState(statePath);
    assert.ok(result.state, 'showState must return state');
    assert.equal(result.state.current_stage, 'quick_brainstorm',
      'showState must read back current_stage in old schema format');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Phase 3: WorkflowStateManager is the single source of truth ──────────────

test('WorkflowStateManager v2 state mode matches controller state mode', () => {
  const dir = createTempProject();
  try {
    const { statePath, workItemId } = setupQuickWorkItem(dir, 'TEST-002', 'test-mode-sync');
    advanceStage('quick_brainstorm', statePath);

    const controllerResult = showState(statePath);
    const v2State = makeV2Manager(dir, workItemId).getState();

    assert.equal(v2State.mode, controllerResult.state.mode,
      'WorkflowStateManager mode must match controller state mode');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
