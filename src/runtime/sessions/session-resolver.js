import { readSessionMeta } from './session-meta.js';
import { readWorkItemsIndex } from './work-items-index.js';
import { sessionMirrorPath } from './session-paths.js';
import { SessionRequiredError, SessionStateMismatchError } from './errors.js';
import { resolveSessionBaseDir } from './session-base-dir.js';

export function resolveSession({ env, repoRoot }) {
  const sessionId = env?.OPENKIT_SESSION_ID;
  if (!sessionId) throw new SessionRequiredError();
  const baseDir = resolveSessionBaseDir({ env, repoRoot });
  const meta = readSessionMeta(baseDir, sessionId);
  const idx = readWorkItemsIndex(baseDir);
  const wi = idx.work_items.find((w) => w.work_item_id === meta.work_item_id);
  if (!wi || wi.current_session_id !== sessionId) {
    throw new SessionStateMismatchError(sessionId, meta.work_item_id, wi?.current_session_id ?? null);
  }
  return {
    sessionId,
    workItemId: meta.work_item_id,
    lane: meta.lane,
    baseDir,
    mirrorPath: sessionMirrorPath(baseDir, sessionId),
    worktreePath: meta.worktree_path,
    repoRoot,
    targetBranch: meta.target_branch,
    featureBranch: meta.feature_branch,
  };
}
