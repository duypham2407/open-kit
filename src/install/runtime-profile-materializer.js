import fs from 'node:fs';
import path from 'node:path';

/**
 * Materialize a runtime-profile file from an in-memory template.
 *
 * Audit note [2-L-2]: this function writes to `targetPath` directly
 * without any boundary check. All current callers supply paths derived
 * from getGlobalPaths / getWorkspacePaths, so the path is always under
 * a controlled directory; the function therefore does not validate.
 * If a future caller passes a path from user / config input, that
 * caller MUST validate the path is inside the expected project /
 * workspace root before invoking this function.
 *
 * @param {{ targetPath: string, templateContent: string }} args
 * @returns {string} The path that was written.
 */
export function materializeRuntimeProfile({ targetPath, templateContent }) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, templateContent, 'utf8');
  return targetPath;
}
