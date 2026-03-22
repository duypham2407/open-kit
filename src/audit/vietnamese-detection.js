import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { OPENKIT_ASSET_MANIFEST } from '../install/asset-manifest.js';

const TEXT_EXTENSIONS = new Set(['.md', '.txt']);
const MACHINE_EXTENSIONS = new Set(['.json', '.js']);
const VIETNAMESE_DIACRITIC_REGEX = /[\u00C0-\u1EF9]/u;
const EXCLUDED_TOP_LEVEL_NAMES = new Set(['.git', '.worktrees', 'node_modules']);
const EXCLUDED_RELATIVE_PREFIXES = ['.git/', '.worktrees/', 'node_modules/'];

const HIGH_PRIORITY_PREFIXES = ['skills/', 'agents/', 'commands/', '.opencode/README.md'];
const MEDIUM_PRIORITY_PREFIXES = ['docs/', 'assets/install-bundle/opencode/'];

function walkFiles(rootPath, relativePath = '') {
  const targetPath = relativePath ? path.join(rootPath, relativePath) : rootPath;
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return [relativePath || path.basename(targetPath)];
  }

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const childRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
    if (entry.isDirectory() && shouldExcludePath(childRelativePath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...walkFiles(rootPath, childRelativePath));
      continue;
    }
    if (shouldExcludePath(childRelativePath)) {
      continue;
    }
    files.push(childRelativePath);
  }

  return files;
}

function listTrackedFiles(projectRoot) {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return null;
  }

  const trackedFiles = new Set();

  for (const line of result.stdout.split('\n')) {
    const normalizedPath = line.trim();
    if (!normalizedPath) {
      continue;
    }

    const absolutePath = path.join(projectRoot, normalizedPath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      continue;
    }

    trackedFiles.add(normalizedPath);
  }

  return trackedFiles;
}

