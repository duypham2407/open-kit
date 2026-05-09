import { readWorkItemsIndex } from './work-items-index.js';
import { addSessionEntry, readSessionsIndex } from './sessions-index.js';
import { syntheticOrphanIdFor } from './synthetic-orphan.js';

export async function reconcileExistingWorktrees({ baseDir, listWorktrees, warn = (m) => console.warn(m) }) {
  const wis = readWorkItemsIndex(baseDir).work_items;
  const existing = new Set(readSessionsIndex(baseDir).sessions.map((s) => s.session_id));
  for (const wt of listWorktrees()) {
    const wi = wis.find((w) => w.work_item_id === wt.workItemId);
    if (!wi) {
      warn(`OK1235 worktree at ${wt.worktreePath} (work item ${wt.workItemId}) has no matching index entry; skipping`);
      continue;
    }
    if (wi.status === 'done' || wi.status === 'abandoned') continue;
    const id = syntheticOrphanIdFor(wt.workItemId);
    if (existing.has(id)) continue;
    await addSessionEntry(baseDir, {
      session_id: id, work_item_id: wi.work_item_id, lane: wi.lane,
      worktree_path: wt.worktreePath, repo_root: wt.repoRoot,
      pid: null, status: 'orphan',
      started_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
    });
  }
}
