import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { startSessionLifecycle } from '../../../runtime/runtime-bootstrap.js';
import { addSessionEntry, readSessionsIndex } from '../../../runtime/sessions/sessions-index.js';
import { readHeartbeat } from '../../../runtime/sessions/heartbeat.js';

let baseDir;
let sessionId;

async function seedActiveSession() {
  const startedAt = new Date().toISOString();
  await addSessionEntry(baseDir, {
    session_id: sessionId,
    work_item_id: null,
    lane: null,
    worktree_path: null,
    repo_root: '/repo',
    pid: process.pid,
    status: 'active',
    started_at: startedAt,
    last_seen_at: startedAt,
  });
}

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-hb-boot-'));
  fs.mkdirSync(path.join(baseDir, 'sessions'), { recursive: true });
  sessionId = 's_aaaaaa';
});

afterEach(() => {
  fs.rmSync(baseDir, { recursive: true, force: true });
});

describe('startSessionLifecycle', () => {
  it('returns a no-op handle when sessionId is missing', () => {
    const handle = startSessionLifecycle({ baseDir, sessionId: null, pid: process.pid });
    assert.equal(handle.started, false);
    handle.stop();
  });

  it('writes a heartbeat immediately and updates it on tick', async () => {
    await seedActiveSession();
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      registerSignals: false,
    });
    try {
      assert.equal(handle.started, true);
      const first = readHeartbeat(baseDir, sessionId);
      assert.ok(first, 'heartbeat written immediately');
      await delay(80);
      const second = readHeartbeat(baseDir, sessionId);
      assert.notEqual(first.last_beat_at, second.last_beat_at, 'heartbeat ticker updates timestamp');
    } finally {
      handle.stop();
    }
  });

  it('stop() halts the ticker and does not update sessions index', async () => {
    await seedActiveSession();
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      registerSignals: false,
    });
    handle.stop();
    const before = readHeartbeat(baseDir, sessionId).last_beat_at;
    await delay(80);
    const after = readHeartbeat(baseDir, sessionId).last_beat_at;
    assert.equal(before, after, 'heartbeat does not advance after stop');
    const idx = readSessionsIndex(baseDir);
    assert.equal(idx.sessions[0].status, 'active', 'manual stop does not close session');
  });

  it('shutdown handler marks session closed and stops heartbeat', async () => {
    await seedActiveSession();
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      registerSignals: false,
    });
    await handle.shutdown();
    const idx = readSessionsIndex(baseDir);
    assert.equal(idx.sessions[0].status, 'closed', 'sessions/index entry status=closed');
    const before = readHeartbeat(baseDir, sessionId).last_beat_at;
    await delay(80);
    const after = readHeartbeat(baseDir, sessionId).last_beat_at;
    assert.equal(before, after, 'heartbeat does not advance after shutdown');
  });

  it('shutdown is idempotent', async () => {
    await seedActiveSession();
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      registerSignals: false,
    });
    await handle.shutdown();
    await handle.shutdown();
    const idx = readSessionsIndex(baseDir);
    assert.equal(idx.sessions[0].status, 'closed');
  });

  it('shutdown is best-effort when sessions/index is unwritable', async () => {
    // No seedActiveSession — sessions/index does not yet exist.
    // updateSessionEntry will create it; ensure no throw escapes shutdown.
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      registerSignals: false,
    });
    await handle.shutdown();
    // Heartbeat ticker should be stopped regardless.
    const before = readHeartbeat(baseDir, sessionId).last_beat_at;
    await delay(60);
    const after = readHeartbeat(baseDir, sessionId).last_beat_at;
    assert.equal(before, after);
  });

  it('registers signal handlers when registerSignals is true (default)', async () => {
    await seedActiveSession();
    const captured = [];
    const fakeProcess = {
      pid: process.pid,
      on(event, handler) {
        captured.push({ event, handler });
        return fakeProcess;
      },
      off() { return fakeProcess; },
      removeListener() { return fakeProcess; },
    };
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      processRef: fakeProcess,
    });
    try {
      const events = captured.map((c) => c.event).sort();
      assert.deepEqual(events, ['SIGINT', 'SIGTERM', 'exit'].sort());
      // Simulate SIGTERM firing the handler.
      const sigterm = captured.find((c) => c.event === 'SIGTERM');
      await sigterm.handler();
      const idx = readSessionsIndex(baseDir);
      assert.equal(idx.sessions[0].status, 'closed');
    } finally {
      handle.stop();
    }
  });

  it('exit handler runs synchronously (best-effort) without awaiting', async () => {
    await seedActiveSession();
    const captured = [];
    const fakeProcess = {
      pid: process.pid,
      on(event, handler) { captured.push({ event, handler }); return fakeProcess; },
      off() { return fakeProcess; },
      removeListener() { return fakeProcess; },
    };
    const handle = startSessionLifecycle({
      baseDir,
      sessionId,
      pid: process.pid,
      intervalMs: 30,
      processRef: fakeProcess,
    });
    try {
      const exitEntry = captured.find((c) => c.event === 'exit');
      // exit handler should not throw and should be sync (returns undefined).
      const result = exitEntry.handler();
      assert.equal(result, undefined);
    } finally {
      handle.stop();
    }
  });
});
