import fs from 'node:fs';
import { readSessionMeta } from './session-meta.js';
import { removeSessionEntry } from './sessions-index.js';
import { setCurrentSessionId, setWorkItemStatus } from './work-items-index.js';
import { sessionDir } from './session-paths.js';

/**
 * Abandon a session per spec §6.6.
 *
 * Order of operations (committed before the worktree question is even asked):
 *   1. work_items[*].status = abandoned, current_session_id = null
 *      (state.json itself is preserved on disk for audit; we only flip status).
 *   2. Delete sessions/<session_id>/ directory.
 *   3. Remove entry from sessions/index.json.
 *
 * Then, only as cleanup:
 *   4. If meta.worktree_path is set and the path exists, ask the injected prompt
 *      whether to keep or remove. If 'remove', call worktreeRemover with the
 *      forceRemoveDirty flag forwarded as `force`. The remover is responsible
 *      for the dirty/clean check (per spec it runs worktree-manager.js's check)
 *      and reports back via its return value. The flag applies only here — the
 *      abandon decision in steps 1–3 has already committed.
 *
 * Injected dependencies (testability):
 *   - worktreeRemover({ worktreePath, force }) → { status: 'removed' | 'refused-dirty' | 'missing' }
 *   - prompt({ worktreePath }) → 'keep' | 'remove' (sync or async)
 *
 * @param {object} opts
 * @param {string}  opts.baseDir
 * @param {string}  opts.sessionId
 * @param {boolean} [opts.forceRemoveDirty=false]
 * @param {(args: { worktreePath: string, force: boolean }) => ({ status: string } | Promise<{ status: string }>)} [opts.worktreeRemover]
 * @param {(args: { worktreePath: string }) => ('keep' | 'remove' | Promise<'keep' | 'remove'>)} [opts.prompt]
 * @returns {Promise<{ sessionId: string, workItemId: string|null, worktreeAction: 'none'|'missing'|'kept'|'removed'|'refused-dirty' }>}
 */
export async function abandonSession({
  baseDir,
  sessionId,
  forceRemoveDirty = false,
  worktreeRemover,
  prompt,
}) {
  // Read meta first — this throws SessionNotFoundError if the session doesn't
  // exist, which is the right behavior: abandon must reference a real session.
  const meta = readSessionMeta(baseDir, sessionId);
  const workItemId = meta.work_item_id ?? null;
  const worktreePath = meta.worktree_path ?? null;

  // Step 1: flip work item status + clear current_session_id (only if bound).
  // If the session was launcher-created and never bound, there's nothing to
  // update in work-items/index.json.
  if (workItemId) {
    await setWorkItemStatus(baseDir, workItemId, 'abandoned');
    await setCurrentSessionId(baseDir, workItemId, null);
  }

  // Step 2: delete sessions/<session_id>/ directory.
  // This removes meta.json, heartbeat.json, workflow-state.json mirror, etc.
  // The work item's state.json (under work-items/<id>/state.json) is NOT
  // touched — it's preserved on disk for audit.
  fs.rmSync(sessionDir(baseDir, sessionId), { recursive: true, force: true });

  // Step 3: remove entry from sessions/index.json.
  await removeSessionEntry(baseDir, sessionId);

  // Step 4: worktree cleanup. The abandon is already committed at this point;
  // anything we report here is purely informational about the worktree.
  if (!worktreePath) {
    return { sessionId, workItemId, worktreeAction: 'none' };
  }
  if (!fs.existsSync(worktreePath)) {
    // Quick lane has worktreePath=null and is handled above. A non-null path
    // that doesn't exist on disk means the worktree was already cleaned up
    // out-of-band. Don't error; just report.
    return { sessionId, workItemId, worktreeAction: 'missing' };
  }
  if (typeof prompt !== 'function') {
    throw new TypeError('abandonSession requires an injected prompt function when a worktree exists');
  }
  if (typeof worktreeRemover !== 'function') {
    throw new TypeError('abandonSession requires an injected worktreeRemover function when a worktree exists');
  }

  const choice = await prompt({ worktreePath });
  if (choice === 'keep') {
    return { sessionId, workItemId, worktreeAction: 'kept' };
  }
  if (choice !== 'remove') {
    throw new Error(`abandonSession prompt must return 'keep' or 'remove', got '${choice}'`);
  }

  const result = await worktreeRemover({ worktreePath, force: forceRemoveDirty });
  const status = result?.status;
  if (status !== 'removed' && status !== 'refused-dirty' && status !== 'missing') {
    throw new Error(`worktreeRemover must report status 'removed' | 'refused-dirty' | 'missing', got '${status}'`);
  }
  return { sessionId, workItemId, worktreeAction: status };
}
