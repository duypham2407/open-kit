import crypto from 'node:crypto';

import { createBackgroundRun } from './task-state.js';

export function spawnBackgroundRun(registry, { title, payload }) {
  const id = `bg_${crypto.randomBytes(4).toString('hex')}`;
  const run = createBackgroundRun({ id, title, payload });
  run.status = 'running';
  registry.set(id, run);
  return run;
}
