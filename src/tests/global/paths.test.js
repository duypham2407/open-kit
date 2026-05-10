import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateProjectRoot } from '../../global/paths.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-paths-test-'));
}

function createTempProject() {
  const tempDir = createTempDir();
  fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "test"}');
  return tempDir;
}

test('validateProjectRoot accepts valid project with package.json', () => {
  const projectRoot = createTempProject();

  const result = validateProjectRoot(projectRoot);

  assert.equal(result.valid, true);
  assert.equal(result.checks.exists, true);
  assert.equal(result.checks.isDirectory, true);
  assert.equal(result.checks.hasPackageJson, true);
  assert.equal(result.checks.isAccessible, true);
  assert.equal(result.reason, null);

  // Cleanup
  fs.rmSync(projectRoot, { recursive: true });
});

test('validateProjectRoot rejects non-existent path', () => {
  const result = validateProjectRoot('/nonexistent/path/to/project');

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'path_does_not_exist');
});

test('validateProjectRoot rejects directory without package.json', () => {
  const tempDir = createTempDir();

  const result = validateProjectRoot(tempDir);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'no_package_json');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

test(
  'validateProjectRoot detects permission denied',
  { skip: process.getuid && process.getuid() === 0 ? 'cannot test permission denial as root' : false },
  () => {
    const projectRoot = createTempProject();
    fs.chmodSync(projectRoot, 0o000);

    const result = validateProjectRoot(projectRoot);

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'permission_denied');

    // Cleanup
    fs.chmodSync(projectRoot, 0o755);
    fs.rmSync(projectRoot, { recursive: true });
  }
);
