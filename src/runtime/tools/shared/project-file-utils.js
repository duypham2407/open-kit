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
