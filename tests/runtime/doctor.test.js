import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inspectManagedDoctor } from '../../src/runtime/doctor.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-doctor-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function materializeManagedInstall(projectRoot) {
  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'managed-opencode-wrapper',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });
}

test('doctor reports install missing when managed wrapper files are absent', () => {
  const projectRoot = makeTempDir();

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => false,
  });

  assert.equal(result.status, 'install-missing');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.ownedAssets.managed, []);
  assert.match(result.summary, /managed install was not found/i);
  assert.match(result.summary, /openkit run cannot proceed cleanly/i);
});

test('doctor reports install incomplete when install state is missing', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'managed-opencode-wrapper',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'install-incomplete');
  assert.equal(result.canRunCleanly, false);
  assert.match(result.summary, /install is incomplete/i);
  assert.deepEqual(result.issues, [
    'Missing required managed asset: .openkit/openkit-install.json',
  ]);
});

test('doctor reports install incomplete for a partial install when install state exists but wrapper entrypoint is missing', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'install-incomplete');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.ownedAssets.managed, ['opencode.json', '.openkit/openkit-install.json']);
  assert.match(result.summary, /install is incomplete/i);
  assert.match(result.issues.join('\n'), /Missing required managed asset: opencode\.json/);
});

test('doctor reports drift when a managed asset changed on disk', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  writeJson(path.join(projectRoot, 'opencode.json'), {
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'changed-wrapper-surface',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['opencode.json']);
  assert.match(result.summary, /managed asset drift was detected/i);
  assert.match(result.issues[0], /Drift detected for managed asset: opencode\.json/);
});

test('doctor reports drift for managed install-state assets it owns in phase 1', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'custom-profile',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.opencode-manifest', path: 'opencode.json', status: 'materialized' },
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [],
    },
    warnings: [],
    conflicts: [],
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['.openkit/openkit-install.json']);
  assert.match(result.summary, /managed asset drift was detected/i);
  assert.match(
    result.issues.join('\n'),
    /Drift detected for managed asset: \.openkit\/openkit-install\.json/
  );
});

test('doctor reports malformed wrapper manifest JSON as diagnosable drift instead of crashing', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  writeText(path.join(projectRoot, 'opencode.json'), '{"installState": ');

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['opencode.json']);
  assert.match(result.issues.join('\n'), /Managed asset JSON is malformed: opencode\.json/);
});

test('doctor reports malformed managed install-state JSON as diagnosable drift instead of crashing', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });
  writeText(path.join(projectRoot, '.openkit', 'openkit-install.json'), '{"schema": ');

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'drift-detected');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, ['.openkit/openkit-install.json']);
  assert.match(
    result.issues.join('\n'),
    /Managed asset JSON is malformed: \.openkit\/openkit-install\.json/
  );
});

test('doctor reports runtime prerequisites missing when install is intact but launcher prerequisites are absent', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => false,
  });

  assert.equal(result.status, 'runtime-prerequisites-missing');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.driftedAssets, []);
  assert.deepEqual(result.ownedAssets.managed, ['opencode.json', '.openkit/openkit-install.json']);
  assert.match(result.summary, /runtime launch prerequisites are missing/i);
  assert.match(result.issues.join('\n'), /Missing runtime manifest: \.opencode\/opencode\.json/);
  assert.match(result.issues.join('\n'), /OpenCode executable is not available on PATH/);
});

test('doctor reports healthy state when install is intact and launcher prerequisites are available', () => {
  const projectRoot = makeTempDir();

  materializeManagedInstall(projectRoot);
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.canRunCleanly, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.driftedAssets, []);
  assert.deepEqual(result.ownedAssets.managed, ['opencode.json', '.openkit/openkit-install.json']);
  assert.match(result.summary, /managed wrapper is healthy/i);
  assert.match(result.summary, /openkit run can proceed cleanly/i);
});

test('doctor does not report healthy when an adopted root manifest is incompatible with the wrapper contract', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    plugin: ['existing-plugin'],
    productSurface: {
      current: 'custom-surface',
    },
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [
        {
          assetId: 'runtime.opencode-manifest',
          path: 'opencode.json',
          adoptedFrom: 'user-existing',
          status: 'adopted',
        },
      ],
    },
    warnings: [],
    conflicts: [
      {
        assetId: 'runtime.opencode-manifest',
        path: 'opencode.json',
        reason: 'unsupported-top-level-key',
        resolution: 'manual-review-required',
      },
    ],
  });
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'install-incomplete');
  assert.equal(result.canRunCleanly, false);
  assert.deepEqual(result.ownedAssets.adopted, ['opencode.json']);
  assert.match(result.summary, /wrapper contract is incomplete/i);
  assert.match(result.issues.join('\n'), /adopted root manifest is incompatible with the managed wrapper contract/i);
});

test('doctor can report healthy when an adopted root manifest still satisfies the wrapper contract', () => {
  const projectRoot = makeTempDir();

  writeJson(path.join(projectRoot, 'opencode.json'), {
    plugin: ['existing-plugin'],
    installState: {
      path: '.openkit/openkit-install.json',
      schema: 'openkit/install-state@1',
    },
    productSurface: {
      current: 'managed-opencode-wrapper',
      wrapperReadiness: 'managed',
      installationMode: 'openkit-managed',
    },
  });
  writeJson(path.join(projectRoot, '.openkit', 'openkit-install.json'), {
    schema: 'openkit/install-state@1',
    stateVersion: 1,
    kit: {
      name: 'OpenKit',
      version: '0.1.0',
    },
    installation: {
      profile: 'openkit-core',
      status: 'installed',
      installedAt: '2026-03-22T12:00:00.000Z',
    },
    assets: {
      managed: [
        { assetId: 'runtime.install-state', path: '.openkit/openkit-install.json', status: 'managed' },
      ],
      adopted: [
        {
          assetId: 'runtime.opencode-manifest',
          path: 'opencode.json',
          adoptedFrom: 'user-existing',
          status: 'adopted',
        },
      ],
    },
    warnings: [],
    conflicts: [],
  });
  writeJson(path.join(projectRoot, '.opencode', 'opencode.json'), {
    model: 'managed-model',
  });

  const result = inspectManagedDoctor({
    projectRoot,
    env: {},
    isOpenCodeAvailable: () => true,
  });

  assert.equal(result.status, 'healthy');
  assert.equal(result.canRunCleanly, true);
  assert.deepEqual(result.ownedAssets.adopted, ['opencode.json']);
  assert.deepEqual(result.issues, []);
});
