import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listInstallBundleSkillMetadata } from '../../src/capabilities/skill-catalog.js';
import { OPENKIT_ASSET_MANIFEST, validateBundledAssetFiles } from '../../src/install/asset-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const bundleCatalogPath = path.join(projectRoot, 'assets/install-bundle/opencode/skill-catalog.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function copyDirectoryContents(sourceDirectory, targetDirectory) {
  fs.mkdirSync(targetDirectory, { recursive: true });

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function makeValidationFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-skill-bundle-sync-'));

  copyDirectoryContents(path.join(projectRoot, 'skills'), path.join(fixtureRoot, 'skills'));
  copyDirectoryContents(path.join(projectRoot, 'assets/install-bundle'), path.join(fixtureRoot, 'assets/install-bundle'));

  return fixtureRoot;
}

test('install bundle manifest contains every install-bundled source skill and derived catalog metadata', () => {
  const manifestSkillAssets = OPENKIT_ASSET_MANIFEST.bundle.assets
    .filter((asset) => asset.assetClass === 'skills')
    .map((asset) => asset.id.replace(/^opencode\.skill\./, ''));
  const manifestSkillSet = new Set(manifestSkillAssets);
  const installBundledSkills = listInstallBundleSkillMetadata();

  assert.ok(
    OPENKIT_ASSET_MANIFEST.bundle.assets.some((asset) => asset.id === 'opencode.skill-catalog'),
    'expected generated skill-catalog.json to be listed in the bundle asset manifest'
  );

  for (const skill of installBundledSkills) {
    assert.equal(skill.packaging.installBundle, true);
    assert.equal(skill.packaging.source, 'repo');
    assert.ok(manifestSkillSet.has(skill.name), `manifest missing skill asset for ${skill.name}`);
  }
});

test('derived install-bundle skill catalog matches canonical install-bundled metadata', () => {
  assert.equal(fs.existsSync(bundleCatalogPath), true, 'generated bundle skill-catalog.json should exist');
  const derived = readJson(bundleCatalogPath);
  const canonical = listInstallBundleSkillMetadata().map((skill) => ({
    id: skill.id,
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    status: skill.status,
    capabilityState: skill.capabilityState,
    support_level: skill.support_level,
    roles: skill.roles,
    stages: skill.stages,
    tags: skill.tags,
    triggers: skill.triggers,
    recommended_mcps: skill.recommended_mcps,
    source: skill.source,
    packaging: skill.packaging,
    limitations: skill.limitations,
    docs: skill.docs,
  }));

  assert.equal(derived.schema, 'openkit/skill-install-bundle-catalog@1');
  assert.equal(derived.validationSurface, 'package');
  assert.deepEqual(derived.skills, canonical);
});

test('install bundle validation detects skill catalog and asset drift', () => {
  const validation = validateBundledAssetFiles(projectRoot);

  assert.deepEqual(validation.missingSourceSkillCatalogEntries, []);
  assert.deepEqual(validation.repoBackedSkillCatalogEntriesMissingSourceFiles, []);
  assert.deepEqual(validation.sourceSkillsMissingInstallBundleDecision, []);
  assert.deepEqual(validation.missingSkillCatalogEntries, []);
  assert.deepEqual(validation.extraSkillCatalogEntries, []);
  assert.deepEqual(validation.missingSkillManifestEntries, []);
  assert.deepEqual(validation.missingSkillBundleFiles, []);
  assert.deepEqual(validation.skillCatalogMismatches, []);
});

test('install bundle validation fails for an extra source skill without canonical metadata', () => {
  const fixtureRoot = makeValidationFixture();
  const extraSkillPath = path.join(fixtureRoot, 'skills', 'unmapped-source-skill', 'SKILL.md');

  fs.mkdirSync(path.dirname(extraSkillPath), { recursive: true });
  fs.writeFileSync(
    extraSkillPath,
    '# Unmapped Source Skill\n\nThis fixture simulates a source skill without canonical metadata.\n',
    'utf8',
  );

  const validation = validateBundledAssetFiles(fixtureRoot);

  assert.deepEqual(validation.missingSourceSkillCatalogEntries, [
    'skills/unmapped-source-skill/SKILL.md',
  ]);
  assert.deepEqual(validation.sourceSkillsMissingInstallBundleDecision, [
    'skills/unmapped-source-skill/SKILL.md',
  ]);
});
