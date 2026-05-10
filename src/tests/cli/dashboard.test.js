import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  dashboardCommand,
  buildDashboardModel,
  renderDashboard,
} from '../../cli/commands/dashboard.js';
import { runCli } from '../../cli/index.js';
import { writeSessionMeta } from '../../runtime/sessions/session-meta.js';
import { addSessionEntry } from '../../runtime/sessions/sessions-index.js';
import { addWorkItem } from '../../runtime/sessions/work-items-index.js';
import { sessionMirrorPath } from '../../runtime/sessions/session-paths.js';

let projectRoot;
let base;
let repoRoot;
let worktreePath;

const STARTED = '2026-05-09T10:00:00.000Z';

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-dash-cli-'));
  base = path.join(projectRoot, '.opencode');
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-dash-cli-repo-'));
  worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-dash-cli-wt-'));
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

async function seedSession({
  sessionId,
  workItemId,
  status,
  lane = 'full',
  wt = worktreePath,
  startedAt = STARTED,
  lastSeenAt = STARTED,
  stage = null,
}) {
  writeSessionMeta(base, {
    sessionId,
    workItemId,
    lane: workItemId ? lane : null,
    repoRoot,
    worktreePath: wt,
    targetBranch: 'main',
    featureBranch: workItemId ? `openkit/${workItemId}` : null,
    startedAt,
  });
  await addSessionEntry(base, {
    session_id: sessionId,
    work_item_id: workItemId,
    lane: workItemId ? lane : null,
    worktree_path: wt,
    repo_root: repoRoot,
    pid: status === 'active' ? 4242 : null,
    status,
    started_at: startedAt,
    last_seen_at: lastSeenAt,
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
  if (stage) {
    fs.writeFileSync(
      sessionMirrorPath(base, sessionId),
      `${JSON.stringify({ current_stage: stage, status: 'in_progress', current_owner: 'agent' }, null, 2)}\n`,
    );
  }
}

describe('openkit dashboard', () => {
  it('renders three sections (Active, Orphan, Closed) with correct headers', async () => {
    await seedSession({
      sessionId: 's_active1',
      workItemId: 'wi-active',
      status: 'active',
      stage: 'full_implementation',
    });
    await seedSession({
      sessionId: 's_orph01',
      workItemId: 'wi-orph',
      status: 'orphan',
      stage: 'planning',
    });
    await seedSession({
      sessionId: 's_close1',
      workItemId: 'wi-closed',
      status: 'closed',
      stage: 'done',
    });

    const io = captureIo();
    const code = await dashboardCommand.run(['--base-dir', base], io);
    assert.equal(code, 0);

    const out = io.out();
    // All three section headers appear, with their counts.
    assert.match(out, /Active sessions \(1\)/);
    assert.match(out, /Orphan sessions \(1\)/);
    assert.match(out, /Closed sessions \(1\)/);

    // Each session id is rendered in its row.
    assert.match(out, /s_active1/);
    assert.match(out, /s_orph01/);
    assert.match(out, /s_close1/);

    // Lanes / work items / stages from the per-session mirrors propagate.
    assert.match(out, /wi-active/);
    assert.match(out, /full_implementation/);
    assert.match(out, /planning/);
    assert.match(out, /done/);
  });

  it('shows empty-state messages when no sessions exist for a section', async () => {
    const io = captureIo();
    const code = await dashboardCommand.run(['--base-dir', base], io);
    assert.equal(code, 0);

    const out = io.out();
    assert.match(out, /Active sessions \(0\)/);
    assert.match(out, /Orphan sessions \(0\)/);
    assert.match(out, /Closed sessions \(0\)/);
    assert.match(out, /No active sessions/);
    assert.match(out, /No orphan sessions/);
    assert.match(out, /No recently closed sessions/);
  });

  it('--json emits a structured model with active/orphan/closed buckets', async () => {
    await seedSession({ sessionId: 's_actjs1', workItemId: 'wi-aj', status: 'active', stage: 'spec' });
    await seedSession({ sessionId: 's_orpjs1', workItemId: 'wi-oj', status: 'orphan' });
    await seedSession({ sessionId: 's_cljs01', workItemId: 'wi-cj', status: 'closed' });

    const io = captureIo();
    const code = await dashboardCommand.run(['--json', '--base-dir', base], io);
    assert.equal(code, 0);

    const parsed = JSON.parse(io.out());
    assert.equal(parsed.active.length, 1);
    assert.equal(parsed.orphan.length, 1);
    assert.equal(parsed.closed.length, 1);
    assert.equal(parsed.active[0].session_id, 's_actjs1');
    assert.equal(parsed.active[0].current_stage, 'spec');
    assert.equal(parsed.counts.active, 1);
    assert.equal(parsed.counts.orphan, 1);
    assert.equal(parsed.counts.closed, 1);
  });

  it('caps closed entries at --closed-limit and reports the truncated total', async () => {
    // Seed 4 closed sessions; limit to 2.
    for (let i = 0; i < 4; i += 1) {
      // Drift last_seen so ordering is deterministic, newest first.
      const lastSeen = `2026-05-0${i + 1}T10:00:00.000Z`;
      await seedSession({
        sessionId: `s_cl${String(i).padStart(4, '0')}`,
        workItemId: `wi-cl-${i}`,
        status: 'closed',
        startedAt: lastSeen,
        lastSeenAt: lastSeen,
      });
    }

    const io = captureIo();
    const code = await dashboardCommand.run(['--closed-limit', '2', '--base-dir', base], io);
    assert.equal(code, 0);
    const out = io.out();
    assert.match(out, /Closed sessions \(4\)/);
    // Newest first: i=3 (May 04) and i=2 (May 03) shown.
    assert.match(out, /s_cl0003/);
    assert.match(out, /s_cl0002/);
    // i=0 / i=1 truncated.
    assert.doesNotMatch(out, /s_cl0001\b/);
    assert.doesNotMatch(out, /s_cl0000\b/);
    assert.match(out, /2 more/);
  });

  it('rejects invalid --closed-limit', async () => {
    const io = captureIo();
    const code = await dashboardCommand.run(['--closed-limit', 'abc', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Invalid --closed-limit/);
  });

  it('rejects unknown positional arguments', async () => {
    const io = captureIo();
    const code = await dashboardCommand.run(['stray', '--base-dir', base], io);
    assert.equal(code, 1);
    assert.match(io.err(), /Unknown argument/);
  });

  it('--help prints usage and exits 0', async () => {
    const io = captureIo();
    const code = await dashboardCommand.run(['--help'], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit dashboard/);
  });
});

describe('dashboard model helpers', () => {
  it('buildDashboardModel groups by status and sorts closed newest-first', async () => {
    await seedSession({
      sessionId: 's_oldcl1',
      workItemId: 'wi-oldcl',
      status: 'closed',
      startedAt: '2026-05-01T10:00:00.000Z',
      lastSeenAt: '2026-05-01T10:00:00.000Z',
    });
    await seedSession({
      sessionId: 's_newcl1',
      workItemId: 'wi-newcl',
      status: 'closed',
      startedAt: '2026-05-08T10:00:00.000Z',
      lastSeenAt: '2026-05-08T10:00:00.000Z',
    });
    await seedSession({ sessionId: 's_actsrt', workItemId: 'wi-as', status: 'active' });

    const model = buildDashboardModel(base);
    assert.equal(model.active.length, 1);
    assert.equal(model.closed.length, 2);
    assert.equal(model.closed[0].session_id, 's_newcl1');
    assert.equal(model.closed[1].session_id, 's_oldcl1');
  });

  it('renderDashboard produces a stable string with all three section headers', () => {
    const out = renderDashboard({
      active: [],
      orphan: [],
      closed: [],
      counts: { active: 0, orphan: 0, closed: 0 },
    });
    assert.match(out, /Active sessions \(0\)/);
    assert.match(out, /Orphan sessions \(0\)/);
    assert.match(out, /Closed sessions \(0\)/);
  });
});

describe('top-level CLI integration for `openkit dashboard`', () => {
  it('runCli routes dashboard with --base-dir', async () => {
    const io = captureIo();
    const code = await runCli(['dashboard', '--base-dir', base], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Active sessions/);
  });

  it('runCli routes `dashboard --help` to the command', async () => {
    const io = captureIo();
    const code = await runCli(['dashboard', '--help'], io);
    assert.equal(code, 0);
    assert.match(io.out(), /Usage: openkit dashboard/);
  });
});
