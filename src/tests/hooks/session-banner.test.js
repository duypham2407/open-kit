import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadBannerContext,
  renderSessionBanner,
  resolveBaseDir,
  runSessionBanner,
} from '../../hooks/session-banner.js';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-banner-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeMeta(baseDir, sessionId, meta) {
  const dir = path.join(baseDir, 'sessions', sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
}

function writeWorkItemState(baseDir, workItemId, state) {
  const dir = path.join(baseDir, 'work-items', workItemId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
}

class CaptureStream {
  constructor() {
    this.chunks = [];
  }
  write(chunk) {
    this.chunks.push(chunk);
    return true;
  }
  get text() {
    return this.chunks.join('');
  }
}

describe('resolveBaseDir', () => {
  it('honors OPENKIT_BASE_DIR override', () => {
    assert.equal(resolveBaseDir({ OPENKIT_BASE_DIR: '/tmp/foo' }, '/cwd'), '/tmp/foo');
  });

  it('falls back to OPENKIT_PROJECT_ROOT/.opencode', () => {
    assert.equal(
      resolveBaseDir({ OPENKIT_PROJECT_ROOT: '/work/repo' }, '/cwd'),
      path.join('/work/repo', '.opencode'),
    );
  });

  it('prefers OPENKIT_REPOSITORY_ROOT over worktree OPENKIT_PROJECT_ROOT', () => {
    assert.equal(
      resolveBaseDir({
        OPENKIT_PROJECT_ROOT: '/work/repo/.worktrees/full-x',
        OPENKIT_REPOSITORY_ROOT: '/work/repo',
      }, '/work/repo/.worktrees/full-x'),
      path.join('/work/repo', '.opencode'),
    );
  });

  it('uses cwd/.opencode as last resort', () => {
    assert.equal(resolveBaseDir({}, '/cwd'), path.join('/cwd', '.opencode'));
  });
});

describe('loadBannerContext', () => {
  it('returns null when sessionId is missing', () => {
    assert.equal(loadBannerContext({ baseDir: tmp, sessionId: '' }), null);
  });

  it('returns null when meta.json is missing', () => {
    assert.equal(loadBannerContext({ baseDir: tmp, sessionId: 's_8f3a2c' }), null);
  });

  it('returns null when meta.json is malformed', () => {
    const dir = path.join(tmp, 'sessions', 's_8f3a2c');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'meta.json'), '{not-json');
    assert.equal(loadBannerContext({ baseDir: tmp, sessionId: 's_8f3a2c' }), null);
  });

  it('reads meta + work-item state.json stage', () => {
    writeMeta(tmp, 's_8f3a2c', {
      schema: 'openkit/session-meta@1',
      session_id: 's_8f3a2c',
      work_item_id: 'full-payments-refactor',
      lane: 'full',
      repo_root: '/Users/dev/open-kit',
      worktree_path: '/Users/dev/open-kit/.claude/worktrees/full-payments-refactor',
      target_branch: 'main',
      feature_branch: 'openkit/full-payments-refactor',
      started_at: '2026-05-09T10:12:00Z',
    });
    writeWorkItemState(tmp, 'full-payments-refactor', {
      work_item_id: 'full-payments-refactor',
      current_stage: 'full_implementation',
    });

    const ctx = loadBannerContext({ baseDir: tmp, sessionId: 's_8f3a2c' });
    assert.ok(ctx);
    assert.equal(ctx.meta.session_id, 's_8f3a2c');
    assert.equal(ctx.stage, 'full_implementation');
  });

  it('handles unbound session (no work_item_id) without state.json', () => {
    writeMeta(tmp, 's_unbnd', {
      schema: 'openkit/session-meta@1',
      session_id: 's_unbnd',
      work_item_id: null,
      lane: null,
      repo_root: '/Users/dev/open-kit',
      worktree_path: null,
      target_branch: null,
      feature_branch: null,
      started_at: '2026-05-09T10:12:00Z',
    });

    const ctx = loadBannerContext({ baseDir: tmp, sessionId: 's_unbnd' });
    assert.ok(ctx);
    assert.equal(ctx.stage, null);
  });

  it('returns stage=null when work-item state.json is missing', () => {
    writeMeta(tmp, 's_8f3a2c', {
      schema: 'openkit/session-meta@1',
      session_id: 's_8f3a2c',
      work_item_id: 'no-such-item',
      lane: 'quick',
      repo_root: '/Users/dev/open-kit',
      worktree_path: null,
      target_branch: null,
      feature_branch: null,
      started_at: '2026-05-09T10:12:00Z',
    });
    const ctx = loadBannerContext({ baseDir: tmp, sessionId: 's_8f3a2c' });
    assert.ok(ctx);
    assert.equal(ctx.stage, null);
  });
});

