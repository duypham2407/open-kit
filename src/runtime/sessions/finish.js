import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readSessionMeta } from './session-meta.js';
import { updateSessionEntry } from './sessions-index.js';
import { setWorkItemStatus, setCurrentSessionId } from './work-items-index.js';

/**
 * Map of lane → spec gate name to verify before finish is allowed.
 * Per spec §6.8:
 *   - quick     → quick_verified
 *   - full      → qa_to_done
 *   - migration → migration_verified
 */
const LANE_GATE = {
  quick: 'quick_verified',
  full: 'qa_to_done',
  migration: 'migration_verified',
};

/**
 * Default git runner. Returns `{ status, stdout, stderr }` matching spawnSync.
 *
 * Tests inject a stub. Production wraps `spawnSync` with `encoding: 'utf8'`.
 *
 * @param {object} args
 * @param {string} args.cwd
 * @param {string[]} args.args - argv passed to git (no leading "git")
 */
function defaultGit({ cwd, args }) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Check whether a gate has passed. Accepts the workspace-state shape
 * (`{approvals: { gateName: { status: 'approved' } } }`) and the runtime
 * state-manager shape (`{ gates: { 'lane.gate': true } }`).
 *
 * The spec uses short names (`qa_to_done`, `quick_verified`,
 * `migration_verified`); the runtime state map uses dotted names. We accept
 * the short name directly when the workspace shape is present, and look up a
 * configured equivalent in the dotted shape otherwise.
 *
 * @param {object} state - workflow state snapshot
 * @param {string} gateName - spec gate name (e.g. 'qa_to_done')
 * @returns {boolean}
 */
function isGateMet(state, gateName) {
  if (!state || typeof state !== 'object') return false;

  // Workspace-state shape: state.approvals[gateName] = { status: 'approved' | 'pending' | ... }
  if (state.approvals && typeof state.approvals === 'object') {
    const entry = state.approvals[gateName];
    if (entry && entry.status === 'approved') return true;
  }

  // Runtime state-manager shape: state.gates[<dotted>] = boolean
  if (state.gates && typeof state.gates === 'object') {
    if (state.gates[gateName] === true) return true;
    // Fall back to short→dotted mapping for the common cases.
    const DOTTED = {
      quick_verified: 'quick.verified',
      qa_to_done: 'full.qa_passed',
      migration_verified: 'migration.parity_verified',
    };
    const dotted = DOTTED[gateName];
    if (dotted && state.gates[dotted] === true) return true;
  }

  return false;
}

/**
 * Build a sentinel error with a stable code so callers can switch on it.
 */
function finishError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  for (const [k, v] of Object.entries(extra)) err[k] = v;
  return err;
}

/**
 * Detect a merge-conflict result from a `git merge --squash` invocation.
 *
 * Real git prints `CONFLICT (...)` to stdout and returns non-zero. We treat
 * any non-zero exit from `merge --squash` whose stdout/stderr contains the
 * substring "CONFLICT" as a conflict, so callers can refuse without rolling
 * back the worktree, the feature branch, or the session (per spec §6.8 step 8).
 */
function isMergeConflict({ status, stdout, stderr }) {
  if (status === 0) return false;
  const blob = `${stdout || ''}\n${stderr || ''}`;
  return /CONFLICT\b/i.test(blob);
}

/**
 * Read the lane-aware commit summary from the workflow state. We look at
 * the lane's primary artifact (scope/solution package for full, scope for
 * quick — though quick takes no git op anyway, migration uses its report).
 * Falls back to feature_slug if no artifact summary is present.
 */
function buildCommitSummary({ lane, featureSlug, state }) {
  const artifacts = state?.artifacts ?? {};
  // Spec §6.8 step 7: "summary draws from the lane's primary artifact".
  // Full's primary artifact is the solution package, migration's is the
  // migration report (or scope when present), quick has scope_package.
  let summaryText = null;
  if (lane === 'full') {
    summaryText = artifacts.solution_package?.summary ?? artifacts.scope_package?.summary ?? null;
  } else if (lane === 'migration') {
    summaryText = artifacts.migration_report?.summary ?? artifacts.scope_package?.summary ?? null;
  } else {
    summaryText = artifacts.scope_package?.summary ?? null;
  }
  if (typeof summaryText !== 'string' || summaryText.trim() === '') {
    summaryText = featureSlug;
  }
  return `${lane}(${featureSlug}): ${summaryText}`;
}

