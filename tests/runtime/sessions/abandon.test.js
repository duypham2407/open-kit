import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abandonSession } from '../../../src/runtime/sessions/abandon.js';
import { writeSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import {
  addSessionEntry,
  readSessionsIndex,
} from '../../../src/runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../../src/runtime/sessions/work-items-index.js';
import { sessionDir } from '../../../src/runtime/sessions/session-paths.js';
import { SessionNotFoundError } from '../../../src/runtime/sessions/errors.js';

let base;
let repoRoot;
let worktreePath;

const STARTED = '2026-05-09T10:00:00.000Z';

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-abandon-'));
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-abandon-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-abandon-wt-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(worktreePath, { recursive: true, force: true });
});

const writeFullMeta = async (sessionId = 's_full01', overrides = {}) => {
  const meta = {
    sessionId,
    workItemId: 'full-x',
    lane: 'full',
    repoRoot,
    worktreePath,
    targetBranch: 'main',
    featureBranch: 'openkit/full-x',
    startedAt: STARTED,
    ...overrides,
  };
  writeSessionMeta(base, meta);
  await addSessionEntry(base, {
    session_id: sessionId,
    work_item_id: meta.workItemId,
    lane: meta.lane,
    worktree_path: meta.worktreePath,
    repo_root: meta.repoRoot,
    pid: null,
    status: 'orphan',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  if (meta.workItemId) {
    await addWorkItem(base, {
      workItemId: meta.workItemId,
      featureSlug: 'x',
      lane: meta.lane,
      currentSessionId: sessionId,
      statePath: 'p',
    });
  }
  return meta;
};

const writeQuickMeta = async (sessionId = 's_quick0') => {
  writeSessionMeta(base, {
    sessionId,
    workItemId: 'quick-y',
    lane: 'quick',
    repoRoot,
    worktreePath: null,
    targetBranch: null,
    featureBranch: null,
    startedAt: STARTED,
  });
  await addSessionEntry(base, {
    session_id: sessionId,
    work_item_id: 'quick-y',
    lane: 'quick',
    worktree_path: null,
    repo_root: repoRoot,
    pid: null,
    status: 'active',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  await addWorkItem(base, {
    workItemId: 'quick-y',
    featureSlug: 'y',
    lane: 'quick',
    currentSessionId: sessionId,
    statePath: 'p',
  });
};

describe('abandonSession', () => {
  it('quick lane: marks work item abandoned, deletes session dir, removes index entry, no prompt', async () => {
    await writeQuickMeta('s_quick0');
    // Sanity: the session dir exists before abandon (writeSessionMeta created it).
    assert.equal(fs.existsSync(sessionDir(base, 's_quick0')), true);

    const promptCalls = [];
    const removerCalls = [];

    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_quick0',
      prompt: (...args) => { promptCalls.push(args); return 'keep'; },
      worktreeRemover: (...args) => { removerCalls.push(args); return { status: 'removed' }; },
    });

    assert.deepEqual(result, {
      sessionId: 's_quick0',
      workItemId: 'quick-y',
      worktreeAction: 'none',
    });
    assert.equal(promptCalls.length, 0, 'prompt must not be called when there is no worktree');
    assert.equal(removerCalls.length, 0, 'worktreeRemover must not be called when there is no worktree');

    // Session directory deleted.
    assert.equal(fs.existsSync(sessionDir(base, 's_quick0')), false);

    // Sessions index entry removed.
    assert.equal(readSessionsIndex(base).sessions.length, 0);

    // Work item status flipped, current_session_id cleared. State NOT deleted.
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items.length, 1);
    assert.equal(wIdx.work_items[0].status, 'abandoned');
    assert.equal(wIdx.work_items[0].current_session_id, null);
  });

  it('full lane happy path: prompt returns keep — worktree left intact', async () => {
    await writeFullMeta('s_full01');

    const removerCalls = [];
    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_full01',
      prompt: ({ worktreePath: wt }) => {
        assert.equal(wt, worktreePath);
        return 'keep';
      },
      worktreeRemover: (...args) => { removerCalls.push(args); return { status: 'removed' }; },
    });

    assert.deepEqual(result, {
      sessionId: 's_full01',
      workItemId: 'full-x',
      worktreeAction: 'kept',
    });
    assert.equal(removerCalls.length, 0, 'worktreeRemover must not be called when user picks keep');

    // Worktree dir still present on disk.
    assert.equal(fs.existsSync(worktreePath), true);

    // Indexes updated.
    assert.equal(readSessionsIndex(base).sessions.length, 0);
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'abandoned');
    assert.equal(wIdx.work_items[0].current_session_id, null);
  });

  it('full lane: prompt returns remove on a clean worktree — remover called with force=false and reports removed', async () => {
    await writeFullMeta('s_full02');

    const removerCalls = [];
    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_full02',
      prompt: () => 'remove',
      worktreeRemover: (args) => {
        removerCalls.push(args);
        return { status: 'removed' };
      },
    });

    assert.deepEqual(result, {
      sessionId: 's_full02',
      workItemId: 'full-x',
      worktreeAction: 'removed',
    });
    assert.equal(removerCalls.length, 1);
    assert.deepEqual(removerCalls[0], { worktreePath, force: false });
  });

  it('full lane: dirty worktree without --force-remove-dirty is refused (abandon still committed)', async () => {
    await writeFullMeta('s_dirty1');

    let forceSeen;
    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_dirty1',
      forceRemoveDirty: false,
      prompt: () => 'remove',
      worktreeRemover: ({ force }) => {
        forceSeen = force;
        return { status: 'refused-dirty' };
      },
    });

    assert.deepEqual(result, {
      sessionId: 's_dirty1',
      workItemId: 'full-x',
      worktreeAction: 'refused-dirty',
    });
    assert.equal(forceSeen, false);

    // Crucially, the abandon itself committed even though worktree removal was refused.
    assert.equal(fs.existsSync(sessionDir(base, 's_dirty1')), false);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'abandoned');
    assert.equal(wIdx.work_items[0].current_session_id, null);

    // The dirty worktree is left on disk for the user to inspect.
    assert.equal(fs.existsSync(worktreePath), true);
  });

  it('full lane: --force-remove-dirty forwards force=true to remover', async () => {
    await writeFullMeta('s_dirty2');

    let forceSeen;
    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_dirty2',
      forceRemoveDirty: true,
      prompt: () => 'remove',
      worktreeRemover: ({ force }) => {
        forceSeen = force;
        return { status: 'removed' };
      },
    });

    assert.equal(forceSeen, true);
    assert.equal(result.worktreeAction, 'removed');
  });

  it('full lane: missing worktree on disk is reported as missing, no prompt, no remover', async () => {
    const gone = path.join(os.tmpdir(), `ok-abandon-gone-${Date.now()}-${Math.random()}`);
    await writeFullMeta('s_gone01', { worktreePath: gone });

    let promptCalls = 0;
    let removerCalls = 0;
    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_gone01',
      prompt: () => { promptCalls += 1; return 'remove'; },
      worktreeRemover: () => { removerCalls += 1; return { status: 'removed' }; },
    });

    assert.deepEqual(result, {
      sessionId: 's_gone01',
      workItemId: 'full-x',
      worktreeAction: 'missing',
    });
    assert.equal(promptCalls, 0, 'prompt must not be called when worktree path is missing');
    assert.equal(removerCalls, 0, 'remover must not be called when worktree path is missing');

    // Abandon still committed.
    assert.equal(readSessionsIndex(base).sessions.length, 0);
    assert.equal(readWorkItemsIndex(base).work_items[0].status, 'abandoned');
  });

  it('throws SessionNotFoundError when meta.json is missing', async () => {
    await assert.rejects(
      () => abandonSession({
        baseDir: base,
        sessionId: 's_missing',
        prompt: () => 'keep',
        worktreeRemover: () => ({ status: 'removed' }),
      }),
      (e) => e instanceof SessionNotFoundError && e.sessionId === 's_missing',
    );
  });

  it('unbound session (work_item_id=null) does not touch work-items index', async () => {
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
      pid: null,
      status: 'orphan',
      started_at: STARTED,
      last_seen_at: STARTED,
    });

    const result = await abandonSession({
      baseDir: base,
      sessionId: 's_unbnd0',
      prompt: () => 'keep',
      worktreeRemover: () => ({ status: 'removed' }),
    });

    assert.deepEqual(result, {
      sessionId: 's_unbnd0',
      workItemId: null,
      worktreeAction: 'none',
    });

    // No work-items entries were created or modified.
    assert.equal(readWorkItemsIndex(base).work_items.length, 0);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
    assert.equal(fs.existsSync(sessionDir(base, 's_unbnd0')), false);
  });

  it('throws when prompt is missing but a worktree exists', async () => {
    await writeFullMeta('s_full03');

    await assert.rejects(
      () => abandonSession({
        baseDir: base,
        sessionId: 's_full03',
        worktreeRemover: () => ({ status: 'removed' }),
      }),
      /requires an injected prompt/,
    );
  });

  it('throws when worktreeRemover is missing but a worktree exists', async () => {
    await writeFullMeta('s_full04');

    await assert.rejects(
      () => abandonSession({
        baseDir: base,
        sessionId: 's_full04',
        prompt: () => 'remove',
      }),
      /requires an injected worktreeRemover/,
    );
  });

  it('rejects unknown prompt return values', async () => {
    await writeFullMeta('s_full05');

    await assert.rejects(
      () => abandonSession({
        baseDir: base,
        sessionId: 's_full05',
        prompt: () => 'maybe',
        worktreeRemover: () => ({ status: 'removed' }),
      }),
      /must return 'keep' or 'remove'/,
    );
  });
});
