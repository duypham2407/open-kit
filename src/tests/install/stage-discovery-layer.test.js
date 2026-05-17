import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stageOpenCodeDiscoveryLayer } from '../../global/materialize.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '../../..');

function makeTempKitRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-stage-layer-'));
}

describe('stageOpenCodeDiscoveryLayer', () => {
  test('copies install-bundle classes into kitRoot top-level', () => {
    const kitRoot = makeTempKitRoot();
    try {
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: PROJECT_ROOT });

      for (const cls of ['commands', 'agents', 'skills', 'context']) {
        const dir = path.join(kitRoot, cls);
        assert.ok(fs.existsSync(dir), `${cls} should exist at <kitRoot>/${cls}`);
        const entries = fs.readdirSync(dir);
        assert.ok(entries.length > 0, `${cls} should be non-empty`);
      }

      assert.ok(
        fs.existsSync(path.join(kitRoot, 'commands', 'delivery.md')),
        '<kitRoot>/commands/delivery.md should be staged from install-bundle'
      );
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('is idempotent — second call does not throw or duplicate', () => {
    const kitRoot = makeTempKitRoot();
    try {
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: PROJECT_ROOT });
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: PROJECT_ROOT });

      const commands = fs.readdirSync(path.join(kitRoot, 'commands'));
      const uniqueCount = new Set(commands).size;
      assert.equal(commands.length, uniqueCount, 'no duplicate command files');
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
    }
  });

  test('skips classes when install-bundle source missing', () => {
    const kitRoot = makeTempKitRoot();
    const fakePackageRoot = makeTempKitRoot(); // empty package root
    try {
      stageOpenCodeDiscoveryLayer({ kitRoot, packageRoot: fakePackageRoot });
      // Nothing should be created since the install-bundle source doesn't exist
      assert.equal(fs.existsSync(path.join(kitRoot, 'commands')), false);
    } finally {
      fs.rmSync(kitRoot, { recursive: true, force: true });
      fs.rmSync(fakePackageRoot, { recursive: true, force: true });
    }
  });
});
