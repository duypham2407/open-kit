import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateSessionId } from '../../../runtime/sessions/session-id.js';
import { writeSessionMeta } from '../../../runtime/sessions/session-meta.js';
import {
  addSessionEntry,
  readSessionsIndex,
} from '../../../runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../../runtime/sessions/work-items-index.js';
import { writeHeartbeat } from '../../../runtime/sessions/heartbeat.js';
import { finishSession } from '../../../runtime/sessions/finish.js';
import { sessionMirrorPath } from '../../../runtime/sessions/session-paths.js';

/**
 * End-to-end finish flow:
 *
 *   1. Boot a fake active full-lane session (meta + index + heartbeat + mirror).
 *   2. Approve the lane's gate.
 *   3. Call finishSession() with a stubbed git that performs a real
 *      squash-merge sequence and a worktree remover.
 *   4. Assert: indexes flip, branch is deleted, worktree is removed,
 *      and the per-session mirror is left alone (forensic retention).
 */

let base;
let repoRoot;
let worktreePath;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finflow-'));
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finflow-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finflow-wt-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  fs.mkdirSync(path.join(base, 'sessions'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(worktreePath, { recursive: true, force: true });
});

const ts = () => new Date().toISOString();

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });

/**
 * Build a git stub that scripts the full-lane finish sequence
 * (rev-parse worktree, status --porcelain, rev-parse repo, merge --squash,
 *  commit, branch -D), recording each call.
 */
function buildFullLaneGit({ worktreePath, repoRoot, featureBranch, targetBranch }) {
  const calls = [];
  const stub = ({ cwd, args }) => {
    calls.push({ cwd, args });
    if (cwd === worktreePath && args.join(' ') === 'rev-parse --abbrev-ref HEAD') return ok(`${featureBranch}\n`);
    if (cwd === worktreePath && args.join(' ') === 'status --porcelain') return ok('');
    if (cwd === repoRoot && args.join(' ') === 'rev-parse --abbrev-ref HEAD') return ok(`${targetBranch}\n`);
    if (cwd === repoRoot && args[0] === 'merge' && args[1] === '--squash') return ok('Squash commit -- not updating HEAD\n');
    if (cwd === repoRoot && args[0] === 'commit') return ok('');
    if (cwd === repoRoot && args[0] === 'branch' && args[1] === '-D') return ok('');
    throw new Error(`unexpected git call: ${JSON.stringify({ cwd, args })}`);
  };
  return { git: stub, calls };
}

async function bootFullLaneSession({ baseDir, repoRoot, worktreePath, gateApproved = true }) {
  const sessionId = generateSessionId();
  const workItemId = 'full-fin';
  const featureBranch = `openkit/${workItemId}`;
  const targetBranch = 'main';
  const startedAt = ts();
  writeSessionMeta(baseDir, {
    sessionId, workItemId, lane: 'full',
    repoRoot, worktreePath,
    targetBranch, featureBranch,
    startedAt,
  });
  await addSessionEntry(baseDir, {
    session_id: sessionId, work_item_id: workItemId, lane: 'full',
    worktree_path: worktreePath, repo_root: repoRoot,
    pid: process.pid, status: 'active',
    started_at: startedAt, last_seen_at: startedAt,
  });
  await addWorkItem(baseDir, {
    workItemId, featureSlug: workItemId, lane: 'full',
    currentSessionId: sessionId, statePath: `work-items/${workItemId}.json`,
  });
  writeHeartbeat(baseDir, sessionId, process.pid);
  const mirrorPath = sessionMirrorPath(baseDir, sessionId);
  fs.writeFileSync(mirrorPath, JSON.stringify({ sessionId, scratch: 'finish-flow' }));
  return { sessionId, workItemId, featureBranch, targetBranch, mirrorPath };
}

