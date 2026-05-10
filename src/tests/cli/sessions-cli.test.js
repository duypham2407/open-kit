import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sessionsCommand, sessionsDispatch, sessionsSubcommands } from '../../cli/commands/sessions/index.js';
import { writeSessionMeta } from '../../runtime/sessions/session-meta.js';
import { writeHeartbeat } from '../../runtime/sessions/heartbeat.js';
import {
  addSessionEntry,
  readSessionsIndex,
  listSessions,
} from '../../runtime/sessions/sessions-index.js';
import {
  addWorkItem,
  readWorkItemsIndex,
} from '../../runtime/sessions/work-items-index.js';
import { sessionDir, sessionMirrorPath, workItemsIndexPath } from '../../runtime/sessions/session-paths.js';

let base;
let repoRoot;
let worktreePath;
let projectRoot;

const STARTED = '2026-05-09T10:00:00.000Z';

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-sessions-cli-'));
  base = path.join(projectRoot, '.opencode');
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-sessions-cli-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-sessions-cli-wt-'));
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

async function seedSession({ sessionId, workItemId = null, status = 'active', lane = 'full', wt = worktreePath }) {
  writeSessionMeta(base, {
    sessionId,
    workItemId,
    lane: workItemId ? lane : null,
    repoRoot,
    worktreePath: wt,
    targetBranch: 'main',
    featureBranch: workItemId ? `openkit/${workItemId}` : null,
    startedAt: STARTED,
  });
  await addSessionEntry(base, {
    session_id: sessionId,
    work_item_id: workItemId,
    lane: workItemId ? lane : null,
    worktree_path: wt,
    repo_root: repoRoot,
    pid: status === 'active' ? 4242 : null,
    status,
    started_at: STARTED,
    last_seen_at: STARTED,
  });
  if (workItemId) {
    await addWorkItem(base, {
      workItemId,
      featureSlug: workItemId,
      lane,
      currentSessionId: sessionId,
      statePath: `.opencode/work-items/${workItemId}/state.json`,
    });
  }
}

describe('sessions CLI dispatcher', () => {
  it('exposes the spec entry table', () => {
    assert.deepEqual(
      Object.keys(sessionsSubcommands).sort(),
      ['abandon', 'downgrade-index', 'kill', 'list', 'resume', 'show'],
    );
  });

  it('top-level help lists every subcommand and exits 0', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run([], io);
    assert.equal(code, 0);
    const out = io.out();
    for (const sub of ['list', 'show', 'resume', 'abandon', 'kill', 'downgrade-index']) {
      assert.match(out, new RegExp(sub));
    }
  });

  it('rejects unknown subcommand with exit 1', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['nope'], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Unknown subcommand/);
  });

  it('sessionsDispatch programmatic API throws on unknown name', async () => {
    await assert.rejects(() => sessionsDispatch(['mystery'], { io: captureIo() }), /unknown subcommand/);
  });
});

describe('openkit sessions list', () => {
  it('defaults to active+orphan filter', async () => {
    await seedSession({ sessionId: 's_alive1', workItemId: 'wi-alive', status: 'active' });
    await seedSession({ sessionId: 's_orph01', workItemId: 'wi-orph', status: 'orphan' });
    await seedSession({ sessionId: 's_close1', workItemId: 'wi-closed', status: 'closed' });

    const io = captureIo();
    const code = await sessionsCommand.run(['list', '--base-dir', base], io);
    assert.equal(code, 0);
    const out = io.out();
    assert.match(out, /s_alive1/);
    assert.match(out, /s_orph01/);
    assert.doesNotMatch(out, /s_close1/);
  });

  it('--status closed filters to closed only', async () => {
    await seedSession({ sessionId: 's_alive2', workItemId: 'wi-a2', status: 'active' });
    await seedSession({ sessionId: 's_close2', workItemId: 'wi-c2', status: 'closed' });

    const io = captureIo();
    const code = await sessionsCommand.run(['list', '--status', 'closed', '--base-dir', base], io);
    assert.equal(code, 0);
    assert.match(io.out(), /s_close2/);
    assert.doesNotMatch(io.out(), /s_alive2/);
  });

  it('--status all returns every session', async () => {
    await seedSession({ sessionId: 's_alive3', workItemId: 'wi-a3', status: 'active' });
    await seedSession({ sessionId: 's_close3', workItemId: 'wi-c3', status: 'closed' });

    const io = captureIo();
    const code = await sessionsCommand.run(['list', '--status', 'all', '--base-dir', base], io);
    assert.equal(code, 0);
    assert.match(io.out(), /s_alive3/);
    assert.match(io.out(), /s_close3/);
  });

  it('--json emits parseable JSON', async () => {
    await seedSession({ sessionId: 's_jsona1', workItemId: 'wi-j', status: 'active' });

    const io = captureIo();
    const code = await sessionsCommand.run(['list', '--json', '--base-dir', base], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(io.out());
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].session_id, 's_jsona1');
  });

  it('rejects unknown --status', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['list', '--status', 'bogus', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Invalid --status/);
  });

  it('rejects stray positional arguments', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['list', 'extra-arg', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Unknown argument/);
  });

  it('--help exits 0 and prints usage', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['list', '--help'], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit sessions list/);
  });
});

