// Regression test for audit fix [2-H-4]: openkit upgrade must surface
// materialize failures as a structured stderr message and exit code 1,
// not as an uncaught exception with a raw stack trace.

import test from 'node:test';
import assert from 'node:assert/strict';

// We exercise the command directly with a stubbed io and a process.env
// that points materialize at a non-writeable OPENCODE_HOME so the call
// fails. Easier: just import the command and inject a synthetic failure
// by setting OPENCODE_HOME to /dev/null (which fs.mkdirSync rejects).

import { upgradeCommand } from '../../cli/commands/upgrade.js';

function makeIo() {
  const stdoutBuf = [];
  const stderrBuf = [];
  return {
    stdout: { write: (chunk) => { stdoutBuf.push(String(chunk)); return true; } },
    stderr: { write: (chunk) => { stderrBuf.push(String(chunk)); return true; } },
    get stdoutText() { return stdoutBuf.join(''); },
    get stderrText() { return stderrBuf.join(''); },
  };
}

test('upgrade command returns 1 and writes structured stderr on failure', async () => {
  const io = makeIo();

  // /dev/null cannot be a directory; mkdirSync on a sub-path fails with
  // ENOTDIR. This produces a deterministic materialize failure without
  // requiring filesystem permissions tweaks.
  const originalHome = process.env.OPENCODE_HOME;
  process.env.OPENCODE_HOME = '/dev/null/openkit-upgrade-error-test';

  try {
    const exitCode = await upgradeCommand.run([], io);
    assert.equal(exitCode, 1, 'upgrade must return exit code 1 on materialize failure');
  } finally {
    if (originalHome === undefined) {
      delete process.env.OPENCODE_HOME;
    } else {
      process.env.OPENCODE_HOME = originalHome;
    }
  }

  assert.equal(io.stdoutText, '', 'no stdout on failure (success messages must not be emitted)');
  assert.match(
    io.stderrText,
    /openkit upgrade failed/,
    'stderr must include the structured "openkit upgrade failed" header',
  );
  assert.match(
    io.stderrText,
    /restored|reinstall|retry/i,
    'stderr must include recovery guidance (rollback note + retry / reinstall hint)',
  );
});

test('upgrade --help still returns 0 without invoking materialize', async () => {
  const io = makeIo();
  const exitCode = await upgradeCommand.run(['--help'], io);
  assert.equal(exitCode, 0);
  assert.match(io.stdoutText, /Usage:/);
  assert.equal(io.stderrText, '');
});
