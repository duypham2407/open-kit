import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { killSession } from '../../../runtime/sessions/kill.js';
import { writeSessionMeta } from '../../../runtime/sessions/session-meta.js';
import { writeHeartbeat } from '../../../runtime/sessions/heartbeat.js';
import {
  addSessionEntry,
  readSessionsIndex,
} from '../../../runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../../runtime/sessions/work-items-index.js';
import { sessionDir } from '../../../runtime/sessions/session-paths.js';
import { SessionNotFoundError } from '../../../runtime/sessions/errors.js';
import {
  SIGTERM_TO_SIGKILL_GRACE_MS,
  SIGKILL_CONFIRM_TIMEOUT_MS,
} from '../../../runtime/sessions/constants.js';

let base;
let repoRoot;

const STARTED = '2026-05-09T10:00:00.000Z';

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-kill-'));
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-kill-repo-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

const setupQuickSession = async ({
  sessionId = 's_quick0',
  workItemId = 'quick-y',
  pid = 4242,
} = {}) => {
  writeSessionMeta(base, {
    sessionId,
    workItemId,
    lane: 'quick',
    repoRoot,
    worktreePath: null,
    targetBranch: null,
    featureBranch: null,
    startedAt: STARTED,
  });
  await addSessionEntry(base, {
    session_id: sessionId,
    work_item_id: workItemId,
    lane: 'quick',
    worktree_path: null,
    repo_root: repoRoot,
    pid,
    status: 'active',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  if (workItemId) {
    await addWorkItem(base, {
      workItemId,
      featureSlug: 'y',
      lane: 'quick',
      currentSessionId: sessionId,
      statePath: 'p',
    });
  }
  if (pid) writeHeartbeat(base, sessionId, pid);
};

const esrch = () => {
  const e = new Error('ESRCH');
  e.code = 'ESRCH';
  return e;
};

/**
 * Build a deterministic processKill stub that records every call and lets each
 * test script the alive/dead transition. The fake clock is advanced by the
 * sleep stub so polling progresses without real wall-clock waits.
 */
function makeStubs({ aliveSignals = [], pid }) {
  const calls = [];
  let aliveCallCount = 0;
  let signalCallCount = 0;

  // aliveSignals: array of booleans, one per signal-0 (alive check) call.
  // signalCallCount: tracks when SIGTERM/SIGKILL were sent so the alive
  // sequence can be aware of "after SIGTERM" vs "after SIGKILL".
  const processKill = (gotPid, signal) => {
    assert.equal(gotPid, pid, `processKill received unexpected pid ${gotPid}`);
    calls.push({ pid: gotPid, signal });
    if (signal === 0) {
      const idx = aliveCallCount;
      aliveCallCount += 1;
      const alive = idx < aliveSignals.length ? aliveSignals[idx] : false;
      if (!alive) throw esrch();
      return true;
    }
    signalCallCount += 1;
    return true;
  };

  let nowMs = 1_000_000;
  const slept = [];
  const sleep = async (ms) => {
    slept.push(ms);
    nowMs += ms;
  };
  const now = () => nowMs;

  return {
    processKill,
    sleep,
    now,
    calls,
    slept,
    get aliveCalls() { return aliveCallCount; },
    get signalCalls() { return signalCallCount; },
  };
}

describe('killSession', () => {
  it('SIGTERM-only happy path: process dies after SIGTERM, no SIGKILL', async () => {
    await setupQuickSession({ pid: 4242 });

    // alive checks: [pre-SIGTERM=true, post-SIGTERM=false]
    const stubs = makeStubs({ aliveSignals: [true, false], pid: 4242 });

    const result = await killSession({
      baseDir: base,
      sessionId: 's_quick0',
      processKill: stubs.processKill,
      sleep: stubs.sleep,
      now: stubs.now,
    });

    assert.equal(result.sessionId, 's_quick0');
    assert.equal(result.pid, 4242);
    assert.equal(result.escalated, false);
    assert.match(result.killedAt, /T/);
    assert.equal(result.abandon, undefined);

    // Signals: only SIGTERM was sent. Two alive checks (initial + post-grace).
    const sentSignals = stubs.calls.filter((c) => c.signal !== 0).map((c) => c.signal);
    assert.deepEqual(sentSignals, ['SIGTERM']);
    assert.deepEqual(stubs.slept, [SIGTERM_TO_SIGKILL_GRACE_MS]);

    // Sessions index: orphan, pid cleared.
    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions.length, 1);
    assert.equal(sIdx.sessions[0].status, 'orphan');
    assert.equal(sIdx.sessions[0].pid, null);

    // Work items: current_session_id cleared, status untouched (still in_progress).
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].current_session_id, null);
    assert.equal(wIdx.work_items[0].status, 'in_progress');
  });

  it('SIGTERM→SIGKILL escalation: process survives SIGTERM, dies after SIGKILL', async () => {
    await setupQuickSession({ pid: 9999 });

    // alive: [pre-SIGTERM=true, post-SIGTERM=true (escalate),
    //         poll1=true, poll2=false (dead)]
    const stubs = makeStubs({
      aliveSignals: [true, true, true, false],
      pid: 9999,
    });

    const result = await killSession({
      baseDir: base,
      sessionId: 's_quick0',
      processKill: stubs.processKill,
      sleep: stubs.sleep,
      now: stubs.now,
      pollIntervalMs: 100,
    });

    assert.equal(result.escalated, true);
    assert.equal(result.pid, 9999);

    const sentSignals = stubs.calls.filter((c) => c.signal !== 0).map((c) => c.signal);
    assert.deepEqual(sentSignals, ['SIGTERM', 'SIGKILL']);
    // Sleeps: 3 s grace, then one 100 ms poll interval before the second
    // alive check returns false.
    assert.deepEqual(stubs.slept, [SIGTERM_TO_SIGKILL_GRACE_MS, 100]);

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'orphan');
    assert.equal(sIdx.sessions[0].pid, null);
  });

  it('refuses with OK_KILL_PID_DEAD when heartbeat PID is already dead', async () => {
    await setupQuickSession({ pid: 4242 });

    // First (and only) alive check returns false.
    const stubs = makeStubs({ aliveSignals: [false], pid: 4242 });

    await assert.rejects(
      () => killSession({
        baseDir: base,
        sessionId: 's_quick0',
        processKill: stubs.processKill,
        sleep: stubs.sleep,
        now: stubs.now,
      }),
      (err) => {
        assert.equal(err.code, 'OK_KILL_PID_DEAD');
        assert.equal(err.sessionId, 's_quick0');
        assert.equal(err.pid, 4242);
        assert.match(err.message, /abandon/);
        return true;
      },
    );

    // No signals sent.
    assert.equal(stubs.calls.filter((c) => c.signal !== 0).length, 0);

    // Indexes untouched: still active, current_session_id still pointing.
    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'active');
    assert.equal(sIdx.sessions[0].pid, 4242);
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].current_session_id, 's_quick0');
  });

  it('refuses with OK_KILL_PID_DEAD when heartbeat is missing', async () => {
    // Setup but DO NOT write heartbeat.
    writeSessionMeta(base, {
      sessionId: 's_nohb00',
      workItemId: 'wi-nohb',
      lane: 'quick',
      repoRoot,
      worktreePath: null,
      targetBranch: null,
      featureBranch: null,
      startedAt: STARTED,
    });
    await addSessionEntry(base, {
      session_id: 's_nohb00',
      work_item_id: 'wi-nohb',
      lane: 'quick',
      worktree_path: null,
      repo_root: repoRoot,
      pid: null,
      status: 'active',
      started_at: STARTED,
      last_seen_at: STARTED,
    });
    await addWorkItem(base, {
      workItemId: 'wi-nohb',
      featureSlug: 'nohb',
      lane: 'quick',
      currentSessionId: 's_nohb00',
      statePath: 'p',
    });

    const stubs = makeStubs({ aliveSignals: [], pid: 0 });

    await assert.rejects(
      () => killSession({
        baseDir: base,
        sessionId: 's_nohb00',
        processKill: stubs.processKill,
        sleep: stubs.sleep,
        now: stubs.now,
      }),
      (err) => {
        assert.equal(err.code, 'OK_KILL_PID_DEAD');
        assert.match(err.message, /abandon/);
        return true;
      },
    );

    assert.equal(stubs.calls.length, 0, 'no processKill call should be made');
  });

  it('throws SessionNotFoundError when meta is missing', async () => {
    const stubs = makeStubs({ aliveSignals: [], pid: 0 });

    await assert.rejects(
      () => killSession({
        baseDir: base,
        sessionId: 's_nope000',
        processKill: stubs.processKill,
        sleep: stubs.sleep,
        now: stubs.now,
      }),
      (err) => err instanceof SessionNotFoundError && err.sessionId === 's_nope000',
    );
  });

  it('--abandon combo: kill then abandon in one call (quick lane, no worktree)', async () => {
    await setupQuickSession({ pid: 4242 });

    const stubs = makeStubs({ aliveSignals: [true, false], pid: 4242 });

    const result = await killSession({
      baseDir: base,
      sessionId: 's_quick0',
      abandon: true,
      processKill: stubs.processKill,
      sleep: stubs.sleep,
      now: stubs.now,
    });

    assert.equal(result.escalated, false);
    assert.deepEqual(result.abandon, {
      sessionId: 's_quick0',
      workItemId: 'quick-y',
      worktreeAction: 'none',
    });

    // Session dir gone, sessions index empty, work item abandoned.
    assert.equal(fs.existsSync(sessionDir(base, 's_quick0')), false);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'abandoned');
    assert.equal(wIdx.work_items[0].current_session_id, null);
  });

  it('escalation poll timeout: process survives SIGKILL → throws OK_KILL_TIMEOUT', async () => {
    await setupQuickSession({ pid: 7777 });

    // Always alive — never dies. Provide enough true entries so we exhaust
    // the 5 s budget instead of running out of script.
    const stubs = makeStubs({
      aliveSignals: new Array(200).fill(true),
      pid: 7777,
    });

    await assert.rejects(
      () => killSession({
        baseDir: base,
        sessionId: 's_quick0',
        processKill: stubs.processKill,
        sleep: stubs.sleep,
        now: stubs.now,
        pollIntervalMs: 100,
      }),
      (err) => {
        assert.equal(err.code, 'OK_KILL_TIMEOUT');
        assert.equal(err.pid, 7777);
        return true;
      },
    );

    // Both signals attempted.
    const sentSignals = stubs.calls.filter((c) => c.signal !== 0).map((c) => c.signal);
    assert.deepEqual(sentSignals, ['SIGTERM', 'SIGKILL']);

    // Total polled time after SIGKILL should equal SIGKILL_CONFIRM_TIMEOUT_MS.
    const polledMs = stubs.slept.slice(1).reduce((a, b) => a + b, 0);
    assert.equal(polledMs, SIGKILL_CONFIRM_TIMEOUT_MS);

    // Indexes were NOT updated — kill failed, so the entry stays active.
    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'active');
    assert.equal(sIdx.sessions[0].pid, 7777);
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].current_session_id, 's_quick0');
  });

  it('SIGTERM races with natural exit: ESRCH on send is treated as success', async () => {
    await setupQuickSession({ pid: 5555 });

    let calls = 0;
    const processKill = (pid, signal) => {
      calls += 1;
      assert.equal(pid, 5555);
      if (signal === 0 && calls === 1) return true;        // alive pre-send
      if (signal === 'SIGTERM') throw esrch();              // raced exit
      if (signal === 0) throw esrch();                      // dead post-grace
      throw new Error(`unexpected signal sequence at call ${calls}: ${signal}`);
    };

    let nowMs = 0;
    const sleep = async (ms) => { nowMs += ms; };
    const now = () => nowMs;

    const result = await killSession({
      baseDir: base,
      sessionId: 's_quick0',
      processKill,
      sleep,
      now,
    });

    assert.equal(result.escalated, false);
    assert.equal(result.pid, 5555);

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'orphan');
  });

  it('unbound session (work_item_id=null): kill skips work-items update', async () => {
    writeSessionMeta(base, {
      sessionId: 's_unbnd0',
      workItemId: null,
      lane: null,
      repoRoot,
      worktreePath: null,
      targetBranch: null,
      featureBranch: null,
      startedAt: STARTED,
    });
    await addSessionEntry(base, {
      session_id: 's_unbnd0',
      work_item_id: null,
      lane: null,
      worktree_path: null,
      repo_root: repoRoot,
      pid: 1234,
      status: 'active',
      started_at: STARTED,
      last_seen_at: STARTED,
    });
    writeHeartbeat(base, 's_unbnd0', 1234);

    const stubs = makeStubs({ aliveSignals: [true, false], pid: 1234 });

    const result = await killSession({
      baseDir: base,
      sessionId: 's_unbnd0',
      processKill: stubs.processKill,
      sleep: stubs.sleep,
      now: stubs.now,
    });

    assert.equal(result.escalated, false);

    // Session entry flipped to orphan; work-items index untouched (empty).
    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'orphan');
    assert.equal(sIdx.sessions[0].pid, null);
    assert.equal(readWorkItemsIndex(base).work_items.length, 0);
  });
});
