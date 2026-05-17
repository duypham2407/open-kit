import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectKitLayoutDrift } from '../../global/ensure-install.js';

function makeKitRootWithLayerB() {
  const kitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-drift-'));
  fs.mkdirSync(path.join(kitRoot, 'src', 'openkit-runtime'), { recursive: true });
  fs.writeFileSync(path.join(kitRoot, 'src', 'openkit-runtime', 'workflow-state.js'), 'stub');
  return kitRoot;
}

describe('detectKitLayoutDrift', () => {
  test('returns true when <kitRoot>/commands missing', () => {
    const kitRoot = makeKitRootWithLayerB();
    try {
      assert.equal(detectKitLayoutDrift(kitRoot), true);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('returns false when commands+agents+skills all present', () => {
    const kitRoot = makeKitRootWithLayerB();
    try {
      for (const cls of ['commands', 'agents', 'skills']) {
        fs.mkdirSync(path.join(kitRoot, cls), { recursive: true });
        fs.writeFileSync(path.join(kitRoot, cls, 'stub.md'), 'stub');
      }
      assert.equal(detectKitLayoutDrift(kitRoot), false);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('returns true when commands dir exists but empty', () => {
    const kitRoot = makeKitRootWithLayerB();
    try {
      fs.mkdirSync(path.join(kitRoot, 'commands'), { recursive: true });
      fs.mkdirSync(path.join(kitRoot, 'agents'), { recursive: true });
      fs.writeFileSync(path.join(kitRoot, 'agents', 'A.md'), 'stub');
      fs.mkdirSync(path.join(kitRoot, 'skills', 's'), { recursive: true });
      fs.writeFileSync(path.join(kitRoot, 'skills', 's', 'SKILL.md'), 'stub');
      assert.equal(detectKitLayoutDrift(kitRoot), true);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });
});
