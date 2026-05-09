import fs from 'node:fs';
import path from 'node:path';
import { sessionsIndexPath, sessionsDir } from '../sessions/session-paths.js';
import { readHeartbeat } from '../sessions/heartbeat.js';
import { listOpenKitWorktrees } from '../sessions/list-openkit-worktrees.js';
import {
  LEGACY_MIRROR_ROTATE_KEEP,
  ORPHAN_THRESHOLD_MS,
  SESSIONS_INDEX_SCHEMA,
} from '../sessions/constants.js';

const ORPHAN_WARN_THRESHOLD = 5;

function defaultIsPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function check(id, status, summary, details = {}) {
  return { id, status, summary, ...details };
}

function inspectSessionsIndexReadable(baseDir) {
  const file = sessionsIndexPath(baseDir);
  if (!fs.existsSync(file)) {
    return check(
      'sessions-index-readable',
      'ok',
      'sessions/index.json is absent (will be created on next run).',
      { path: file, present: false },
    );
  }
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return check(
      'sessions-index-readable',
      'fail',
      `sessions/index.json could not be read: ${err.message}`,
      { path: file, present: true, error: err.message },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return check(
      'sessions-index-readable',
      'fail',
      `sessions/index.json is not valid JSON: ${err.message}`,
      { path: file, present: true, error: err.message },
    );
  }
  if (parsed?.schema !== SESSIONS_INDEX_SCHEMA) {
    return check(
      'sessions-index-readable',
      'warn',
      `sessions/index.json schema='${parsed?.schema}' does not match expected '${SESSIONS_INDEX_SCHEMA}'.`,
      { path: file, present: true, schema: parsed?.schema ?? null },
    );
  }
  if (!Array.isArray(parsed.sessions)) {
    return check(
      'sessions-index-readable',
      'fail',
      'sessions/index.json is missing the sessions array.',
      { path: file, present: true },
    );
  }
  return check(
    'sessions-index-readable',
    'ok',
    `sessions/index.json parsed (${parsed.sessions.length} entries).`,
    { path: file, present: true, count: parsed.sessions.length },
  );
}

function inspectLegacyMirrorRotation(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return check(
      'legacy-mirror-rotation',
      'ok',
      'baseDir does not exist; nothing to rotate.',
      { count: 0 },
    );
  }
  let names;
  try {
    names = fs.readdirSync(baseDir);
  } catch (err) {
    return check(
      'legacy-mirror-rotation',
      'fail',
      `Could not list ${baseDir}: ${err.message}`,
      { error: err.message },
    );
  }
  const legacies = names.filter((n) => n.startsWith('workflow-state.json.legacy.'));
  if (legacies.length > LEGACY_MIRROR_ROTATE_KEEP) {
    return check(
      'legacy-mirror-rotation',
      'warn',
      `Found ${legacies.length} workflow-state.json.legacy.* files; rotation keeps at most ${LEGACY_MIRROR_ROTATE_KEEP}.`,
      { count: legacies.length, keep: LEGACY_MIRROR_ROTATE_KEEP, files: legacies },
    );
  }
  return check(
    'legacy-mirror-rotation',
    'ok',
    `Found ${legacies.length} legacy mirror file(s); within the rotation cap of ${LEGACY_MIRROR_ROTATE_KEEP}.`,
    { count: legacies.length, keep: LEGACY_MIRROR_ROTATE_KEEP },
  );
}

function inspectOrphanSessionsCount(baseDir) {
  const idxResult = readSessionsIndexSafe(baseDir);
  if (idxResult.status === 'fail') {
    return check(
      'orphan-sessions-count',
      'fail',
      `Could not read sessions/index.json: ${idxResult.error}`,
      { error: idxResult.error },
    );
  }
  const orphans = (idxResult.value?.sessions ?? []).filter((s) => s.status === 'orphan');
  if (orphans.length > ORPHAN_WARN_THRESHOLD) {
    return check(
      'orphan-sessions-count',
      'warn',
      `${orphans.length} orphan session entries (threshold > ${ORPHAN_WARN_THRESHOLD}). Consider abandoning stale sessions.`,
      {
        count: orphans.length,
        threshold: ORPHAN_WARN_THRESHOLD,
        orphanIds: orphans.map((o) => o.session_id),
      },
    );
  }
  return check(
    'orphan-sessions-count',
    'ok',
    `${orphans.length} orphan session entries (threshold > ${ORPHAN_WARN_THRESHOLD}).`,
    { count: orphans.length, threshold: ORPHAN_WARN_THRESHOLD },
  );
}

