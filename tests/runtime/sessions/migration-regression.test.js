import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  migrateWorkItemsIndex,
  readWorkItemsIndex,
} from '../../../src/runtime/sessions/work-items-index.js';
import { rotateLegacyMirror } from '../../../src/runtime/sessions/legacy-mirror-rotator.js';
import {
  migrateOnStart,
  _resetWarnedForTests,
} from '../../../src/runtime/sessions/migrate-on-start.js';
import {
  workItemsIndexPath,
  legacyMirrorPath,
  sessionsIndexPath,
} from '../../../src/runtime/sessions/session-paths.js';
import {
  WORK_ITEMS_INDEX_SCHEMA_V3,
  SESSIONS_INDEX_SCHEMA,
  LEGACY_STUB_SCHEMA,
  LEGACY_MIRROR_ROTATE_KEEP,
} from '../../../src/runtime/sessions/constants.js';

/**
 * Regression suite: verify v2 → v3 migration is idempotent and that
 * legacy-mirror rotation behaves correctly across many runs.
 *
 * This test exists to catch regressions if:
 *   - the v2 → v3 mapping shape changes,
 *   - the rotator stops capping files,
 *   - migrate-on-start drops a step,
 *   - a re-run accidentally re-rotates the stub or re-migrates a v3 index.
 */

let base;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'ok-migreg-'));
  fs.mkdirSync(path.join(base, 'work-items'), { recursive: true });
  _resetWarnedForTests();
});

afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe('migration regression', () => {
  describe('v2 → v3 work-items index', () => {
    it('idempotent: running migrateWorkItemsIndex three times leaves a stable v3 file', () => {
      const v2 = {
        active_work_item_id: 'feature-A',
        work_items: [
          { work_item_id: 'feature-A', mode: 'full', status: 'in_progress', state_path: 'p1' },
          { work_item_id: 'feature-B', mode: 'quick', status: 'done', state_path: 'p2' },
          { work_item_id: 'feature-C', mode: 'migration', state_path: 'p3' },
        ],
      };
      fs.writeFileSync(workItemsIndexPath(base), JSON.stringify(v2));

      migrateWorkItemsIndex(base);
      const after1 = fs.readFileSync(workItemsIndexPath(base), 'utf8');
      migrateWorkItemsIndex(base);
      const after2 = fs.readFileSync(workItemsIndexPath(base), 'utf8');
      migrateWorkItemsIndex(base);
      const after3 = fs.readFileSync(workItemsIndexPath(base), 'utf8');
      assert.equal(after1, after2);
      assert.equal(after2, after3);

      const idx = readWorkItemsIndex(base);
      assert.equal(idx.schema, WORK_ITEMS_INDEX_SCHEMA_V3);
      assert.equal(idx.active_work_item_id, undefined);
      assert.equal(idx.work_items.length, 3);
      const a = idx.work_items.find((w) => w.work_item_id === 'feature-A');
      assert.equal(a.lane, 'full');
      assert.equal(a.status, 'orphan'); // in_progress → orphan in v2 → v3
      assert.equal(a.current_session_id, null);
      const b = idx.work_items.find((w) => w.work_item_id === 'feature-B');
      assert.equal(b.lane, 'quick');
      assert.equal(b.status, 'done'); // done is preserved
      const c = idx.work_items.find((w) => w.work_item_id === 'feature-C');
      assert.equal(c.lane, 'migration');
    });

    it('preserves done and abandoned statuses; converts everything else to orphan', () => {
      fs.writeFileSync(workItemsIndexPath(base), JSON.stringify({
        active_work_item_id: null,
        work_items: [
          { work_item_id: 'd1', mode: 'quick', status: 'done', state_path: 'p' },
          { work_item_id: 'a1', mode: 'quick', status: 'abandoned', state_path: 'p' },
          { work_item_id: 'p1', mode: 'quick', status: 'planned', state_path: 'p' },
          { work_item_id: 'i1', mode: 'quick', status: 'in_progress', state_path: 'p' },
        ],
      }));
      migrateWorkItemsIndex(base);
      const idx = readWorkItemsIndex(base);
      const map = Object.fromEntries(idx.work_items.map((w) => [w.work_item_id, w.status]));
      assert.equal(map.d1, 'done');
      assert.equal(map.a1, 'abandoned');
      assert.equal(map.p1, 'orphan');
      assert.equal(map.i1, 'orphan');
    });

    it('seeds an empty v3 index when work-items file is missing', () => {
      // No file initially.
      assert.equal(fs.existsSync(workItemsIndexPath(base)), false);
      migrateWorkItemsIndex(base);
      const idx = readWorkItemsIndex(base);
      assert.equal(idx.schema, WORK_ITEMS_INDEX_SCHEMA_V3);
      assert.deepEqual(idx.work_items, []);
    });

    it('does not re-migrate an already-v3 file (byte-stable)', () => {
      fs.writeFileSync(workItemsIndexPath(base), JSON.stringify({
        schema: WORK_ITEMS_INDEX_SCHEMA_V3,
        work_items: [
          { work_item_id: 'x', feature_id: null, feature_slug: 'x', lane: 'full',
            status: 'in_progress', current_session_id: 's_abcdef',
            state_path: 'p', created_at: '2026-05-09T00:00:00.000Z' },
        ],
      }));
      const before = fs.readFileSync(workItemsIndexPath(base), 'utf8');
      migrateWorkItemsIndex(base);
      migrateWorkItemsIndex(base);
      const after = fs.readFileSync(workItemsIndexPath(base), 'utf8');
      assert.equal(after, before);
    });
  });

  describe('legacy mirror rotation', () => {
    it('rotates a non-stub mirror to a .legacy.<ts> file and leaves a stub behind', () => {
      const file = legacyMirrorPath(base);
      fs.writeFileSync(file, JSON.stringify({ stage: 'full_implementation' }));
      const r = rotateLegacyMirror(base);
      assert.equal(r.rotated, true);
      const stub = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(stub.schema, LEGACY_STUB_SCHEMA);
      const legacies = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
      assert.equal(legacies.length, 1);
    });

    it('does not rotate a stub a second time', () => {
      const file = legacyMirrorPath(base);
      fs.writeFileSync(file, JSON.stringify({ schema: LEGACY_STUB_SCHEMA }));
      const r1 = rotateLegacyMirror(base);
      const r2 = rotateLegacyMirror(base);
      assert.equal(r1.rotated, false);
      assert.equal(r2.rotated, false);
      const legacies = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
      assert.equal(legacies.length, 0);
    });

    it('caps rotated files at LEGACY_MIRROR_ROTATE_KEEP across many rotations', async () => {
      const file = legacyMirrorPath(base);
      for (let i = 0; i < 15; i++) {
        fs.writeFileSync(file, JSON.stringify({ tick: i }));
        rotateLegacyMirror(base);
        await new Promise((r) => setTimeout(r, 5));
      }
      const legacies = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
      assert.ok(
        legacies.length <= LEGACY_MIRROR_ROTATE_KEEP,
        `expected at most ${LEGACY_MIRROR_ROTATE_KEEP} legacy files, got ${legacies.length}`,
      );
    });

    it('drops the oldest legacies first when capping', async () => {
      const file = legacyMirrorPath(base);
      const created = [];
      for (let i = 0; i < 12; i++) {
        fs.writeFileSync(file, JSON.stringify({ tick: i }));
        const r = rotateLegacyMirror(base);
        if (r.rotated) created.push(path.basename(r.target));
        await new Promise((r) => setTimeout(r, 12));
      }
      const remaining = new Set(
        fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.')),
      );
      // The first two created files should have been pruned.
      assert.equal(remaining.has(created[0]), false, 'oldest must be pruned');
      assert.equal(remaining.has(created[1]), false, 'second-oldest must be pruned');
      // The two most recent must be retained.
      assert.equal(remaining.has(created[created.length - 1]), true);
      assert.equal(remaining.has(created[created.length - 2]), true);
    });

    it('handles a missing legacy mirror as a no-op', () => {
      const r = rotateLegacyMirror(base);
      assert.equal(r.rotated, false);
    });
  });

  describe('migrate-on-start full regression', () => {
    it('runs all migration steps in order and is idempotent on rerun', async () => {
      // Simulate a freshly-upgraded project in a v2 layout.
      fs.writeFileSync(path.join(base, 'work-items/index.json'), JSON.stringify({
        active_work_item_id: 'feature-001',
        work_items: [
          { work_item_id: 'feature-001', mode: 'full', status: 'in_progress', state_path: 'p' },
        ],
      }));
      fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'full_implementation' }));

      const logs = [];
      await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });

      // sessions dir + index seeded.
      assert.ok(fs.existsSync(sessionsIndexPath(base)));
      const sidx = JSON.parse(fs.readFileSync(sessionsIndexPath(base), 'utf8'));
      assert.equal(sidx.schema, SESSIONS_INDEX_SCHEMA);

      // work-items migrated to v3.
      const widx = readWorkItemsIndex(base);
      assert.equal(widx.schema, WORK_ITEMS_INDEX_SCHEMA_V3);

      // legacy mirror rotated → stub left behind, one .legacy.<ts> file present.
      const stub = JSON.parse(fs.readFileSync(path.join(base, 'workflow-state.json'), 'utf8'));
      assert.equal(stub.schema, LEGACY_STUB_SCHEMA);
      const legacies1 = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
      assert.equal(legacies1.length, 1);

      // OK1234 warning fired exactly once.
      assert.equal(logs.filter((l) => /OK1234/.test(l)).length, 1);

      // Second run is a no-op — stub stays a stub, no new legacies, no new warnings.
      await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });
      const legacies2 = fs.readdirSync(base).filter((n) => n.startsWith('workflow-state.json.legacy.'));
      assert.equal(legacies2.length, 1);
      assert.equal(logs.filter((l) => /OK1234/.test(l)).length, 1);
    });

    it('emits OK1234 once per process even when a non-stub mirror reappears', async () => {
      const logs = [];
      fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'a' }));
      await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });
      // Manually replace the stub with a non-stub again — simulates a buggy
      // tool re-writing the legacy mirror after migration.
      fs.writeFileSync(path.join(base, 'workflow-state.json'), JSON.stringify({ stage: 'b' }));
      await migrateOnStart({ baseDir: base, listWorktrees: () => [], warn: (m) => logs.push(m) });
      assert.equal(logs.filter((l) => /OK1234/.test(l)).length, 1);
    });
  });
});
