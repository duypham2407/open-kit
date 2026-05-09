import fs from 'node:fs';
import { migrateWorkItemsIndex } from './work-items-index.js';
import { rotateLegacyMirror } from './legacy-mirror-rotator.js';
import { reconcileExistingWorktrees } from './worktree-reconciler.js';
import { sessionsDir, sessionsIndexPath } from './session-paths.js';
import { SESSIONS_INDEX_SCHEMA } from './constants.js';

let warnedThisProcess = false;

// test-only: reset the once-per-process warning latch
export function _resetWarnedForTests() {
  warnedThisProcess = false;
}

export async function migrateOnStart({ baseDir, listWorktrees, warn = (m) => console.warn(m) }) {
  fs.mkdirSync(sessionsDir(baseDir), { recursive: true });
  if (!fs.existsSync(sessionsIndexPath(baseDir))) {
    fs.writeFileSync(
      sessionsIndexPath(baseDir),
      `${JSON.stringify({ schema: SESSIONS_INDEX_SCHEMA, sessions: [], updated_at: new Date().toISOString() }, null, 2)}\n`,
    );
  }
  migrateWorkItemsIndex(baseDir);
  const r = rotateLegacyMirror(baseDir);
  if (r.rotated && !warnedThisProcess) {
    warn(`OK1234 Legacy mirror rotated to ${r.target}. New runtime uses sessions/<id>/workflow-state.json.`);
    warnedThisProcess = true;
  }
  await reconcileExistingWorktrees({ baseDir, listWorktrees, warn });
}
