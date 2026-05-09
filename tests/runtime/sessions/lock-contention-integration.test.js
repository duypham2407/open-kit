import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  addSessionEntry,
  readSessionsIndex,
  updateSessionEntry,
} from '../../../src/runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
  setWorkItemStatus,
  setCurrentSessionId,
} from '../../../src/runtime/sessions/work-items-index.js';
import { generateSessionId } from '../../../src/runtime/sessions/session-id.js';
import { sessionsIndexPath, workItemsIndexPath } from '../../../src/runtime/sessions/session-paths.js';

/**
 * Integration test for atomic-write lock contention. Concurrent writes to
 * sessions/index.json and work-items/index.json must:
 *
 *   1. Not corrupt the file (always parses to valid JSON).
 *   2. Not lose updates (every entry is present after the dust settles).
 *   3. Not leak .tmp files.
 *   4. Not cross-contaminate (writes to one file do not block the other forever).
 */

let base;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-lock-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  fs.mkdirSync(path.join(base, 'sessions'), { recursive: true });
});

afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

const ts = () => new Date().toISOString();

describe('lock contention integration', () => {
  it('20 concurrent addSessionEntry calls all land without corruption', async () => {
    const ids = Array.from({ length: 20 }, () => generateSessionId());
    // De-dup just in case generateSessionId collides (probability is vanishing)
    const unique = Array.from(new Set(ids));
    await Promise.all(
      unique.map((id) =>
        addSessionEntry(base, {
          session_id: id,
          work_item_id: null,
          lane: null,
          worktree_path: null,
          repo_root: '/r',
          pid: process.pid,
          status: 'active',
          started_at: ts(),
          last_seen_at: ts(),
        }),
      ),
    );
    const idx = readSessionsIndex(base);
    assert.equal(idx.sessions.length, unique.length);
    assert.equal(new Set(idx.sessions.map((s) => s.session_id)).size, unique.length);
  });

  it('concurrent addSessionEntry + updateSessionEntry serialize correctly', async () => {
    const id = generateSessionId();
    await addSessionEntry(base, {
      session_id: id, work_item_id: null, lane: null,
      worktree_path: null, repo_root: '/r',
      pid: process.pid, status: 'active',
      started_at: ts(), last_seen_at: ts(),
    });
    await Promise.all([
      updateSessionEntry(base, id, (cur) => ({ ...cur, last_seen_at: '2026-05-09T10:00:00.000Z' })),
      updateSessionEntry(base, id, (cur) => ({ ...cur, status: 'closed' })),
      updateSessionEntry(base, id, (cur) => ({ ...cur, pid: null })),
    ]);
    const entry = readSessionsIndex(base).sessions[0];
    // Three independent updates all happened: the file is valid JSON and contains
    // the merged state of all three (the "last write wins" for any conflicting
    // field, but each independent field shows up).
    assert.equal(entry.session_id, id);
    assert.equal(entry.status, 'closed');
    assert.equal(entry.pid, null);
    assert.equal(entry.last_seen_at, '2026-05-09T10:00:00.000Z');
  });

  it('concurrent writes to sessions/index and work-items/index do not block each other', async () => {
    const start = Date.now();
    const sids = Array.from({ length: 5 }, () => generateSessionId());
    const wids = Array.from({ length: 5 }, (_, i) => `wi-${i}-${Date.now()}`);

    await Promise.all([
      ...sids.map((id) =>
        addSessionEntry(base, {
          session_id: id, work_item_id: null, lane: null,
          worktree_path: null, repo_root: '/r',
          pid: process.pid, status: 'active',
          started_at: ts(), last_seen_at: ts(),
        }),
      ),
      ...wids.map((wi) =>
        addWorkItem(base, {
          workItemId: wi, featureSlug: wi, lane: 'full',
          currentSessionId: null, statePath: `work-items/${wi}.json`,
        }),
      ),
    ]);

    const elapsed = Date.now() - start;
    // Should complete in well under the lock-timeout (~2s + retries). The two
    // files have independent locks, so total wall time ≈ max of either file's
    // serial latency, not sum.
    assert.ok(elapsed < 5000, `expected <5s, got ${elapsed}ms`);
    assert.equal(readSessionsIndex(base).sessions.length, sids.length);
    assert.equal(readWorkItemsIndex(base).work_items.length, wids.length);
  });

  it('does not leak .tmp files after concurrent contention', async () => {
    const ids = Array.from({ length: 10 }, () => generateSessionId());
    await Promise.all(
      ids.map((id) =>
        addSessionEntry(base, {
          session_id: id, work_item_id: null, lane: null,
          worktree_path: null, repo_root: '/r',
          pid: process.pid, status: 'active',
          started_at: ts(), last_seen_at: ts(),
        }),
      ),
    );
    const sessionsDirContents = fs.readdirSync(path.dirname(sessionsIndexPath(base)));
    const stray = sessionsDirContents.filter((n) => n.includes('.tmp.'));
    assert.deepEqual(stray, []);
  });

  it('file always parses as valid JSON during concurrent writes', async () => {
    const ids = Array.from({ length: 15 }, () => generateSessionId());
    let parseFailures = 0;
    const reader = (async () => {
      const deadline = Date.now() + 800;
      while (Date.now() < deadline) {
        if (fs.existsSync(sessionsIndexPath(base))) {
          try {
            const raw = fs.readFileSync(sessionsIndexPath(base), 'utf8');
            JSON.parse(raw);
          } catch {
            parseFailures += 1;
          }
        }
        await delay(5);
      }
    })();
    const writers = ids.map((id) =>
      addSessionEntry(base, {
        session_id: id, work_item_id: null, lane: null,
        worktree_path: null, repo_root: '/r',
        pid: process.pid, status: 'active',
        started_at: ts(), last_seen_at: ts(),
      }),
    );
    await Promise.all([reader, ...writers]);
    assert.equal(parseFailures, 0, 'no observer should see partially-written JSON');
  });

  it('concurrent work-items mutations preserve the v3 schema', async () => {
    const wis = Array.from({ length: 8 }, (_, i) => `wi-conc-${i}`);
    await Promise.all(
      wis.map((wi) =>
        addWorkItem(base, {
          workItemId: wi, featureSlug: wi, lane: 'full',
          currentSessionId: null, statePath: `work-items/${wi}.json`,
        }),
      ),
    );
    await Promise.all([
      ...wis.map((wi) => setWorkItemStatus(base, wi, 'in_progress')),
      ...wis.map((wi) => setCurrentSessionId(base, wi, `s_${wi.slice(0, 6).padEnd(6, '0')}`)),
    ]);
    const idx = readWorkItemsIndex(base);
    assert.equal(idx.schema, 'openkit/work-items-index@3');
    assert.equal(idx.work_items.length, wis.length);
    for (const wi of idx.work_items) {
      assert.equal(wi.status, 'in_progress');
      assert.notEqual(wi.current_session_id, null);
    }
  });
});
