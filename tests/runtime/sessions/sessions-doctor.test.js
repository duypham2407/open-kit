import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectSessionsDoctor } from '../../../src/runtime/doctor/sessions-doctor.js';
import { addSessionEntry } from '../../../src/runtime/sessions/sessions-index.js';
import { writeHeartbeat } from '../../../src/runtime/sessions/heartbeat.js';
import { sessionsIndexPath } from '../../../src/runtime/sessions/session-paths.js';
import { SESSIONS_INDEX_SCHEMA } from '../../../src/runtime/sessions/constants.js';

let base;
let repoRoot;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-doctor-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  fs.mkdirSync(path.join(base, 'sessions'), { recursive: true });
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-doctor-repo-'));
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

const ts = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const findCheck = (result, id) => result.checks.find((c) => c.id === id);

describe('sessions-doctor', () => {
  it('returns five checks with worstStatus ok on a clean baseDir', () => {
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    assert.equal(result.checks.length, 5);
    assert.equal(result.worstStatus, 'ok');
    for (const id of [
      'sessions-index-readable',
      'legacy-mirror-rotation',
      'orphan-sessions-count',
      'worktree-orphan-mismatch',
      'pid-cleanup',
    ]) {
      assert.ok(findCheck(result, id), `missing check ${id}`);
    }
  });

  it('sessions-index-readable: ok when index parses', async () => {
    await addSessionEntry(base, {
      session_id: 's_aaaaaa', work_item_id: null, lane: null,
      worktree_path: null, repo_root: repoRoot,
      pid: process.pid, status: 'active',
      started_at: ts(0), last_seen_at: ts(0),
    });
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    assert.equal(findCheck(result, 'sessions-index-readable').status, 'ok');
  });

  it('sessions-index-readable: fail on malformed JSON', () => {
    fs.writeFileSync(sessionsIndexPath(base), '{not valid json');
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    const c = findCheck(result, 'sessions-index-readable');
    assert.equal(c.status, 'fail');
    assert.equal(result.worstStatus, 'fail');
  });

  it('legacy-mirror-rotation: warn when more than 10 .legacy.* files', () => {
    for (let i = 0; i < 11; i++) {
      fs.writeFileSync(path.join(base, `workflow-state.json.legacy.${i}`), '{}');
    }
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    const c = findCheck(result, 'legacy-mirror-rotation');
    assert.equal(c.status, 'warn');
    assert.equal(c.count, 11);
  });

  it('legacy-mirror-rotation: ok at exactly 10 .legacy.* files', () => {
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(base, `workflow-state.json.legacy.${i}`), '{}');
    }
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    assert.equal(findCheck(result, 'legacy-mirror-rotation').status, 'ok');
  });

  it('orphan-sessions-count: warn when more than 5 orphan entries', async () => {
    for (let i = 0; i < 6; i++) {
      await addSessionEntry(base, {
        session_id: `s_orph${i.toString().padStart(2, '0')}`,
        work_item_id: `wi-${i}`, lane: 'full',
        worktree_path: null, repo_root: repoRoot,
        pid: null, status: 'orphan',
        started_at: ts(0), last_seen_at: ts(0),
      });
    }
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    const c = findCheck(result, 'orphan-sessions-count');
    assert.equal(c.status, 'warn');
    assert.equal(c.count, 6);
  });

  it('orphan-sessions-count: ok when 5 or fewer', async () => {
    for (let i = 0; i < 5; i++) {
      await addSessionEntry(base, {
        session_id: `s_oo${i.toString().padStart(4, '0')}`,
        work_item_id: `wi-${i}`, lane: 'full',
        worktree_path: null, repo_root: repoRoot,
        pid: null, status: 'orphan',
        started_at: ts(0), last_seen_at: ts(0),
      });
    }
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    assert.equal(findCheck(result, 'orphan-sessions-count').status, 'ok');
  });

  it('worktree-orphan-mismatch: warn when worktree has no matching session entry', () => {
    const fakeWt = path.join(repoRoot, '.claude', 'worktrees', 'wi-missing');
    fs.mkdirSync(fakeWt, { recursive: true });
    const result = inspectSessionsDoctor({
      baseDir: base, repoRoot,
      listWorktrees: () => [{ workItemId: 'wi-missing', worktreePath: fakeWt, repoRoot }],
    });
    const c = findCheck(result, 'worktree-orphan-mismatch');
    assert.equal(c.status, 'warn');
    assert.equal(c.missing.length, 1);
  });

  it('worktree-orphan-mismatch: ok when every worktree has a matching session', async () => {
    const fakeWt = path.join(repoRoot, '.claude', 'worktrees', 'wi-ok');
    fs.mkdirSync(fakeWt, { recursive: true });
    await addSessionEntry(base, {
      session_id: 's_wokwok', work_item_id: 'wi-ok', lane: 'full',
      worktree_path: fakeWt, repo_root: repoRoot,
      pid: null, status: 'active',
      started_at: ts(0), last_seen_at: ts(0),
    });
    const result = inspectSessionsDoctor({
      baseDir: base, repoRoot,
      listWorktrees: () => [{ workItemId: 'wi-ok', worktreePath: fakeWt, repoRoot }],
    });
    assert.equal(findCheck(result, 'worktree-orphan-mismatch').status, 'ok');
  });

  it('pid-cleanup: warn when active+fresh-heartbeat entry has dead PID', async () => {
    const sid = 's_dead11';
    await addSessionEntry(base, {
      session_id: sid, work_item_id: 'wi-dead', lane: 'full',
      worktree_path: null, repo_root: repoRoot,
      pid: 999999, status: 'active',
      started_at: ts(0), last_seen_at: ts(0),
    });
    writeHeartbeat(base, sid, 999999);
    const result = inspectSessionsDoctor({
      baseDir: base, repoRoot,
      listWorktrees: () => [],
      isPidAlive: (pid) => pid !== 999999,
    });
    const c = findCheck(result, 'pid-cleanup');
    assert.equal(c.status, 'warn');
    assert.equal(c.stale.length, 1);
    assert.equal(c.stale[0].session_id, sid);
  });

  it('pid-cleanup: ok when fresh-heartbeat PID is alive', async () => {
    const sid = 's_alive1';
    await addSessionEntry(base, {
      session_id: sid, work_item_id: 'wi-alive', lane: 'full',
      worktree_path: null, repo_root: repoRoot,
      pid: process.pid, status: 'active',
      started_at: ts(0), last_seen_at: ts(0),
    });
    writeHeartbeat(base, sid, process.pid);
    const result = inspectSessionsDoctor({
      baseDir: base, repoRoot,
      listWorktrees: () => [],
    });
    assert.equal(findCheck(result, 'pid-cleanup').status, 'ok');
  });

  it('pid-cleanup: ignores stale-heartbeat entries (those are the orphan scanners job)', async () => {
    const sid = 's_stale1';
    await addSessionEntry(base, {
      session_id: sid, work_item_id: 'wi-stale', lane: 'full',
      worktree_path: null, repo_root: repoRoot,
      pid: 999999, status: 'active',
      started_at: ts(-30 * 60_000), last_seen_at: ts(-30 * 60_000),
    });
    writeHeartbeat(base, sid, 999999);
    const hbFile = path.join(base, 'sessions', sid, 'heartbeat.json');
    const old = (Date.now() - 20 * 60_000) / 1000;
    fs.utimesSync(hbFile, old, old);
    // Manually rewrite heartbeat to simulate old beat timestamp
    fs.writeFileSync(hbFile, JSON.stringify({ pid: 999999, last_beat_at: ts(-20 * 60_000) }));
    const result = inspectSessionsDoctor({
      baseDir: base, repoRoot,
      listWorktrees: () => [],
      isPidAlive: () => false,
    });
    assert.equal(findCheck(result, 'pid-cleanup').status, 'ok');
  });

  it('returns worstStatus across all checks', async () => {
    fs.writeFileSync(sessionsIndexPath(base), '{not valid json');
    const result = inspectSessionsDoctor({ baseDir: base, repoRoot, listWorktrees: () => [] });
    assert.equal(result.worstStatus, 'fail');
  });

  it('skips when no baseDir is provided', () => {
    const result = inspectSessionsDoctor({});
    assert.equal(result.worstStatus, 'ok');
    assert.equal(result.checks.length, 1);
    assert.equal(result.checks[0].skipped, true);
  });
});
