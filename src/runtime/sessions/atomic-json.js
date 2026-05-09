import fs from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { IndexLockTimeoutError } from './errors.js';
import {
  INDEX_LOCK_RETRIES,
  INDEX_LOCK_RETRY_INTERVAL_MS,
  INDEX_LOCK_TIMEOUT_MS,
} from './constants.js';

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function atomicReadJson(filePath, defaultValue) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT' && defaultValue !== undefined) return defaultValue;
    throw err;
  }
}

export async function atomicReadModifyWrite(filePath, mutator, opts = {}) {
  const { defaultValue } = opts;
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    if (defaultValue === undefined) {
      throw new Error(`File missing and no defaultValue provided: ${filePath}`);
    }
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
  let release;
  try {
    release = await lockfile.lock(filePath, {
      retries: { retries: INDEX_LOCK_RETRIES, minTimeout: INDEX_LOCK_RETRY_INTERVAL_MS, maxTimeout: INDEX_LOCK_RETRY_INTERVAL_MS },
      stale: INDEX_LOCK_TIMEOUT_MS * 5,
    });
  } catch (err) {
    throw new IndexLockTimeoutError(filePath, INDEX_LOCK_TIMEOUT_MS);
  }
  try {
    const current = atomicReadJson(filePath, defaultValue);
    const next = await mutator(current);
    const tmp = `${filePath}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
    fs.renameSync(tmp, filePath);
    return next;
  } finally {
    await release();
  }
}
