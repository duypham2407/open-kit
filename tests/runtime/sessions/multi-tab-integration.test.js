import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateSessionId } from '../../../src/runtime/sessions/session-id.js';
import { writeSessionMeta, readSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import { addSessionEntry, readSessionsIndex } from '../../../src/runtime/sessions/sessions-index.js';
import { writeHeartbeat } from '../../../src/runtime/sessions/heartbeat.js';
import { sessionMirrorPath } from '../../../src/runtime/sessions/session-paths.js';
import { scanOrphans } from '../../../src/runtime/sessions/orphan-scanner.js';

/**
 * Integration test for multi-tab launches:
 *
 *   - Launch two fake sessions concurrently (simulating two terminals).
 *   - Each must receive a unique session_id, have its own meta.json, and
 *     write to a separate per-session workflow-state mirror path.
 *   - The orphan scanner must not interfere with either fresh session.
 */

let base;
let repoRoot;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-multitab-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  fs.mkdirSync(path.join(base, 'sessions'), { recursive: true });
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-multitab-repo-'));
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

/**
 * Simulate one launcher tab generating a session and writing its mirror.
 * This mirrors the contract that launcher.js + heartbeat-bootstrap establish.
 */
async function launchFakeSession({ baseDir, repoRoot, pid }) {
  const sessionId = generateSessionId();
  const startedAt = new Date().toISOString();
  writeSessionMeta(baseDir, {
    sessionId,
    workItemId: null,
    lane: null,
    repoRoot,
    worktreePath: null,
    targetBranch: null,
    featureBranch: null,
    startedAt,
  });
  await addSessionEntry(baseDir, {
    session_id: sessionId,
    work_item_id: null,
    lane: null,
    worktree_path: null,
    repo_root: repoRoot,
    pid,
    status: 'active',
    started_at: startedAt,
    last_seen_at: startedAt,
  });
  writeHeartbeat(baseDir, sessionId, pid);
  // Simulate workflow-state mirror write (the runtime opens this file per-session).
  const mirrorPath = sessionMirrorPath(baseDir, sessionId);
  fs.writeFileSync(mirrorPath, JSON.stringify({ sessionId, version: 1 }, null, 2));
  return { sessionId, mirrorPath };
}

describe('multi-tab integration', () => {
  it('two concurrent launches produce distinct sessions and mirrors', async () => {
    const [tabA, tabB] = await Promise.all([
      launchFakeSession({ baseDir: base, repoRoot, pid: process.pid }),
      launchFakeSession({ baseDir: base, repoRoot, pid: process.pid }),
    ]);

    assert.notEqual(tabA.sessionId, tabB.sessionId, 'each tab must get a unique session_id');
    assert.notEqual(tabA.mirrorPath, tabB.mirrorPath, 'mirror paths must be per-session');

    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions.length, 2);
    const ids = idx.sessions.map((s) => s.session_id).sort();
    assert.deepEqual(ids, [tabA.sessionId, tabB.sessionId].sort());

    // Each session has its own meta.json
    assert.equal(readSessionMeta(base, tabA.sessionId).session_id, tabA.sessionId);
    assert.equal(readSessionMeta(base, tabB.sessionId).session_id, tabB.sessionId);

    // Each mirror file holds its own payload
    const a = JSON.parse(fs.readFileSync(tabA.mirrorPath, 'utf8'));
    const b = JSON.parse(fs.readFileSync(tabB.mirrorPath, 'utf8'));
    assert.equal(a.sessionId, tabA.sessionId);
    assert.equal(b.sessionId, tabB.sessionId);
  });

  it('orphan scanner does not interfere with two fresh sessions', async () => {
    const [tabA, tabB] = await Promise.all([
      launchFakeSession({ baseDir: base, repoRoot, pid: process.pid }),
      launchFakeSession({ baseDir: base, repoRoot, pid: process.pid }),
    ]);

    await scanOrphans(base, { now: () => Date.now() });

    const idx = readSessionsIndex(base);
    const a = idx.sessions.find((s) => s.session_id === tabA.sessionId);
    const b = idx.sessions.find((s) => s.session_id === tabB.sessionId);
    assert.equal(a.status, 'active');
    assert.equal(b.status, 'active');
  });

  it('five concurrent launches yield five distinct ids', async () => {
    const tabs = await Promise.all(
      Array.from({ length: 5 }, () => launchFakeSession({ baseDir: base, repoRoot, pid: process.pid })),
    );
    const ids = new Set(tabs.map((t) => t.sessionId));
    assert.equal(ids.size, 5);
    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions.length, 5);
  });

  it('per-session workflow-state mirrors are independent (no cross-write)', async () => {
    const tabA = await launchFakeSession({ baseDir: base, repoRoot, pid: process.pid });
    const tabB = await launchFakeSession({ baseDir: base, repoRoot, pid: process.pid });

    fs.writeFileSync(tabA.mirrorPath, JSON.stringify({ sessionId: tabA.sessionId, scratch: 'A-only' }));
    fs.writeFileSync(tabB.mirrorPath, JSON.stringify({ sessionId: tabB.sessionId, scratch: 'B-only' }));

    const a = JSON.parse(fs.readFileSync(tabA.mirrorPath, 'utf8'));
    const b = JSON.parse(fs.readFileSync(tabB.mirrorPath, 'utf8'));
    assert.equal(a.scratch, 'A-only');
    assert.equal(b.scratch, 'B-only');
  });
});
