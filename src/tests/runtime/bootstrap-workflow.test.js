import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBootstrapWorkflowTool } from '../../runtime/tools/workflow/bootstrap-workflow.js';
import { bootstrapWorkflow } from '../../openkit-runtime/lib/workflow-state-controller.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

function makeTempStatePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-tool-'));
  return path.join(dir, '.opencode', 'workflow-state.json');
}

/**
 * Create a minimal kernel mock that delegates bootstrapWorkflow to the real
 * controller but uses a temporary state path for isolation.
 */
function makeKernel(statePath) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  return {
    available: true,
    bootstrapWorkflow: (opts) => bootstrapWorkflow({ ...opts, statePath }),
  };
}

test('tool.bootstrap-workflow creates state on empty project', () => {
  const statePath = makeTempStatePath();
  const kernel = makeKernel(statePath);
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel });

  const result = tool.execute({
    lane: 'quick',
    description: 'fix bug in CSV export',
  });

  assert.equal(result.status, 'created');
  assert.ok(fs.existsSync(statePath));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.mode, 'quick');
  assert.equal(state.current_stage, 'quick_intake');
  assert.equal(state.current_owner, 'QuickAgent');
  assert.equal(state.intake_payload?.description, 'fix bug in CSV export');
});

test('tool.bootstrap-workflow returns conflict on active workflow', () => {
  const statePath = makeTempStatePath();
  const kernel = makeKernel(statePath);
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel });

  tool.execute({ lane: 'quick', description: 'first task' });
  const result = tool.execute({ lane: 'full', description: 'second task' });

  assert.equal(result.status, 'conflict');
  assert.ok(result.activeWorkflow, 'should return activeWorkflow');
  assert.equal(result.activeWorkflow.mode, 'quick');
});

test('tool.bootstrap-workflow with archivePrior overrides active workflow', () => {
  const statePath = makeTempStatePath();
  const kernel = makeKernel(statePath);
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel });

  tool.execute({ lane: 'quick', description: 'first task' });
  const result = tool.execute({
    lane: 'full',
    description: 'second task',
    archivePrior: true,
  });

  assert.equal(result.status, 'created');
  assert.equal(result.archived, true);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.mode, 'full');
  assert.equal(state.current_stage, 'full_intake');
});

test('tool.bootstrap-workflow returns error on missing lane', () => {
  const statePath = makeTempStatePath();
  const kernel = makeKernel(statePath);
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel });

  const result = tool.execute({ description: 'test task' });

  assert.equal(result.status, 'error');
  assert.match(result.message, /lane/i);
});

test('tool.bootstrap-workflow returns error on missing description', () => {
  const statePath = makeTempStatePath();
  const kernel = makeKernel(statePath);
  const tool = createBootstrapWorkflowTool({ workflowKernel: kernel });

  const result = tool.execute({ lane: 'quick' });

  assert.equal(result.status, 'error');
  assert.match(result.message, /description/i);
});

test('tool.bootstrap-workflow handles unavailable kernel gracefully', () => {
  const tool = createBootstrapWorkflowTool({ workflowKernel: null });

  const result = tool.execute({ lane: 'quick', description: 'test' });

  assert.equal(result.status, 'error');
  assert.match(result.message, /unavailable|kernel/i);
});
