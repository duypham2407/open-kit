import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worktreeRoot = path.resolve(__dirname, '..', '..');
const binPath = path.join(worktreeRoot, 'bin', 'openkit.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-onboard-'));
}

test('openkit onboard explains the default path and lane entry choices', () => {
  const tempHome = makeTempDir();
  const result = spawnSync(process.execPath, [binPath, 'onboard'], {
    cwd: worktreeRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCODE_HOME: tempHome,
      PATH: '',
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /OpenKit onboarding/);
  assert.match(result.stdout, /Default entrypoint after launch: \/task/);
  assert.match(result.stdout, /Primary entry commands/);
  assert.match(result.stdout, /\/migrate/);
  assert.match(result.stdout, /resume-summary/);
  assert.match(result.stdout, /preferred product path/i);
  assert.match(result.stdout, /npm install -g @duypham93\/openkit/);
  assert.match(result.stdout, /openkit doctor/);
  assert.match(result.stdout, /openkit run/);
  assert.match(result.stdout, /Compatibility runtime/);
  assert.match(result.stdout, /target-project app validation/i);
  assert.doesNotMatch(result.stdout, /Capability-guided next steps/);
});