describe('finish-flow integration', () => {
  it('full-lane: active → squash merge → closed; branch and worktree removed; mirror retained', async () => {
    const { sessionId, workItemId, featureBranch, targetBranch, mirrorPath } =
      await bootFullLaneSession({ baseDir: base, repoRoot, worktreePath });
    const { git, calls } = buildFullLaneGit({ worktreePath, repoRoot, featureBranch, targetBranch });
    const removerCalls = [];
    const worktreeRemover = ({ worktreePath: wt }) => {
      removerCalls.push(wt);
      return { status: 'removed' };
    };

    const readWorkflowState = (b, wid) => {
      assert.equal(b, base);
      assert.equal(wid, workItemId);
      return {
        approvals: { qa_to_done: { status: 'approved' } },
        artifacts: { solution_package: { summary: 'add login flow' } },
      };
    };

    const result = await finishSession({
      baseDir: base,
      sessionId,
      git,
      worktreeRemover,
      readWorkflowState,
    });

    // Result reflects the full-lane finish.
    assert.equal(result.sessionId, sessionId);
    assert.equal(result.workItemId, workItemId);
    assert.equal(result.lane, 'full');
    assert.equal(result.mergedCommit, 'full(full-fin): add login flow');
    assert.equal(result.worktreeRemoved, 'removed');

    // git was called the expected six times.
    const argLines = calls.map((c) => c.args.join(' '));
    assert.ok(argLines.includes('rev-parse --abbrev-ref HEAD'));
    assert.ok(argLines.some((a) => a.startsWith('merge --squash')));
    assert.ok(argLines.some((a) => a.startsWith('branch -D')));
    assert.deepEqual(removerCalls, [worktreePath]);

    // Indexes closed.
    const sIdx = readSessionsIndex(base);
    const sEntry = sIdx.sessions.find((s) => s.session_id === sessionId);
    assert.equal(sEntry.status, 'closed');
    assert.equal(sEntry.pid, null);

    const wIdx = readWorkItemsIndex(base);
    const wi = wIdx.work_items.find((w) => w.work_item_id === workItemId);
    assert.equal(wi.status, 'done');
    assert.equal(wi.current_session_id, null);

    // Per-session mirror retained for forensics — finish does not delete it.
    assert.equal(fs.existsSync(mirrorPath), true);
  });

  it('full-lane: gate not met → indexes untouched, no git, no remover call', async () => {
    const { sessionId } = await bootFullLaneSession({ baseDir: base, repoRoot, worktreePath });
    const { git, calls } = buildFullLaneGit({ worktreePath, repoRoot, featureBranch: 'x', targetBranch: 'x' });
    const removerCalls = [];

    const readWorkflowState = () => ({
      approvals: { qa_to_done: { status: 'pending' } },
    });

    await assert.rejects(
      () =>
        finishSession({
          baseDir: base,
          sessionId,
          git,
          worktreeRemover: ({ worktreePath: wt }) => {
            removerCalls.push(wt);
            return { status: 'removed' };
          },
          readWorkflowState,
        }),
      (err) => err.code === 'OK_FINISH_GATE_NOT_MET',
    );

    assert.equal(calls.length, 0);
    assert.equal(removerCalls.length, 0);

    const sIdx = readSessionsIndex(base);
    assert.equal(sIdx.sessions[0].status, 'active');
    const wIdx = readWorkItemsIndex(base);
    assert.equal(wIdx.work_items[0].status, 'in_progress');
    assert.equal(wIdx.work_items[0].current_session_id, sessionId);
  });

  it('quick-lane: gate met → indexes closed, no git, no worktreeRemover required', async () => {
    const sessionId = generateSessionId();
    const workItemId = 'quick-fin';
    const startedAt = ts();
    writeSessionMeta(base, {
      sessionId, workItemId, lane: 'quick',
      repoRoot, worktreePath: null,
      targetBranch: null, featureBranch: null,
      startedAt,
    });
    await addSessionEntry(base, {
      session_id: sessionId, work_item_id: workItemId, lane: 'quick',
      worktree_path: null, repo_root: repoRoot,
      pid: process.pid, status: 'active',
      started_at: startedAt, last_seen_at: startedAt,
    });
    await addWorkItem(base, {
      workItemId, featureSlug: workItemId, lane: 'quick',
      currentSessionId: sessionId, statePath: 'p',
    });

    const readWorkflowState = () => ({ approvals: { quick_verified: { status: 'approved' } } });

    const result = await finishSession({
      baseDir: base,
      sessionId,
      readWorkflowState,
    });

    assert.equal(result.lane, 'quick');
    assert.equal(result.mergedCommit, null);

    const wi = readWorkItemsIndex(base).work_items[0];
    assert.equal(wi.status, 'done');
    assert.equal(wi.current_session_id, null);
    const sEntry = readSessionsIndex(base).sessions[0];
    assert.equal(sEntry.status, 'closed');
  });

  it('full-lane: merge conflict → indexes left active, worktree not removed', async () => {
    const { sessionId, featureBranch, targetBranch } = await bootFullLaneSession({
      baseDir: base, repoRoot, worktreePath,
    });
    const calls = [];
    const git = ({ cwd, args }) => {
      calls.push({ cwd, args });
      if (cwd === worktreePath && args.join(' ') === 'rev-parse --abbrev-ref HEAD') return ok(`${featureBranch}\n`);
      if (cwd === worktreePath && args.join(' ') === 'status --porcelain') return ok('');
      if (cwd === repoRoot && args.join(' ') === 'rev-parse --abbrev-ref HEAD') return ok(`${targetBranch}\n`);
      if (cwd === repoRoot && args[0] === 'merge' && args[1] === '--squash') {
        return {
          status: 1,
          stdout: 'CONFLICT (content): Merge conflict in foo.txt\n',
          stderr: '',
        };
      }
      throw new Error(`unexpected git call: ${args.join(' ')}`);
    };

    let removerCalled = false;
    const worktreeRemover = () => {
      removerCalled = true;
      return { status: 'removed' };
    };

    await assert.rejects(
      () =>
        finishSession({
          baseDir: base,
          sessionId,
          git,
          worktreeRemover,
          readWorkflowState: () => ({
            approvals: { qa_to_done: { status: 'approved' } },
            artifacts: { solution_package: { summary: 's' } },
          }),
        }),
      (err) => err.code === 'OK_FINISH_MERGE_CONFLICT',
    );

    assert.equal(removerCalled, false);
    const sEntry = readSessionsIndex(base).sessions[0];
    assert.equal(sEntry.status, 'active');
    const wi = readWorkItemsIndex(base).work_items[0];
    assert.equal(wi.status, 'in_progress');
    assert.equal(wi.current_session_id, sEntry.session_id);
  });
});