describe('renderSessionBanner', () => {
  it('renders the spec §7.3 box for a full-lane session', () => {
    const ctx = {
      meta: {
        session_id: 's_8f3a2c',
        work_item_id: 'full-payments-refactor',
        lane: 'full',
        repo_root: '/Users/dev/open-kit',
        worktree_path: '/Users/dev/open-kit/.claude/worktrees/full-payments-refactor',
        feature_branch: 'openkit/full-payments-refactor',
      },
      stage: 'full_implementation',
    };

    const expected = [
      '┌─ OpenKit Session s_8f3a2c ──── lane=full ──── work-item=full-payments-refactor',
      '│  worktree: .claude/worktrees/full-payments-refactor (branch openkit/full-payments-refactor)',
      '│  stage: full_implementation',
      '└─ /finish when done  •  Ctrl-D exits and leaves session active',
    ].join('\n');

    assert.equal(renderSessionBanner(ctx), expected);
  });

  it('renders <none> worktree line for quick lane', () => {
    const ctx = {
      meta: {
        session_id: 's_quickk',
        work_item_id: 'quick-fix-1',
        lane: 'quick',
        repo_root: '/Users/dev/open-kit',
        worktree_path: null,
        feature_branch: null,
      },
      stage: 'quick_implementation',
    };

    const out = renderSessionBanner(ctx);
    assert.match(out, /lane=quick/);
    assert.match(out, /worktree: <none>/);
    assert.match(out, /stage: quick_implementation/);
  });

  it('renders unbound placeholders before slash command lane binding', () => {
    const ctx = {
      meta: {
        session_id: 's_unbnd',
        work_item_id: null,
        lane: null,
        repo_root: '/Users/dev/open-kit',
        worktree_path: null,
        feature_branch: null,
      },
      stage: null,
    };

    const out = renderSessionBanner(ctx);
    assert.match(out, /lane=unbound/);
    assert.match(out, /work-item=unbound/);
    assert.match(out, /stage: unbound/);
  });

  it('falls back to absolute worktree path when not under repo_root', () => {
    const ctx = {
      meta: {
        session_id: 's_extern',
        work_item_id: 'wi-x',
        lane: 'full',
        repo_root: '/Users/dev/open-kit',
        worktree_path: '/elsewhere/wt',
        feature_branch: 'openkit/wi-x',
      },
      stage: 'full_implementation',
    };
    const out = renderSessionBanner(ctx);
    assert.match(out, /worktree: \/elsewhere\/wt \(branch openkit\/wi-x\)/);
  });

  it('returns empty string for null context', () => {
    assert.equal(renderSessionBanner(null), '');
    assert.equal(renderSessionBanner(undefined), '');
    assert.equal(renderSessionBanner({}), '');
  });
});

describe('runSessionBanner', () => {
  it('is a no-op when OPENKIT_SESSION_ID is unset', () => {
    const stream = new CaptureStream();
    const printed = runSessionBanner({ env: {}, cwd: tmp, stream });
    assert.equal(printed, false);
    assert.equal(stream.text, '');
  });

  it('is a no-op when meta.json is missing', () => {
    const stream = new CaptureStream();
    const printed = runSessionBanner({
      env: { OPENKIT_SESSION_ID: 's_missin', OPENKIT_BASE_DIR: tmp },
      cwd: tmp,
      stream,
    });
    assert.equal(printed, false);
    assert.equal(stream.text, '');
  });

  it('prints the spec §7.3 banner when session is bound', () => {
    writeMeta(tmp, 's_8f3a2c', {
      schema: 'openkit/session-meta@1',
      session_id: 's_8f3a2c',
      work_item_id: 'full-payments-refactor',
      lane: 'full',
      repo_root: '/Users/dev/open-kit',
      worktree_path: '/Users/dev/open-kit/.claude/worktrees/full-payments-refactor',
      target_branch: 'main',
      feature_branch: 'openkit/full-payments-refactor',
      started_at: '2026-05-09T10:12:00Z',
    });
    writeWorkItemState(tmp, 'full-payments-refactor', {
      work_item_id: 'full-payments-refactor',
      current_stage: 'full_implementation',
    });

    const stream = new CaptureStream();
    const printed = runSessionBanner({
      env: { OPENKIT_SESSION_ID: 's_8f3a2c', OPENKIT_BASE_DIR: tmp },
      cwd: tmp,
      stream,
    });

    assert.equal(printed, true);
    const expected =
      '┌─ OpenKit Session s_8f3a2c ──── lane=full ──── work-item=full-payments-refactor\n' +
      '│  worktree: .claude/worktrees/full-payments-refactor (branch openkit/full-payments-refactor)\n' +
      '│  stage: full_implementation\n' +
      '└─ /finish when done  •  Ctrl-D exits and leaves session active\n';
    assert.equal(stream.text, expected);
  });

  it('resolves baseDir from OPENKIT_PROJECT_ROOT when OPENKIT_BASE_DIR is unset', () => {
    const projectRoot = path.join(tmp, 'proj');
    const baseDir = path.join(projectRoot, '.opencode');
    fs.mkdirSync(baseDir, { recursive: true });
    writeMeta(baseDir, 's_proj11', {
      schema: 'openkit/session-meta@1',
      session_id: 's_proj11',
      work_item_id: null,
      lane: null,
      repo_root: projectRoot,
      worktree_path: null,
      target_branch: null,
      feature_branch: null,
      started_at: '2026-05-09T10:12:00Z',
    });

    const stream = new CaptureStream();
    const printed = runSessionBanner({
      env: { OPENKIT_SESSION_ID: 's_proj11', OPENKIT_PROJECT_ROOT: projectRoot },
      cwd: '/somewhere/else',
      stream,
    });

    assert.equal(printed, true);
    assert.match(stream.text, /OpenKit Session s_proj11/);
  });
});
