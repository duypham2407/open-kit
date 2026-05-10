import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'registry.json'), 'utf8'));
const installManifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, '.opencode/install-manifest.json'), 'utf8'),
);
const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));

test('package.json version matches registry.json kit.version', () => {
  assert.equal(
    registry.kit?.version,
    pkg.version,
    `registry.json kit.version (${registry.kit?.version}) must equal package.json version (${pkg.version})`,
  );
});

test('package.json version matches install-manifest.json kit.version', () => {
  assert.equal(
    installManifest.kit?.version,
    pkg.version,
    `install-manifest.json kit.version (${installManifest.kit?.version}) must equal package.json version (${pkg.version})`,
  );
});

test('package.json version matches package-lock.json root versions', () => {
  assert.equal(
    packageLock.version,
    pkg.version,
    `package-lock.json version (${packageLock.version}) must equal package.json version (${pkg.version})`,
  );
  assert.equal(
    packageLock.packages?.['']?.version,
    pkg.version,
    `package-lock.json packages[""].version (${packageLock.packages?.['']?.version}) must equal package.json version (${pkg.version})`,
  );
});

test('package.json exposes a version metadata sync script', () => {
  assert.equal(
    pkg.scripts?.['sync:version'],
    'node scripts/sync-version-metadata.mjs',
  );
});