describe('openkit sessions show', () => {
  it('renders meta + heartbeat + workflow stage', async () => {
    await seedSession({ sessionId: 's_show01', workItemId: 'wi-show', status: 'active' });
    writeHeartbeat(base, 's_show01', 4242);
    fs.writeFileSync(
      sessionMirrorPath(base, 's_show01'),
      `${JSON.stringify({ current_stage: 'full_implementation', status: 'in_progress', current_owner: 'FullstackAgent' }, null, 2)}\n`,
    );

    const io = captureIo();
    const code = await sessionsCommand.run(['show', 's_show01', '--base-dir', base], io);
    assert.equal(code, 0);
    const out = io.out();
    assert.match(out, /Session: s_show01/);
    assert.match(out, /Lane:\s+full/);
    assert.match(out, /full_implementation/);
    assert.match(out, /PID:\s+4242/);
  });

  it('--json emits structured output for piping', async () => {
    await seedSession({ sessionId: 's_jshow1', workItemId: 'wi-js', status: 'orphan' });

    const io = captureIo();
    const code = await sessionsCommand.run(['show', 's_jshow1', '--json', '--base-dir', base], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(io.out());
    assert.equal(parsed.meta.session_id, 's_jshow1');
    assert.equal(parsed.indexEntry.status, 'orphan');
  });

  it('exits 1 when session is missing', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['show', 's_nope01', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /not found/);
  });

  it('errors when session_id positional is missing', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['show', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Usage:/);
  });
});

describe('openkit sessions resume', () => {
  it('updates the index, prints the env block, exits 0', async () => {
    // Resume requires worktree on disk (we use the real tempdir worktreePath)
    // and a matching git branch — the resume CLI command does not stub git.
    // To keep this unit test fast we exercise the quick-lane path (no worktree).
    await seedSession({ sessionId: 's_qres01', workItemId: 'wi-qr', status: 'orphan', lane: 'quick', wt: null });

    const io = captureIo();
    const code = await sessionsCommand.run(['resume', 's_qres01', '--base-dir', base], io);
    assert.equal(code, 0);
    const out = io.out();
    assert.match(out, /Resumed session s_qres01/);
    assert.match(out, /OPENKIT_SESSION_ID="s_qres01"/);
    assert.match(out, /OPENKIT_PROJECT_ROOT=/);

    const idx = readSessionsIndex(base);
    const entry = idx.sessions.find((s) => s.session_id === 's_qres01');
    assert.equal(entry.status, 'active');
    assert.equal(entry.pid, process.pid);
  });

  it('--json emits structured env + meta', async () => {
    await seedSession({ sessionId: 's_qres02', workItemId: 'wi-qr2', status: 'orphan', lane: 'quick', wt: null });

    const io = captureIo();
    const code = await sessionsCommand.run(['resume', 's_qres02', '--json', '--base-dir', base], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(io.out());
    assert.equal(parsed.sessionId, 's_qres02');
    assert.equal(parsed.env.OPENKIT_SESSION_ID, 's_qres02');
  });

  it('exits 1 with a friendly error for missing session', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['resume', 's_missing', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /not found/);
  });
});

