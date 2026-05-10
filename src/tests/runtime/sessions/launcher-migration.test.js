import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateOnStart, _resetWarnedForTests } from '../../../runtime/sessions/migrate-on-start.js';

let repo;
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-launch-mig-'));
  fs.mkdirSync(path.join(repo, '.opencode/work-items'), { recursive: true });
  _resetWarnedForTests();
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('launcher migration integration', () => {
  it('end-to-end: pre-existing v2 install gets migrated', async () => {
    fs.writeFileSync(path.join(repo, '.opencode/work-items/index.json'), JSON.stringify({
      active_work_item_id: 'feature-001',
      work_items: [{ work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: 'p' }],
    }));
    fs.writeFileSync(path.join(repo, '.opencode/workflow-state.json'), JSON.stringify({ stage: 'full_implementation' }));

    await migrateOnStart({
      baseDir: path.join(repo, '.opencode'),
      listWorktrees: () => [],
    });

    const idx = JSON.parse(fs.readFileSync(path.join(repo, '.opencode/work-items/index.json'), 'utf8'));
    assert.equal(idx.schema, 'openkit/work-items-index@3');
    assert.ok(fs.existsSync(path.join(repo, '.opencode/sessions/index.json')));

    const stub = JSON.parse(fs.readFileSync(path.join(repo, '.opencode/workflow-state.json'), 'utf8'));
    assert.equal(stub.schema, 'openkit/legacy-stub@1');
  });
});
