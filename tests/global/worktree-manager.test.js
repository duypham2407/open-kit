import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createManagedWorktree,
  finalizeManagedWorktree,
  getManagedWorktree,
} from '../../src/global/worktree-manager.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-worktree-'));
}

function createSpawnStub() {
  const calls = [];
  const branches = new Set(['main']);
  const worktreePaths = new Set();
  let currentRootBranch = 'main';

  return {
    calls,
    spawn(command, args) {
      calls.push({ command, args });
      const repoRoot = args[1];
      const gitArgs = args.slice(2);

      if (gitArgs[0] === 'rev-parse' && gitArgs[1] === '--is-inside-work-tree') {
        return { status: 0, stdout: 'true\n', stderr: '' };
      }

      if (gitArgs[0] === 'rev-parse' && gitArgs[1] === '--abbrev-ref' && gitArgs[2] === 'HEAD') {
        const branch = worktreePaths.has(repoRoot) ? 'openkit/quick/task-900' : currentRootBranch;
        return { status: 0, stdout: `${branch}\n`, stderr: '' };
      }

      if (gitArgs[0] === 'rev-parse' && gitArgs[1] === '--verify') {
        const branchName = gitArgs[2].replace('refs/heads/', '');
        return branches.has(branchName)
          ? { status: 0, stdout: `${branchName}\n`, stderr: '' }
          : { status: 1, stdout: '', stderr: 'missing' };
      }

      if (gitArgs[0] === 'status' && gitArgs[1] === '--porcelain') {
        return { status: 0, stdout: '', stderr: '' };
      }

      if (gitArgs[0] === 'worktree' && gitArgs[1] === 'add') {
        const worktreePath = gitArgs.includes('-b') ? gitArgs[4] : gitArgs[2];
        const branch = gitArgs.includes('-b') ? gitArgs[3] : gitArgs[3];
        branches.add(branch);
        worktreePaths.add(worktreePath);
        fs.mkdirSync(worktreePath, { recursive: true });
        return { status: 0, stdout: '', stderr: '' };
      }

      if (gitArgs[0] === 'merge' && gitArgs[1] === '--no-edit') {
        return { status: 0, stdout: 'merged\n', stderr: '' };
      }

      if (gitArgs[0] === 'worktree' && gitArgs[1] === 'remove') {
        fs.rmSync(gitArgs[2], { recursive: true, force: true });
        worktreePaths.delete(gitArgs[2]);
        return { status: 0, stdout: '', stderr: '' };
      }

      if (gitArgs[0] === 'branch' && gitArgs[1] === '-d') {
        branches.delete(gitArgs[2]);
        return { status: 0, stdout: '', stderr: '' };
      }

      return { status: 0, stdout: '', stderr: '' };
    },
  };
}

test('createManagedWorktree records metadata and creates a per-work-item path', () => {
  const repositoryRoot = makeTempDir();
  const runtimeRoot = makeTempDir();
  const stub = createSpawnStub();

  const result = createManagedWorktree({
    repositoryRoot,
    runtimeRoot,
    workItemId: 'task-900',
    mode: 'quick',
    spawn: stub.spawn,
  });

  assert.equal(result.status, 'created');
  assert.match(result.metadata.worktree_path, /\.worktrees[\\/]task-900$/);
  assert.equal(fs.existsSync(result.metadata.worktree_path), true);

  const persisted = getManagedWorktree({ runtimeRoot, workItemId: 'task-900' });
  assert.equal(persisted.branch, 'openkit/quick/task-900');
  assert.equal(persisted.target_branch, 'main');
});

test('finalizeManagedWorktree merges and removes a clean completed worktree', () => {
  const repositoryRoot = makeTempDir();
  const runtimeRoot = makeTempDir();
  const stub = createSpawnStub();

  const created = createManagedWorktree({
    repositoryRoot,
    runtimeRoot,
    workItemId: 'task-900',
    mode: 'quick',
    spawn: stub.spawn,
  });

  const result = finalizeManagedWorktree({
    repositoryRoot,
    runtimeRoot,
    workItemId: 'task-900',
    spawn: stub.spawn,
  });

  assert.equal(result.status, 'merged');
  assert.equal(fs.existsSync(created.metadata.worktree_path), false);
  assert.equal(getManagedWorktree({ runtimeRoot, workItemId: 'task-900' }), null);
});
