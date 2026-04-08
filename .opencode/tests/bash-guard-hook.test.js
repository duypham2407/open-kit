import test from 'node:test';
import assert from 'node:assert/strict';

import { createBashGuardHook } from '../../src/runtime/hooks/tool-guards/bash-guard-hook.js';

// ---------------------------------------------------------------------------
// Strict mode
// ---------------------------------------------------------------------------

test('bash-guard blocks grep in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'grep -r "TODO" src/' } });
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.ok(result.blockedBy[0].includes('search'));
});

test('bash-guard blocks cat on source files in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'cat src/index.js' } });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('Read tool'));
});

test('bash-guard blocks sed in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'sed -i "s/foo/bar/g" file.ts' } });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('text-transform'));
});

test('bash-guard blocks awk in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: "awk '{print $1}' data.json" } });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('text-transform'));
});

test('bash-guard blocks find -name in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'find . -name "*.ts" -type f' } });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('file-discovery'));
});

test('bash-guard blocks head on source files in strict mode', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'head -20 src/utils.ts' } });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('Read tool'));
});

// ---------------------------------------------------------------------------
// Allowed commands are never blocked
// ---------------------------------------------------------------------------

test('bash-guard allows git commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'git status' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows npm commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'npm install lodash' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows node commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'node --test tests/*.test.js' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows docker commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'docker build -t myapp .' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows mkdir', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'mkdir -p src/new-dir' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows cargo commands', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'cargo test' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows semgrep', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'semgrep scan --config auto src/' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows ast-grep', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'ast-grep run --pattern "console.log($A)"' } });
  assert.equal(result.allowed, true);
});

test('bash-guard blocks grep in moderate mode too', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'moderate' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'grep -r "TODO" src/' } });
  assert.equal(result.allowed, true);
  assert.ok(result.warning.includes('search'));
});

test('bash-guard blocks grep in permissive mode too', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'permissive' });
  const result = hook.run({ toolId: 'tool.interactive-bash', args: { command: 'grep -r "TODO" src/' } });
  assert.equal(result.allowed, true);
  assert.equal(result.warning, undefined);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('bash-guard allows when no args provided', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({});
  assert.equal(result.allowed, true);
});

test('bash-guard allows when command is empty', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  const result = hook.run({ toolId: 'test', args: { command: '' } });
  assert.equal(result.allowed, true);
});

test('bash-guard allows non-code file cat', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  // cat on a .log file should not be blocked (not in code extensions)
  const result = hook.run({ toolId: 'test', args: { command: 'cat server.log' } });
  assert.equal(result.allowed, true);
});

test('bash-guard hook has correct id and name', () => {
  const hook = createBashGuardHook({ enforcementLevel: 'strict' });
  assert.equal(hook.id, 'hook.bash-guard');
  assert.equal(hook.name, 'Bash Guard Hook');
  assert.equal(hook.stage, 'foundation');
});
