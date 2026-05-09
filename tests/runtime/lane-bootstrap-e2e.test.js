import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createWorkflowKernelAdapter } from '../../src/runtime/workflow-kernel.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

function makeFreshStatePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-e2e-'));
  const statePath = path.join(dir, '.opencode', 'workflow-state.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  return statePath;
}

function makeKernel(statePath) {
  return createWorkflowKernelAdapter({
    projectRoot: PROJECT_ROOT,
    env: { ...process.env, OPENKIT_WORKFLOW_STATE: statePath },
  });
}

function readState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

// ─── Quick lane ───────────────────────────────────────────────────────────────

test('quick lane: fresh project → bootstrap → quick_intake', () => {
  const statePath = makeFreshStatePath();
  const kernel = makeKernel(statePath);

  // Before bootstrap: no state
  assert.equal(kernel.showState(), null, 'showState should return null before bootstrap');

  // Bootstrap quick
  const result = kernel.bootstrapWorkflow({
    lane: 'quick',
    description: 'fix bug in CSV export',
  });
  assert.equal(result.status, 'created');
  assert.ok(fs.existsSync(statePath), 'state file should be created');

  // After bootstrap
  const state = readState(statePath);
  assert.equal(state.mode, 'quick');
  assert.equal(state.current_stage, 'quick_intake');
  assert.equal(state.intake_payload?.description, 'fix bug in CSV export');
});

// ─── Full lane ────────────────────────────────────────────────────────────────

test('full lane: fresh project → bootstrap → full_intake', () => {
  const statePath = makeFreshStatePath();
  const kernel = makeKernel(statePath);

  const result = kernel.bootstrapWorkflow({
    lane: 'full',
    description: 'add enterprise approval workflow',
  });
  assert.equal(result.status, 'created');

  const state = readState(statePath);
  assert.equal(state.mode, 'full');
  assert.equal(state.current_stage, 'full_intake');
  assert.equal(state.intake_payload?.description, 'add enterprise approval workflow');
});

// ─── Migration lane ───────────────────────────────────────────────────────────

test('migration lane: fresh project → bootstrap → migration_intake', () => {
  const statePath = makeFreshStatePath();
  const kernel = makeKernel(statePath);

  const result = kernel.bootstrapWorkflow({
    lane: 'migration',
    description: 'upgrade React 18 to 19',
  });
  assert.equal(result.status, 'created');

  const state = readState(statePath);
  assert.equal(state.mode, 'migration');
  assert.equal(state.current_stage, 'migration_intake');
  assert.equal(state.intake_payload?.description, 'upgrade React 18 to 19');
});

// ─── Multi-workflow conflict ──────────────────────────────────────────────────

test('multi-workflow conflict: second bootstrap on active workflow returns conflict', () => {
  const statePath = makeFreshStatePath();
  const kernel = makeKernel(statePath);

  // First bootstrap
  const first = kernel.bootstrapWorkflow({ lane: 'quick', description: 'first task' });
  assert.equal(first.status, 'created');

  // Second bootstrap without archivePrior should conflict
  const second = kernel.bootstrapWorkflow({ lane: 'full', description: 'second task' });
  assert.equal(second.status, 'conflict');
  assert.ok(second.activeWorkflow, 'conflict should report active workflow info');
  assert.equal(second.activeWorkflow.mode, 'quick');
});

// ─── Archive prior ────────────────────────────────────────────────────────────

test('archive prior: second bootstrap with archivePrior=true succeeds', () => {
  const statePath = makeFreshStatePath();
  const kernel = makeKernel(statePath);

  // First bootstrap
  kernel.bootstrapWorkflow({ lane: 'quick', description: 'first task' });

  // Second bootstrap with archivePrior=true
  const result = kernel.bootstrapWorkflow({
    lane: 'full',
    description: 'second task',
    archivePrior: true,
  });
  assert.equal(result.status, 'created');
  assert.equal(result.archived, true);

  // New state is full
  const state = readState(statePath);
  assert.equal(state.mode, 'full');

  // Archive directory should exist
  const archiveBase = path.join(path.dirname(statePath), 'work-items');
  assert.ok(fs.existsSync(archiveBase), 'work-items archive base should exist');
});
