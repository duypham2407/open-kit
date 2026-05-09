import { atomicReadModifyWrite, atomicReadJson } from './atomic-json.js';
import { sessionsIndexPath } from './session-paths.js';
import { SESSIONS_INDEX_SCHEMA } from './constants.js';

const empty = () => ({ schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date().toISOString() });

export function readSessionsIndex(baseDir) {
  return atomicReadJson(sessionsIndexPath(baseDir), empty());
}

export async function addSessionEntry(baseDir, entry) {
  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    if (idx.sessions.some((s) => s.session_id === entry.session_id)) {
      throw new Error(`duplicate session_id: ${entry.session_id}`);
    }
    return { ...idx, sessions: [...idx.sessions, entry], updated_at: new Date().toISOString() };
  }, { defaultValue: empty() });
}

export async function updateSessionEntry(baseDir, sessionId, mutator) {
  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    const sessions = idx.sessions.map((s) => (s.session_id === sessionId ? mutator(s) : s));
    return { ...idx, sessions, updated_at: new Date().toISOString() };
  }, { defaultValue: empty() });
}

export async function removeSessionEntry(baseDir, sessionId) {
  await atomicReadModifyWrite(sessionsIndexPath(baseDir), (cur) => {
    const idx = cur ?? empty();
    return {
      ...idx,
      sessions: idx.sessions.filter((s) => s.session_id !== sessionId),
      updated_at: new Date().toISOString(),
    };
  }, { defaultValue: empty() });
}

export function listSessions(baseDir, { status } = {}) {
  const idx = readSessionsIndex(baseDir);
  if (!status || status === 'all') return idx.sessions;
  return idx.sessions.filter((s) => s.status === status);
}
