import fs from 'node:fs';
import path from 'node:path';

const ENV_PROPAGATION_MODES = new Set(['none', 'symlink', 'copy']);
export const COPY_ENV_WARNING = 'copy mode duplicates env files and can drift from the repository root source.';

function normalizeMode(mode) {
  const candidate = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
  return ENV_PROPAGATION_MODES.has(candidate) ? candidate : 'none';
}

function listSourceEnvFiles(repositoryRoot) {
  const entries = fs.readdirSync(repositoryRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name === '.env' || name.startsWith('.env.'))
    .sort()
    .map((name) => path.join(repositoryRoot, name));
}

function buildTargetPath(worktreePath, sourceFilePath) {
  return path.join(worktreePath, path.basename(sourceFilePath));
}

function isRetainedSymlinkTarget(targetPath, sourceFile) {
  try {
    const targetStat = fs.lstatSync(targetPath);
    if (!targetStat.isSymbolicLink()) {
      return false;
    }

    return fs.realpathSync(targetPath) === fs.realpathSync(sourceFile);
  } catch {
    return false;
  }
}

function isRetainedCopiedTarget(targetPath, sourceFile) {
  try {
    const targetStat = fs.statSync(targetPath);
    if (!targetStat.isFile()) {
      return false;
    }

    return fs.readFileSync(targetPath).equals(fs.readFileSync(sourceFile));
  } catch {
    return false;
  }
}

function classifyTargets(worktreePath, sourceFiles, mode) {
  const pendingFiles = [];
  const conflicts = [];

  for (const sourceFile of sourceFiles) {
    const targetFile = buildTargetPath(worktreePath, sourceFile);
    if (!fs.existsSync(targetFile)) {
      pendingFiles.push(sourceFile);
      continue;
    }

    const retainedMatch = mode === 'symlink'
      ? isRetainedSymlinkTarget(targetFile, sourceFile)
      : isRetainedCopiedTarget(targetFile, sourceFile);

    if (!retainedMatch) {
      conflicts.push(targetFile);
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    pendingFiles,
  };
}

function applySymlinkPropagation(sourceFiles, worktreePath) {
  const createdTargets = [];

  try {
    for (const sourceFile of sourceFiles) {
      const targetPath = buildTargetPath(worktreePath, sourceFile);
      fs.symlinkSync(sourceFile, targetPath);
      createdTargets.push(targetPath);
    }

    return {
      status: 'applied',
      mode: 'symlink',
      warning: null,
      sourceFiles,
    };
  } catch (error) {
    for (const targetPath of createdTargets) {
      fs.rmSync(targetPath, { force: true });
    }

    return {
      status: 'unsupported',
      mode: 'symlink',
      warning: `Unable to create env symlinks: ${error.message}`,
      sourceFiles: [],
    };
  }
}

function applyCopyPropagation(sourceFiles, worktreePath) {
  for (const sourceFile of sourceFiles) {
    const targetPath = buildTargetPath(worktreePath, sourceFile);
    fs.copyFileSync(sourceFile, targetPath, fs.constants.COPYFILE_EXCL);
  }

  return {
    status: 'applied',
    mode: 'copy',
    warning: COPY_ENV_WARNING,
    sourceFiles,
  };
}

export function resolveEnvPropagationMode({ requestedMode, retainedMode } = {}) {
  const normalizedRequestedMode = normalizeMode(requestedMode);
  if (requestedMode !== undefined && requestedMode !== null && String(requestedMode).trim().length > 0) {
    return normalizedRequestedMode;
  }

  return normalizeMode(retainedMode);
}

export function propagateWorktreeEnvFiles({
  repositoryRoot,
  worktreePath,
  mode,
} = {}) {
  const selectedMode = normalizeMode(mode);
  if (selectedMode === 'none') {
    return {
      status: 'skipped',
      mode: 'none',
      warning: null,
      sourceFiles: [],
    };
  }

  const sourceFiles = listSourceEnvFiles(repositoryRoot);
  if (sourceFiles.length === 0) {
    return {
      status: 'skipped',
      mode: selectedMode,
      warning: 'No repository-root .env or .env.* files were found to propagate.',
      sourceFiles: [],
    };
  }

  const conflictCheck = classifyTargets(worktreePath, sourceFiles, selectedMode);
  if (conflictCheck.hasConflicts) {
    return {
      status: 'conflict',
      mode: selectedMode,
      warning: `Env propagation would overwrite existing files in the managed worktree: ${conflictCheck.conflicts
        .map((filePath) => path.basename(filePath))
        .join(', ')}`,
      conflicts: conflictCheck.conflicts,
      sourceFiles: [],
    };
  }

  if (conflictCheck.pendingFiles.length === 0) {
    return {
      status: 'retained',
      mode: selectedMode,
      warning: selectedMode === 'copy' ? COPY_ENV_WARNING : null,
      sourceFiles,
    };
  }

  if (selectedMode === 'symlink') {
    const result = applySymlinkPropagation(conflictCheck.pendingFiles, worktreePath);
    return {
      ...result,
      sourceFiles,
    };
  }

  const result = applyCopyPropagation(conflictCheck.pendingFiles, worktreePath);
  return {
    ...result,
    sourceFiles,
  };
}
