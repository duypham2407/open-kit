import fs from 'node:fs';
import path from 'node:path';

import { detectProjectRoot } from '../global/paths.js';

function isUsableDirectory(candidate) {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return false;
  }

  try {
    return fs.statSync(path.resolve(candidate.trim())).isDirectory();
  } catch {
    return false;
  }
}

function hasCwdPlaceholder(candidate) {
  return typeof candidate === 'string' && candidate.split(/[\\/]+/).includes('{cwd}');
}

function canonicalDirectory(candidate) {
  const resolved = path.resolve(candidate);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function selectSourceRoot({ explicitProjectRoot, env = process.env, cwd = process.cwd() } = {}) {
  const candidates = [];
  if (explicitProjectRoot !== undefined && explicitProjectRoot !== null) {
    candidates.push({ value: explicitProjectRoot, source: 'explicit-project-root' });
  }
  candidates.push({ value: env.OPENKIT_PROJECT_ROOT, source: 'env.OPENKIT_PROJECT_ROOT' });

  for (const candidate of candidates) {
    if (hasCwdPlaceholder(candidate.value)) {
      continue;
    }

    if (isUsableDirectory(candidate.value)) {
      return candidate;
    }
  }

  if (isUsableDirectory(env.OPENKIT_REPOSITORY_ROOT)) {
    return { value: env.OPENKIT_REPOSITORY_ROOT, source: 'env.OPENKIT_REPOSITORY_ROOT' };
  }

  const placeholderCandidate = candidates.find((candidate) => hasCwdPlaceholder(candidate.value));
  if (placeholderCandidate) {
    return { value: cwd, source: `${placeholderCandidate.source}:placeholder-expanded` };
  }

  return { value: cwd, source: 'cwd' };
}

export function normalizeRuntimeProjectRoot({ projectRoot, env = process.env, cwd = process.cwd() } = {}) {
  const selected = selectSourceRoot({ explicitProjectRoot: projectRoot, env, cwd });
  const detected = detectProjectRoot(selected.value);
  const normalizedProjectRoot = canonicalDirectory(detected);

  return {
    projectRoot: normalizedProjectRoot,
    source: selected.source,
    requestedProjectRoot: projectRoot,
    envProjectRoot: env.OPENKIT_PROJECT_ROOT ?? null,
    envRepositoryRoot: env.OPENKIT_REPOSITORY_ROOT ?? null,
    placeholderExpanded: selected.source.includes('placeholder-expanded'),
  };
}