function inspectWorktreeOrphanMismatch(baseDir, repoRoot, listWorktrees) {
  if (!repoRoot) {
    return check(
      'worktree-orphan-mismatch',
      'ok',
      'No repoRoot provided; skipping worktree mismatch check.',
      { skipped: true },
    );
  }
  const lister = typeof listWorktrees === 'function' ? listWorktrees : () => listOpenKitWorktrees(repoRoot);
  let worktrees;
  try {
    worktrees = lister();
  } catch (err) {
    return check(
      'worktree-orphan-mismatch',
      'fail',
      `Could not list worktrees: ${err.message}`,
      { error: err.message },
    );
  }
  const idxResult = readSessionsIndexSafe(baseDir);
  if (idxResult.status === 'fail') {
    return check(
      'worktree-orphan-mismatch',
      'fail',
      `Could not read sessions/index.json: ${idxResult.error}`,
      { error: idxResult.error },
    );
  }
  const sessions = idxResult.value?.sessions ?? [];
  const workItemIdsInIndex = new Set(
    sessions.filter((s) => s.work_item_id).map((s) => s.work_item_id),
  );
  const missing = [];
  for (const wt of worktrees) {
    if (!workItemIdsInIndex.has(wt.workItemId)) {
      missing.push(wt);
    }
  }
  if (missing.length > 0) {
    return check(
      'worktree-orphan-mismatch',
      'warn',
      `${missing.length} OpenKit worktree(s) on disk have no matching session entry.`,
      {
        missing: missing.map((m) => ({ workItemId: m.workItemId, worktreePath: m.worktreePath })),
        worktreeCount: worktrees.length,
      },
    );
  }
  return check(
    'worktree-orphan-mismatch',
    'ok',
    `${worktrees.length} OpenKit worktree(s) all have matching session entries.`,
    { worktreeCount: worktrees.length },
  );
}

function inspectPidCleanup(baseDir, { isPidAlive = defaultIsPidAlive, now = Date.now } = {}) {
  const idxResult = readSessionsIndexSafe(baseDir);
  if (idxResult.status === 'fail') {
    return check(
      'pid-cleanup',
      'fail',
      `Could not read sessions/index.json: ${idxResult.error}`,
      { error: idxResult.error },
    );
  }
  const nowMs = typeof now === 'function' ? now() : Date.now();
  const sessions = (idxResult.value?.sessions ?? []).filter((s) => s.status === 'active');
  const stale = [];
  for (const entry of sessions) {
    const hb = readHeartbeat(baseDir, entry.session_id);
    if (!hb) continue;
    const beat = Date.parse(hb.last_beat_at);
    if (!Number.isFinite(beat)) continue;
    if (nowMs - beat > ORPHAN_THRESHOLD_MS) continue; // not fresh
    const pid = hb.pid ?? entry.pid;
    if (!isPidAlive(pid)) {
      stale.push({ session_id: entry.session_id, pid });
    }
  }
  if (stale.length > 0) {
    return check(
      'pid-cleanup',
      'warn',
      `${stale.length} active session(s) have a fresh heartbeat but a dead PID.`,
      { stale, activeCount: sessions.length },
    );
  }
  return check(
    'pid-cleanup',
    'ok',
    `${sessions.length} active session(s); all fresh-heartbeat PIDs are alive.`,
    { activeCount: sessions.length },
  );
}

function readSessionsIndexSafe(baseDir) {
  const file = sessionsIndexPath(baseDir);
  if (!fs.existsSync(file)) {
    return { status: 'ok', value: { schema: SESSIONS_INDEX_SCHEMA, sessions: [] } };
  }
  try {
    return { status: 'ok', value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { status: 'fail', error: err.message };
  }
}

/**
 * Inspect sessions hygiene. Returns five named checks per spec §10.
 * Each check has `{ id, status: 'ok'|'warn'|'fail', summary, ...details }`.
 *
 * @param {object} opts
 * @param {string} opts.baseDir - typically `<projectRoot>/.opencode`
 * @param {string} [opts.repoRoot] - repo root used to enumerate OpenKit worktrees
 * @param {() => Array<{workItemId: string, worktreePath: string}>} [opts.listWorktrees]
 *   - injectable worktree lister (defaults to listOpenKitWorktrees(repoRoot))
 * @param {(pid: number) => boolean} [opts.isPidAlive]
 * @param {() => number} [opts.now]
 */
export function inspectSessionsDoctor({
  baseDir,
  repoRoot = null,
  listWorktrees = null,
  isPidAlive = defaultIsPidAlive,
  now = Date.now,
} = {}) {
  if (!baseDir) {
    const skipped = check('sessions-doctor', 'ok', 'No baseDir provided; sessions doctor skipped.', { skipped: true });
    return {
      checks: [skipped],
      worstStatus: 'ok',
    };
  }
  const checks = [
    inspectSessionsIndexReadable(baseDir),
    inspectLegacyMirrorRotation(baseDir),
    inspectOrphanSessionsCount(baseDir),
    inspectWorktreeOrphanMismatch(baseDir, repoRoot, listWorktrees),
    inspectPidCleanup(baseDir, { isPidAlive, now }),
  ];
  const order = { ok: 0, warn: 1, fail: 2 };
  const worstStatus = checks.reduce((acc, c) => (order[c.status] > order[acc] ? c.status : acc), 'ok');
  return { checks, worstStatus };
}

export const _internals = {
  inspectSessionsIndexReadable,
  inspectLegacyMirrorRotation,
  inspectOrphanSessionsCount,
  inspectWorktreeOrphanMismatch,
  inspectPidCleanup,
};
