import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { finishCommand } from '../../cli/commands/finish.js';
import { runCli } from '../../cli/index.js';
import { writeSessionMeta } from '../../runtime/sessions/session-meta.js';
import {
  addSessionEntry,
  readSessionsIndex,
} from '../../runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../runtime/sessions/work-items-index.js';

let projectRoot;
let baseDir;
let repoRoot;
let worktreePath;

const STARTED = '2026-05-09T10:00:00.000Z';

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finish-cli-'));
  baseDir = path.join(projectRoot, '.opencode');
  fs.mkdirSync(path.join(baseDir, 'work-items'), { recursive: true });
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finish-cli-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-finish-cli-wt-'));
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(worktreePath, { recursive: true, force: true });
});

function captureIo() {
  const stdout = { chunks: [], write: (s) => { stdout.chunks.push(String(s)); return true; } };
  const stderr = { chunks: [], write: (s) => { stderr.chunks.push(String(s)); return true; } };
  return {
    stdout,
    stderr,
    stdin: process.stdin,
    out: () => stdout.chunks.join(''),
    err: () => stderr.chunks.join(''),
  };
}

async function seedQuickSession(sessionId = 's_qfn001', workItemId = 'wi-qfn') {
  writeSessionMeta(baseDir, {
    sessionId,
    workItemId,
    lane: 'quick',
    repoRoot,
    worktreePath: null,
    targetBranch: null,
    featureBranch: null,
    startedAt: STARTED,
  });
  await addSessionEntry(baseDir, {
    session_id: sessionId,
    work_item_id: workItemId,
    lane: 'quick',
    worktree_path: null,
    repo_root: repoRoot,
    pid: process.pid,
    status: 'active',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  await addWorkItem(baseDir, {
    workItemId,
    featureSlug: workItemId,
    lane: 'quick',
    currentSessionId: sessionId,
    statePath: `.opencode/work-items/${workItemId}/state.json`,
  });
  return { sessionId, workItemId };
}

async function seedFullSession(sessionId = 's_full01', workItemId = 'wi-full') {
  writeSessionMeta(baseDir, {
    sessionId,
    workItemId,
    lane: 'full',
    repoRoot,
    worktreePath,
    targetBranch: 'main',
    featureBranch: `openkit/${workItemId}`,
    startedAt: STARTED,
  });
  await addSessionEntry(baseDir, {
    session_id: sessionId,
    work_item_id: workItemId,
    lane: 'full',
    worktree_path: worktreePath,
    repo_root: repoRoot,
    pid: process.pid,
    status: 'active',
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  await addWorkItem(baseDir, {
    workItemId,
    featureSlug: workItemId,
    lane: 'full',
    currentSessionId: sessionId,
    statePath: `.opencode/work-items/${workItemId}/state.json`,
  });
  return { sessionId, workItemId };
}

function envFor(sessionId) {
  return {
    OPENKIT_SESSION_ID: sessionId,
    OPENKIT_PROJECT_ROOT: projectRoot,
  };
}

describe('openkit finish — quick lane', () => {
  it('exits 0, marks work item done, marks session closed (no git calls)', async () => {
    const { sessionId, workItemId } = await seedQuickSession();
    const io = captureIo();

    let gitCalls = 0;
    const code = await finishCommand.run([], io, {
      deps: {
        env: envFor(sessionId),
        repoRoot,
        git: () => { gitCalls += 1; return { status: 0, stdout: '', stderr: '' }; },
        readWorkflowState: () => ({ approvals: { quick_verified: { status: 'approved' } } }),
      },
    });

    assert.equal(code, 0);
    assert.equal(gitCalls, 0, 'quick lane must not invoke git');
    assert.match(io.out(), /Finished session s_qfn001 \(quick lane\)/);
    assert.match(io.out(), new RegExp(`Work item ${workItemId} marked done`));

    const wIdx = readWorkItemsIndex(baseDir);
    assert.equal(wIdx.work_items[0].status, 'done');
    assert.equal(wIdx.work_items[0].current_session_id, null);
    const sIdx = readSessionsIndex(baseDir);
    assert.equal(sIdx.sessions[0].status, 'closed');
  });

  it('--json emits the structured finishSession result', async () => {
    const { sessionId } = await seedQuickSession('s_qjson1', 'wi-qjson');
    const io = captureIo();

    const code = await finishCommand.run(['--json'], io, {
      deps: {
        env: envFor(sessionId),
        repoRoot,
        readWorkflowState: () => ({ approvals: { quick_verified: { status: 'approved' } } }),
      },
    });

    assert.equal(code, 0);
    const parsed = JSON.parse(io.out());
    assert.equal(parsed.sessionId, 's_qjson1');
    assert.equal(parsed.workItemId, 'wi-qjson');
    assert.equal(parsed.lane, 'quick');
    assert.equal(parsed.mergedCommit, null);
  });

  it('refuses with exit 1 when the gate has not been approved', async () => {
    const { sessionId } = await seedQuickSession('s_qng001', 'wi-qng');
    const io = captureIo();

    const code = await finishCommand.run([], io, {
      deps: {
        env: envFor(sessionId),
        repoRoot,
        readWorkflowState: () => ({ approvals: { quick_verified: { status: 'pending' } } }),
      },
    });

    assert.equal(code, 1);
    assert.match(io.err(), /quick_verified/);
    // Indexes untouched.
    assert.equal(readWorkItemsIndex(baseDir).work_items[0].status, 'in_progress');
    assert.equal(readSessionsIndex(baseDir).sessions[0].status, 'active');
  });
});

describe('openkit finish — full lane', () => {
  it('happy path: drives the squash-merge sequence and closes both indexes', async () => {
    const { sessionId, workItemId } = await seedFullSession('s_ffl001', 'wi-ffl');
    const io = captureIo();
    const calls = [];
    const git = ({ cwd, args }) => {
      calls.push({ cwd, args });
      // Worktree branch read.
      if (cwd === worktreePath && args.join(' ') === 'rev-parse --abbrev-ref HEAD') {
        return { status: 0, stdout: `openkit/${workItemId}\n`, stderr: '' };
      }
      // Worktree status check.
      if (cwd === worktreePath && args.join(' ') === 'status --porcelain') {
        return { status: 0, stdout: '', stderr: '' };
      }
      // Repo root branch read.
      if (cwd === repoRoot && args.join(' ') === 'rev-parse --abbrev-ref HEAD') {
        return { status: 0, stdout: 'main\n', stderr: '' };
      }
      // Merge / commit / branch -D all return 0.
      if (cwd === repoRoot && (args[0] === 'merge' || args[0] === 'commit' || args[0] === 'branch')) {
        return { status: 0, stdout: '', stderr: '' };
      }
      throw new Error(`unexpected git call: ${JSON.stringify({ cwd, args })}`);
    };

    let removerCalls = 0;
    const worktreeRemover = ({ worktreePath: wt }) => {
      removerCalls += 1;
      assert.equal(wt, worktreePath);
      return { status: 'removed' };
    };

    const code = await finishCommand.run([], io, {
      deps: {
        env: envFor(sessionId),
        repoRoot,
        git,
        worktreeRemover,
        readWorkflowState: () => ({
          approvals: { qa_to_done: { status: 'approved' } },
          artifacts: { solution_package: { summary: 'add login flow' } },
        }),
      },
    });

    assert.equal(code, 0);
    assert.equal(removerCalls, 1);
    assert.match(io.out(), new RegExp(`Finished session ${sessionId}`));
    assert.match(io.out(), /Squash-merged full lane/);
    assert.match(io.out(), /full\(wi-ffl\): add login flow/);

    // The commit message must be exactly what was shipped to git.
    const commitCall = calls.find((c) => c.args[0] === 'commit');
    assert.deepEqual(commitCall.args, ['commit', '-m', 'full(wi-ffl): add login flow']);

    assert.equal(readWorkItemsIndex(baseDir).work_items[0].status, 'done');
    assert.equal(readSessionsIndex(baseDir).sessions[0].status, 'closed');
  });

  it('surfaces merge conflict (exit 1) without rolling back state', async () => {
    const { sessionId } = await seedFullSession('s_fmc001', 'wi-fmc');
    const io = captureIo();
    const git = ({ cwd, args }) => {
      if (cwd === worktreePath && args[0] === 'rev-parse') return { status: 0, stdout: 'openkit/wi-fmc\n', stderr: '' };
      if (cwd === worktreePath && args[0] === 'status') return { status: 0, stdout: '', stderr: '' };
      if (cwd === repoRoot && args[0] === 'rev-parse') return { status: 0, stdout: 'main\n', stderr: '' };
      if (cwd === repoRoot && args[0] === 'merge') {
        return {
          status: 1,
          stdout: 'CONFLICT (content): Merge conflict in foo.txt\n',
          stderr: '',
        };
      }
      throw new Error(`unexpected git call: ${JSON.stringify({ cwd, args })}`);
    };

    let removerCalled = false;
    const worktreeRemover = () => { removerCalled = true; return { status: 'removed' }; };

    const code = await finishCommand.run([], io, {
      deps: {
        env: envFor(sessionId),
        repoRoot,
        git,
        worktreeRemover,
        readWorkflowState: () => ({
          approvals: { qa_to_done: { status: 'approved' } },
          artifacts: { solution_package: { summary: 'something' } },
        }),
      },
    });

    assert.equal(code, 1);
    assert.match(io.err(), /CONFLICT|conflict/);
    assert.equal(removerCalled, false, 'worktreeRemover must not be called on merge conflict');

    // Indexes untouched, worktree still on disk.
    assert.equal(fs.existsSync(worktreePath), true);
    assert.equal(readWorkItemsIndex(baseDir).work_items[0].status, 'in_progress');
    assert.equal(readSessionsIndex(baseDir).sessions[0].status, 'active');
  });
});

describe('openkit finish — error surfaces', () => {
  it('exits 1 when OPENKIT_SESSION_ID is missing', async () => {
    const io = captureIo();
    const code = await finishCommand.run([], io, {
      deps: { env: {}, repoRoot },
    });
    assert.equal(code, 1);
    assert.match(io.err(), /OPENKIT_SESSION_ID/);
  });

  it('exits 1 when the session is not bound to the work item index', async () => {
    // Seed meta + sessions index but leave work-items index empty.
    writeSessionMeta(baseDir, {
      sessionId: 's_orphan1',
      workItemId: 'wi-missing',
      lane: 'quick',
      repoRoot,
      worktreePath: null,
      targetBranch: null,
      featureBranch: null,
      startedAt: STARTED,
    });
    await addSessionEntry(baseDir, {
      session_id: 's_orphan1',
      work_item_id: 'wi-missing',
      lane: 'quick',
      worktree_path: null,
      repo_root: repoRoot,
      pid: process.pid,
      status: 'active',
      started_at: STARTED,
      last_seen_at: STARTED,
    });

    const io = captureIo();
    const code = await finishCommand.run([], io, {
      deps: {
        env: envFor('s_orphan1'),
        repoRoot,
      },
    });
    assert.equal(code, 1);
    assert.match(io.err(), /work item|bound/i);
  });

  it('--help prints usage and exits 0', async () => {
    const io = captureIo();
    const code = await finishCommand.run(['--help'], io, { deps: { env: {}, repoRoot } });
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit finish/);
  });

  it('rejects unknown positional arguments', async () => {
    const io = captureIo();
    const code = await finishCommand.run(['bogus'], io, { deps: { env: {}, repoRoot } });
    assert.equal(code, 1);
    assert.match(io.err(), /Unknown argument/);
  });
});

describe('top-level CLI integration for `openkit finish`', () => {
  it('runCli routes `finish --help` to the command', async () => {
    const io = captureIo();
    const code = await runCli(['finish', '--help'], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit finish/);
  });
});
