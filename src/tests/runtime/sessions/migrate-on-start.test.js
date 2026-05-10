import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateOnStart, _resetWarnedForTests } from '../../../runtime/sessions/migrate-on-start.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-mig-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  _resetWarnedForTests();
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('migrate-on-start', () => {
  it('creates sessions/ dir, migrates v2 index, rotates legacy mirror', async () => {
    fs.writeFileSync(path.join(base, 'work-items/index.json'), JSON.stringify({
      active_work_item_id: 'feature-001',
      work_items: [{ work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: 'p' }],
    }));
    fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'full_implementation' }));
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    assert.ok(fs.existsSync(path.join(base, 'sessions')));
    const idx = JSON.parse(fs.readFileSync(path.join(base, 'work-items/index.json'), 'utf8'));
    assert.equal(idx.schema, 'openkit/work-items-index@3');
    assert.equal(idx.active_work_item_id, undefined);
    const stub = JSON.parse(fs.readFileSync(path.join(base, 'workflow-state.json'), 'utf8'));
    assert.equal(stub.schema, 'openkit/legacy-stub@1');
  });

  it('is idempotent on already-v3 layout', async () => {
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    const idx = JSON.parse(fs.readFileSync(path.join(base, 'work-items/index.json'), 'utf8'));
    assert.equal(idx.schema, 'openkit/work-items-index@3');
  });

  it('emits warning once per process', async () => {
    fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'x' }));
    const logs = [];
    await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });
    assert.equal(logs.filter((l) => /OK1234/.test(l)).length, 1);
    // Second run rotates again (because file is non-stub each call after manual write); warning should still only fire once total per process
    fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'y' }));
    await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });
    assert.equal(logs.filter((l) => /OK1234/.test(l)).length, 1);
  });

  it('creates sessions/index.json on fresh install', async () => {
    await migrateOnStart({ baseDir: base, listWorktrees: () => [] });
    assert.ok(fs.existsSync(path.join(base, 'sessions', 'index.json')));
    const sidx = JSON.parse(fs.readFileSync(path.join(base, 'sessions', 'index.json'), 'utf8'));
    assert.equal(sidx.schema, 'openkit/sessions-index@1');
    assert.deepEqual(sidx.sessions, []);
  });
});
