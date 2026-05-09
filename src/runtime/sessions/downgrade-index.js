import fs from 'node:fs';
import path from 'node:path';
import { readWorkItemsIndex } from './work-items-index.js';
import { atomicReadModifyWrite } from './atomic-json.js';
import { workItemsIndexPath, legacyMirrorPath } from './session-paths.js';

/**
 * Downgrade `work-items/index.json` from v3 → v2 (lossy, maintainer-only).
 *
 * Implements spec §8.4 step-by-step:
 *   1. Load v3 work-items/index.json.
 *   2. Pick first in_progress work item and set active_work_item_id = its id.
 *      If none in_progress, omit the field.
 *   3. Strip current_session_id, lane (re-emit as mode), and status fields
 *      that v2 did not have.
 *   4. Write back without the v3 schema field.
 *   5. Restore the most recent workflow-state.json.legacy.* to
 *      workflow-state.json if present.
 *   6. Print a warning describing what was lost.
 *
 * The script is intentionally lossy: v2 cannot represent per-session state, so
 * if multiple sessions had been active, the resulting v2 file may appear
 * inconsistent. This is acceptable for incident response.
 *
 * @param {object} opts
 * @param {string} opts.baseDir - usually `.opencode`
 * @param {{ warn: (msg: string) => void }} [opts.logger] - injected for testability
 * @returns {Promise<{
 *   activeWorkItemId: string | null,
 *   workItemCount: number,
 *   restoredLegacyMirror: string | null,
 *   indexPath: string,
 * }>}
 */
export async function downgradeIndex({ baseDir, logger = console }) {
  const warn = typeof logger?.warn === 'function' ? logger.warn.bind(logger) : (m) => console.warn(m);

  // Step 1: Load v3 work-items/index.json (via the v3 reader, which yields an
  // empty default if the file is missing).
  const v3 = readWorkItemsIndex(baseDir);
  const items = Array.isArray(v3.work_items) ? v3.work_items : [];

  // Step 2: pick first in_progress work item to repopulate active_work_item_id.
  const firstInProgress = items.find((wi) => wi.status === 'in_progress');
  const activeWorkItemId = firstInProgress?.work_item_id ?? null;

  // Step 3: strip v3-only fields and re-emit `mode` from `lane`. v2 entries
  // had: { work_item_id, feature_id, feature_slug, mode, status, state_path }.
  // We deliberately drop `status` and `current_session_id` per spec; we keep
  // `feature_id`, `feature_slug`, `state_path` since those exist in v2's shape.
  const v2Items = items.map((wi) => {
    const out = {
      work_item_id: wi.work_item_id,
      feature_id: wi.feature_id ?? null,
      feature_slug: wi.feature_slug ?? null,
      mode: wi.lane ?? wi.mode ?? 'full',
      state_path: wi.state_path,
    };
    return out;
  });

  // Step 4: write back without the v3 `schema` field. Only include
  // active_work_item_id if there was an in_progress item.
  const v2 = activeWorkItemId
    ? { active_work_item_id: activeWorkItemId, work_items: v2Items }
    : { work_items: v2Items };

  await atomicReadModifyWrite(workItemsIndexPath(baseDir), () => v2, { defaultValue: v3 });

  // Step 5: restore the most recent workflow-state.json.legacy.<ts> to
  // workflow-state.json if any exist. "Most recent" is determined by sorting
  // the suffix lexicographically — rotateLegacyMirror writes ISO timestamps
  // (with `:` and `.` replaced by `-`), which sort correctly as strings; we
  // also tiebreak by mtime so that races during a single test millisecond
  // resolve deterministically.
  const restoredLegacyMirror = restoreLatestLegacyMirror(baseDir);

  // Step 6: warn the operator that this is lossy.
  warn(
    'OK1235 sessions downgrade-index: rewrote work-items/index.json as v2 (lossy). ' +
      'Per-session state cannot be represented in v2 and will appear inconsistent ' +
      'if multiple sessions had been active. Synthetic orphans, current_session_id ' +
      'bindings, and v3-only statuses were dropped.',
  );

  return {
    activeWorkItemId,
    workItemCount: v2Items.length,
    restoredLegacyMirror,
    indexPath: workItemsIndexPath(baseDir),
  };
}

function restoreLatestLegacyMirror(baseDir) {
  if (!fs.existsSync(baseDir)) return null;
  const candidates = fs
    .readdirSync(baseDir)
    .filter((n) => n.startsWith('workflow-state.json.legacy.'))
    .map((n) => {
      const full = path.join(baseDir, n);
      let mtimeMs = 0;
      try { mtimeMs = fs.statSync(full).mtimeMs; } catch { /* gone, ignore */ }
      return { name: n, full, mtimeMs };
    });
  if (candidates.length === 0) return null;

  // Sort by name (which embeds an ISO timestamp) then by mtime as a tiebreaker.
  candidates.sort((a, b) => {
    if (a.name === b.name) return a.mtimeMs - b.mtimeMs;
    return a.name < b.name ? -1 : 1;
  });
  const latest = candidates[candidates.length - 1];

  // Copy (not rename) so the .legacy.* file stays on disk for forensics.
  fs.copyFileSync(latest.full, legacyMirrorPath(baseDir));
  return latest.full;
}