/**
 * Finish a session per spec §6.8.
 *
 * Quick lane (no git op):
 *   1. Verify `quick_verified` gate has passed.
 *   2. work_item.status = done, session.status = closed.
 *
 * Full / migration lane (squash merge then close):
 *   1. Verify the lane's final gate has passed.
 *   2. Read meta.json (source of truth for branches and worktree path).
 *   3. Validate worktree exists.
 *   4. Validate worktree is on `meta.feature_branch`.
 *   5. Validate worktree is clean (`git status --porcelain` empty).
 *   6. Validate repo root is on `meta.target_branch`.
 *   7. `git merge --squash <feature_branch>` then `git commit -m "<lane>(<slug>): ..."`.
 *   8. On merge conflict: leave everything in place; surface the conflict.
 *   9. On merge success: remove worktree, then `git branch -D <feature_branch>`.
 *  10. Atomic-update both indexes: work_item=done, session=closed.
 *
 * Injected dependencies:
 *   - git({ cwd, args }) → { status, stdout, stderr }
 *   - worktreeRemover({ worktreePath }) → { status: 'removed' | 'refused-dirty' | 'missing' }
 *   - readWorkflowState(baseDir, workItemId) → workflow state snapshot
 *
 * @param {object} opts
 * @param {string} opts.baseDir
 * @param {string} opts.sessionId
 * @param {(args: { cwd: string, args: string[] }) => ({ status: number, stdout: string, stderr: string })} [opts.git]
 * @param {(args: { worktreePath: string }) => ({ status: string } | Promise<{ status: string }>)} [opts.worktreeRemover]
 * @param {(baseDir: string, workItemId: string) => object} opts.readWorkflowState
 * @returns {Promise<object>} { sessionId, workItemId, lane, lane: 'quick'|'full'|'migration', commit?: string }
 */
