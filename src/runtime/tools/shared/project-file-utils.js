import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  '.openkit',
  '.opencode',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

export function resolveProjectPath(projectRoot, targetPath) {
  if (typeof targetPath !== 'string' || targetPath.trim().length === 0) {
    return null;
  }

  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.resolve(projectRoot, targetPath);
}

export function isInsideProjectRoot(projectRoot, targetPath) {
  const relative = path.relative(projectRoot, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function realpathOrResolved(inputPath) {
  try {
    return fs.realpathSync.native(inputPath);
  } catch {
    return path.resolve(inputPath);
  }
}

function isInsideCanonicalRoot(canonicalProjectRoot, targetPath) {
  const relative = path.relative(canonicalProjectRoot, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function compactPathResolution(result) {
  return {
    status: result.status,
    reason: result.reason,
    requestedPath: result.requestedPath,
    normalizedInput: result.normalizedInput,
    projectRoot: result.projectRoot,
    canonicalProjectRoot: result.canonicalProjectRoot,
    resolvedPath: result.resolvedPath,
    canonicalPath: result.canonicalPath,
    relativePath: result.relativePath,
    kind: result.kind,
  };
}

function createProjectFilePathResult({
  status,
  reason = null,
  requestedPath,
  normalizedInput = null,
  projectRoot,
  canonicalProjectRoot,
  resolvedPath = null,
  canonicalPath = null,
  relativePath = null,
  kind = null,
}) {
  const result = {
    status,
    reason,
    requestedPath,
    normalizedInput,
    projectRoot,
    canonicalProjectRoot,
    resolvedPath,
    canonicalPath,
    relativePath,
    kind,
  };
  result.pathResolution = compactPathResolution(result);
  return result;
}

export function resolveProjectFilePath(projectRoot, requestedPath) {
  const resolvedProjectRoot = path.resolve(projectRoot ?? process.cwd());
  const canonicalProjectRoot = realpathOrResolved(resolvedProjectRoot);

  if (typeof requestedPath !== 'string') {
    return createProjectFilePathResult({
      status: 'invalid-path',
      reason: 'empty-path',
      requestedPath,
      normalizedInput: null,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
    });
  }

  const normalizedInput = requestedPath.trim();
  if (normalizedInput.length === 0) {
    return createProjectFilePathResult({
      status: 'invalid-path',
      reason: 'empty-path',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
    });
  }

  const resolvedPath = path.isAbsolute(normalizedInput)
    ? realpathOrResolved(normalizedInput)
    : path.resolve(canonicalProjectRoot, normalizedInput);

  if (!isInsideCanonicalRoot(canonicalProjectRoot, resolvedPath)) {
    return createProjectFilePathResult({
      status: 'invalid-path',
      reason: 'outside-root',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
    });
  }

  let lstat;
  try {
    lstat = fs.lstatSync(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return createProjectFilePathResult({
        status: 'missing-file',
        reason: 'missing-file',
        requestedPath,
        normalizedInput,
        projectRoot: resolvedProjectRoot,
        canonicalProjectRoot,
        resolvedPath,
        relativePath: path.relative(canonicalProjectRoot, resolvedPath).split(path.sep).join('/'),
        kind: 'missing',
      });
    }

    return createProjectFilePathResult({
      status: 'read-error',
      reason: error?.code === 'EACCES' ? 'permission-denied' : 'stat-error',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
    });
  }

  let canonicalPath;
  try {
    canonicalPath = fs.realpathSync.native(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return createProjectFilePathResult({
        status: 'missing-file',
        reason: 'file-disappeared',
        requestedPath,
        normalizedInput,
        projectRoot: resolvedProjectRoot,
        canonicalProjectRoot,
        resolvedPath,
        relativePath: path.relative(canonicalProjectRoot, resolvedPath).split(path.sep).join('/'),
        kind: 'missing',
      });
    }

    return createProjectFilePathResult({
      status: 'read-error',
      reason: error?.code === 'EACCES' ? 'permission-denied' : 'realpath-error',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
    });
  }

  if (!isInsideCanonicalRoot(canonicalProjectRoot, canonicalPath)) {
    return createProjectFilePathResult({
      status: 'invalid-path',
      reason: 'symlink-outside-root',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
      canonicalPath,
    });
  }

  let stat;
  try {
    stat = fs.statSync(canonicalPath);
  } catch (error) {
    return createProjectFilePathResult({
      status: error?.code === 'ENOENT' ? 'missing-file' : 'read-error',
      reason: error?.code === 'ENOENT' ? 'file-disappeared' : 'stat-error',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
      canonicalPath,
      relativePath: path.relative(canonicalProjectRoot, canonicalPath).split(path.sep).join('/'),
      kind: error?.code === 'ENOENT' ? 'missing' : null,
    });
  }

  if (stat.isDirectory()) {
    return createProjectFilePathResult({
      status: 'not-file',
      reason: 'directory',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
      canonicalPath,
      relativePath: path.relative(canonicalProjectRoot, canonicalPath).split(path.sep).join('/'),
      kind: 'directory',
    });
  }

  if (!stat.isFile()) {
    return createProjectFilePathResult({
      status: 'not-file',
      reason: 'non-regular-file',
      requestedPath,
      normalizedInput,
      projectRoot: resolvedProjectRoot,
      canonicalProjectRoot,
      resolvedPath,
      canonicalPath,
      relativePath: path.relative(canonicalProjectRoot, canonicalPath).split(path.sep).join('/'),
      kind: lstat.isSymbolicLink() ? 'symlink' : 'other',
    });
  }

  return createProjectFilePathResult({
    status: 'ok',
    requestedPath,
    normalizedInput,
    projectRoot: resolvedProjectRoot,
    canonicalProjectRoot,
    resolvedPath: canonicalPath,
    canonicalPath,
    relativePath: path.relative(canonicalProjectRoot, canonicalPath).split(path.sep).join('/'),
    kind: 'file',
  });
}

export function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function listProjectFiles(projectRoot, { extensions = null, maxFiles = 4000 } = {}) {
  const results = [];
  const allowedExtensions = Array.isArray(extensions) && extensions.length > 0
    ? new Set(extensions.map((entry) => entry.toLowerCase()))
    : null;

  function visit(directory) {
    if (results.length >= maxFiles || !fs.existsSync(directory)) {
      return;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) {
        return;
      }

      const nextPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
          visit(nextPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (allowedExtensions && !allowedExtensions.has(extension)) {
        continue;
      }

      results.push(nextPath);
    }
  }

  visit(projectRoot);
  return results;
}
