import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createReleaseNotes,
  getReleaseNotesPath,
  publishRelease,
  releasePrepare,
  releaseVerify,
  syncVersionMetadata,
  updateReleasesIndex,
  updateVersionMetadata,
} from '../../release/workflow.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-release-workflow-'));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function createFixtureRepo(version = '0.2.12') {
  const repoRoot = makeTempDir();
  write(path.join(repoRoot, 'package.json'), JSON.stringify({ name: '@duypham93/openkit', version }, null, 2) + '\n');
  write(path.join(repoRoot, 'package-lock.json'), JSON.stringify({ name: '@duypham93/openkit', version, lockfileVersion: 3, packages: { '': { name: '@duypham93/openkit', version } } }, null, 2) + '\n');
  write(path.join(repoRoot, 'registry.json'), JSON.stringify({ kit: { version } }, null, 2) + '\n');
  write(path.join(repoRoot, 'src', 'openkit-runtime', 'install-manifest.json'), JSON.stringify({ kit: { version } }, null, 2) + '\n');
  write(
    path.join(repoRoot, 'RELEASES.md'),
    '# Releases\n\n## Latest\n\n- [`0.2.12`](release-notes/0.2.12.md) - latest release\n- npm latest: `@duypham93/openkit@0.2.12`\n- git tag: `v0.2.12`\n\n## History\n\nHistorical release notes tracked in-repo:\n\n- [`0.2.12`](release-notes/0.2.12.md) - latest release\n',
  );
  write(path.join(repoRoot, 'release-notes', 'TEMPLATE.md'), '## Published package\n\n- npm: `@duypham93/openkit@<version>`\n');
  for (const relativePath of [
    'src/openkit-runtime/tests/session-start-hook.test.js',
    'src/openkit-runtime/tests/workflow-behavior.test.js',
    'src/openkit-runtime/tests/workflow-contract-consistency.test.js',
    'src/openkit-runtime/tests/workflow-state-cli.test.js',
    'src/tests/cli/openkit-cli.test.js',
    'src/tests/global/doctor.test.js',
    'src/tests/global/ensure-install.test.js',
    'src/tests/runtime/doctor.test.js',
  ]) {
    write(path.join(repoRoot, relativePath), `version fixture ${version}\n`);
  }
  write(path.join(repoRoot, 'release-notes', '0.2.12.md'), '## Published package\n\n- npm: `@duypham93/openkit@0.2.12`\n');
  return repoRoot;
}

test('releasePrepare updates version metadata and scaffolds release notes', () => {
  const repoRoot = createFixtureRepo();
  const spawn = (command, args) => {
    if (command === 'git' && args[0] === 'status') {
      return { status: 0, stdout: '', stderr: '' };
    }
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };

  const result = releasePrepare(repoRoot, '0.2.13', { summary: 'new release summary', spawn });

  assert.equal(result.nextVersion, '0.2.13');
  assert.equal(fs.existsSync(getReleaseNotesPath(repoRoot, '0.2.13')), true);
  assert.match(read(path.join(repoRoot, 'RELEASES.md')), /release-notes\/0\.2\.13\.md/);
  assert.match(read(path.join(repoRoot, 'RELEASES.md')), /npm latest: `@duypham93\/openkit@0\.2\.13`/);
  assert.match(read(path.join(repoRoot, 'RELEASES.md')), /git tag: `v0\.2\.13`/);
  assert.match(read(path.join(repoRoot, 'package.json')), /0\.2\.13/);
  assert.match(read(path.join(repoRoot, 'package-lock.json')), /0\.2\.13/);
});

