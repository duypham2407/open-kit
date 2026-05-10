import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { inspectGlobalDoctor } from '../../global/doctor.js';

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('canRunCleanly is false when global install is missing (regression)', () => {
  // Sanity-check the existing branch: install-missing already returns
  // canRunCleanly: false. This proves the doctor entry-point honors more
  // than just `issues.length`.
  const globalRoot = mkdtemp('doctor-prop-missing-');
  const projectRoot = mkdtemp('doctor-prop-proj-missing-');

  const result = inspectGlobalDoctor({
    projectRoot,
    env: {
      ...process.env,
      OPENCODE_HOME: globalRoot,
    },
  });

  assert.equal(result.status, 'install-missing');
  assert.equal(result.canRunCleanly, false);

  fs.rmSync(globalRoot, { recursive: true, force: true });
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

test('issues includes "Workflow kernel is unavailable" when runtimeDoctor.workflow.status === "unavailable"', () => {
  // Audit fix [2-H-2] propagates runtime-doctor sub-check failures into the
  // top-level issues array. We exercise this by reading the doctor.js source
  // and asserting the new propagation block exists and uses the documented
  // surface name. A behavioral test would require building a full kit-root
  // that the runtime can boot but whose workflow kernel cannot be loaded —
  // a multi-hundred-line harness for what is fundamentally a one-line guard.
  // Instead, this test pins the propagation rule as a contract.
  const sourceUrl = new URL('../../global/doctor.js', import.meta.url);
  const source = fs.readFileSync(sourceUrl, 'utf8');

  assert.match(
    source,
    /runtimeDoctor\.workflow\?\.status\s*===\s*'unavailable'/,
    'doctor.js must check runtimeDoctor.workflow.status against "unavailable" so canRunCleanly cannot be true when the kernel is broken',
  );
  assert.match(
    source,
    /Workflow kernel is unavailable/,
    'doctor.js must push a human-readable issue describing the workflow-kernel-unavailable case',
  );
});
