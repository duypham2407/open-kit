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
  updateReleasesIndex,
} from '../../src/release/workflow.js';

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
  write(path.join(repoRoot, 'registry.json'), JSON.stringify({ kit: { version } }, null, 2) + '\n');
  write(path.join(repoRoot, '.opencode', 'install-manifest.json'), JSON.stringify({ kit: { version } }, null, 2) + '\n');
  write(path.join(repoRoot, 'RELEASES.md'), '# Releases\n\nHistorical release notes tracked in-repo:\n\n- [`0.2.12`](release-notes/0.2.12.md) - latest release\n');
  write(path.join(repoRoot, 'release-notes', 'TEMPLATE.md'), '## Published package\n\n- npm: `@duypham93/openkit@<version>`\n');
  for (const relativePath of [
    '.opencode/tests/session-start-hook.test.js',
    '.opencode/tests/workflow-behavior.test.js',
    '.opencode/tests/workflow-contract-consistency.test.js',
    '.opencode/tests/workflow-state-cli.test.js',
    'tests/cli/openkit-cli.test.js',
    'tests/global/doctor.test.js',
    'tests/global/ensure-install.test.js',
    'tests/runtime/doctor.test.js',
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
  assert.match(read(path.join(repoRoot, 'package.json')), /0\.2\.13/);
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
