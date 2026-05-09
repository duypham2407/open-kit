import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resumeSession } from '../../../src/runtime/sessions/resume.js';
import { writeSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import { addSessionEntry, readSessionsIndex } from '../../../src/runtime/sessions/sessions-index.js';
import { addWorkItem, readWorkItemsIndex } from '../../../src/runtime/sessions/work-items-index.js';
import { sessionMirrorPath } from '../../../src/runtime/sessions/session-paths.js';
import {
  SessionNotFoundError,
  WorktreeMissingError,
  SessionStateMismatchError,
} from '../../../src/runtime/sessions/errors.js';

let base;
let repoRoot;
let worktreePath;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-resume-'));
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-resume-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-resume-wt-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(worktreePath, { recursive: true, force: true });
});

const STARTED = '2026-05-09T10:00:00.000Z';
const FIXED_NOW = Date.parse('2026-05-09T11:00:00.000Z');

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
      currentSessionId: null,
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
    status: 'orphan',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  await addWorkItem(base, {
    workItemId: 'quick-y',
    featureSlug: 'y',
    lane: 'quick',
    currentSessionId: null,
    statePath: 'p',
  });
};

describe('resumeSession', () => {
  it('quick lane: skips worktree validation, updates indexes, and spawns', async () => {
    await writeQuickMeta('s_quick0');

    const gitCalls = [];
    const spawnCalls = [];
    const result = await resumeSession({
      baseDir: base,
      sessionId: 's_quick0',
      newPid: 4242,
      now: () => FIXED_NOW,
      git: (wt) => { gitCalls.push(wt); return 'unused'; },
      spawn: async (env, ctx) => { spawnCalls.push({ env, ctx }); return { ok: true }; },
    });

    assert.equal(gitCalls.length, 0, 'git must not be called for quick lane');
    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(spawnCalls[0].env, {
      OPENKIT_SESSION_ID: 's_quick0',
      OPENKIT_WORK_ITEM_ID: 'quick-y',
      OPENKIT_PROJECT_ROOT: repoRoot,
      OPENKIT_REPOSITORY_ROOT: repoRoot,
      OPENKIT_WORKFLOW_STATE: sessionMirrorPath(base, 's_quick0'),
    });
    assert.deepEqual(result.spawnResult, { ok: true });

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'active');
    assert.equal(sIdx.sessions[0].pid, 4242);
    assert.equal(sIdx.sessions[0].last_seen_at, new Date(FIXED_NOW).toISOString());

    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].current_session_id, 's_quick0');
    assert.equal(wIdx.work_items[0].status, 'in_progress');
  });

  it('full lane: validates worktree + branch, updates indexes, and spawns', async () => {
    await writeFullMeta('s_full01');

    const gitCalls = [];
    const spawnCalls = [];
    const result = await resumeSession({
      baseDir: base,
      sessionId: 's_full01',
      newPid: 7777,
      now: () => FIXED_NOW,
      git: (wt) => { gitCalls.push(wt); return 'openkit/full-x'; },
      spawn: async (env) => { spawnCalls.push(env); return 'spawned'; },
    });

    assert.deepEqual(gitCalls, [worktreePath]);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].OPENKIT_PROJECT_ROOT, worktreePath);
    assert.equal(spawnCalls[0].OPENKIT_REPOSITORY_ROOT, repoRoot);
    assert.equal(spawnCalls[0].OPENKIT_SESSION_ID, 's_full01');
    assert.equal(spawnCalls[0].OPENKIT_WORK_ITEM_ID, 'full-x');
    assert.equal(spawnCalls[0].OPENKIT_WORKFLOW_STATE, sessionMirrorPath(base, 's_full01'));
    assert.equal(result.spawnResult, 'spawned');

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'active');
    assert.equal(sIdx.sessions[0].pid, 7777);

    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].current_session_id, 's_full01');
    assert.equal(wIdx.work_items[0].status, 'in_progress');
  });

  it('throws SessionNotFoundError when meta.json is missing', async () => {
    await assert.rejects(
      () => resumeSession({
        baseDir: base,
        sessionId: 's_missing',
        newPid: 1,
        spawn: async () => {},
      }),
      (e) => e instanceof SessionNotFoundError && e.sessionId === 's_missing',
    );
  });

  it('throws WorktreeMissingError when worktree_path does not exist', async () => {
    const gone = path.join(os.tmpdir(), `ok-resume-gone-${Date.now()}-${Math.random()}`);
    await writeFullMeta('s_gone01', { worktreePath: gone });

    let spawned = false;
    await assert.rejects(
      () => resumeSession({
        baseDir: base,
        sessionId: 's_gone01',
        newPid: 1,
        git: () => { throw new Error('git should not be called when worktree missing'); },
        spawn: async () => { spawned = true; },
      }),
      (e) => e instanceof WorktreeMissingError && e.worktreePath === gone,
    );
    assert.equal(spawned, false, 'spawn must not run when worktree is missing');

    // Indexes must be untouched.
    assert.equal(readSessionsIndex(base).sessions[0].status, 'orphan');
    assert.equal(readWorkItemsIndex(base).work_items[0].current_session_id, null);
  });

  it('throws SessionStateMismatchError when worktree branch != feature_branch', async () => {
    await writeFullMeta('s_full02');

    let spawned = false;
    await assert.rejects(
      () => resumeSession({
        baseDir: base,
        sessionId: 's_full02',
        newPid: 1,
        git: () => 'main', // wrong branch
        spawn: async () => { spawned = true; },
      }),
      (e) => e instanceof SessionStateMismatchError,
    );
    assert.equal(spawned, false, 'spawn must not run on branch mismatch');

    // Indexes must be untouched.
    assert.equal(readSessionsIndex(base).sessions[0].status, 'orphan');
    assert.equal(readWorkItemsIndex(base).work_items[0].current_session_id, null);
  });

  it('updates both indexes atomically with last_seen_at = now()', async () => {
    await writeFullMeta('s_full03');

    await resumeSession({
      baseDir: base,
      sessionId: 's_full03',
      newPid: 9001,
      now: () => FIXED_NOW,
      git: () => 'openkit/full-x',
      spawn: async () => null,
    });

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].session_id, 's_full03');
    assert.equal(sIdx.sessions[0].status, 'active');
    assert.equal(sIdx.sessions[0].pid, 9001);
    assert.equal(sIdx.sessions[0].last_seen_at, new Date(FIXED_NOW).toISOString());

    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].current_session_id, 's_full03');
    assert.equal(wIdx.work_items[0].status, 'in_progress');
  });

  it('does not touch work-items index when meta has no work_item_id (unbound launcher session)', async () => {
    // Simulate a launcher-created meta that was never bound.
    writeSessionMeta(base, {
      sessionId: 's_unbnd0', workItemId: null, lane: null,
      repoRoot, worktreePath: null, targetBranch: null, featureBranch: null,
      startedAt: STARTED,
    });
    await addSessionEntry(base, {
      session_id: 's_unbnd0', work_item_id: null, lane: null,
      worktree_path: null, repo_root: repoRoot,
      pid: null, status: 'orphan',
      started_at: STARTED, last_seen_at: STARTED,
    });

    const spawnCalls = [];
    await resumeSession({
      baseDir: base,
      sessionId: 's_unbnd0',
      newPid: 5,
      now: () => FIXED_NOW,
      spawn: async (env) => { spawnCalls.push(env); },
    });

    assert.equal(spawnCalls[0].OPENKIT_WORK_ITEM_ID, '');
    assert.equal(readSessionsIndex(base).sessions[0].status, 'active');
    // No work item entries created by resume.
    assert.equal(readWorkItemsIndex(base).work_items.length, 0);
  });

  it('throws when spawn is not provided', async () => {
    await writeQuickMeta('s_quick1');
    await assert.rejects(
      () => resumeSession({ baseDir: base, sessionId: 's_quick1', newPid: 1 }),
      /requires an injected spawn/,
    );
  });
});
