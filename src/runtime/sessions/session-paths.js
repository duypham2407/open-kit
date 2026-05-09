import path from 'node:path';

export const sessionsDir = (baseDir) => path.join(baseDir, 'sessions');
export const sessionsIndexPath = (baseDir) => path.join(sessionsDir(baseDir), 'index.json');
export const sessionDir = (baseDir, id) => path.join(sessionsDir(baseDir), id);
export const sessionMetaPath = (baseDir, id) => path.join(sessionDir(baseDir, id), 'meta.json');
export const heartbeatPath = (baseDir, id) => path.join(sessionDir(baseDir, id), 'heartbeat.json');
export const sessionMirrorPath = (baseDir, id) => path.join(sessionDir(baseDir, id), 'workflow-state.json');
export const workItemsIndexPath = (baseDir) => path.join(baseDir, 'work-items', 'index.json');
export const legacyMirrorPath = (baseDir) => path.join(baseDir, 'workflow-state.json');

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const legacyMirrorPattern = (baseDir) =>
  new RegExp(`^${escape(path.join(baseDir, 'workflow-state.json.legacy.'))}.+$`);
