import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeHeartbeat, readHeartbeat, startHeartbeat } from '../../../src/runtime/sessions/heartbeat.js';
import { setTimeout as delay } from 'node:timers/promises';

let base;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-hb-')); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('heartbeat', () => {
  it('writes and reads heartbeat', () => {
    writeHeartbeat(base, 's_abcdef', 1234);
    const hb = readHeartbeat(base, 's_abcdef');
    assert.equal(hb.pid, 1234);
    assert.match(hb.last_beat_at, /T/);
  });

  it('returns null when missing', () => {
    assert.equal(readHeartbeat(base, 's_missing'), null);
  });

  it('startHeartbeat fires immediately and stops cleanly', async () => {
    const stop = startHeartbeat({ baseDir: base, sessionId: 's_abcdef', pid: 1234, intervalMs: 50 });
    await delay(20);
    assert.ok(readHeartbeat(base, 's_abcdef'));
    stop();
    const beat1 = readHeartbeat(base, 's_abcdef').last_beat_at;
    await delay(120);
    const beat2 = readHeartbeat(base, 's_abcdef').last_beat_at;
    assert.equal(beat1, beat2);
  });

  it('readHeartbeat returns null on malformed JSON', () => {
    fs.mkdirSync(path.join(base, 'sessions', 's_bad'), { recursive: true });
    fs.writeFileSync(path.join(base, 'sessions', 's_bad', 'heartbeat.json'), 'not-json');
    assert.equal(readHeartbeat(base, 's_bad'), null);
  });
});
