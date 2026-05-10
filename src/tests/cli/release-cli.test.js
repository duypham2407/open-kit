import test from 'node:test';
import assert from 'node:assert/strict';

import { releaseCommand } from '../../cli/commands/release.js';

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

test('release help renders when no subcommand is provided', async () => {
  const capture = createIo();
  const status = await releaseCommand.run([], capture.io, {});

  assert.equal(status, 0);
  assert.match(capture.stdout, /openkit release <subcommand>/);
});

test('release prepare delegates to release workflow deps', async () => {
  const capture = createIo();
  let called = false;
  const status = await releaseCommand.run(['prepare', '0.2.13', '--summary', 'my summary'], capture.io, {
    releaseDeps: {
      releasePrepare(_cwd, version, options) {
        called = true;
        assert.equal(version, '0.2.13');
        assert.equal(options.summary, 'my summary');
        return { nextVersion: '0.2.13', notesPath: '/tmp/notes.md', changedFiles: [] };
      },
    },
  });

  assert.equal(status, 0);
  assert.equal(called, true);
  assert.match(capture.stdout, /Prepared release 0.2.13/);
});

test('release sync-version delegates to package-version sync workflow', async () => {
  const capture = createIo();
  let called = false;
  const status = await releaseCommand.run(['sync-version'], capture.io, {
    releaseDeps: {
      syncVersionMetadata(_cwd) {
        called = true;
        return { nextVersion: '0.2.13', changedFiles: ['registry.json'] };
      },
    },
  });

  assert.equal(status, 0);
  assert.equal(called, true);
  assert.match(capture.stdout, /Synced version metadata to 0\.2\.13/);
  assert.match(capture.stdout, /Changed files: 1/);
});

test('release help documents sync-version', async () => {
  const capture = createIo();
  const status = await releaseCommand.run([], capture.io, {});

  assert.equal(status, 0);
  assert.match(capture.stdout, /sync-version/);
});

test('release verify delegates to release workflow deps', async () => {
  const capture = createIo();
  let called = false;
  const status = await releaseCommand.run(['verify', '--skip-tests'], capture.io, {
    releaseDeps: {
      releaseVerify(_cwd, options) {
        called = true;
        assert.equal(options.skipTests, true);
        return { version: '0.2.12' };
      },
    },
  });

  assert.equal(status, 0);
  assert.equal(called, true);
  assert.match(capture.stdout, /Release 0.2.12 verified successfully/);
});

test('release publish delegates to release workflow deps', async () => {
  const capture = createIo();
  let called = false;
  const status = await releaseCommand.run(['publish', '--skip-gh'], capture.io, {
    releaseDeps: {
      publishRelease(_cwd, options) {
        called = true;
        assert.equal(options.skipGh, true);
        return { version: '0.2.12', tag: 'v0.2.12' };
      },
    },
  });

  assert.equal(status, 0);
  assert.equal(called, true);
  assert.match(capture.stdout, /Published 0.2.12/);
});
