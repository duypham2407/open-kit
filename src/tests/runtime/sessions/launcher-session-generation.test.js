import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateSessionId } from '../../../runtime/sessions/session-id.js';
import { writeSessionMeta, readSessionMeta } from '../../../runtime/sessions/session-meta.js';
import { addSessionEntry, readSessionsIndex } from '../../../runtime/sessions/sessions-index.js';

// This test exercises the contract that the launcher block establishes:
// (sessionId, meta with null work item, sessions index entry with status active).
// We don't spawn opencode; we just verify the modules behave the way the
// launcher uses them.

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-launch-sess-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('launcher session generation contract', () => {
  it('generates id, writes unbound meta, registers active entry', async () => {
    const id = generateSessionId();
    const startedAt = new Date().toISOString();
    writeSessionMeta(base, {
      sessionId: id, workItemId: null, lane: null,
      repoRoot: '/repo', worktreePath: null,
      targetBranch: null, featureBranch: null, startedAt,
    });
    await addSessionEntry(base, {
      session_id: id, work_item_id: null, lane: null,
      worktree_path: null, repo_root: '/repo',
      pid: process.pid, status: 'active',
      started_at: startedAt, last_seen_at: startedAt,
    });

    const meta = readSessionMeta(base, id);
    assert.equal(meta.session_id, id);
    assert.equal(meta.work_item_id, null);
    assert.equal(meta.lane, null);

    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions.length, 1);
    assert.equal(idx.sessions[0].session_id, id);
    assert.equal(idx.sessions[0].status, 'active');
    assert.equal(idx.sessions[0].pid, process.pid);
  });

  it('different sessions land in different entries (multi-tab simulation)', async () => {
    const startedAt = new Date().toISOString();
    for (const id of [generateSessionId(), generateSessionId()]) {
      writeSessionMeta(base, {
        sessionId: id, workItemId: null, lane: null,
        repoRoot: '/repo', worktreePath: null,
        targetBranch: null, featureBranch: null, startedAt,
      });
      await addSessionEntry(base, {
        session_id: id, work_item_id: null, lane: null,
        worktree_path: null, repo_root: '/repo',
        pid: process.pid, status: 'active',
        started_at: startedAt, last_seen_at: startedAt,
      });
    }
    assert.equal(readSessionsIndex(base).sessions.length, 2);
  });
});
