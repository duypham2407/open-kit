import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanOrphans } from '../../../src/runtime/sessions/orphan-scanner.js';
import { addSessionEntry, readSessionsIndex } from '../../../src/runtime/sessions/sessions-index.js';
import { addWorkItem, readWorkItemsIndex } from '../../../src/runtime/sessions/work-items-index.js';
import { writeHeartbeat } from '../../../src/runtime/sessions/heartbeat.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-orphan-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

const ts = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

describe('orphan-scanner', () => {
  it('marks active entry orphan when last_seen_at is older than threshold', async () => {
    await addSessionEntry(base, {
      session_id: 's_111111', work_item_id: 'full-x', lane: 'full',
      worktree_path: '/r/.claude/worktrees/full-x', repo_root: '/r',
      pid: 99, status: 'active',
      started_at: ts(-30 * 60_000), last_seen_at: ts(-15 * 60_000),
    });
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_111111', statePath: 'p' });
    writeHeartbeat(base, 's_111111', 99);
    fs.utimesSync(path.join(base, 'sessions', 's_111111', 'heartbeat.json'), Date.now() / 1000 - 900, Date.now() / 1000 - 900);

    await scanOrphans(base, { now: () => Date.now() });
    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions[0].status, 'orphan');
    const wi = readWorkItemsIndex(base).work_items[0];
    assert.equal(wi.current_session_id, null);
    assert.equal(wi.status, 'orphan');
  });

  it('keeps active when heartbeat is fresh and PID alive', async () => {
    await addSessionEntry(base, {
      session_id: 's_222222', work_item_id: 'q-y', lane: 'quick',
      worktree_path: null, repo_root: '/r',
      pid: process.pid, status: 'active',
      started_at: ts(0), last_seen_at: ts(0),
    });
    writeHeartbeat(base, 's_222222', process.pid);
    await scanOrphans(base);
    assert.equal(readSessionsIndex(base).sessions[0].status, 'active');
  });

  it('removes closed entries older than 7 days', async () => {
    await addSessionEntry(base, {
      session_id: 's_333333', work_item_id: 'old', lane: 'quick',
      worktree_path: null, repo_root: '/r',
      pid: 77, status: 'closed',
      started_at: ts(-30 * 24 * 3600 * 1000), last_seen_at: ts(-10 * 24 * 3600 * 1000),
    });
    await scanOrphans(base);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
  });

  it('PID-dead path marks orphan even with fresh heartbeat', async () => {
    await addSessionEntry(base, {
      session_id: 's_444444', work_item_id: 'z', lane: 'quick',
      worktree_path: null, repo_root: '/r',
      pid: 999999, status: 'active', // PID very unlikely to exist
      started_at: ts(0), last_seen_at: ts(0),
    });
    writeHeartbeat(base, 's_444444', 999999);
    await scanOrphans(base);
    assert.equal(readSessionsIndex(base).sessions[0].status, 'orphan');
  });

  it('keeps closed entries fresher than 7 days', async () => {
    await addSessionEntry(base, {
      session_id: 's_555555', work_item_id: 'recent', lane: 'quick',
      worktree_path: null, repo_root: '/r',
      pid: 88, status: 'closed',
      started_at: ts(-2 * 24 * 3600 * 1000), last_seen_at: ts(-1 * 24 * 3600 * 1000),
    });
    await scanOrphans(base);
    assert.equal(readSessionsIndex(base).sessions.length, 1);
    assert.equal(readSessionsIndex(base).sessions[0].status, 'closed');
  });
});
