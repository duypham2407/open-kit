import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listOpenKitWorktrees } from '../../../runtime/sessions/list-openkit-worktrees.js';
import path from 'node:path';

describe('listOpenKitWorktrees', () => {
  it('parses git worktree list --porcelain and filters by .claude/worktrees prefix', () => {
    const fakeSpawn = () => ({
      status: 0,
      stdout: [
        'worktree /repo',
        'HEAD abc',
        'branch refs/heads/main',
        '',
        `worktree /repo/.claude/worktrees/full-x`,
        'HEAD def',
        'branch refs/heads/openkit/full-x',
        '',
        'worktree /other/wt',
        'HEAD ghi',
        'branch refs/heads/feature',
        '',
      ].join('\n'),
    });
    const wts = listOpenKitWorktrees('/repo', { spawn: fakeSpawn });
    assert.equal(wts.length, 1);
    assert.equal(wts[0].workItemId, 'full-x');
    assert.equal(wts[0].worktreePath, '/repo/.claude/worktrees/full-x');
    assert.equal(wts[0].repoRoot, '/repo');
  });

  it('returns [] when git fails', () => {
    const fakeSpawn = () => ({ status: 1, stdout: '' });
    assert.deepEqual(listOpenKitWorktrees('/repo', { spawn: fakeSpawn }), []);
  });
});
