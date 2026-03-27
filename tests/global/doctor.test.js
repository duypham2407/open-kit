import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inspectGlobalDoctor, renderGlobalDoctorSummary } from '../../src/global/doctor.js';
import { materializeGlobalInstall } from '../../src/global/materialize.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-global-doctor-'));
}

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('global doctor reports next steps for install-missing', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 'install-missing');
  assert.equal(result.nextStep, 'Run openkit run for first-time setup.');
  assert.equal(result.recommendedCommand, 'openkit run');

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Next: Run openkit run for first-time setup\./);
  assert.match(output, /Recommended command: openkit run/);
  assert.match(output, /Default session entrypoint: \/task/);
});

test('global doctor reports next steps for healthy installs', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();
  const fakeBinDir = path.join(tempHome, 'bin');

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });
  writeExecutable(path.join(fakeBinDir, 'opencode'), '#!/bin/sh\nexit 0\n');

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.nextStep, 'Run openkit run.');
  assert.equal(result.recommendedCommand, 'openkit run');
  assert.equal(result.workspace.paths.workspaceRoot.includes('workspaces'), true);
  assert.equal(result.workspace.meta, null);
  assert.equal(result.workspace.index, null);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode')), false);
  assert.equal(fs.existsSync(path.join(tempHome, 'workspaces')), false);

  const output = renderGlobalDoctorSummary(result);
  assert.match(output, /Default session entrypoint: \/task/);
  assert.match(output, /Next action after launch:/);
});

test('global doctor recommends upgrade for invalid installs', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  writeJson(path.join(tempHome, 'kits', 'openkit', 'install-state.json'), {
    schema: 'wrong-schema',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.3.5',
    },
    installation: {
      profile: 'openkit',
      status: 'installed',
      installedAt: '2026-03-24T00:00:00.000Z',
    },
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: process.env.PATH ?? '',
    },
  });

  assert.equal(result.status, 'install-invalid');
  assert.equal(result.nextStep, 'Run openkit upgrade to refresh the global install.');
  assert.equal(result.recommendedCommand, 'openkit upgrade');
});

test('global doctor reports workspace issues with guidance', () => {
  const tempHome = makeTempDir();
  const projectRoot = makeTempDir();

  materializeGlobalInstall({
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
    },
  });

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 'workspace-ready-with-issues');
  assert.equal(result.nextStep, 'Review the issues above before relying on this workspace.');
  assert.equal(result.recommendedCommand, null);
  assert.match(result.issues.join('\n'), /OpenCode executable is not available on PATH/);
  assert.equal(result.workspace.meta, null);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode')), false);
});
