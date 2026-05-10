import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downgradeIndex } from '../../../runtime/sessions/downgrade-index.js';
import { workItemsIndexPath, legacyMirrorPath } from '../../../runtime/sessions/session-paths.js';
import { WORK_ITEMS_INDEX_SCHEMA_V3 } from '../../../runtime/sessions/constants.js';

let base;
let logger;

function makeLogger() {
  const warnings = [];
  return {
    warnings,
    warn: (msg) => warnings.push(msg),
  };
}

function writeV3Index(workItems) {
  fs.mkdirSync(path.dirname(workItemsIndexPath(base)), { recursive: true });
  fs.writeFileSync(
    workItemsIndexPath(base),
    `${JSON.stringify({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: workItems }, null, 2)}\n`,
  );
}

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-downgrade-'));
  logger = makeLogger();
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('downgradeIndex', () => {
  it('v3 with one in_progress → v2 with active_work_item_id set, no schema field', async () => {
    writeV3Index([
      {
        work_item_id: 'feature-001',
        feature_id: 'F1',
        feature_slug: 'one',
        lane: 'full',
        status: 'in_progress',
        current_session_id: 's_abc123',
        state_path: '.opencode/work-items/feature-001/state.json',
        created_at: '2026-05-09T10:00:00.000Z',
      },
      {
        work_item_id: 'feature-002',
        feature_id: 'F2',
        feature_slug: 'two',
        lane: 'quick',
        status: 'done',
        current_session_id: null,
        state_path: '.opencode/work-items/feature-002/state.json',
        created_at: '2026-05-09T09:00:00.000Z',
      },
    ]);

    const result = await downgradeIndex({ baseDir: base, logger });

    const written = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.equal(written.schema, undefined, 'v3 schema field must be dropped');
    assert.equal(written.active_work_item_id, 'feature-001');
    assert.equal(written.work_items.length, 2);

    const f1 = written.work_items.find((w) => w.work_item_id === 'feature-001');
    assert.equal(f1.mode, 'full', 'lane must be re-emitted as mode');
    assert.equal(f1.feature_slug, 'one');
    assert.equal(f1.feature_id, 'F1');
    assert.equal(f1.state_path, '.opencode/work-items/feature-001/state.json');
    assert.equal(f1.lane, undefined, 'lane must be stripped');
    assert.equal(f1.current_session_id, undefined, 'current_session_id must be stripped');
    assert.equal(f1.status, undefined, 'v3 status must be stripped');

    assert.equal(result.activeWorkItemId, 'feature-001');
    assert.equal(result.workItemCount, 2);
    assert.equal(result.restoredLegacyMirror, null);
    assert.ok(logger.warnings.length >= 1, 'a warning must be emitted');
    assert.match(logger.warnings[0], /lossy|inconsistent|per-session/i);
  });

  it('v3 with all done → v2 without active_work_item_id', async () => {
    writeV3Index([
      {
        work_item_id: 'feature-001',
        feature_id: 'F1',
        feature_slug: 'one',
        lane: 'full',
        status: 'done',
        current_session_id: null,
        state_path: 'p1',
        created_at: '2026-05-09T10:00:00.000Z',
      },
      {
        work_item_id: 'feature-002',
        feature_id: 'F2',
        feature_slug: 'two',
        lane: 'quick',
        status: 'done',
        current_session_id: null,
        state_path: 'p2',
        created_at: '2026-05-09T09:00:00.000Z',
      },
    ]);

    const result = await downgradeIndex({ baseDir: base, logger });

    const written = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.equal(written.schema, undefined);
    assert.ok(
      !('active_work_item_id' in written),
      'active_work_item_id must be omitted when no in_progress item exists',
    );
    assert.equal(written.work_items.length, 2);
    assert.equal(result.activeWorkItemId, null);
  });

  it('omits active_work_item_id when only orphan/abandoned items exist (no in_progress)', async () => {
    writeV3Index([
      {
        work_item_id: 'feature-001',
        feature_id: null,
        feature_slug: 'one',
        lane: 'full',
        status: 'orphan',
        current_session_id: null,
        state_path: 'p1',
        created_at: '2026-05-09T10:00:00.000Z',
      },
      {
        work_item_id: 'feature-002',
        feature_id: null,
        feature_slug: 'two',
        lane: 'quick',
        status: 'abandoned',
        current_session_id: null,
        state_path: 'p2',
        created_at: '2026-05-09T09:00:00.000Z',
      },
    ]);

    const result = await downgradeIndex({ baseDir: base, logger });

    const written = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.ok(!('active_work_item_id' in written));
    assert.equal(result.activeWorkItemId, null);
  });

  it('picks the first in_progress item when multiple exist', async () => {
    writeV3Index([
      { work_item_id: 'a', feature_slug: 'a', lane: 'full', status: 'done', current_session_id: null, state_path: 'pa' },
      { work_item_id: 'b', feature_slug: 'b', lane: 'full', status: 'in_progress', current_session_id: 's_b', state_path: 'pb' },
      { work_item_id: 'c', feature_slug: 'c', lane: 'full', status: 'in_progress', current_session_id: 's_c', state_path: 'pc' },
    ]);

    const result = await downgradeIndex({ baseDir: base, logger });
    assert.equal(result.activeWorkItemId, 'b');
    const written = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.equal(written.active_work_item_id, 'b');
  });

  it('handles empty v3 index (no work items)', async () => {
    writeV3Index([]);

    const result = await downgradeIndex({ baseDir: base, logger });

    const written = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.equal(written.schema, undefined);
    assert.ok(!('active_work_item_id' in written));
    assert.deepEqual(written.work_items, []);
    assert.equal(result.workItemCount, 0);
  });

  it('restores the most recent workflow-state.json.legacy.* if present', async () => {
    writeV3Index([]);
    const stamp = '2026-05-09T10-00-00-000Z';
    const legacyName = `workflow-state.json.legacy.${stamp}`;
    const legacyFull = path.join(base, legacyName);
    const legacyContent = JSON.stringify({ stage: 'restored', tick: 42 });
    fs.writeFileSync(legacyFull, legacyContent);

    const result = await downgradeIndex({ baseDir: base, logger });

    assert.equal(result.restoredLegacyMirror, legacyFull);
    const restored = fs.readFileSync(legacyMirrorPath(base), 'utf8');
    assert.equal(restored, legacyContent);
    // Source legacy file is preserved (we copy, not move).
    assert.equal(fs.existsSync(legacyFull), true);
  });

  it('with multiple legacy mirrors, picks the latest by ISO-stamped name', async () => {
    writeV3Index([]);
    const older = path.join(base, 'workflow-state.json.legacy.2026-05-09T10-00-00-000Z');
    const middle = path.join(base, 'workflow-state.json.legacy.2026-05-09T11-00-00-000Z');
    const newer = path.join(base, 'workflow-state.json.legacy.2026-05-09T12-00-00-000Z');
    fs.writeFileSync(older, JSON.stringify({ tick: 1 }));
    fs.writeFileSync(middle, JSON.stringify({ tick: 2 }));
    fs.writeFileSync(newer, JSON.stringify({ tick: 3 }));

    const result = await downgradeIndex({ baseDir: base, logger });

    assert.equal(result.restoredLegacyMirror, newer);
    const restored = JSON.parse(fs.readFileSync(legacyMirrorPath(base), 'utf8'));
    assert.equal(restored.tick, 3);
  });

  it('no legacy mirrors present → restoredLegacyMirror is null and no top-level workflow-state.json is created', async () => {
    writeV3Index([]);

    const result = await downgradeIndex({ baseDir: base, logger });

    assert.equal(result.restoredLegacyMirror, null);
    assert.equal(fs.existsSync(legacyMirrorPath(base)), false);
  });

  it('overwrites an existing workflow-state.json with the restored legacy mirror', async () => {
    writeV3Index([]);
    fs.writeFileSync(legacyMirrorPath(base), JSON.stringify({ schema: 'openkit/legacy-stub@1' }));
    const legacyFull = path.join(base, 'workflow-state.json.legacy.2026-05-09T13-00-00-000Z');
    fs.writeFileSync(legacyFull, JSON.stringify({ tick: 99 }));

    const result = await downgradeIndex({ baseDir: base, logger });

    assert.equal(result.restoredLegacyMirror, legacyFull);
    const restored = JSON.parse(fs.readFileSync(legacyMirrorPath(base), 'utf8'));
    assert.equal(restored.tick, 99);
  });

  it('falls back to mode if a legacy v3 entry has mode but no lane', async () => {
    // Defensive: a hand-edited or partially migrated index may have `mode`
    // alongside missing `lane`. The downgrade should still re-emit `mode`.
    fs.mkdirSync(path.dirname(workItemsIndexPath(base)), { recursive: true });
    fs.writeFileSync(
      workItemsIndexPath(base),
      JSON.stringify({
        schema: WORK_ITEMS_INDEX_SCHEMA_V3,
        work_items: [
          { work_item_id: 'x', feature_slug: 'x', mode: 'quick', status: 'done', state_path: 'p' },
        ],
      }),
    );

    await downgradeIndex({ baseDir: base, logger });
    const written = JSON.parse(fs.readFileSync(workItemsIndexPath(base), 'utf8'));
    assert.equal(written.work_items[0].mode, 'quick');
  });

  it('emits a warning describing what was lost', async () => {
    writeV3Index([
      { work_item_id: 'a', feature_slug: 'a', lane: 'full', status: 'in_progress', current_session_id: 's_a', state_path: 'pa' },
    ]);

    await downgradeIndex({ baseDir: base, logger });

    assert.equal(logger.warnings.length, 1);
    const msg = logger.warnings[0];
    assert.match(msg, /per-session state/i);
    assert.match(msg, /inconsistent|multiple sessions/i);
  });

  it('uses console.warn when no logger is provided (smoke test)', async () => {
    writeV3Index([]);

    const original = console.warn;
    const captured = [];
    console.warn = (m) => captured.push(m);
    try {
      await downgradeIndex({ baseDir: base });
    } finally {
      console.warn = original;
    }

    assert.ok(captured.length >= 1);
  });
});
