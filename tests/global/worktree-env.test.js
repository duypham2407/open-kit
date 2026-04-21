import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { propagateWorktreeEnvFiles, resolveEnvPropagationMode } from '../../src/global/worktree-env.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-worktree-env-'));
}

function writeFile(filePath, content = 'value=1\n') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

test('resolveEnvPropagationMode prefers explicit requested mode', () => {
  assert.equal(resolveEnvPropagationMode({ requestedMode: 'copy', retainedMode: 'symlink' }), 'copy');
  assert.equal(resolveEnvPropagationMode({ requestedMode: ' Symlink ', retainedMode: 'none' }), 'symlink');
});

test('resolveEnvPropagationMode reuses retained mode when request is missing', () => {
  assert.equal(resolveEnvPropagationMode({ requestedMode: undefined, retainedMode: 'copy' }), 'copy');
  assert.equal(resolveEnvPropagationMode({ requestedMode: '', retainedMode: 'symlink' }), 'symlink');
  assert.equal(resolveEnvPropagationMode({ requestedMode: undefined, retainedMode: 'invalid' }), 'none');
});

test('propagateWorktreeEnvFiles skips when no env files exist', () => {
  const repositoryRoot = makeTempDir();
  const worktreePath = makeTempDir();

  const result = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'copy',
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.mode, 'copy');
  assert.match(result.warning, /No repository-root \.env or \.env\.\* files were found/);
});

test('propagateWorktreeEnvFiles reports conflicts without overwriting', () => {
  const repositoryRoot = makeTempDir();
  const worktreePath = makeTempDir();

  writeFile(path.join(repositoryRoot, '.env'));
  writeFile(path.join(repositoryRoot, '.env.local'));
  writeFile(path.join(worktreePath, '.env.local'), 'existing=true\n');

  const result = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'copy',
  });

  assert.equal(result.status, 'conflict');
  assert.match(result.warning, /Env propagation would overwrite existing files in the managed worktree: \.env\.local/);
  assert.deepEqual(result.sourceFiles, []);
  assert.equal(fs.readFileSync(path.join(worktreePath, '.env.local'), 'utf8'), 'existing=true\n');
});

test('propagateWorktreeEnvFiles copies env files in copy mode', () => {
  const repositoryRoot = makeTempDir();
  const worktreePath = makeTempDir();

  writeFile(path.join(repositoryRoot, '.env'), 'ROOT=true\n');
  writeFile(path.join(repositoryRoot, '.env.test'), 'TEST=true\n');

  const result = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'copy',
  });

  assert.equal(result.status, 'applied');
  assert.equal(result.mode, 'copy');
  assert.match(result.warning, /copy mode duplicates env files/);
  assert.equal(fs.readFileSync(path.join(worktreePath, '.env'), 'utf8'), 'ROOT=true\n');
  assert.equal(fs.readFileSync(path.join(worktreePath, '.env.test'), 'utf8'), 'TEST=true\n');
});

test('propagateWorktreeEnvFiles treats retained symlinks as reusable for later launches', () => {
  const repositoryRoot = makeTempDir();
  const worktreePath = makeTempDir();

  writeFile(path.join(repositoryRoot, '.env'), 'ROOT=true\n');
  writeFile(path.join(repositoryRoot, '.env.local'), 'LOCAL=true\n');

  const firstResult = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'symlink',
  });

  assert.equal(firstResult.status, 'applied');

  const secondResult = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'symlink',
  });

  assert.equal(secondResult.status, 'retained');
  assert.equal(secondResult.mode, 'symlink');
  assert.deepEqual(secondResult.sourceFiles.map((filePath) => path.basename(filePath)), ['.env', '.env.local']);
});

test('propagateWorktreeEnvFiles treats retained copied files as reusable for later launches', () => {
  const repositoryRoot = makeTempDir();
  const worktreePath = makeTempDir();

  writeFile(path.join(repositoryRoot, '.env'), 'ROOT=true\n');

  const firstResult = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'copy',
  });

  assert.equal(firstResult.status, 'applied');

  const secondResult = propagateWorktreeEnvFiles({
    repositoryRoot,
    worktreePath,
    mode: 'copy',
  });

  assert.equal(secondResult.status, 'retained');
  assert.equal(secondResult.mode, 'copy');
  assert.match(secondResult.warning, /copy mode duplicates env files/);
});
