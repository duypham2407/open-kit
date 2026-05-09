import { randomBytes } from 'node:crypto';
import {
  SESSION_ID_PREFIX,
  SESSION_ID_HEX_LEN,
  SYNTHETIC_ORPHAN_PREFIX,
  SYNTHETIC_ORPHAN_HEX_LEN,
} from './constants.js';

// Prefixes must not contain regex metacharacters; constants.js owns that invariant.
const RUNTIME_RE = new RegExp(`^${SESSION_ID_PREFIX}[0-9a-f]{${SESSION_ID_HEX_LEN}}$`);
const ORPHAN_RE = new RegExp(`^${SYNTHETIC_ORPHAN_PREFIX}[0-9a-f]{${SYNTHETIC_ORPHAN_HEX_LEN}}$`);

export function generateSessionId() {
  const bytes = randomBytes(Math.ceil(SESSION_ID_HEX_LEN / 2));
  return SESSION_ID_PREFIX + bytes.toString('hex').slice(0, SESSION_ID_HEX_LEN);
}

export function isValidSessionId(value) {
  if (typeof value !== 'string') return false;
  return RUNTIME_RE.test(value) || ORPHAN_RE.test(value);
}

export function isSyntheticOrphanId(value) {
  return typeof value === 'string' && ORPHAN_RE.test(value);
}
