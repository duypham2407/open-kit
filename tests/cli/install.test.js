import test from 'node:test';
import assert from 'node:assert/strict';

import { installCommand } from '../../src/cli/commands/install.js';

function createIo() {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: { write(chunk) { stdout += chunk; } },
      stderr: { write(chunk) { stderr += chunk; } },
    },
    get stdout() { return stdout; },
    get stderr() { return stderr; },
  };
}

function fakeMaterialize({ tooling = { installed: true, toolingRoot: '/tmp/tooling' }, semgrepTooling = { installed: true, toolingRoot: '/tmp/tooling' } } = {}) {
  return () => ({
    kitRoot: '/tmp/kits/openkit',
    profilesRoot: '/tmp/profiles',
    tooling,
    semgrepTooling,
  });
}

test('install --help shows usage', async () => {
  const capture = createIo();
  const status = await installCommand.run(['--help'], capture.io, {});

  assert.equal(status, 0);
  assert.match(capture.stdout, /Usage: openkit install/);
  assert.match(capture.stdout, /--verify/);
  assert.match(capture.stdout, /openkit run/);
});

test('install succeeds when all tooling installs correctly', async () => {
  const capture = createIo();
  const status = await installCommand.run([], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize(),
      ensureAstGrep: () => ({ installed: true, toolingRoot: '/tmp/tooling' }),
      ensureSemgrep: () => ({ installed: true, toolingRoot: '/tmp/tooling' }),
      checkAstGrep: () => true,
      checkSemgrep: () => true,
      checkCodemod: () => true,
    },
  });

  assert.equal(status, 0);
  assert.match(capture.stdout, /Installing OpenKit global kit/);
  assert.match(capture.stdout, /Kit root:/);
  assert.match(capture.stdout, /ast-grep: installed/);
  assert.match(capture.stdout, /semgrep: installed/);
  assert.match(capture.stdout, /jscodeshift: available/);
  assert.match(capture.stdout, /All runtime tooling installed successfully/);
  assert.match(capture.stdout, /openkit run/);
  assert.equal(capture.stderr, '');
});

test('install returns exit code 1 when ast-grep fails', async () => {
  const capture = createIo();
  const status = await installCommand.run([], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize({
        tooling: { installed: false, reason: 'spawn error' },
      }),
      ensureAstGrep: () => ({ installed: false, reason: 'spawn error' }),
      ensureSemgrep: () => ({ installed: true, toolingRoot: '/tmp/tooling' }),
      checkAstGrep: () => false,
      checkSemgrep: () => true,
      checkCodemod: () => true,
    },
  });

  assert.equal(status, 1);
  assert.match(capture.stdout, /ast-grep: FAILED/);
  assert.match(capture.stderr, /Failed to install: ast-grep/);
});

test('install returns exit code 1 and shows remediation when semgrep fails', async () => {
  const capture = createIo();
  const status = await installCommand.run([], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize({
        semgrepTooling: { installed: false, reason: 'python3 not found' },
      }),
      ensureAstGrep: () => ({ installed: true, toolingRoot: '/tmp/tooling' }),
      ensureSemgrep: () => ({ installed: false, reason: 'python3 not found' }),
      checkAstGrep: () => true,
      checkSemgrep: () => false,
      checkCodemod: () => true,
    },
  });

  assert.equal(status, 1);
  assert.match(capture.stdout, /semgrep: FAILED/);
  assert.match(capture.stderr, /Failed to install: semgrep/);
  assert.match(capture.stderr, /python3 and pip/);
  assert.match(capture.stderr, /brew install python3/);
});

test('install returns exit code 1 when jscodeshift is missing', async () => {
  const capture = createIo();
  const status = await installCommand.run([], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize(),
      ensureAstGrep: () => ({ installed: true }),
      ensureSemgrep: () => ({ installed: true }),
      checkAstGrep: () => true,
      checkSemgrep: () => true,
      checkCodemod: () => false,
    },
  });

  assert.equal(status, 1);
  assert.match(capture.stdout, /jscodeshift: NOT FOUND/);
  assert.match(capture.stderr, /Failed to install: jscodeshift/);
});

test('install --verify passes when all tools are available', async () => {
  const capture = createIo();
  const status = await installCommand.run(['--verify'], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize(),
      ensureAstGrep: () => ({ installed: true }),
      ensureSemgrep: () => ({ installed: true }),
      checkAstGrep: () => true,
      checkSemgrep: () => true,
      checkCodemod: () => true,
    },
  });

  assert.equal(status, 0);
  assert.match(capture.stdout, /Verifying installation/);
  assert.match(capture.stdout, /ast-grep: OK/);
  assert.match(capture.stdout, /semgrep:  OK/);
  assert.match(capture.stdout, /jscodeshift: OK/);
  assert.match(capture.stdout, /Verification passed/);
});

test('install --verify returns exit code 1 when verification fails', async () => {
  const capture = createIo();
  const status = await installCommand.run(['--verify'], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize(),
      ensureAstGrep: () => ({ installed: true }),
      ensureSemgrep: () => ({ installed: true }),
      checkAstGrep: () => false,
      checkSemgrep: () => true,
      checkCodemod: () => true,
    },
  });

  assert.equal(status, 1);
  assert.match(capture.stdout, /ast-grep: NOT FOUND/);
  assert.match(capture.stderr, /Verification failed for: ast-grep/);
  assert.match(capture.stderr, /openkit doctor/);
});

test('install reports multiple failures together', async () => {
  const capture = createIo();
  const status = await installCommand.run([], capture.io, {
    installDeps: {
      env: { OPENCODE_HOME: '/tmp/test-home' },
      materialize: fakeMaterialize({
        tooling: { installed: false, reason: 'npm error' },
        semgrepTooling: { installed: false, reason: 'pip error' },
      }),
      ensureAstGrep: () => ({ installed: false }),
      ensureSemgrep: () => ({ installed: false }),
      checkAstGrep: () => false,
      checkSemgrep: () => false,
      checkCodemod: () => false,
    },
  });

  assert.equal(status, 1);
  assert.match(capture.stderr, /Failed to install: ast-grep, semgrep, jscodeshift/);
});
