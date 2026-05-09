// Regression test for audit fix [2-H-1]: materializeGlobalInstall must be
// atomic. Previously the kit-root and profiles-root were deleted before the
// copy loop; a mid-flight crash left an empty kit-root and OpenKit
// inoperable. The fix uses backup-rename + rollback so a failure during
// materialize leaves the prior install in place.
//
// Test strategy: build a healthy install, then trigger a failure during a
// SECOND materialize call (by stubbing one of the dependency provisioners
// to throw). Assert kit-root still contains the original content.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { materializeGlobalInstall } from '../../src/global/materialize.js';

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildEnv(globalRoot) {
  return {
    ...process.env,
    OPENCODE_HOME: globalRoot,
  };
}

const FAKE_TOOLING_OK = () => ({ installed: true, toolingRoot: '/tmp/fake' });

test('materializeGlobalInstall preserves existing install when a mid-flight error occurs', () => {
  const globalRoot = mkdtemp('mat-atomic-');

  // Round 1: a successful install.
  const result1 = materializeGlobalInstall({
    env: buildEnv(globalRoot),
    ensureAstGrep: FAKE_TOOLING_OK,
    ensureSemgrep: FAKE_TOOLING_OK,
  });

  const kitRoot = result1.kitRoot;
  const profilesRoot = result1.profilesRoot;
  assert.ok(fs.existsSync(kitRoot), 'kitRoot must exist after first install');
  assert.ok(fs.existsSync(path.join(kitRoot, 'install-state.json')), 'install-state.json must exist after first install');

  // Insert a sentinel inside the kit-root so we can prove the rollback
  // restored the SAME directory rather than re-creating it.
  // (The atomic implementation renames aside; rollback renames back.)
  const sentinelPath = path.join(kitRoot, '__sentinel__.txt');
  fs.writeFileSync(sentinelPath, 'round-1-content');

  // Round 2: deliberately make ensureAstGrep throw mid-materialize.
  let didThrow = false;
  try {
    materializeGlobalInstall({
      env: buildEnv(globalRoot),
      ensureAstGrep: () => {
        throw new Error('synthetic-tooling-failure');
      },
      ensureSemgrep: FAKE_TOOLING_OK,
    });
  } catch (err) {
    didThrow = true;
    assert.match(err.message, /synthetic-tooling-failure/);
  }
  assert.ok(didThrow, 'materializeGlobalInstall should propagate the synthetic failure');

  // After rollback: kit-root must exist and must still contain the sentinel
  // we wrote BEFORE the failed second install.
  assert.ok(fs.existsSync(kitRoot), 'kitRoot must still exist after rollback');
  assert.ok(
    fs.existsSync(sentinelPath),
    'sentinel file must survive the failed install — proof that the prior install was rolled back into place',
  );
  assert.equal(
    fs.readFileSync(sentinelPath, 'utf8'),
    'round-1-content',
    'sentinel content must be the original — rollback should not re-run the install',
  );

  // Profiles root also restored.
  assert.ok(fs.existsSync(profilesRoot), 'profilesRoot must still exist after rollback');

  // No leftover .prev-* backup directories: rollback should rename them back.
  const parentDir = path.dirname(kitRoot);
  const stale = fs.readdirSync(parentDir).filter((name) => name.includes('.prev-'));
  assert.deepEqual(stale, [], `no stale .prev- backups should remain in ${parentDir}, found: ${stale.join(', ')}`);

  fs.rmSync(globalRoot, { recursive: true, force: true });
});

test('materializeGlobalInstall succeeds and leaves no backup directories', () => {
  const globalRoot = mkdtemp('mat-atomic-clean-');

  const result = materializeGlobalInstall({
    env: buildEnv(globalRoot),
    ensureAstGrep: FAKE_TOOLING_OK,
    ensureSemgrep: FAKE_TOOLING_OK,
  });

  assert.ok(fs.existsSync(result.kitRoot));

  // No leftover backup directories from a successful install.
  const parentDir = path.dirname(result.kitRoot);
  const stale = fs.readdirSync(parentDir).filter((name) => name.includes('.prev-'));
  assert.deepEqual(stale, []);

  fs.rmSync(globalRoot, { recursive: true, force: true });
});
