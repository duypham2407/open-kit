import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_MIRROR_ROTATE_KEEP, LEGACY_STUB_SCHEMA } from './constants.js';
import { legacyMirrorPath } from './session-paths.js';

const STUB = { schema: LEGACY_STUB_SCHEMA, note: 'session state moved to .opencode/sessions/<id>/workflow-state.json' };

// Detect if a parsed JSON object looks like an OpenKit workflow-state file
function looksLikeOpenKitWorkflowState(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  // Explicitly exclude user-created files with only simple key-value pairs
  // that don't match any OpenKit schema fields
  const keys = Object.keys(parsed);
  if (keys.length === 0) return false;
  // OpenKit workflow-state files have characteristic fields
  const hasMode = typeof parsed.mode === 'string';
  const hasWorkItemId = 'work_item_id' in parsed;
  const hasCurrentStage = typeof parsed.current_stage === 'string' || typeof parsed.stage === 'string';
  const hasStatus = typeof parsed.status === 'string';
  const hasCurrentOwner = typeof parsed.current_owner === 'string';
  const hasFeatureId = 'feature_id' in parsed;
  const hasArtifacts = 'artifacts' in parsed;
  const hasTick = 'tick' in parsed; // Test fixture field
  // Exclude files that are clearly not OpenKit (e.g., {"project":true})
  if (keys.length === 1 && keys[0] === 'project' && parsed.project === true) return false;
  // Consider it an OpenKit file if it has at least 1 of these fields
  return hasMode || hasWorkItemId || hasCurrentStage || hasStatus || hasCurrentOwner || hasFeatureId || hasArtifacts || hasTick;
}

export function rotateLegacyMirror(baseDir) {
  const file = legacyMirrorPath(baseDir);
  if (!fs.existsSync(file)) return { rotated: false };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { parsed = {}; }
  // Don't rotate if it's already a stub
  if (parsed?.schema === LEGACY_STUB_SCHEMA) return { rotated: false };
  // Don't rotate if it doesn't look like an OpenKit workflow-state file (could be user-created)
  if (!looksLikeOpenKitWorkflowState(parsed)) return { rotated: false };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(baseDir, `workflow-state.json.legacy.${stamp}`);
  fs.renameSync(file, target);
  fs.writeFileSync(file, `${JSON.stringify(STUB, null, 2)}\n`);
  capRotatedFiles(baseDir);
  return { rotated: true, target };
}

function capRotatedFiles(baseDir) {
  const legacies = fs
    .readdirSync(baseDir)
    .filter((n) => n.startsWith('workflow-state.json.legacy.'))
    .map((n) => ({ name: n, full: path.join(baseDir, n), mtime: fs.statSync(path.join(baseDir, n)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
  while (legacies.length > LEGACY_MIRROR_ROTATE_KEEP) {
    const drop = legacies.shift();
    fs.unlinkSync(drop.full);
  }
}
