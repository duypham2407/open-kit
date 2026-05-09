import fs from 'node:fs';
import { heartbeatPath, sessionDir } from './session-paths.js';
import { HEARTBEAT_INTERVAL_MS } from './constants.js';

export function writeHeartbeat(baseDir, sessionId, pid) {
  fs.mkdirSync(sessionDir(baseDir, sessionId), { recursive: true });
  fs.writeFileSync(
    heartbeatPath(baseDir, sessionId),
    `${JSON.stringify({ pid, last_beat_at: new Date().toISOString() })}\n`,
  );
}

export function readHeartbeat(baseDir, sessionId) {
  const file = heartbeatPath(baseDir, sessionId);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function startHeartbeat({ baseDir, sessionId, pid, intervalMs = HEARTBEAT_INTERVAL_MS }) {
  writeHeartbeat(baseDir, sessionId, pid);
  const handle = setInterval(() => {
    try { writeHeartbeat(baseDir, sessionId, pid); } catch { /* swallow during shutdown */ }
  }, intervalMs);
  handle.unref?.();
  return () => clearInterval(handle);
}
