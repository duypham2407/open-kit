import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateSessionId } from '../../../runtime/sessions/session-id.js';
import { writeSessionMeta } from '../../../runtime/sessions/session-meta.js';
import {
  addSessionEntry,
  readSessionsIndex,
} from '../../../runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../../runtime/sessions/work-items-index.js';
import { writeHeartbeat } from '../../../runtime/sessions/heartbeat.js';
import { scanOrphans } from '../../../runtime/sessions/orphan-scanner.js';
import { resumeSession } from '../../../runtime/sessions/resume.js';

/**
 * End-to-end orphan-recovery integration:
 *
 *   1. Create an active full-lane session bound to a work item.
 *   2. Simulate the launching PID dying (use a guaranteed-dead pid).
 *   3. Run the orphan scanner; verify status transitions to 'orphan'
 *      and the work item's current_session_id is unbound.
 *   4. Resume the session via resumeSession(); verify both indexes
 *      flip back to 'active' / 'in_progress'.
 */

let base;
let repoRoot;
let worktreePath;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-orphan-resume-'));
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-orphan-resume-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-orphan-resume-wt-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  fs.mkdirSync(path.join(base, 'sessions'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(worktreePath, { recursive: true, force: true });
});

const ts = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const DEAD_PID = 999_999; // unlikely to exist on any test host

describe('orphan recovery integration', () => {
  it('full-lane: scanner marks orphan, resume re-binds to active', async () => {
    const sessionId = generateSessionId();
    const workItemId = 'full-recover';
    const startedAt = ts(-30 * 60_000);
    writeSessionMeta(base, {
      sessionId,
      workItemId,
      lane: 'full',
      repoRoot,
      worktreePath,
      targetBranch: 'main',
      featureBranch: 'openkit/full-recover',
      startedAt,
    });
    await addSessionEntry(base, {
      session_id: sessionId,
      work_item_id: workItemId,
      lane: 'full',
      worktree_path: worktreePath,
      repo_root: repoRoot,
      pid: DEAD_PID,
      status: 'active',
      started_at: startedAt,
      last_seen_at: ts(-15 * 60_000),
    });
    await addWorkItem(base, {
      workItemId,
      featureSlug: 'full-recover',
      lane: 'full',
      currentSessionId: sessionId,
      statePath: `work-items/${workItemId}.json`,
    });
    writeHeartbeat(base, sessionId, DEAD_PID);

    // Simulate PID death + stale heartbeat by rewriting the heartbeat to old time
    fs.writeFileSync(
      path.join(base, 'sessions', sessionId, 'heartbeat.json'),
      JSON.stringify({ pid: DEAD_PID, last_beat_at: ts(-15 * 60_000) }),
    );

    // Step 1: confirm starting state.
    let sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions[0].status, 'active');

    // Step 2: scanner.
    const result = await scanOrphans(base, { now: () => Date.now() });
    assert.equal(result.transitionedToOrphan, 1);

    sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions[0].status, 'orphan');

    const wiBefore = readWorkItemsIndex(base).work_items.find((w) => w.work_item_id === workItemId);
    assert.equal(wiBefore.current_session_id, null);
    assert.equal(wiBefore.status, 'orphan');

    // Step 3: resume.
    const newPid = process.pid;
    const spawnCalls = [];
    const result2 = await resumeSession({
      baseDir: base,
      sessionId,
      newPid,
      git: () => 'openkit/full-recover',
      spawn: async (env, ctx) => {
        spawnCalls.push({ env, ctx });
        return { ok: true };
      },
    });

    // Verify resume returned the meta + env block
    assert.equal(result2.meta.session_id, sessionId);
    assert.equal(result2.env.OPENKIT_SESSION_ID, sessionId);
    assert.equal(result2.env.OPENKIT_WORK_ITEM_ID, workItemId);
    assert.equal(spawnCalls.length, 1);

    // Verify indexes flipped back.
    sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions[0].status, 'active');
    assert.equal(sessions[0].pid, newPid);

    const wiAfter = readWorkItemsIndex(base).work_items.find((w) => w.work_item_id === workItemId);
    assert.equal(wiAfter.current_session_id, sessionId);
    assert.equal(wiAfter.status, 'in_progress');
  });

  it('quick-lane: scanner marks orphan, resume succeeds without git', async () => {
    const sessionId = generateSessionId();
    const workItemId = 'quick-recover';
    const startedAt = ts(-30 * 60_000);
    writeSessionMeta(base, {
      sessionId,
      workItemId,
      lane: 'quick',
      repoRoot,
      worktreePath: null,
      targetBranch: null,
      featureBranch: null,
      startedAt,
    });
    await addSessionEntry(base, {
      session_id: sessionId,
      work_item_id: workItemId,
      lane: 'quick',
      worktree_path: null,
      repo_root: repoRoot,
      pid: DEAD_PID,
      status: 'active',
      started_at: startedAt,
      last_seen_at: ts(-15 * 60_000),
    });
    await addWorkItem(base, {
      workItemId,
      featureSlug: 'quick-recover',
      lane: 'quick',
      currentSessionId: sessionId,
      statePath: `work-items/${workItemId}.json`,
    });
    writeHeartbeat(base, sessionId, DEAD_PID);
    fs.writeFileSync(
      path.join(base, 'sessions', sessionId, 'heartbeat.json'),
      JSON.stringify({ pid: DEAD_PID, last_beat_at: ts(-15 * 60_000) }),
    );

    await scanOrphans(base);
    let sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions[0].status, 'orphan');

    let gitInvocations = 0;
    await resumeSession({
      baseDir: base,
      sessionId,
      newPid: process.pid,
      git: () => {
        gitInvocations += 1;
        return '';
      },
      spawn: async () => ({ ok: true }),
    });
    assert.equal(gitInvocations, 0, 'quick lane resume must skip git checks');

    sessions = readSessionsIndex(base).sessions;
    assert.equal(sessions[0].status, 'active');
  });

  it('scanner is idempotent: running twice does not double-mark or duplicate', async () => {
    const sessionId = generateSessionId();
    const workItemId = 'full-idem';
    const startedAt = ts(-30 * 60_000);
    writeSessionMeta(base, {
      sessionId,
      workItemId,
      lane: 'full',
      repoRoot,
      worktreePath,
      targetBranch: 'main',
      featureBranch: `openkit/${workItemId}`,
      startedAt,
    });
    await addSessionEntry(base, {
      session_id: sessionId,
      work_item_id: workItemId,
      lane: 'full',
      worktree_path: worktreePath,
      repo_root: repoRoot,
      pid: DEAD_PID,
      status: 'active',
      started_at: startedAt,
      last_seen_at: ts(-15 * 60_000),
    });
    await addWorkItem(base, {
      workItemId,
      featureSlug: workItemId,
      lane: 'full',
      currentSessionId: sessionId,
      statePath: 'p',
    });
    writeHeartbeat(base, sessionId, DEAD_PID);
    fs.writeFileSync(
      path.join(base, 'sessions', sessionId, 'heartbeat.json'),
      JSON.stringify({ pid: DEAD_PID, last_beat_at: ts(-15 * 60_000) }),
    );

    const r1 = await scanOrphans(base);
    const r2 = await scanOrphans(base);
    assert.equal(r1.transitionedToOrphan, 1);
    assert.equal(r2.transitionedToOrphan, 0);
    assert.equal(readSessionsIndex(base).sessions.length, 1);
  });
});
