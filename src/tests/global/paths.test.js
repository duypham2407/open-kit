import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateProjectRoot, detectProjectRoot, detectProjectRootWithDiagnostics } from '../../global/paths.js';

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

test('detectProjectRootWithDiagnostics walks up to find package.json', () => {
  const projectRoot = createTempProject();
  // realpath in case tmpdir contains a symlink (common on macOS)
  const realProjectRoot = fs.realpathSync(projectRoot);
  const nestedDir = path.join(realProjectRoot, 'src', 'components');
  fs.mkdirSync(nestedDir, { recursive: true });

  const result = detectProjectRootWithDiagnostics(nestedDir);

  assert.equal(result.valid, true);
  assert.equal(result.path, realProjectRoot);
  assert.equal(result.confidence, 'high');
  assert.equal(result.strategy, 'walk_up');

  fs.rmSync(realProjectRoot, { recursive: true });
});

test('detectProjectRootWithDiagnostics detects project at cwd via cwd strategy', () => {
  const projectRoot = createTempProject();
  const realProjectRoot = fs.realpathSync(projectRoot);

  const result = detectProjectRootWithDiagnostics(realProjectRoot);

  assert.equal(result.valid, true);
  assert.equal(result.path, realProjectRoot);
  assert.equal(result.confidence, 'high');
  assert.equal(result.strategy, 'cwd');

  fs.rmSync(realProjectRoot, { recursive: true });
});

test('detectProjectRootWithDiagnostics falls back when no package.json or markers exist', () => {
  // Use an isolated temp dir somewhere unlikely to walk into a project ancestor.
  // We move into a deeply nested dir under tmp that itself has no markers.
  const tempDir = createTempDir();
  const realTempDir = fs.realpathSync(tempDir);
  const nestedDir = path.join(realTempDir, 'a', 'b', 'c');
  fs.mkdirSync(nestedDir, { recursive: true });

  // Note: this test could find an ancestor marker on dev machines, so we only
  // assert that fallback semantics are honoured when no marker is found by
  // checking the contract: when valid=false, confidence must be 'fallback'
  // and path must equal the resolved startDir.
  const result = detectProjectRootWithDiagnostics(nestedDir);

  if (!result.valid) {
    assert.equal(result.path, nestedDir);
    assert.equal(result.confidence, 'fallback');
    assert.equal(result.strategy, 'fallback');
  } else {
    // If an ancestor marker was found, that's a valid environmental outcome —
    // still assert the shape is correct.
    assert.equal(result.confidence, 'high');
    assert.ok(['cwd', 'walk_up', 'project_markers'].includes(result.strategy));
  }

  fs.rmSync(realTempDir, { recursive: true });
});

test('detectProjectRootWithDiagnostics detects by project markers (tsconfig.json) when no package.json', () => {
  const tempDir = createTempDir();
  const realTempDir = fs.realpathSync(tempDir);
  fs.writeFileSync(path.join(realTempDir, 'tsconfig.json'), '{}');
  const nestedDir = path.join(realTempDir, 'src');
  fs.mkdirSync(nestedDir, { recursive: true });

  const result = detectProjectRootWithDiagnostics(nestedDir);

  assert.equal(result.valid, true);
  assert.equal(result.path, realTempDir);
  assert.equal(result.confidence, 'high');
  assert.equal(result.strategy, 'project_markers');

  fs.rmSync(realTempDir, { recursive: true });
});

test('detectProjectRoot returns startDir path string (backwards compatible)', () => {
  const projectRoot = createTempProject();
  const realProjectRoot = fs.realpathSync(projectRoot);
  const nestedDir = path.join(realProjectRoot, 'src');
  fs.mkdirSync(nestedDir, { recursive: true });

  const result = detectProjectRoot(nestedDir);

  assert.equal(typeof result, 'string');
  assert.equal(result, realProjectRoot);

  fs.rmSync(realProjectRoot, { recursive: true });
});
