import test from 'node:test';
import assert from 'node:assert/strict';

import { createBashGuardHook } from '../../src/runtime/hooks/tool-guards/bash-guard-hook.js';

test('bash guard blocks grep in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ args: { command: 'grep foo src/app.js' } });

  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /OS-level command detected/);
});

test('bash guard blocks cat on source files in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ args: { command: 'cat src/app.ts' } });

  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

test('bash guard warns instead of blocking in moderate mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'moderate' });
  const result = hook.run({ args: { command: 'find . -name "*.ts"' } });

  assert.equal(result.allowed, true);
  assert.match(result.warning, /OS-level command detected/);
});

test('bash guard allows git commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ args: { command: 'git status' } });

  assert.deepEqual(result, { allowed: true });
});

test('bash guard allows node test commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ args: { command: 'node --test tests/runtime/*.test.js' } });

  assert.deepEqual(result, { allowed: true });
});

test('bash guard allows any command in permissive mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'permissive' });
  const result = hook.run({ args: { command: 'grep foo src/app.js' } });

  assert.deepEqual(result, { allowed: true });
});
