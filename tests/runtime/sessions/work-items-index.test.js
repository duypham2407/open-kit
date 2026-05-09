import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readWorkItemsIndex, migrateWorkItemsIndex,
  addWorkItem, setCurrentSessionId, setWorkItemStatus,
} from '../../../src/runtime/sessions/work-items-index.js';
import { workItemsIndexPath } from '../../../src/runtime/sessions/session-paths.js';

let base;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-widx-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('work-items-index v3', () => {
  it('migrates v2 → v3 idempotently, drops active_work_item_id', () => {
    const v2 = {
      active_work_item_id: 'feature-001',
      work_items: [
        { work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: '.opencode/work-items/feature-001/state.json' },
        { work_item_id: 'feature-002', mode: 'quick', status: 'done', state_path: '.opencode/work-items/feature-002/state.json' },
      ],
    };
    fs.writeFileSync(workItemsIndexPath(base), JSON.stringify(v2));
    migrateWorkItemsIndex(base);
    const v3 = readWorkItemsIndex(base);
    assert.equal(v3.schema, 'openkit/work-items-index@3');
    assert.equal(v3.active_work_item_id, undefined);
    const f1 = v3.work_items.find((w) => w.work_item_id === 'feature-001');
    assert.equal(f1.lane, 'full');
    assert.equal(f1.status, 'orphan');
    assert.equal(f1.current_session_id, null);
    const f2 = v3.work_items.find((w) => w.work_item_id === 'feature-002');
    assert.equal(f2.status, 'done');
    migrateWorkItemsIndex(base);
    assert.equal(readWorkItemsIndex(base).schema, 'openkit/work-items-index@3');
  });

  it('addWorkItem appends with current_session_id', async () => {
    await addWorkItem(base, {
      workItemId: 'full-x', featureSlug: 'x', lane: 'full',
      currentSessionId: 's_abcdef', statePath: '.opencode/work-items/full-x/state.json',
    });
    const idx = readWorkItemsIndex(base);
    assert.equal(idx.work_items[0].current_session_id, 's_abcdef');
    assert.equal(idx.work_items[0].status, 'in_progress');
  });

  it('setCurrentSessionId clears bind', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_abcdef', statePath: 'p' });
    await setCurrentSessionId(base, 'full-x', null);
    const wi = readWorkItemsIndex(base).work_items[0];
    assert.equal(wi.current_session_id, null);
  });

  it('setWorkItemStatus updates status', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_abcdef', statePath: 'p' });
    await setWorkItemStatus(base, 'full-x', 'done');
    assert.equal(readWorkItemsIndex(base).work_items[0].status, 'done');
  });

  it('migrates legacy item with no status field to orphan', () => {
    const v2 = { active_work_item_id: null, work_items: [{ work_item_id: 'feature-old', mode: 'quick', state_path: 'p' }] };
    fs.writeFileSync(workItemsIndexPath(base), JSON.stringify(v2));
    migrateWorkItemsIndex(base);
    const v3 = readWorkItemsIndex(base);
    assert.equal(v3.work_items[0].status, 'orphan');
    assert.equal(v3.work_items[0].lane, 'quick');
  });

  it('addWorkItem refuses duplicate work_item_id', async () => {
    await addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_a', statePath: 'p' });
    await assert.rejects(
      () => addWorkItem(base, { workItemId: 'full-x', featureSlug: 'x', lane: 'full', currentSessionId: 's_b', statePath: 'p' }),
      /duplicate/i,
    );
  });
});