export async function finishSession({
  baseDir,
  sessionId,
  git = defaultGit,
  worktreeRemover,
  readWorkflowState,
}) {
  if (typeof readWorkflowState !== 'function') {
    throw new TypeError('finishSession requires an injected readWorkflowState function');
  }

  // Step 0: load meta — single source of truth for branches and worktree path.
  // (Throws SessionNotFoundError if missing.)
  const meta = readSessionMeta(baseDir, sessionId);
  const lane = meta.lane;
  const workItemId = meta.work_item_id;

  if (!workItemId) {
    throw finishError(
      'OK_FINISH_NOT_BOUND',
      `Session '${sessionId}' is not bound to a work item; nothing to finish.`,
    );
  }

  const gateName = LANE_GATE[lane];
  if (!gateName) {
    throw finishError(
      'OK_FINISH_UNKNOWN_LANE',
      `Session '${sessionId}' has unknown lane '${lane}'; cannot finish.`,
    );
  }

  // Step 1 (both lanes): verify the lane's final gate has passed.
  const state = readWorkflowState(baseDir, workItemId);
  if (!isGateMet(state, gateName)) {
    throw finishError(
      'OK_FINISH_GATE_NOT_MET',
      `Lane '${lane}' gate '${gateName}' has not been approved. Complete the lane and approve the gate before running /finish.`,
      { sessionId, workItemId, lane, gate: gateName },
    );
  }

  // Quick lane stops here — no git op.
  if (lane === 'quick') {
    await closeIndexes({ baseDir, sessionId, workItemId });
    return { sessionId, workItemId, lane, mergedCommit: null };
  }

  // Full / migration lane — branch + worktree validations.
  const worktreePath = meta.worktree_path;
  const featureBranch = meta.feature_branch;
  const targetBranch = meta.target_branch;
  const repoRoot = meta.repo_root;

  if (!worktreePath || !featureBranch || !targetBranch || !repoRoot) {
    throw finishError(
      'OK_FINISH_META_INCOMPLETE',
      `Session '${sessionId}' meta is missing worktree_path / feature_branch / target_branch / repo_root needed for finish.`,
      { meta },
    );
  }

  // Step 3: worktree exists.
  if (!fs.existsSync(worktreePath)) {
    throw finishError(
      'OK_FINISH_WORKTREE_MISSING',
      `Worktree at '${worktreePath}' is missing on disk. Recommend abandoning the session.`,
      { worktreePath },
    );
  }

  // Step 4: worktree is on meta.feature_branch.
  const wtBranch = runGit(git, {
    cwd: worktreePath,
    args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    failCode: 'OK_FINISH_GIT_FAILED',
    failContext: `read current branch in worktree '${worktreePath}'`,
  }).trim();
  if (wtBranch !== featureBranch) {
    throw finishError(
      'OK_FINISH_BRANCH_MISMATCH',
      `Worktree branch '${wtBranch}' does not match meta.feature_branch '${featureBranch}'. Refusing to finish.`,
      { worktreePath, currentBranch: wtBranch, expected: featureBranch },
    );
  }

  // Step 5: worktree clean.
  const wtStatus = runGit(git, {
    cwd: worktreePath,
    args: ['status', '--porcelain'],
    failCode: 'OK_FINISH_GIT_FAILED',
    failContext: `read worktree status at '${worktreePath}'`,
  });
  if (wtStatus.trim() !== '') {
    throw finishError(
      'OK_FINISH_WORKTREE_DIRTY',
      `Worktree at '${worktreePath}' is dirty. Commit or stash changes before /finish.`,
      { worktreePath, status: wtStatus },
    );
  }

  // Step 6: repo root is on meta.target_branch.
  const repoBranch = runGit(git, {
    cwd: repoRoot,
    args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    failCode: 'OK_FINISH_GIT_FAILED',
    failContext: `read current branch in repo root '${repoRoot}'`,
  }).trim();
  if (repoBranch !== targetBranch) {
    throw finishError(
      'OK_FINISH_REPO_WRONG_BRANCH',
      `Repository at '${repoRoot}' is on '${repoBranch}', not target_branch '${targetBranch}'. Switch the repo to the target branch before /finish — finish does not change branches automatically.`,
      { repoRoot, currentBranch: repoBranch, expected: targetBranch },
    );
  }

  // Step 7: squash merge.
  const mergeResult = git({
    cwd: repoRoot,
    args: ['merge', '--squash', featureBranch],
  });
  if (mergeResult.status !== 0) {
    if (isMergeConflict(mergeResult)) {
      // Step 8: leave the worktree, the feature branch, and the session in
      // place. The user resolves manually and reruns /finish.
      throw finishError(
        'OK_FINISH_MERGE_CONFLICT',
        `git merge --squash ${featureBranch} produced a conflict. Resolve manually in '${repoRoot}' and rerun /finish. The worktree, feature branch, and session are unchanged.`,
        {
          repoRoot,
          featureBranch,
          targetBranch,
          stdout: mergeResult.stdout,
          stderr: mergeResult.stderr,
        },
      );
    }
    throw finishError(
      'OK_FINISH_MERGE_FAILED',
      `git merge --squash ${featureBranch} failed (status=${mergeResult.status}): ${(mergeResult.stderr || mergeResult.stdout || '').trim()}`,
      { repoRoot, featureBranch, mergeResult },
    );
  }

  const summaryText = buildCommitSummary({
    lane,
    featureSlug: meta.feature_slug ?? meta.work_item_id,
    state,
  });
  const commitResult = git({
    cwd: repoRoot,
    args: ['commit', '-m', summaryText],
  });
  if (commitResult.status !== 0) {
    throw finishError(
      'OK_FINISH_COMMIT_FAILED',
      `git commit after squash merge failed (status=${commitResult.status}): ${(commitResult.stderr || commitResult.stdout || '').trim()}`,
      { repoRoot, summary: summaryText, commitResult },
    );
  }

  // Step 9: remove worktree, then delete feature branch. Failures here are
  // surfaced so the user can finish cleanup manually — but we treat them as
  // post-merge cleanup errors, not as a reason to roll back the merge commit.
  if (typeof worktreeRemover !== 'function') {
    throw finishError(
      'OK_FINISH_REMOVER_MISSING',
      'finishSession requires an injected worktreeRemover for full/migration lanes',
    );
  }
  const removeResult = await worktreeRemover({ worktreePath });
  const removeStatus = removeResult?.status;
  if (removeStatus !== 'removed' && removeStatus !== 'missing') {
    throw finishError(
      'OK_FINISH_WORKTREE_REMOVE_FAILED',
      `worktree removal returned status '${removeStatus}'. Resolve manually; the squash-merge commit is already on '${targetBranch}'.`,
      { worktreePath, removeStatus },
    );
  }

  const branchDeleteResult = git({
    cwd: repoRoot,
    args: ['branch', '-D', featureBranch],
  });
  if (branchDeleteResult.status !== 0) {
    throw finishError(
      'OK_FINISH_BRANCH_DELETE_FAILED',
      `git branch -D ${featureBranch} failed (status=${branchDeleteResult.status}): ${(branchDeleteResult.stderr || branchDeleteResult.stdout || '').trim()}`,
      { repoRoot, featureBranch },
    );
  }

  // Step 10: atomic-update indexes.
  await closeIndexes({ baseDir, sessionId, workItemId });

  return {
    sessionId,
    workItemId,
    lane,
    mergedCommit: summaryText,
    worktreeRemoved: removeStatus,
  };
}

/**
 * Run `git` and return stdout. Throws OK_FINISH_GIT_FAILED on non-zero exit.
 */
function runGit(git, { cwd, args, failCode, failContext }) {
  const result = git({ cwd, args });
  if ((result?.status ?? 1) !== 0) {
    throw finishError(
      failCode,
      `git ${args.join(' ')} failed while trying to ${failContext}: ${(result?.stderr || result?.stdout || '').trim() || `non-zero exit (${result?.status})`}`,
      { cwd, args, status: result?.status, stderr: result?.stderr, stdout: result?.stdout },
    );
  }
  return result.stdout ?? '';
}

/**
 * Atomic close: work_item.status=done, work_item.current_session_id=null,
 * session.status=closed.
 */
async function closeIndexes({ baseDir, sessionId, workItemId }) {
  const closedAt = new Date().toISOString();
  await setWorkItemStatus(baseDir, workItemId, 'done');
  await setCurrentSessionId(baseDir, workItemId, null);
  await updateSessionEntry(baseDir, sessionId, (cur) => ({
    ...cur,
    status: 'closed',
    pid: null,
    last_seen_at: closedAt,
  }));
}
