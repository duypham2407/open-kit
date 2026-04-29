import crypto from 'node:crypto';

export function normalizeRuntimeSessionId(value) {
  if (typeof value !== 'string' || value.trim() !== value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  return value;
}

export function createRuntimeSessionId() {
  return `session_${crypto.randomBytes(8).toString('hex')}`;
}
