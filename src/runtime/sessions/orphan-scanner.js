import { atomicReadModifyWrite } from './atomic-json.js';
import { sessionsIndexPath, workItemsIndexPath } from './session-paths.js';
import { readHeartbeat } from './heartbeat.js';
import { ORPHAN_THRESHOLD_MS, CLOSED_RETENTION_MS, SESSIONS_INDEX_SCHEMA, WORK_ITEMS_INDEX_SCHEMA_V3 } from './constants.js';

function isPidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function shouldMarkOrphan(entry, baseDir, now) {
  const last = Date.parse(entry.last_seen_at);
  if (Number.isFinite(last) && now - last > ORPHAN_THRESHOLD_MS) return true;
  const hb = readHeartbeat(baseDir, entry.session_id);
  if (hb) {
    const beat = Date.parse(hb.last_beat_at);
    if (Number.isFinite(beat) && now - beat > ORPHAN_THRESHOLD_MS) return true;
  }
  if (!isPidAlive(entry.pid)) return true;
  return false;
}

export async function scanOrphans(baseDir, opts = {}) {
  const now = (opts.now ?? Date.now)();
  const transitionedToOrphan = [];

  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? { schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date(now).toISOString() };
    const sessions = idx.sessions
      .filter((s) => {
        if (s.status === 'closed') {
          const lastSeen = Date.parse(s.last_seen_at);
          if (Number.isFinite(lastSeen) && now - lastSeen > CLOSED_RETENTION_MS) return false;
        }
        return true;
      })
      .map((s) => {
        if (s.status !== 'active') return s;
        if (shouldMarkOrphan(s, baseDir, now)) {
          transitionedToOrphan.push(s);
          return { ...s, status: 'orphan' };
        }
        return s;
      });
    return { ...idx, sessions, updated_at: new Date(now).toISOString() };
  }, { defaultValue: { schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date(now).toISOString() } });

  for (const entry of transitionedToOrphan) {
    await atomicReadModifyWrite(workItemsIndexPath(baseDir), (cur) => {
      const idx = cur ?? { schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] };
      return {
        ...idx,
        work_items: idx.work_items.map((wi) =>
          wi.work_item_id === entry.work_item_id
            ? { ...wi, current_session_id: null, status: wi.status === 'done' ? wi.status : 'orphan' }
            : wi,
        ),
      };
    }, { defaultValue: { schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] } });
  }
  return { transitionedToOrphan: transitionedToOrphan.length };
}
