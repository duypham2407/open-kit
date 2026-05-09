import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { finishSession } from '../../../src/runtime/sessions/finish.js';
import { writeSessionMeta } from '../../../src/runtime/sessions/session-meta.js';
import {
  addSessionEntry,
  readSessionsIndex,
} from '../../../src/runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../../src/runtime/sessions/work-items-index.js';
import { SessionNotFoundError } from '../../../src/runtime/sessions/errors.js';

let base;
let repoRoot;
let worktreePath;

const STARTED = '2026-05-09T10:00:00.000Z';

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finish-'));
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finish-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finish-wt-'));
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
    status: 'active',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  if (meta.workItemId) {
    await addWorkItem(base, {
      workItemId: meta.workItemId,
      featureSlug: 'full-x',
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
    featureSlug: 'quick-y',
    lane: 'quick',
    currentSessionId: sessionId,
    statePath: 'p',
  });
};

const writeMigrationMeta = async (sessionId = 's_migr01') => {
  const meta = {
    sessionId,
    workItemId: 'migration-z',
    lane: 'migration',
    repoRoot,
    worktreePath,
    targetBranch: 'main',
    featureBranch: 'openkit/migration-z',
    startedAt: STARTED,
  };
  writeSessionMeta(base, meta);
  await addSessionEntry(base, {
    session_id: sessionId,
    work_item_id: meta.workItemId,
    lane: meta.lane,
    worktree_path: meta.worktreePath,
    repo_root: meta.repoRoot,
    pid: null,
    status: 'active',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  await addWorkItem(base, {
    workItemId: meta.workItemId,
    featureSlug: 'migration-z',
    lane: meta.lane,
    currentSessionId: sessionId,
    statePath: 'p',
  });
  return meta;
};

/** Build a workspace-shape state with the given gate approved (or not). */
const stateWithGate = (gateName, approved, extra = {}) => ({
  approvals: {
    [gateName]: { status: approved ? 'approved' : 'pending' },
  },
  artifacts: {},
  ...extra,
});

/** Helper that records every git invocation and returns scripted results. */
function makeGit(scripts) {
  // scripts: array of { match: (cmd) => boolean, response: { status, stdout, stderr } }
  const calls = [];
  const git = ({ cwd, args }) => {
    calls.push({ cwd, args });
    for (const s of scripts) {
      if (s.match({ cwd, args })) {
        return s.response;
      }
    }
    throw new Error(`unexpected git call: ${JSON.stringify({ cwd, args })}`);
  };
  return { git, calls };
}

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const fail = (stderr = 'boom') => ({ status: 1, stdout: '', stderr });
const conflict = () => ({
  status: 1,
  stdout: 'CONFLICT (content): Merge conflict in foo.txt\nAutomatic merge failed; fix conflicts and then commit the result.\n',
  stderr: '',
});

describe('finishSession — quick lane', () => {
  it('happy path: gate approved → work item done, session closed, no git calls', async () => {
    await writeQuickMeta('s_quick0');
    const readWorkflowState = (b, wid) => {
      assert.equal(b, base);
      assert.equal(wid, 'quick-y');
      return stateWithGate('quick_verified', true);
    };
    const { git, calls } = makeGit([]);

    const result = await finishSession({
      baseDir: base,
      sessionId: 's_quick0',
      git,
      readWorkflowState,
    });

    assert.equal(result.sessionId, 's_quick0');
    assert.equal(result.workItemId, 'quick-y');
    assert.equal(result.lane, 'quick');
    assert.equal(result.mergedCommit, null);
    assert.equal(calls.length, 0, 'quick lane must not invoke git');

    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'done');
    assert.equal(wIdx.work_items[0].current_session_id, null);

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'closed');
    assert.equal(sIdx.sessions[0].pid, null);
  });

  it('refuses when the quick_verified gate has not been approved', async () => {
    await writeQuickMeta('s_quick1');
    const readWorkflowState = () => stateWithGate('quick_verified', false);

    await assert.rejects(
      () =>
        finishSession({
          baseDir: base,
          sessionId: 's_quick1',
          readWorkflowState,
        }),
      (e) => e.code === 'OK_FINISH_GATE_NOT_MET' && e.gate === 'quick_verified',
    );

    // Indexes untouched.
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'in_progress');
    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'active');
  });

  it('also accepts the dotted gate name (state.gates["quick.verified"]=true)', async () => {
    await writeQuickMeta('s_quick2');
    const readWorkflowState = () => ({ gates: { 'quick.verified': true }, artifacts: {} });

    const result = await finishSession({
      baseDir: base,
      sessionId: 's_quick2',
      readWorkflowState,
    });
    assert.equal(result.lane, 'quick');
    assert.equal(readWorkItemsIndex(base).work_items[0].status, 'done');
  });
});

