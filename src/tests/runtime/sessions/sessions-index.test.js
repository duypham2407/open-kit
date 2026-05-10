import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readSessionsIndex, addSessionEntry, updateSessionEntry,
  removeSessionEntry, listSessions,
} from '../../../runtime/sessions/sessions-index.js';

let base;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-sidx-')); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

const entry = (overrides = {}) => ({
  session_id: 's_abcdef', work_item_id: 'full-x', lane: 'full',
  worktree_path: '/r/.claude/worktrees/full-x', repo_root: '/r',
  pid: 1234, status: 'active', started_at: '2026-05-09T10:00:00Z',
  last_seen_at: '2026-05-09T10:00:00Z', ...overrides,
});

describe('sessions-index', () => {
  it('readSessionsIndex returns empty schema when file missing', () => {
    const idx = readSessionsIndex(base);
    assert.equal(idx.schema, 'openkit/sessions-index@1');
    assert.deepEqual(idx.sessions, []);
  });

  it('addSessionEntry appends', async () => {
    await addSessionEntry(base, entry());
    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions.length, 1);
    assert.equal(idx.sessions[0].session_id, 's_abcdef');
  });

  it('addSessionEntry refuses duplicate session_id', async () => {
    await addSessionEntry(base, entry());
    await assert.rejects(() => addSessionEntry(base, entry()), /duplicate/i);
  });

  it('updateSessionEntry mutates one entry', async () => {
    await addSessionEntry(base, entry());
    await updateSessionEntry(base, 's_abcdef', (cur) => ({ ...cur, status: 'orphan' }));
    assert.equal(readSessionsIndex(base).sessions[0].status, 'orphan');
  });

  it('removeSessionEntry drops one entry', async () => {
    await addSessionEntry(base, entry());
    await removeSessionEntry(base, 's_abcdef');
    assert.deepEqual(readSessionsIndex(base).sessions, []);
  });

  it('listSessions filters by status', async () => {
    await addSessionEntry(base, entry({ session_id: 's_111111' }));
    await addSessionEntry(base, entry({ session_id: 's_222222', status: 'orphan' }));
    const orphans = listSessions(base, { status: 'orphan' });
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].session_id, 's_222222');
  });

  it('listSessions with no filter returns all', async () => {
    await addSessionEntry(base, entry({ session_id: 's_111111' }));
    await addSessionEntry(base, entry({ session_id: 's_222222', status: 'orphan' }));
    assert.equal(listSessions(base).length, 2);
    assert.equal(listSessions(base, { status: 'all' }).length, 2);
  });
});
