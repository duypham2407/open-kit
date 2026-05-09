import fs from 'node:fs';
import { sessionMetaPath, sessionDir } from './session-paths.js';
import { SESSION_META_SCHEMA } from './constants.js';
import { SessionNotFoundError } from './errors.js';

export function writeSessionMeta(baseDir, meta) {
  const file = sessionMetaPath(baseDir, meta.sessionId);
  if (fs.existsSync(file)) {
    throw new Error(`session meta is write-once and already exists at ${file}`);
  }
  fs.mkdirSync(sessionDir(baseDir, meta.sessionId), { recursive: true });
  const payload = {
    schema: SESSION_META_SCHEMA,
    session_id: meta.sessionId,
    work_item_id: meta.workItemId ?? null,
    lane: meta.lane ?? null,
    repo_root: meta.repoRoot,
    worktree_path: meta.worktreePath ?? null,
    target_branch: meta.targetBranch ?? null,
    feature_branch: meta.featureBranch ?? null,
    started_at: meta.startedAt,
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readSessionMeta(baseDir, sessionId) {
  const file = sessionMetaPath(baseDir, sessionId);
  if (!fs.existsSync(file)) {
    throw new SessionNotFoundError(sessionId);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