describe('finishSession — full lane', () => {
  it('happy path: gate met, branches match, clean worktree, merge succeeds, branch deleted, indexes closed', async () => {
    await writeFullMeta('s_full01');
    const readWorkflowState = () => stateWithGate('qa_to_done', true, {
      artifacts: { solution_package: { summary: 'add login flow' } },
    });

    const { git, calls } = makeGit([
      // Worktree branch read.
      { match: ({ cwd, args }) => cwd === worktreePath && args.join(' ') === 'rev-parse --abbrev-ref HEAD', response: ok('openkit/full-x\n') },
      // Worktree status check.
      { match: ({ cwd, args }) => cwd === worktreePath && args.join(' ') === 'status --porcelain', response: ok('') },
      // Repo root branch read.
      { match: ({ cwd, args }) => cwd === repoRoot && args.join(' ') === 'rev-parse --abbrev-ref HEAD', response: ok('main\n') },
      // Merge --squash.
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'merge' && args[1] === '--squash', response: ok('Squash commit -- not updating HEAD\n') },
      // Commit.
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'commit', response: ok('') },
      // Branch delete.
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'branch' && args[1] === '-D', response: ok('') },
    ]);

    let removerCalls = 0;
    const worktreeRemover = ({ worktreePath: wt }) => {
      removerCalls += 1;
      assert.equal(wt, worktreePath);
      return { status: 'removed' };
    };

    const result = await finishSession({
      baseDir: base,
      sessionId: 's_full01',
      git,
      worktreeRemover,
      readWorkflowState,
    });

    assert.equal(result.sessionId, 's_full01');
    assert.equal(result.workItemId, 'full-x');
    assert.equal(result.lane, 'full');
    assert.equal(result.mergedCommit, 'full(full-x): add login flow');
    assert.equal(result.worktreeRemoved, 'removed');
    assert.equal(removerCalls, 1);
    assert.equal(calls.length, 6, 'expected 6 git calls (branch×2, status, merge, commit, branch -D)');

    // The commit message must be exactly what was shipped to git.
    const commitCall = calls.find((c) => c.args[0] === 'commit');
    assert.deepEqual(commitCall.args, ['commit', '-m', 'full(full-x): add login flow']);

    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'done');
    assert.equal(wIdx.work_items[0].current_session_id, null);
    assert.equal(readSessionsIndex(base).sessions[0].status, 'closed');
  });

  it('migration lane: uses migration_verified gate and migration_report summary', async () => {
    await writeMigrationMeta('s_migr01');
    const readWorkflowState = () => stateWithGate('migration_verified', true, {
      artifacts: { migration_report: { summary: 'upgrade lockfile' } },
    });

    const { git } = makeGit([
      { match: ({ cwd, args }) => cwd === worktreePath && args.join(' ') === 'rev-parse --abbrev-ref HEAD', response: ok('openkit/migration-z\n') },
      { match: ({ cwd, args }) => cwd === worktreePath && args.join(' ') === 'status --porcelain', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args.join(' ') === 'rev-parse --abbrev-ref HEAD', response: ok('main\n') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'merge', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'commit', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'branch', response: ok('') },
    ]);

    const result = await finishSession({
      baseDir: base,
      sessionId: 's_migr01',
      git,
      worktreeRemover: () => ({ status: 'removed' }),
      readWorkflowState,
    });

    assert.equal(result.lane, 'migration');
    assert.equal(result.mergedCommit, 'migration(migration-z): upgrade lockfile');
  });

  it('refuses when qa_to_done gate not met (no git calls, indexes untouched)', async () => {
    await writeFullMeta('s_full02');
    const readWorkflowState = () => stateWithGate('qa_to_done', false);

    let gitCalled = false;
    const git = () => { gitCalled = true; return ok(); };
    const worktreeRemover = () => ({ status: 'removed' });

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_full02',
        git,
        worktreeRemover,
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_GATE_NOT_MET' && e.gate === 'qa_to_done',
    );
    assert.equal(gitCalled, false, 'must not invoke git when the gate has not passed');
    assert.equal(readWorkItemsIndex(base).work_items[0].status, 'in_progress');
    assert.equal(readSessionsIndex(base).sessions[0].status, 'active');
  });

  it('refuses when worktree path is missing on disk', async () => {
    const gone = path.join(os.tmpdir(), `ok-finish-gone-${Date.now()}-${Math.random()}`);
    await writeFullMeta('s_gone1', { worktreePath: gone });
    const readWorkflowState = () => stateWithGate('qa_to_done', true);

    const { git, calls } = makeGit([]);

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_gone1',
        git,
        worktreeRemover: () => ({ status: 'removed' }),
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_WORKTREE_MISSING' && e.worktreePath === gone,
    );
    assert.equal(calls.length, 0, 'should not run git when the worktree is missing');
  });

  it('refuses on branch mismatch in the worktree', async () => {
    await writeFullMeta('s_bm0001');
    const readWorkflowState = () => stateWithGate('qa_to_done', true);

    const { git, calls } = makeGit([
      { match: ({ cwd }) => cwd === worktreePath, response: ok('some-other-branch\n') },
    ]);

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_bm0001',
        git,
        worktreeRemover: () => ({ status: 'removed' }),
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_BRANCH_MISMATCH'
        && e.currentBranch === 'some-other-branch'
        && e.expected === 'openkit/full-x',
    );

    // Only the first git call (branch read) ran — no merge attempt.
    assert.equal(calls.length, 1);
    assert.equal(readSessionsIndex(base).sessions[0].status, 'active');
  });

  it('refuses on dirty worktree', async () => {
    await writeFullMeta('s_dirty1');
    const readWorkflowState = () => stateWithGate('qa_to_done', true);

    const { git, calls } = makeGit([
      { match: ({ args }) => args.join(' ') === 'rev-parse --abbrev-ref HEAD', response: ok('openkit/full-x\n') },
      { match: ({ args }) => args.join(' ') === 'status --porcelain', response: ok(' M src/foo.js\n') },
    ]);

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_dirty1',
        git,
        worktreeRemover: () => ({ status: 'removed' }),
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_WORKTREE_DIRTY',
    );
    assert.equal(calls.length, 2, 'should stop after the dirty status check');
  });

  it('refuses when the repo root is on the wrong branch', async () => {
    await writeFullMeta('s_wrong1');
    const readWorkflowState = () => stateWithGate('qa_to_done', true);

    const { git, calls } = makeGit([
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'rev-parse', response: ok('openkit/full-x\n') },
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'status', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'rev-parse', response: ok('feature/elsewhere\n') },
    ]);

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_wrong1',
        git,
        worktreeRemover: () => ({ status: 'removed' }),
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_REPO_WRONG_BRANCH'
        && e.currentBranch === 'feature/elsewhere'
        && e.expected === 'main',
    );
    assert.equal(calls.length, 3, 'should stop before merging when repo is on the wrong branch');
  });

  it('refuses on merge conflict and leaves worktree, branch, and session untouched', async () => {
    await writeFullMeta('s_conf01');
    const readWorkflowState = () => stateWithGate('qa_to_done', true, {
      artifacts: { solution_package: { summary: 'something' } },
    });

    const { git, calls } = makeGit([
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'rev-parse', response: ok('openkit/full-x\n') },
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'status', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'rev-parse', response: ok('main\n') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'merge', response: conflict() },
    ]);

    let removerCalled = false;
    const worktreeRemover = () => { removerCalled = true; return { status: 'removed' }; };

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_conf01',
        git,
        worktreeRemover,
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_MERGE_CONFLICT'
        && e.featureBranch === 'openkit/full-x'
        && /CONFLICT/.test(e.stdout || ''),
    );

    // Crucially: no commit, no branch -D, no worktree removal.
    assert.equal(calls.filter((c) => c.args[0] === 'commit').length, 0);
    assert.equal(calls.filter((c) => c.args[0] === 'branch').length, 0);
    assert.equal(removerCalled, false, 'worktreeRemover must not be called on merge conflict');

    // Worktree dir still on disk.
    assert.equal(fs.existsSync(worktreePath), true);

    // Indexes untouched.
    assert.equal(readWorkItemsIndex(base).work_items[0].status, 'in_progress');
    assert.equal(readSessionsIndex(base).sessions[0].status, 'active');
  });

  it('falls back to feature_slug when no artifact summary is present', async () => {
    await writeFullMeta('s_fb0001');
    const readWorkflowState = () => stateWithGate('qa_to_done', true); // no artifacts

    const { git, calls } = makeGit([
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'rev-parse', response: ok('openkit/full-x\n') },
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'status', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'rev-parse', response: ok('main\n') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'merge', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'commit', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'branch', response: ok('') },
    ]);

    const result = await finishSession({
      baseDir: base,
      sessionId: 's_fb0001',
      git,
      worktreeRemover: () => ({ status: 'removed' }),
      readWorkflowState,
    });

    // No summary text → falls back to feature_slug ("full-x").
    assert.equal(result.mergedCommit, 'full(full-x): full-x');
    const commitCall = calls.find((c) => c.args[0] === 'commit');
    assert.deepEqual(commitCall.args, ['commit', '-m', 'full(full-x): full-x']);
  });

  it('throws SessionNotFoundError when meta.json is missing', async () => {
    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_nope01',
        readWorkflowState: () => ({}),
      }),
      (e) => e instanceof SessionNotFoundError && e.sessionId === 's_nope01',
    );
  });

  it('throws when readWorkflowState is missing', async () => {
    await writeQuickMeta('s_quick9');
    await assert.rejects(
      () => finishSession({ baseDir: base, sessionId: 's_quick9' }),
      /requires an injected readWorkflowState/,
    );
  });

  it('throws when worktreeRemover is missing on a full lane that needs removal', async () => {
    await writeFullMeta('s_nrm001');
    const readWorkflowState = () => stateWithGate('qa_to_done', true, {
      artifacts: { solution_package: { summary: 'x' } },
    });

    const { git } = makeGit([
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'rev-parse', response: ok('openkit/full-x\n') },
      { match: ({ cwd, args }) => cwd === worktreePath && args[0] === 'status', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'rev-parse', response: ok('main\n') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'merge', response: ok('') },
      { match: ({ cwd, args }) => cwd === repoRoot && args[0] === 'commit', response: ok('') },
    ]);

    await assert.rejects(
      () => finishSession({
        baseDir: base,
        sessionId: 's_nrm001',
        git,
        readWorkflowState,
      }),
      (e) => e.code === 'OK_FINISH_REMOVER_MISSING',
    );
  });
});
