import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readSessionMeta } from './session-meta.js';
import { updateSessionEntry } from './sessions-index.js';
import { setCurrentSessionId, setWorkItemStatus } from './work-items-index.js';
import { sessionMirrorPath } from './session-paths.js';
import { WorktreeMissingError, SessionStateMismatchError } from './errors.js';

/**
 * Default git runner used to inspect a worktree's current branch.
 * Returns the abbreviated ref name (e.g. "openkit/full-x") or throws on failure.
 */
function defaultGit(worktreePath) {
  const result = spawnSync('git', ['-C', worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `git rev-parse failed in '${worktreePath}': ${(result.stderr ?? '').trim() || 'non-zero exit'}`,
    );
  }
  return (result.stdout ?? '').trim();
}

/**
 * Resume a session per spec §6.5.
 *
 * Validates the meta + worktree, atomically updates both indexes, then
 * invokes `spawn` to attach a shell with the env block from §6.2 step 8.
 *
 * @param {object} opts
 * @param {string} opts.baseDir       - sessions/work-items base dir (typically <projectRoot>/.opencode)
 * @param {string} opts.sessionId     - session_id to resume
 * @param {number} opts.newPid        - PID to record on the resumed entry
 * @param {(env: object, ctx: { meta: object }) => any} opts.spawn  - injected; called once after validations + index updates
 * @param {() => number} [opts.now]   - injected clock, defaults to Date.now
 * @param {(worktreePath: string) => string} [opts.git] - injected branch resolver
 * @returns {Promise<{ meta: object, env: object, spawnResult: any }>}
 */
export async function resumeSession({
  baseDir,
  sessionId,
  newPid,
  spawn,
  now = () => Date.now(),
  git = defaultGit,
}) {
  if (typeof spawn !== 'function') {
    throw new TypeError('resumeSession requires an injected spawn function');
  }

  // Step 1: load meta.json (throws SessionNotFoundError if missing).
  const meta = readSessionMeta(baseDir, sessionId);

  // Steps 2 + 3: full/migration lanes need worktree + branch validation.
  // Quick lane has worktree_path = null and skips both checks.
  if (meta.worktree_path) {
    if (!fs.existsSync(meta.worktree_path)) {
      throw new WorktreeMissingError(meta.worktree_path);
    }
    const currentBranch = git(meta.worktree_path);
    if (meta.feature_branch && currentBranch !== meta.feature_branch) {
      throw new SessionStateMismatchError(
        sessionId,
        meta.work_item_id,
        `worktree branch '${currentBranch}' != meta.feature_branch '${meta.feature_branch}'`,
      );
    }
  }

  const nowIso = new Date(now()).toISOString();

  // Step 4: atomic update sessions/index.json.
  await updateSessionEntry(baseDir, sessionId, (cur) => ({
    ...cur,
    status: 'active',
    pid: newPid,
    last_seen_at: nowIso,
  }));

  // Step 5: atomic update work-items/index.json (only if bound).
  if (meta.work_item_id) {
    await setCurrentSessionId(baseDir, meta.work_item_id, sessionId);
    await setWorkItemStatus(baseDir, meta.work_item_id, 'in_progress');
  }

  // Step 6: spawn shell with env vars per §6.2 step 8.
  const projectRoot = meta.worktree_path ?? meta.repo_root;
  const env = {
    OPENKIT_SESSION_ID: sessionId,
    OPENKIT_WORK_ITEM_ID: meta.work_item_id ?? '',
    OPENKIT_PROJECT_ROOT: projectRoot,
    OPENKIT_REPOSITORY_ROOT: meta.repo_root,
    OPENKIT_WORKFLOW_STATE: sessionMirrorPath(baseDir, sessionId),
  };

  const spawnResult = await spawn(env, { meta });
  return { meta, env, spawnResult };
}
