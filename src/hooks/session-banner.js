// Session-start banner for OpenKit per-tab sessions (spec §7.3).
//
// When OPENKIT_SESSION_ID is set, the session-start hook prints a banner
// summarising the session: id, lane, work item, worktree + branch, and the
// current stage from the per-work-item state.json. When the env var is
// unset the banner is a no-op and the existing legacy startup output runs
// untouched.
//
// The module exports pure helpers (renderSessionBanner, loadBannerContext)
// for unit testing, plus a side-effecting runSessionBanner that prints to
// the supplied stream (defaults to process.stdout).

import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve the .opencode base directory from environment variables.
 * Order of precedence:
 *   1. OPENKIT_BASE_DIR (explicit override, used by tests)
 *   2. OPENKIT_PROJECT_ROOT + '/.opencode' (set by launcher)
 *   3. process.cwd() + '/.opencode' (fallback when invoked manually)
 */
export function resolveBaseDir(env = process.env, cwd = process.cwd()) {
  if (env.OPENKIT_BASE_DIR) {
    return path.resolve(env.OPENKIT_BASE_DIR);
  }
  if (env.OPENKIT_PROJECT_ROOT) {
    return path.join(path.resolve(env.OPENKIT_PROJECT_ROOT), '.opencode');
  }
  return path.join(cwd, '.opencode');
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load the data the banner renders from disk. Returns `null` if essential
 * inputs are missing (no session id, no meta.json) — caller should treat
 * that as "do not render".
 */
export function loadBannerContext({ baseDir, sessionId }) {
  if (!sessionId) return null;

  const metaPath = path.join(baseDir, 'sessions', sessionId, 'meta.json');
  const meta = safeReadJson(metaPath);
  if (!meta) return null;

  let stage = null;
  if (meta.work_item_id) {
    const statePath = path.join(baseDir, 'work-items', meta.work_item_id, 'state.json');
    const state = safeReadJson(statePath);
    if (state && typeof state.current_stage === 'string') {
      stage = state.current_stage;
    }
  }

  return { meta, stage };
}

/**
 * Make `worktree_path` more readable by stripping the repo_root prefix when
 * the worktree lives under it. Falls back to the absolute path otherwise.
 */
function displayWorktreePath(worktreePath, repoRoot) {
  if (!worktreePath) return null;
  if (repoRoot && worktreePath.startsWith(`${repoRoot}/`)) {
    return worktreePath.slice(repoRoot.length + 1);
  }
  return worktreePath;
}

/**
 * Pure renderer. Takes a context object (from loadBannerContext) and
 * returns the multi-line banner string per spec §7.3. Returns the empty
 * string when ctx is null/undefined (caller should not print).
 */
export function renderSessionBanner(ctx) {
  if (!ctx || !ctx.meta) return '';
  const { meta, stage } = ctx;

  const sessionId = meta.session_id ?? '<unknown>';
  const lane = meta.lane ?? 'unbound';
  const workItem = meta.work_item_id ?? 'unbound';

  const lines = [];
  lines.push(`┌─ OpenKit Session ${sessionId} ──── lane=${lane} ──── work-item=${workItem}`);

  if (meta.worktree_path) {
    const wt = displayWorktreePath(meta.worktree_path, meta.repo_root);
    const branch = meta.feature_branch
      ? ` (branch ${meta.feature_branch})`
      : '';
    lines.push(`│  worktree: ${wt}${branch}`);
  } else {
    lines.push('│  worktree: <none> (lane runs in repo root)');
  }

  lines.push(`│  stage: ${stage ?? 'unbound'}`);
  lines.push('└─ /finish when done  •  Ctrl-D exits and leaves session active');

  return lines.join('\n');
}

/**
 * Side-effecting entry point used by the session-start hook. When
 * OPENKIT_SESSION_ID is unset or meta.json is missing, this is a no-op.
 *
 * Returns true when a banner was printed, false otherwise — handy for
 * tests and for the caller to know whether to add separator output.
 */
export function runSessionBanner({
  env = process.env,
  cwd = process.cwd(),
  stream = process.stdout,
} = {}) {
  const sessionId = env.OPENKIT_SESSION_ID;
  if (!sessionId) return false;

  const baseDir = resolveBaseDir(env, cwd);
  const ctx = loadBannerContext({ baseDir, sessionId });
  if (!ctx) return false;

  const banner = renderSessionBanner(ctx);
  if (!banner) return false;

  stream.write(`${banner}\n`);
  return true;
}
