import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPENKIT_ASSET_MANIFEST, validateBundledAssetFiles } from '../../install/asset-manifest.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '../../..');

test('every src/commands/*.md is either bundled or has internalOnly metadata', () => {
  const commandsDir = path.join(PROJECT_ROOT, 'src', 'commands');
  const sourceCommands = fs.readdirSync(commandsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => `src/commands/${name}`);

  const bundledSourcePaths = new Set(
    OPENKIT_ASSET_MANIFEST.bundle.assets
      .filter((asset) => asset.assetClass === 'commands')
      .map((asset) => asset.sourcePath)
  );

  const internalOnly = new Set(
    (OPENKIT_ASSET_MANIFEST.bundle.internalOnlyCommands ?? []).map((entry) => entry.sourcePath)
  );

  const unclassified = sourceCommands.filter(
    (sourcePath) => !bundledSourcePaths.has(sourcePath) && !internalOnly.has(sourcePath)
  );

  assert.deepEqual(
    unclassified,
    [],
    `Source commands missing classification (bundle or internalOnly): ${unclassified.join(', ')}`
  );
});

test('validateBundledAssetFiles returns sourceCommandsMissingFromBundle', () => {
  const result = validateBundledAssetFiles(PROJECT_ROOT);
  assert.ok('sourceCommandsMissingFromBundle' in result, 'validator must report missing-from-bundle field');
  assert.ok(Array.isArray(result.sourceCommandsMissingFromBundle));
});
