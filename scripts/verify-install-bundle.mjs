import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBundledAssetFiles } from '../src/install/asset-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const validation = validateBundledAssetFiles(projectRoot);

if (
  validation.missingFiles.length > 0 ||
  validation.mismatchedFiles.length > 0 ||
  validation.extraBundledFiles.length > 0
) {
  process.stderr.write('Derived install bundle drift detected.\n');

  if (validation.missingFiles.length > 0) {
    process.stderr.write(`Missing files:\n- ${validation.missingFiles.join('\n- ')}\n`);
  }

  if (validation.mismatchedFiles.length > 0) {
    process.stderr.write(
      `Mismatched files:\n- ${validation.mismatchedFiles.map((item) => `${item.id}: ${item.sourcePath} -> ${item.bundledPath}`).join('\n- ')}\n`,
    );
  }

  if (validation.extraBundledFiles.length > 0) {
    process.stderr.write(`Extra bundled files:\n- ${validation.extraBundledFiles.join('\n- ')}\n`);
  }

  process.stderr.write('Run `npm run sync:install-bundle` to refresh derived assets.\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Derived install bundle is in sync.\n');
}
