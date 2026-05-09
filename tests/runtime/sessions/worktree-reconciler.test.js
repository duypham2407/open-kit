import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reconcileExistingWorktrees } from '../../../src/runtime/sessions/worktree-reconciler.js';
import { addWorkItem, readWorkItemsIndex } from '../../../src/runtime/sessions/work-items-index.js';
import { readSessionsIndex } from '../../../src/runtime/sessions/sessions-index.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-rec-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('worktree-reconciler', () => {
  it('creates synthetic orphan for matching not-done work item', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: null, statePath: 'p' });
    const fakeListWorktrees = () => [{ workItemId: 'full-x', worktreePath: '/r/.claude/worktrees/full-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    const sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions.length, 1);
    assert.match(sessions[0].session_id, /^s_orphan_/);
    assert.equal(sessions[0].status, 'orphan');
    assert.equal(sessions[0].work_item_id, 'full-x');
    assert.equal(sessions[0].pid, null);
    assert.equal(sessions[0].worktree_path, '/r/.claude/worktrees/full-x');
  });

  it('skips done work items', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: null, statePath: 'p' });
    const idx = readWorkItemsIndex(base);
    idx.work_items[0].status = 'done';
    fs.writeFileSync(path.join(base, 'work-items', 'index.json'), JSON.stringify(idx, null, 2));
    const fakeListWorktrees = () => [{ workItemId: 'full-x', worktreePath: '/r/.claude/worktrees/full-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    assert.equal(readSessionsIndex(base).sessions.length, 0);
  });

  it('logs warning when no work item matches but does not delete worktree', async () => {
    const warnings = [];
    const fakeListWorktrees = () => [{ workItemId: 'unknown-x', worktreePath: '/r/.claude/worktrees/unknown-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees, warn: (m) => warnings.push(m) });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /unknown-x/);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
  });

  it('is idempotent — running twice does not duplicate synthetic orphans', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: null, statePath: 'p' });
    const fakeListWorktrees = () => [{ workItemId: 'full-x', worktreePath: '/r/.claude/worktrees/full-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    assert.equal(readSessionsIndex(base).sessions.length, 1);
  });

  it('skips abandoned work items', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: null, statePath: 'p' });
    const idx = readWorkItemsIndex(base);
    idx.work_items[0].status = 'abandoned';
    fs.writeFileSync(path.join(base, 'work-items', 'index.json'), JSON.stringify(idx, null, 2));
    const fakeListWorktrees = () => [{ workItemId: 'full-x', worktreePath: '/r/.claude/worktrees/full-x', repoRoot: '/r' }];
    await reconcileExistingWorktrees({ baseDir: base, listWorktrees: fakeListWorktrees });
    assert.equal(readSessionsIndex(base).sessions.length, 0);
  });
});