describe('openkit sessions abandon', () => {
  it('quick lane deletes session and updates work item', async () => {
    await seedSession({ sessionId: 's_qab001', workItemId: 'wi-qab', status: 'active', lane: 'quick', wt: null });

    const io = captureIo();
    const code = await sessionsCommand.run(
      ['abandon', 's_qab001', '--keep-worktree', '--base-dir', base],
      io,
    );
    assert.equal(code, 0);
    assert.match(io.out(), /Abandoned session s_qab001/);
    assert.equal(readSessionsIndex(base).sessions.length, 0);
    assert.equal(fs.existsSync(sessionDir(base, 's_qab001')), false);
    const wi = readWorkItemsIndex(base).work_items.find((w) => w.work_item_id === 'wi-qab');
    assert.equal(wi.status, 'abandoned');
    assert.equal(wi.current_session_id, null);
  });

  it('--json emits structured worktree action', async () => {
    await seedSession({ sessionId: 's_qab002', workItemId: 'wi-qab2', status: 'active', lane: 'quick', wt: null });

    const io = captureIo();
    const code = await sessionsCommand.run(
      ['abandon', 's_qab002', '--keep-worktree', '--json', '--base-dir', base],
      io,
    );
    assert.equal(code, 0);
    const parsed = JSON.parse(io.out());
    assert.equal(parsed.sessionId, 's_qab002');
    assert.equal(parsed.worktreeAction, 'none');
  });

  it('exits 1 when session is missing', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(
      ['abandon', 's_nope999', '--keep-worktree', '--base-dir', base],
      io,
    );
    assert.equal(code, 1);
    assert.match(io.err(), /not found/);
  });

  it('--keep-worktree and --remove-worktree are mutually exclusive', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(
      ['abandon', 's_x', '--keep-worktree', '--remove-worktree', '--base-dir', base],
      io,
    );
    assert.equal(code, 1);
    assert.match(io.err(), /at most one/);
  });
});

describe('openkit sessions kill', () => {
  it('exits 1 with OK_KILL_PID_DEAD when heartbeat is missing', async () => {
    await seedSession({ sessionId: 's_kill01', workItemId: 'wi-k', status: 'active' });

    const io = captureIo();
    const code = await sessionsCommand.run(['kill', 's_kill01', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /heartbeat is missing|abandon/);
  });

  it('exits 1 with helpful message when PID is already dead', async () => {
    await seedSession({ sessionId: 's_kill02', workItemId: 'wi-k2', status: 'active' });
    // Use PID 1 — process.kill(1, 0) typically throws EPERM (alive) on POSIX,
    // so use a definitely-dead PID instead.
    writeHeartbeat(base, 's_kill02', 999_999_999);

    const io = captureIo();
    const code = await sessionsCommand.run(['kill', 's_kill02', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /already dead|abandon/);
  });
});

describe('openkit sessions downgrade-index', () => {
  it('rewrites work-items/index.json from v3 to v2', async () => {
    await seedSession({ sessionId: 's_dg0001', workItemId: 'wi-dg', status: 'active' });

    const io = captureIo();
    const code = await sessionsCommand.run(['downgrade-index', '--base-dir', base], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Rewrote work-items\/index\.json as v2/);
    assert.match(io.err(), /OK1235/);

    const file = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.equal(file.schema, undefined);
    assert.equal(file.active_work_item_id, 'wi-dg');
    assert.equal(file.work_items[0].work_item_id, 'wi-dg');
    assert.equal(file.work_items[0].mode, 'full');
    assert.equal(file.work_items[0].current_session_id, undefined);
  });

  it('--json emits the downgrade summary', async () => {
    await seedSession({ sessionId: 's_dg0002', workItemId: 'wi-dg2', status: 'active' });

    const io = captureIo();
    const code = await sessionsCommand.run(['downgrade-index', '--json', '--base-dir', base], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(io.out());
    assert.equal(parsed.activeWorkItemId, 'wi-dg2');
    assert.equal(parsed.workItemCount, 1);
    assert.equal(Array.isArray(parsed.warnings), true);
  });

  it('rejects unexpected positional arguments', async () => {
    const io = captureIo();
    const code = await sessionsCommand.run(['downgrade-index', 'oops', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Unknown argument/);
  });
});

// Smoke-test top-level CLI integration so we know `bin/openkit.js sessions ...`
// reaches the new dispatcher rather than the legacy "Unknown command" path.
import { runCli } from '../../cli/index.js';

describe('top-level CLI integration for `openkit sessions`', () => {
  it('runCli routes `sessions --help` to the dispatcher', async () => {
    const io = captureIo();
    const code = await runCli(['sessions', '--help'], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit sessions/);
  });

  it('runCli routes `sessions list` to the list subcommand', async () => {
    const io = captureIo();
    const code = await runCli(['sessions', 'list', '--base-dir', base], io);
    assert.equal(code, 0);
    assert.match(io.out(), /No sessions match the requested filter|SESSION_ID/);
  });

  it('runCli forwards per-subcommand --help (not the top-level shortcut)', async () => {
    const io = captureIo();
    const code = await runCli(['sessions', 'list', '--help'], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit sessions list/);
  });
});

// Use listSessions to double-check seedSession matches the runtime contract.
describe('seed helper sanity', () => {
  it('seedSession produces a record listSessions can find', async () => {
    await seedSession({ sessionId: 's_sane01', workItemId: 'wi-sane', status: 'active' });
    const all = listSessions(base, { status: 'all' });
    assert.equal(all.length, 1);
    assert.equal(all[0].session_id, 's_sane01');
  });
});
