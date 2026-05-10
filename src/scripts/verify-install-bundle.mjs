import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBundledAssetFiles } from '../install/asset-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const validation = validateBundledAssetFiles(projectRoot);

// Audit fix [2-M-5]: cross-check that the install-bundle output prefix
// is covered by package.json#files. Without this, a future relocation of
// the bundle output directory would silently produce a published tarball
// missing the bundle.
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const filesField = pkg.files ?? [];
const REQUIRED_BUNDLE_PREFIX = 'src/assets/';
const bundlePrefixCovered = filesField.some((entry) => {
  if (typeof entry !== 'string') return false;
  if (entry === REQUIRED_BUNDLE_PREFIX) return true;
  // Entry covers the bundle prefix if the bundle prefix starts with the entry
  // (e.g., entry "src/" covers prefix "src/assets/").
  if (REQUIRED_BUNDLE_PREFIX.startsWith(entry)) return true;
  // Or if the entry is more specific than the prefix (e.g., entry "src/assets/foo").
  if (entry.startsWith(REQUIRED_BUNDLE_PREFIX)) return true;
  return false;
});
if (!bundlePrefixCovered) {
  process.stderr.write(
    `package.json#files does not cover the install-bundle output prefix '${REQUIRED_BUNDLE_PREFIX}'. ` +
      `Add an entry such as '${REQUIRED_BUNDLE_PREFIX}' so npm pack ships the bundled assets.\n`,
  );
  process.exitCode = 1;
}

if (
  validation.missingFiles.length > 0 ||
  validation.mismatchedFiles.length > 0 ||
  validation.extraBundledFiles.length > 0 ||
  validation.missingSourceSkillCatalogEntries.length > 0 ||
  validation.repoBackedSkillCatalogEntriesMissingSourceFiles.length > 0 ||
  validation.sourceSkillsMissingInstallBundleDecision.length > 0 ||
  validation.missingSkillCatalogEntries.length > 0 ||
  validation.extraSkillCatalogEntries.length > 0 ||
  validation.missingSkillManifestEntries.length > 0 ||
  validation.extraSkillManifestEntries.length > 0 ||
  validation.missingSkillBundleFiles.length > 0 ||
  validation.skillCatalogMismatches.length > 0
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

  if (validation.missingSourceSkillCatalogEntries.length > 0) {
    process.stderr.write(`Source skill files missing catalog metadata:\n- ${validation.missingSourceSkillCatalogEntries.join('\n- ')}\n`);
  }

  if (validation.repoBackedSkillCatalogEntriesMissingSourceFiles.length > 0) {
    process.stderr.write(`Repo-backed skill catalog entries missing source files:\n- ${validation.repoBackedSkillCatalogEntriesMissingSourceFiles.join('\n- ')}\n`);
  }

  if (validation.sourceSkillsMissingInstallBundleDecision.length > 0) {
    process.stderr.write(`Source skills missing install-bundle decision:\n- ${validation.sourceSkillsMissingInstallBundleDecision.join('\n- ')}\n`);
  }

  if (validation.missingSkillCatalogEntries.length > 0) {
    process.stderr.write(`Missing derived skill catalog entries:\n- ${validation.missingSkillCatalogEntries.join('\n- ')}\n`);
  }

  if (validation.extraSkillCatalogEntries.length > 0) {
    process.stderr.write(`Extra derived skill catalog entries:\n- ${validation.extraSkillCatalogEntries.join('\n- ')}\n`);
  }

  if (validation.missingSkillManifestEntries.length > 0) {
    process.stderr.write(`Missing skill manifest entries:\n- ${validation.missingSkillManifestEntries.join('\n- ')}\n`);
  }

  if (validation.extraSkillManifestEntries.length > 0) {
    process.stderr.write(`Extra skill manifest entries:\n- ${validation.extraSkillManifestEntries.join('\n- ')}\n`);
  }

  if (validation.missingSkillBundleFiles.length > 0) {
    process.stderr.write(`Missing skill bundle files:\n- ${validation.missingSkillBundleFiles.join('\n- ')}\n`);
  }

  if (validation.skillCatalogMismatches.length > 0) {
    process.stderr.write(`Skill catalog mismatches:\n- ${validation.skillCatalogMismatches.map((item) => `${item.id}: ${item.reason}`).join('\n- ')}\n`);
  }

  process.stderr.write('Run `npm run sync:install-bundle` to refresh derived assets.\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Derived install bundle is in sync.\n');
}
