import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PACKAGE_NAME = '@duypham93/openkit';

const VERSION_TARGETS = [
  'package.json',
  'registry.json',
  '.opencode/install-manifest.json',
  '.opencode/tests/session-start-hook.test.js',
  '.opencode/tests/workflow-behavior.test.js',
  '.opencode/tests/workflow-contract-consistency.test.js',
  '.opencode/tests/workflow-state-cli.test.js',
  'tests/cli/openkit-cli.test.js',
  'tests/global/doctor.test.js',
  'tests/global/ensure-install.test.js',
  'tests/runtime/doctor.test.js',
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllLiteral(source, from, to) {
  return source.replace(new RegExp(escapeRegExp(from), 'g'), to);
}

export function isValidSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

export function getReleasePaths(repoRoot = process.cwd()) {
  return {
    repoRoot,
    packageJsonPath: path.join(repoRoot, 'package.json'),
    registryPath: path.join(repoRoot, 'registry.json'),
    installManifestPath: path.join(repoRoot, '.opencode', 'install-manifest.json'),
    releasesIndexPath: path.join(repoRoot, 'RELEASES.md'),
    releaseNotesDir: path.join(repoRoot, 'release-notes'),
    releaseTemplatePath: path.join(repoRoot, 'release-notes', 'TEMPLATE.md'),
  };
}

export function getReleaseNotesPath(repoRoot = process.cwd(), version) {
  return path.join(repoRoot, 'release-notes', `${version}.md`);
}

export function readCurrentVersion(repoRoot = process.cwd()) {
  const packageJson = JSON.parse(readText(getReleasePaths(repoRoot).packageJsonPath));
  return packageJson.version;
}

export function ensureReleaseWorkspaceLooksValid(repoRoot = process.cwd()) {
  const paths = getReleasePaths(repoRoot);
  for (const filePath of [paths.packageJsonPath, paths.registryPath, paths.installManifestPath, paths.releasesIndexPath, paths.releaseTemplatePath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required release file: ${path.relative(repoRoot, filePath)}`);
    }
  }
}

export function ensureGitWorktreeClean(repoRoot = process.cwd(), spawn = spawnSync) {
  const result = spawn('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr?.trim() || 'Failed to inspect git worktree state.');
  }

  if ((result.stdout ?? '').trim().length > 0) {
    throw new Error('Git worktree must be clean before running this release step.');
  }
}

export function updateVersionMetadata(repoRoot = process.cwd(), nextVersion) {
  if (!isValidSemver(nextVersion)) {
    throw new Error('Version must use the form x.y.z');
  }

  ensureReleaseWorkspaceLooksValid(repoRoot);

  const currentVersion = readCurrentVersion(repoRoot);
  if (currentVersion === nextVersion) {
    return { currentVersion, nextVersion, changedFiles: [] };
  }

  const changedFiles = [];

  for (const relativePath of VERSION_TARGETS) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const original = readText(absolutePath);
    const updated = replaceAllLiteral(original, currentVersion, nextVersion);
    if (updated !== original) {
      writeText(absolutePath, updated);
      changedFiles.push(relativePath);
    }
  }

  return { currentVersion, nextVersion, changedFiles };
}

export function createReleaseNotes(repoRoot = process.cwd(), version) {
  if (!isValidSemver(version)) {
    throw new Error('Version must use the form x.y.z');
  }

  const notesPath = getReleaseNotesPath(repoRoot, version);
  if (fs.existsSync(notesPath)) {
    return { created: false, notesPath };
  }

  const template = readText(getReleasePaths(repoRoot).releaseTemplatePath);
  const content = replaceAllLiteral(template, '<version>', version);
  writeText(notesPath, content);
  return { created: true, notesPath };
}

export function updateReleasesIndex(repoRoot = process.cwd(), version, summary = 'pending release summary') {
  const releasesPath = getReleasePaths(repoRoot).releasesIndexPath;
  const current = readText(releasesPath);
  const entry = `- [\`${version}\`](release-notes/${version}.md) - ${summary}`;
  const latestBlock = `## Latest\n\n- [\`${version}\`](release-notes/${version}.md) - ${summary}\n- npm latest: \`${PACKAGE_NAME}@${version}\`\n- git tag: \`v${version}\``;

  let updated = current.replace(/## Latest\n\n- \[`[^`]+`\]\(release-notes\/[0-9.]+\.md\) - .*\n- npm latest: `@duypham93\/openkit@[0-9.]+`\n- git tag: `v[0-9.]+`/, latestBlock);

  if (updated.includes(`release-notes/${version}.md`) && current.includes(`release-notes/${version}.md`)) {
    if (updated !== current) {
      writeText(releasesPath, updated);
      return { updated: true, entry };
    }
    return { updated: false, entry };
  }

  const marker = 'Historical release notes tracked in-repo:\n\n';
  if (!current.includes(marker)) {
    throw new Error('Could not find the historical release-notes section in RELEASES.md');
  }

  updated = updated.replace(marker, `${marker}${entry}\n`);
  writeText(releasesPath, updated);
  return { updated: true, entry };
}

export function readReleaseSummaryStatus(repoRoot = process.cwd(), version) {
  const releasesContent = readText(getReleasePaths(repoRoot).releasesIndexPath);
  const hasEntry = releasesContent.includes(`release-notes/${version}.md`);
  const notesPath = getReleaseNotesPath(repoRoot, version);

  return {
    notesPath,
    notesExists: fs.existsSync(notesPath),
    releasesEntryExists: hasEntry,
  };
}

export function verifyReleaseMetadata(repoRoot = process.cwd(), version = readCurrentVersion(repoRoot)) {
  ensureReleaseWorkspaceLooksValid(repoRoot);

  const packageVersion = JSON.parse(readText(getReleasePaths(repoRoot).packageJsonPath)).version;
  const registryVersion = JSON.parse(readText(getReleasePaths(repoRoot).registryPath)).kit.version;
  const manifestVersion = JSON.parse(readText(getReleasePaths(repoRoot).installManifestPath)).kit.version;

  if (packageVersion !== version || registryVersion !== version || manifestVersion !== version) {
    throw new Error('Version metadata is out of sync between package.json, registry.json, and .opencode/install-manifest.json.');
  }

  const releaseStatus = readReleaseSummaryStatus(repoRoot, version);
  if (!releaseStatus.notesExists) {
    throw new Error(`Missing release notes file: ${path.basename(releaseStatus.notesPath)}`);
  }
  if (!releaseStatus.releasesEntryExists) {
    throw new Error(`RELEASES.md is missing an entry for ${version}.`);
  }

  const notes = readText(releaseStatus.notesPath);
  if (!notes.includes(`${PACKAGE_NAME}@${version}`)) {
    throw new Error(`Release notes for ${version} must mention ${PACKAGE_NAME}@${version}.`);
  }

  return {
    version,
    notesPath: releaseStatus.notesPath,
  };
}

export function runReleaseTests(repoRoot = process.cwd(), spawn = spawnSync) {
  const env = { ...process.env, NODE_OPTIONS: '--trace-warnings' };
  const result = spawn(process.execPath, ['--test'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function releasePrepare(repoRoot = process.cwd(), version, { summary = 'pending release summary', spawn = spawnSync } = {}) {
  ensureGitWorktreeClean(repoRoot, spawn);
  const versionResult = updateVersionMetadata(repoRoot, version);
  const notesResult = createReleaseNotes(repoRoot, version);
  const releasesResult = updateReleasesIndex(repoRoot, version, summary);

  return {
    ...versionResult,
    notesCreated: notesResult.created,
    notesPath: notesResult.notesPath,
    releasesUpdated: releasesResult.updated,
  };
}

export function releaseVerify(repoRoot = process.cwd(), { skipTests = false, spawn = spawnSync } = {}) {
  const version = readCurrentVersion(repoRoot);
  const metadata = verifyReleaseMetadata(repoRoot, version);
  let testResult = null;

  if (!skipTests) {
    testResult = runReleaseTests(repoRoot, spawn);
    if (testResult.status !== 0) {
      throw new Error('Release verification tests failed.');
    }
  }

  return {
    version,
    metadata,
    testResult,
  };
}

function commandExists(command, repoRoot, spawn) {
  const result = spawn(command, ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return (result.status ?? 1) === 0;
}

export function publishRelease(repoRoot = process.cwd(), { skipTests = false, skipGh = false, spawn = spawnSync, io } = {}) {
  const version = readCurrentVersion(repoRoot);
  const tag = `v${version}`;

  verifyReleaseMetadata(repoRoot, version);
  ensureGitWorktreeClean(repoRoot, spawn);

  if (!skipTests) {
    const tests = runReleaseTests(repoRoot, spawn);
    if (tests.status !== 0) {
      throw new Error('Release verification tests failed.');
    }
  }

  const npmView = spawn('npm', ['view', `${PACKAGE_NAME}@${version}`, 'version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if ((npmView.status ?? 1) === 0 && (npmView.stdout ?? '').trim() === version) {
    throw new Error(`${PACKAGE_NAME}@${version} is already published.`);
  }

  const tagCheck = spawn('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if ((tagCheck.status ?? 1) === 0) {
    throw new Error(`Git tag ${tag} already exists.`);
  }

  for (const [command, args] of [
    ['git', ['push']],
    ['git', ['tag', '-a', tag, '-m', `OpenKit ${version}`]],
    ['git', ['push', 'origin', tag]],
    ['npm', ['publish']],
  ]) {
    const result = spawn(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.stdout && io?.stdout) {
      io.stdout.write(result.stdout);
    }
    if (result.stderr && io?.stderr) {
      io.stderr.write(result.stderr);
    }
    if ((result.status ?? 1) !== 0) {
      throw new Error(`${command} ${args.join(' ')} failed.`);
    }
  }

  const notesPath = getReleaseNotesPath(repoRoot, version);
  const ghAvailable = !skipGh && commandExists('gh', repoRoot, spawn);
  if (ghAvailable) {
    const result = spawn('gh', ['release', 'create', tag, '--title', tag, '--notes-file', notesPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.stdout && io?.stdout) {
      io.stdout.write(result.stdout);
    }
    if (result.stderr && io?.stderr) {
      io.stderr.write(result.stderr);
    }
    if ((result.status ?? 1) !== 0) {
      throw new Error(`gh release create ${tag} failed.`);
    }
  } else if (io?.stdout) {
    io.stdout.write(`GitHub release not created automatically. Use ${path.basename(notesPath)} to draft the release manually if needed.\n`);
  }

  return {
    version,
    tag,
    notesPath,
    githubReleaseCreated: ghAvailable,
  };
}
