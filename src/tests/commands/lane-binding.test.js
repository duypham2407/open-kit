import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { createBootstrapWorkflowTool } from '../../runtime/tools/workflow/bootstrap-workflow.js';
import { bootstrapWorkflow } from '../../openkit-runtime/lib/workflow-state-controller.js';
import { writeSessionMeta, readSessionMeta } from '../../runtime/sessions/session-meta.js';
import { workItemsIndexPath } from '../../runtime/sessions/session-paths.js';
import { WORK_ITEMS_INDEX_SCHEMA_V3 } from '../../runtime/sessions/constants.js';

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-bind-'));
  const projectRoot = path.join(root, 'proj');
  const baseDir = path.join(projectRoot, '.opencode');
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'work-items'), { recursive: true });
  // Seed v3 work-items index so the bootstrap path doesn't try to write v2.
  fs.writeFileSync(
    workItemsIndexPath(baseDir),
    JSON.stringify({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] }, null, 2),
  );
  const statePath = path.join(baseDir, 'workflow-state.json');
  return { root, projectRoot, baseDir, statePath };
}

function seedSession(baseDir, sessionId, repoRoot) {
  writeSessionMeta(baseDir, {
    sessionId,
    workItemId: null,
    lane: null,
    repoRoot,
    worktreePath: null,
    targetBranch: null,
    featureBranch: null,
    startedAt: new Date().toISOString(),
  });
}

function makeKernel(statePath) {
  return {
    available: true,
    bootstrapWorkflow: (opts) => bootstrapWorkflow({ ...opts, statePath }),
  };
}

test('bootstrap-workflow binds the session to the new work item when OPENKIT_SESSION_ID is set', () => {
  const { projectRoot, baseDir, statePath } = makeProject();
  const sessionId = 's_aabbcc';
  seedSession(baseDir, sessionId, projectRoot);

  const tool = createBootstrapWorkflowTool({
    workflowKernel: makeKernel(statePath),
    env: { OPENKIT_SESSION_ID: sessionId, OPENKIT_PROJECT_ROOT: projectRoot },
    projectRoot,
  });

  const result = tool.execute({ lane: 'quick', description: 'fix CSV header' });

  assert.equal(result.status, 'created');
  // Session meta is now bound to the new work item.
  const meta = readSessionMeta(baseDir, sessionId);
  assert.equal(meta.lane, 'quick');
  assert.ok(meta.work_item_id, 'session meta should have work_item_id after bind');

  // work-items index has current_session_id set on the new entry.
  const idx = JSON.parse(fs.readFileSync(workItemsIndexPath(baseDir), 'utf8'));
  const entry = idx.work_items.find((wi) => wi.work_item_id === meta.work_item_id);
  assert.ok(entry, 'work item entry should exist after bootstrap');
  assert.equal(entry.current_session_id, sessionId);
});

test('bootstrap-workflow binds repo-root session when launched from a managed worktree', () => {
  const { projectRoot, baseDir, statePath } = makeProject();
  const sessionId = 's_abcd12';
  const worktreeRoot = path.join(projectRoot, '.worktrees', 'full-x');
  fs.mkdirSync(worktreeRoot, { recursive: true });
  writeSessionMeta(baseDir, {
    sessionId,
    workItemId: null,
    lane: null,
    repoRoot: projectRoot,
    worktreePath: worktreeRoot,
    targetBranch: null,
    featureBranch: null,
    startedAt: new Date().toISOString(),
  });

  const tool = createBootstrapWorkflowTool({
    workflowKernel: makeKernel(statePath),
    env: {
      OPENKIT_SESSION_ID: sessionId,
      OPENKIT_PROJECT_ROOT: worktreeRoot,
      OPENKIT_REPOSITORY_ROOT: projectRoot,
    },
    projectRoot,
  });

  const result = tool.execute({ lane: 'full', description: 'build full flow' });

  assert.equal(result.status, 'created');
  const meta = readSessionMeta(baseDir, sessionId);
  assert.equal(meta.lane, 'full');
  assert.ok(meta.work_item_id, 'repo-root session meta should be bound');
  assert.equal(
    fs.existsSync(path.join(worktreeRoot, '.opencode', 'sessions', sessionId, 'meta.json')),
    false,
    'bootstrap must not create a second session tree under the worktree',
  );
});

test('bootstrap-workflow refuses with session_already_bound when meta already has work_item_id', () => {
  const { projectRoot, baseDir, statePath } = makeProject();
  const sessionId = 's_ddeeff';
  // Seed a session that's already bound to a different work item.
  writeSessionMeta(baseDir, {
    sessionId,
    workItemId: 'previously-bound',
    lane: 'full',
    repoRoot: projectRoot,
    worktreePath: null,
    targetBranch: null,
    featureBranch: null,
    startedAt: new Date().toISOString(),
  });

  const tool = createBootstrapWorkflowTool({
    workflowKernel: makeKernel(statePath),
    env: { OPENKIT_SESSION_ID: sessionId, OPENKIT_PROJECT_ROOT: projectRoot },
    projectRoot,
  });

  const result = tool.execute({ lane: 'quick', description: 'something else' });

  assert.equal(result.status, 'session_already_bound');
  assert.equal(result.work_item_id, 'previously-bound');
  assert.equal(result.lane, 'full');
  // The pre-existing state file must NOT have been clobbered.
  assert.equal(fs.existsSync(statePath), false, 'no state file should be written when refusing the bind');
});

test('bootstrap-workflow without OPENKIT_SESSION_ID still works (legacy non-session callers)', () => {
  const { projectRoot, statePath } = makeProject();

  const tool = createBootstrapWorkflowTool({
    workflowKernel: makeKernel(statePath),
    env: {},
    projectRoot,
  });

  const result = tool.execute({ lane: 'full', description: 'big feature' });

  assert.equal(result.status, 'created');
  assert.equal(result.lane, 'full');
});
