import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPENKIT_ASSET_MANIFEST } from '../src/install/asset-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

for (const asset of OPENKIT_ASSET_MANIFEST.bundle.assets) {
  if (asset.sourcePath === asset.bundledPath) {
    continue;
  }

  const sourcePath = path.join(projectRoot, asset.sourcePath);
  const bundledPath = path.join(projectRoot, asset.bundledPath);

  fs.mkdirSync(path.dirname(bundledPath), { recursive: true });
  fs.copyFileSync(sourcePath, bundledPath);
}

process.stdout.write('Synced derived install bundle from source assets.\n');
