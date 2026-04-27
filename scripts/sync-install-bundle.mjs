import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPENKIT_ASSET_MANIFEST, createDerivedSkillCatalog } from '../src/install/asset-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const skillCatalogPath = path.join(projectRoot, 'assets/install-bundle/opencode/skill-catalog.json');

for (const asset of OPENKIT_ASSET_MANIFEST.bundle.assets) {
  if (asset.sourcePath === asset.bundledPath) {
    continue;
  }

  const sourcePath = path.join(projectRoot, asset.sourcePath);
  const bundledPath = path.join(projectRoot, asset.bundledPath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Install bundle source file is missing: ${asset.sourcePath}`);
  }

  fs.mkdirSync(path.dirname(bundledPath), { recursive: true });
  fs.copyFileSync(sourcePath, bundledPath);
}

fs.mkdirSync(path.dirname(skillCatalogPath), { recursive: true });
fs.writeFileSync(skillCatalogPath, `${JSON.stringify(createDerivedSkillCatalog(), null, 2)}\n`, 'utf8');

process.stdout.write('Synced derived install bundle from source assets.\n');
