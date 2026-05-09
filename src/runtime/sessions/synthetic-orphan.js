import { createHash } from 'node:crypto';
import { SYNTHETIC_ORPHAN_PREFIX, SYNTHETIC_ORPHAN_HEX_LEN } from './constants.js';

export function syntheticOrphanIdFor(workItemId) {
  const hash = createHash('sha1').update(workItemId).digest('hex').slice(0, SYNTHETIC_ORPHAN_HEX_LEN);
  return `${SYNTHETIC_ORPHAN_PREFIX}${hash}`;
}
