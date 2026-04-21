import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRunOptions } from '../../src/cli/commands/run-options.js';

test('parseRunOptions parses worktree and env flags', () => {
  const parsed = parseRunOptions([
    '--work-item',
    'feature-936',
    '--worktree-mode',
    'reuse',
    '--env-propagation',
    'symlink',
    '--mode',
    'quick',
  ]);

  assert.deepEqual(parsed, {
    workItemId: 'feature-936',
    worktreeMode: 'reuse',
    envPropagation: 'symlink',
    passthroughArgs: ['--mode', 'quick'],
  });
});

test('parseRunOptions normalizes mixed-case option values', () => {
  const parsed = parseRunOptions(['--worktree-mode', 'ReOpen', '--env-propagation', 'Copy']);

  assert.equal(parsed.worktreeMode, 'reopen');
  assert.equal(parsed.envPropagation, 'copy');
});

test('parseRunOptions rejects unknown worktree mode', () => {
  assert.throws(
    () => parseRunOptions(['--worktree-mode', 'active']),
    /Unknown worktree mode 'active'/,
  );
});

test('parseRunOptions rejects unknown env propagation mode', () => {
  assert.throws(
    () => parseRunOptions(['--env-propagation', 'auto']),
    /Unknown env propagation mode 'auto'/,
  );
});

test('parseRunOptions rejects missing values for scoped flags', () => {
  assert.throws(() => parseRunOptions(['--work-item']), /Missing value for --work-item/);
  assert.throws(() => parseRunOptions(['--worktree-mode']), /Missing value for --worktree-mode/);
  assert.throws(() => parseRunOptions(['--env-propagation']), /Missing value for --env-propagation/);
});
