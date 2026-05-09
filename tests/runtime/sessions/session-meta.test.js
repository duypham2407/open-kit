import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSessionMeta, readSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import { SessionNotFoundError } from '../../../src/runtime/sessions/errors.js';

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-meta-')); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('session-meta', () => {
  const sample = {
    sessionId: 's_abcdef', workItemId: 'full-x', lane: 'full',
    repoRoot: '/r', worktreePath: '/r/.claude/worktrees/full-x',
    targetBranch: 'main', featureBranch: 'openkit/full-x',
    startedAt: '2026-05-09T10:00:00Z',
  };

  it('writes meta with schema and reads it back', () => {
    writeSessionMeta(tmp, sample);
    const got = readSessionMeta(tmp, 's_abcdef');
    assert.equal(got.schema, 'openkit/session-meta@1');
    assert.equal(got.session_id, 's_abcdef');
    assert.equal(got.work_item_id, 'full-x');
    assert.equal(got.feature_branch, 'openkit/full-x');
  });

  it('refuses to overwrite an existing meta', () => {
    writeSessionMeta(tmp, sample);
    assert.throws(() => writeSessionMeta(tmp, sample), /write-once/);
  });

  it('readSessionMeta throws SessionNotFoundError when missing', () => {
    assert.throws(() => readSessionMeta(tmp, 's_missing'), (e) => e instanceof SessionNotFoundError);
  });

  it('writes null worktree_path for quick sessions', () => {
    const quick = { ...sample, sessionId: 's_quickk', lane: 'quick', worktreePath: null, targetBranch: null, featureBranch: null };
    writeSessionMeta(tmp, quick);
    const got = readSessionMeta(tmp, 's_quickk');
    assert.equal(got.worktree_path, null);
    assert.equal(got.target_branch, null);
    assert.equal(got.feature_branch, null);
  });
});
