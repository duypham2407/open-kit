import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.resolve(MODULE_DIR, '..', 'package.json');

let cachedVersion = null;

export function getOpenKitVersion() {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    cachedVersion = typeof packageJson.version === 'string' && packageJson.version.length > 0
      ? packageJson.version
      : 'unknown';
  } catch {
    cachedVersion = 'unknown';
  }

  return cachedVersion;
}