test('updateVersionMetadata repairs partial drift when package.json already has target version', () => {
  const repoRoot = createFixtureRepo('0.2.12');
  write(path.join(repoRoot, 'package.json'), JSON.stringify({ name: '@duypham93/openkit', version: '0.2.13' }, null, 2) + '\n');

  const result = updateVersionMetadata(repoRoot, '0.2.13');
  const registry = JSON.parse(read(path.join(repoRoot, 'registry.json')));
  const manifest = JSON.parse(read(path.join(repoRoot, 'src', 'openkit-runtime', 'install-manifest.json')));
  const packageLock = JSON.parse(read(path.join(repoRoot, 'package-lock.json')));

  assert.equal(result.currentVersion, '0.2.13');
  assert.equal(registry.kit.version, '0.2.13');
  assert.equal(manifest.kit.version, '0.2.13');
  assert.equal(packageLock.version, '0.2.13');
  assert.equal(packageLock.packages[''].version, '0.2.13');
  assert.deepEqual(
    result.changedFiles.sort(),
    ['src/openkit-runtime/install-manifest.json', 'package-lock.json', 'registry.json'].sort(),
  );
});

test('syncVersionMetadata uses package.json as the canonical version source', () => {
  const repoRoot = createFixtureRepo('0.2.12');
  write(path.join(repoRoot, 'package.json'), JSON.stringify({ name: '@duypham93/openkit', version: '0.2.13' }, null, 2) + '\n');

  const result = syncVersionMetadata(repoRoot);
  const registry = JSON.parse(read(path.join(repoRoot, 'registry.json')));
  const manifest = JSON.parse(read(path.join(repoRoot, 'src', 'openkit-runtime', 'install-manifest.json')));
  const packageLock = JSON.parse(read(path.join(repoRoot, 'package-lock.json')));

  assert.equal(result.currentVersion, '0.2.13');
  assert.equal(result.nextVersion, '0.2.13');
  assert.equal(registry.kit.version, '0.2.13');
  assert.equal(manifest.kit.version, '0.2.13');
  assert.equal(packageLock.version, '0.2.13');
  assert.equal(packageLock.packages[''].version, '0.2.13');
});

test('syncVersionMetadata does not rewrite matching metadata formatting', () => {
  const repoRoot = createFixtureRepo('0.2.12');
  const registryPath = path.join(repoRoot, 'registry.json');
  const originalRegistry = '{"kit":{"version":"0.2.12"},"items":[1,2]}\n';
  write(registryPath, originalRegistry);

  const result = syncVersionMetadata(repoRoot);

  assert.deepEqual(result.changedFiles, []);
  assert.equal(read(registryPath), originalRegistry);
});

test('releaseVerify checks metadata and can skip tests', () => {
  const repoRoot = createFixtureRepo();
  createReleaseNotes(repoRoot, '0.2.12');
  updateReleasesIndex(repoRoot, '0.2.12', 'latest release');

  const result = releaseVerify(repoRoot, { skipTests: true });
  assert.equal(result.version, '0.2.12');
});

test('publishRelease runs push, tag, publish, and optional gh flow', () => {
  const repoRoot = createFixtureRepo();
  const notesPath = getReleaseNotesPath(repoRoot, '0.2.12');
  write(notesPath, '## Published package\n\n- npm: `@duypham93/openkit@0.2.12`\n');

  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, ...args]);
    if (command === 'git' && args[0] === 'status') {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (command === 'git' && args[0] === 'rev-parse') {
      return { status: 1, stdout: '', stderr: '' };
    }
    if (command === 'npm' && args[0] === 'view') {
      return { status: 1, stdout: '', stderr: '' };
    }
    if (command === process.execPath && args[0] === '--test') {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (command === 'gh' && args[0] === '--version') {
      return { status: 1, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  const output = { stdout: { write() {} }, stderr: { write() {} } };
  const result = publishRelease(repoRoot, { spawn, io: output });

  assert.equal(result.version, '0.2.12');
  assert.deepEqual(calls.some((call) => call[0] === 'npm' && call[1] === 'publish'), true);
  assert.deepEqual(calls.some((call) => call[0] === 'git' && call[1] === 'tag'), true);
});
