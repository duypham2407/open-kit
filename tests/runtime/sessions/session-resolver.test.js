import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSession } from '../../../src/runtime/sessions/session-resolver.js';
import { writeSessionMeta, bindSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import { addWorkItem } from '../../../src/runtime/sessions/work-items-index.js';
import { SessionRequiredError, SessionStateMismatchError, SessionNotFoundError } from '../../../src/runtime/sessions/errors.js';

let repo;
const baseFor = (root) => path.join(root, '.opencode');
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-resolve-'));
  fs.mkdirSync(path.join(baseFor(repo), 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('session-resolver', () => {
  it('throws SessionRequiredError when env missing', () => {
    assert.throws(() => resolveSession({ env: {}, repoRoot: repo }), (e) => e instanceof SessionRequiredError);
  });

  it('resolves quick session pointing at repo root .opencode', async () => {
    writeSessionMeta(baseFor(repo), {
      sessionId: 's_abcdef', workItemId: null, lane: null,
      repoRoot: repo, worktreePath: null,
      targetBranch: null, featureBranch: null, startedAt: '2026-05-09T10:00:00Z',
    });
    bindSessionMeta(baseFor(repo), 's_abcdef', { workItemId: 'q-x', lane: 'quick' });
    await addWorkItem(baseFor(repo), { workItemId: 'q-x', featureSlug: 'x', lane: 'quick', currentSessionId: 's_abcdef', statePath: 'p' });
    const r = resolveSession({ env: { OPENKIT_SESSION_ID: 's_abcdef' }, repoRoot: repo });
    assert.equal(r.sessionId, 's_abcdef');
    assert.equal(r.workItemId, 'q-x');
    assert.equal(r.lane, 'quick');
    assert.equal(r.baseDir, baseFor(repo));
    assert.equal(r.worktreePath, null);
    assert.match(r.mirrorPath, /sessions\/s_abcdef\/workflow-state\.json$/);
  });

  it('resolves full session pointing at worktree .opencode', async () => {
    const wt = path.join(repo, '.claude/worktrees/full-x');
    fs.mkdirSync(path.join(wt, '.opencode/work-items'), { recursive: true });
    writeSessionMeta(path.join(wt, '.opencode'), {
      sessionId: 's_aaaaaa', workItemId: null, lane: null,
      repoRoot: repo, worktreePath: null,
      targetBranch: null, featureBranch: null, startedAt: '2026-05-09T10:00:00Z',
    });
    bindSessionMeta(path.join(wt, '.opencode'), 's_aaaaaa', {
      workItemId: 'full-x', lane: 'full',
      worktreePath: wt, targetBranch: 'main', featureBranch: 'openkit/full-x',
    });
    await addWorkItem(path.join(wt, '.opencode'), { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_aaaaaa', statePath: 'p' });
    const r = resolveSession({ env: { OPENKIT_SESSION_ID: 's_aaaaaa', OPENKIT_PROJECT_ROOT: wt }, repoRoot: repo });
    assert.equal(r.baseDir, path.join(wt, '.opencode'));
    assert.equal(r.worktreePath, wt);
    assert.equal(r.featureBranch, 'openkit/full-x');
    assert.equal(r.targetBranch, 'main');
  });

  it('throws mismatch when index points at another session', async () => {
    writeSessionMeta(baseFor(repo), {
      sessionId: 's_abcdef', workItemId: null, lane: null,
      repoRoot: repo, worktreePath: null,
      targetBranch: null, featureBranch: null, startedAt: '2026-05-09T10:00:00Z',
    });
    bindSessionMeta(baseFor(repo), 's_abcdef', { workItemId: 'q-x', lane: 'quick' });
    await addWorkItem(baseFor(repo), { workItemId: 'q-x', featureSlug: 'x', lane: 'quick', currentSessionId: 's_other1', statePath: 'p' });
    assert.throws(
      () => resolveSession({ env: { OPENKIT_SESSION_ID: 's_abcdef' }, repoRoot: repo }),
      (e) => e instanceof SessionStateMismatchError,
    );
  });

  it('throws SessionNotFoundError when meta missing', () => {
    assert.throws(
      () => resolveSession({ env: { OPENKIT_SESSION_ID: 's_missing' }, repoRoot: repo }),
      (e) => e instanceof SessionNotFoundError,
    );
  });
});
