// Regression test for audit fix [N-1]: switch-profiles-cli.js entry-point
// guard must use real-path comparison so the CLI body actually runs when
// the script is spawned from a symlinked path (e.g. macOS /var/folders/...
// → /private/var/folders/...). The fix replaced the URL-string compare
// with realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('switch-profiles-cli entry-point guard uses realpathSync (not URL-string compare)', () => {
  // Pin the fix as a contract: the guard must use fs.realpathSync to
  // resolve symlinks on both sides of the comparison. A simple string
  // compare against `file://${argv[1]}` is the bug we're guarding against.
  const sourceUrl = new URL('../../runtime/switch-profiles-cli.js', import.meta.url);
  const source = fs.readFileSync(sourceUrl, 'utf8');

  assert.match(
    source,
    /fs\.realpathSync\s*\(\s*fileURLToPath\s*\(\s*import\.meta\.url/,
    'guard must resolve import.meta.url through realpathSync',
  );
  assert.match(
    source,
    /fs\.realpathSync\s*\(\s*process\.argv\[1\]/,
    'guard must resolve process.argv[1] through realpathSync',
  );
  assert.doesNotMatch(
    source,
    /import\.meta\.url\s*===\s*`file:\/\/\$\{process\.argv\[1\]\}`/,
    'the buggy URL-string compare must not return',
  );
});

test('switch-profiles-cli does NOT execute when imported (only when spawned as entry point)', () => {
  // Re-import the module multiple times to confirm it never produces
  // stdout / never sets process.exitCode just from being imported.
  const before = process.exitCode;
  const stdoutBefore = process.stdout.writableLength;

  // The static import at the top of this test file (transitively, via the
  // contract test above's source read) does not actually execute the CLI
  // logic — but to be thorough, dynamically import it again and confirm
  // nothing changes.
  return import('../../runtime/switch-profiles-cli.js').then(() => {
    assert.equal(process.exitCode, before, 'importing the module must not set process.exitCode');
    assert.equal(process.stdout.writableLength, stdoutBefore, 'importing must not write to stdout');
  });
});
