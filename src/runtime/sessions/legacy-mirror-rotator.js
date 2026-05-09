import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_MIRROR_ROTATE_KEEP, LEGACY_STUB_SCHEMA } from './constants.js';
import { legacyMirrorPath } from './session-paths.js';

const STUB = { schema: LEGACY_STUB_SCHEMA, note: 'session state moved to .opencode/sessions/<id>/workflow-state.json' };

export function rotateLegacyMirror(baseDir) {
  const file = legacyMirrorPath(baseDir);
  if (!fs.existsSync(file)) return { rotated: false };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { parsed = {}; }
  if (parsed?.schema === LEGACY_STUB_SCHEMA) return { rotated: false };
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
