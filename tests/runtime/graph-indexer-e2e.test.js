// Regression test for audit fix [4-H-5]: hooks/graph-indexer.js is spawned
// detached on every session start, but had no E2E test exercising the
// hook's binary entry point. The DB layer was tested in isolation but the
// hook's own argv / env / module-import wiring was not.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(projectRoot, 'hooks', 'graph-indexer.js');

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('graph-indexer hook runs end-to-end on a fixture project and exits 0', () => {
  const fixtureRoot = mkdtemp('graph-indexer-e2e-');
  try {
    // Build a tiny fixture: 3 source files with one import edge between them.
    fs.writeFileSync(
      path.join(fixtureRoot, 'a.js'),
      "import { b } from './b.js';\nexport function a() { return b(); }\n",
    );
    fs.writeFileSync(
      path.join(fixtureRoot, 'b.js'),
      "import { c } from './c.js';\nexport function b() { return c(); }\n",
    );
    fs.writeFileSync(
      path.join(fixtureRoot, 'c.js'),
      'export function c() { return 42; }\n',
    );

    // Run graph-indexer.js as a subprocess. The hook reads OPENKIT_PROJECT_ROOT
    // and OPENKIT_KIT_ROOT from env; if better-sqlite3 is unavailable on this
    // platform, the hook exits 0 silently (acceptable — the test asserts the
    // happy path AND covers the no-op exit path).
    const result = spawnSync(process.execPath, [HOOK_PATH], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        OPENKIT_PROJECT_ROOT: fixtureRoot,
        OPENKIT_KIT_ROOT: projectRoot,
        OPENKIT_WORKFLOW_STATE: path.join(fixtureRoot, '.opencode', 'workflow-state.json'),
      },
    });

    assert.equal(result.status, 0, `graph-indexer must exit 0; stderr: ${result.stderr}`);

    // The hook may have created .opencode/project-graph.db. If better-sqlite3
    // is available the file exists and is non-empty; otherwise the hook
    // silently exited without creating it (also acceptable).
    const dbPath = path.join(fixtureRoot, '.opencode', 'project-graph.db');
    if (fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      assert.ok(stat.size > 0, 'project-graph.db must be non-empty when created');
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('graph-indexer hook does not crash on a fixture project with no source files', () => {
  // Edge case: empty repo (e.g., freshly initialised). The hook must not
  // throw or leave the operator with a stack trace.
  const fixtureRoot = mkdtemp('graph-indexer-empty-');
  try {
    const result = spawnSync(process.execPath, [HOOK_PATH], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        OPENKIT_PROJECT_ROOT: fixtureRoot,
        OPENKIT_KIT_ROOT: projectRoot,
        OPENKIT_WORKFLOW_STATE: path.join(fixtureRoot, '.opencode', 'workflow-state.json'),
      },
    });

    assert.equal(result.status, 0, `graph-indexer must exit 0 even on empty repo; stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
