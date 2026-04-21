import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  normalizeWorkItemWorktreeMetadata,
  readWorkItemWorktree,
  removeWorkItemWorktree,
  writeWorkItemWorktree,
} from '../../.opencode/lib/work-item-store.js';

const WORKTREE_SCHEMA = 'openkit/worktree@2';

function runGit(repositoryRoot, args, { spawn = spawnSync, allowFailure = false } = {}) {
  const result = spawn('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
  });

  if (!allowFailure && (result.status ?? 1) !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`);
  }

  return result;
}

function isGitRepository(repositoryRoot, spawn = spawnSync) {
  const result = runGit(repositoryRoot, ['rev-parse', '--is-inside-work-tree'], {
    spawn,
    allowFailure: true,
  });
  return (result.status ?? 1) === 0 && (result.stdout ?? '').trim() === 'true';
}

function getCurrentBranch(repositoryRoot, spawn = spawnSync) {
  const result = runGit(repositoryRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], { spawn });
  const branch = (result.stdout ?? '').trim();
  if (!branch || branch === 'HEAD') {
    throw new Error(`Repository at '${repositoryRoot}' must be on a named branch before OpenKit can manage worktrees.`);
  }
  return branch;
}

function branchExists(repositoryRoot, branch, spawn = spawnSync) {
  const result = runGit(repositoryRoot, ['rev-parse', '--verify', `refs/heads/${branch}`], {
    spawn,
    allowFailure: true,
  });
  return (result.status ?? 1) === 0;
}

function ensureCleanGitStatus(repositoryRoot, label, spawn = spawnSync) {
  const result = runGit(repositoryRoot, ['status', '--porcelain'], { spawn });
  if ((result.stdout ?? '').trim().length > 0) {
    throw new Error(`${label} has uncommitted changes. Commit or stash them before explicit managed worktree cleanup can run.`);
  }
}

function createDefaultEnvPropagationMetadata() {
  return {
    mode: 'none',
    applied_at: null,
    source_files: [],
  };
}

function buildMetadata({ repositoryRoot, workItemId, workflowMode, targetBranch, branch, worktreePath, envPropagation, previousMetadata }) {
  const now = new Date().toISOString();
  return normalizeWorkItemWorktreeMetadata(
    {
      schema: WORKTREE_SCHEMA,
      work_item_id: workItemId,
      workflow_mode: workflowMode,
      lineage_key: workItemId,
      repository_root: repositoryRoot,
      target_branch: targetBranch,
      branch,
      worktree_path: worktreePath,
      created_at: previousMetadata?.created_at ?? now,
      last_used_at: now,
      env_propagation: envPropagation ?? previousMetadata?.env_propagation ?? createDefaultEnvPropagationMetadata(),
    },
    workItemId,
  );
}

export function updateManagedWorktreeMetadata({
  runtimeRoot,
  workItemId,
  workflowMode,
  envPropagation,
  repositoryRoot,
  targetBranch,
  branch,
  worktreePath,
} = {}) {
  const existing = readWorkItemWorktree(runtimeRoot, workItemId);
  if (!existing) {
    return null;
  }

  const metadata = buildMetadata({
    repositoryRoot: repositoryRoot ?? existing.repository_root,
    workItemId,
    workflowMode: workflowMode ?? existing.workflow_mode,
    targetBranch: targetBranch ?? existing.target_branch,
    branch: branch ?? existing.branch,
    worktreePath: worktreePath ?? existing.worktree_path,
    envPropagation: envPropagation ?? existing.env_propagation,
    previousMetadata: existing,
  });
  writeWorkItemWorktree(runtimeRoot, workItemId, metadata);
  return metadata;
}

export function getManagedWorktree({ runtimeRoot, workItemId } = {}) {
  const metadata = readWorkItemWorktree(runtimeRoot, workItemId);
  if (!metadata) {
    return null;
  }

  return {
    ...metadata,
    exists: fs.existsSync(metadata.worktree_path),
  };
}

export function createManagedWorktree({ repositoryRoot, runtimeRoot, workItemId, mode, spawn = spawnSync } = {}) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const existing = getManagedWorktree({ runtimeRoot, workItemId });
  const workflowMode = mode ?? 'quick';

  if (existing?.exists) {
    const refreshedMetadata = updateManagedWorktreeMetadata({
      runtimeRoot,
      workItemId,
      workflowMode,
      repositoryRoot: resolvedRepositoryRoot,
    });

    return {
      status: 'existing',
      metadata: refreshedMetadata ?? existing,
    };
  }

  if (!isGitRepository(resolvedRepositoryRoot, spawn)) {
    return {
      status: 'skipped',
      metadata: null,
      reason: `Project root '${resolvedRepositoryRoot}' is not a git repository.`,
    };
  }

  const targetBranch = getCurrentBranch(resolvedRepositoryRoot, spawn);
  const branch = `openkit/${workflowMode}/${workItemId}`;
  const worktreePath = path.join(resolvedRepositoryRoot, '.worktrees', workItemId);
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

  if (fs.existsSync(worktreePath)) {
    throw new Error(`Managed worktree path '${worktreePath}' already exists.`);
  }

  if (branchExists(resolvedRepositoryRoot, branch, spawn)) {
    runGit(resolvedRepositoryRoot, ['worktree', 'add', worktreePath, branch], { spawn });
  } else {
    runGit(resolvedRepositoryRoot, ['worktree', 'add', '-b', branch, worktreePath, targetBranch], { spawn });
  }

  const metadata = buildMetadata({
    repositoryRoot: resolvedRepositoryRoot,
    workItemId,
    workflowMode,
    targetBranch,
    branch,
    worktreePath,
    envPropagation: createDefaultEnvPropagationMetadata(),
    previousMetadata: null,
  });
  writeWorkItemWorktree(runtimeRoot, workItemId, metadata);

  return {
    status: 'created',
    metadata,
  };
}

export function finalizeManagedWorktree({ repositoryRoot, runtimeRoot, workItemId, spawn = spawnSync } = {}) {
  const metadata = readWorkItemWorktree(runtimeRoot, workItemId);
  if (!metadata) {
    return {
      status: 'skipped',
      reason: `No managed worktree is registered for work item '${workItemId}'.`,
    };
  }

  if (!fs.existsSync(metadata.worktree_path)) {
    removeWorkItemWorktree(runtimeRoot, workItemId);
    return {
      status: 'skipped',
      reason: `Managed worktree path '${metadata.worktree_path}' is already missing; metadata was removed.`,
    };
  }

  const resolvedRepositoryRoot = path.resolve(repositoryRoot ?? metadata.repository_root);

  try {
    ensureCleanGitStatus(metadata.worktree_path, `Worktree '${metadata.worktree_path}'`, spawn);
    ensureCleanGitStatus(resolvedRepositoryRoot, `Repository root '${resolvedRepositoryRoot}'`, spawn);

    const currentBranch = getCurrentBranch(resolvedRepositoryRoot, spawn);
    if (currentBranch !== metadata.target_branch) {
      throw new Error(
        `Repository root must be on '${metadata.target_branch}' before merging '${metadata.branch}'. Current branch is '${currentBranch}'.`
      );
    }

    const mergeResult = runGit(resolvedRepositoryRoot, ['merge', '--no-edit', metadata.branch], {
      spawn,
      allowFailure: true,
    });
    if ((mergeResult.status ?? 1) !== 0) {
      runGit(resolvedRepositoryRoot, ['merge', '--abort'], { spawn, allowFailure: true });
      throw new Error(mergeResult.stderr?.trim() || `Unable to merge '${metadata.branch}' into '${metadata.target_branch}'.`);
    }

    runGit(resolvedRepositoryRoot, ['worktree', 'remove', metadata.worktree_path], { spawn });
    runGit(resolvedRepositoryRoot, ['branch', '-d', metadata.branch], { spawn });
    removeWorkItemWorktree(runtimeRoot, workItemId);

    return {
      status: 'merged',
      metadata,
    };
  } catch (error) {
    return {
      status: 'blocked',
      metadata,
      reason: error.message,
    };
  }
}