function listCheckedInFiles(projectRoot) {
  const gitTrackedFiles = spawnSync('git', ['ls-files', '--cached'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (gitTrackedFiles.status === 0) {
    const files = new Set();

    for (const line of gitTrackedFiles.stdout.split('\n')) {
      const normalizedPath = line.trim();
      if (!normalizedPath) {
        continue;
      }

      const absolutePath = path.join(projectRoot, normalizedPath);
      if (!fs.existsSync(absolutePath)) {
        continue;
      }

      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        continue;
      }

      files.add(normalizedPath);
    }

    return files;
  }

  return new Set(walkFiles(projectRoot));
}

function shouldExcludePath(filePath) {
  const normalizedPath = filePath.split(path.sep).join('/');
  if (EXCLUDED_TOP_LEVEL_NAMES.has(normalizedPath)) {
    return true;
  }

  return EXCLUDED_RELATIVE_PREFIXES.some(
    (prefix) => normalizedPath === prefix.slice(0, -1) || normalizedPath.startsWith(prefix)
  );
}

function isTextCandidate(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || MACHINE_EXTENSIONS.has(extension);
}

function isMachineFacing(filePath) {
  return MACHINE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function readUtf8(projectRoot, relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function classifyPriority(filePath) {
  if (HIGH_PRIORITY_PREFIXES.some((prefix) => filePath === prefix || filePath.startsWith(prefix))) {
    return 'high';
  }

  if (MEDIUM_PRIORITY_PREFIXES.some((prefix) => filePath === prefix || filePath.startsWith(prefix))) {
    return 'medium';
  }

  return 'low';
}

function buildPairingMap() {
  const derivedPairs = OPENKIT_ASSET_MANIFEST.bundle.assets
    .filter((asset) => asset.sourcePath !== asset.bundledPath)
    .map((asset) => ({
      sourcePath: asset.sourcePath,
      derivedPath: asset.bundledPath,
      assetId: asset.id,
      derived: true,
    }));

  derivedPairs.push({
    sourcePath: '.opencode/README.md',
    derivedPath: 'assets/install-bundle/opencode/README.md',
    assetId: 'opencode.bundle.runtime-readme',
    derived: true,
  });

  return derivedPairs.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

export function detectVietnameseInventory(projectRoot) {
  const filesToScan = listCheckedInFiles(projectRoot);

  const textFiles = [...filesToScan].filter(isTextCandidate).sort((left, right) => left.localeCompare(right));
  const humanFacingMatches = [];
  const machineFacingMatches = [];

  for (const filePath of textFiles) {
    const contents = readUtf8(projectRoot, filePath);
    if (!VIETNAMESE_DIACRITIC_REGEX.test(contents)) {
      continue;
    }

    const match = {
      path: filePath,
      priority: classifyPriority(filePath),
      machineFacing: isMachineFacing(filePath),
    };

    if (match.machineFacing) {
      machineFacingMatches.push(match);
      continue;
    }

    humanFacingMatches.push(match);
  }

  const pairingMap = buildPairingMap();
  const matchedPaths = new Set(humanFacingMatches.map((match) => match.path));
  const pairingSummary = pairingMap.map((pair) => ({
    ...pair,
    sourceHasVietnamese: matchedPaths.has(pair.sourcePath),
    derivedHasVietnamese: matchedPaths.has(pair.derivedPath),
  }));

  const priorityCounts = {
    high: humanFacingMatches.filter((match) => match.priority === 'high').length,
    medium: humanFacingMatches.filter((match) => match.priority === 'medium').length,
    low: humanFacingMatches.filter((match) => match.priority === 'low').length,
  };

  return {
    detectionMode: 'heuristic',
    detectionScope: 'repo-wide checked-in files',
    explicitExclusions: [...EXCLUDED_TOP_LEVEL_NAMES],
    scannedFileCount: textFiles.length,
    vietnameseBearingFiles: humanFacingMatches,
    machineFacingMatches,
    machineFacingOutOfScope: machineFacingMatches.length === 0,
    priorityCounts,
    pairingMap: pairingSummary,
  };
}

export function renderVietnameseInventoryReport(inventory) {
  const lines = [];
  lines.push(`Inventory status: ${inventory.vietnameseBearingFiles.length > 0 ? 'matches-found' : 'clear'}`);
  lines.push(`Detection scope: ${inventory.detectionScope}`);
  lines.push(`Detection mode: ${inventory.detectionMode}`);
  lines.push('Heuristic review: required for false positives and false negatives');
  lines.push(`Scanned files: ${inventory.scannedFileCount}`);
  lines.push(
    `Priority counts: high=${inventory.priorityCounts.high}, medium=${inventory.priorityCounts.medium}, low=${inventory.priorityCounts.low}`
  );
  lines.push(`Explicit exclusions: ${inventory.explicitExclusions.join(', ')}`);
  lines.push(
    `Machine-facing literals: ${inventory.machineFacingOutOfScope ? 'out-of-scope confirmed' : 'review needed'}`
  );

  const completePairingCoverage = inventory.pairingMap.every(
    (pair) => pair.sourceHasVietnamese === pair.derivedHasVietnamese
  );
  lines.push(`Pairing map coverage: ${completePairingCoverage ? 'complete' : 'mismatch-detected'}`);
  lines.push('');
  lines.push('Vietnamese-bearing checked-in files:');

  for (const match of inventory.vietnameseBearingFiles) {
    lines.push(`- [${match.priority}] ${match.path}`);
  }

  lines.push('');
  lines.push('Source-versus-derived pairing map:');
  for (const pair of inventory.pairingMap) {
    lines.push(
      `- ${pair.sourcePath} -> ${pair.derivedPath} [source=${pair.sourceHasVietnamese ? 'vi' : 'clear'}, derived=${pair.derivedHasVietnamese ? 'vi' : 'clear'}]`
    );
  }

  return `${lines.join('\n')}\n`;
}
