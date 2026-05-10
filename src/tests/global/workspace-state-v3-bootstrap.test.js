import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { ensureWorkspaceBootstrap } from '../../global/workspace-state.js';
import { WORK_ITEMS_INDEX_SCHEMA_V3 } from '../../runtime/sessions/constants.js';

function makeFreshHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wsv3-'));
  const opencodeHome = path.join(root, 'oc-home');
  const kitRoot = path.join(opencodeHome, 'kits', 'openkit');
  const projectRoot = path.join(root, 'project');

  // Minimum kit scaffolding so the workspace shim doesn't blow up.
  fs.mkdirSync(kitRoot, { recursive: true });
  fs.writeFileSync(path.join(kitRoot, 'AGENTS.md'), '# Test', 'utf8');
  fs.mkdirSync(path.join(kitRoot, 'context'), { recursive: true });
  fs.mkdirSync(path.join(kitRoot, 'docs', 'templates'), { recursive: true });

  fs.mkdirSync(path.join(projectRoot, '.opencode'), { recursive: true });

  return { root, opencodeHome, projectRoot };
}

test('ensureWorkspaceBootstrap writes work-items/index.json with v3 schema', () => {
  const { opencodeHome, projectRoot } = makeFreshHome();

  const result = ensureWorkspaceBootstrap({
    projectRoot,
    env: { OPENCODE_HOME: opencodeHome },
    platform: 'linux',
    homedir: opencodeHome,
  });

  assert.ok(fs.existsSync(result.workItemIndexPath), 'work-items/index.json should be written');

  const idx = JSON.parse(fs.readFileSync(result.workItemIndexPath, 'utf8'));
  assert.equal(idx.schema, WORK_ITEMS_INDEX_SCHEMA_V3, 'fresh workspace should bootstrap v3 schema');
  assert.deepEqual(idx.work_items, [], 'fresh workspace should have no work items');
  assert.equal(
    Object.prototype.hasOwnProperty.call(idx, 'active_work_item_id'),
    false,
    'v3 bootstrap must not write active_work_item_id',
  );
});

test('shouldHydrateWorkspaceFromProject treats v3 work_items: [] as empty regardless of active_work_item_id', () => {
  const { opencodeHome, projectRoot } = makeFreshHome();

  // Seed a legacy project-side state to trigger the hydrate path.
  const legacyDir = path.join(projectRoot, '.opencode');
  fs.mkdirSync(path.join(legacyDir, 'work-items'), { recursive: true });
  fs.writeFileSync(
    path.join(legacyDir, 'workflow-state.json'),
    JSON.stringify({ mode: 'quick', current_stage: 'quick_intake' }, null, 2),
  );
  fs.writeFileSync(
    path.join(legacyDir, 'work-items', 'index.json'),
    JSON.stringify({ schema: WORK_ITEMS_INDEX_SCHEMA_V3, work_items: [] }, null, 2),
  );

  const result = ensureWorkspaceBootstrap({
    projectRoot,
    env: { OPENCODE_HOME: opencodeHome },
    platform: 'linux',
    homedir: opencodeHome,
  });

  // The hydration should have copied the legacy mirror into the workspace.
  const hydrated = JSON.parse(fs.readFileSync(result.workflowStatePath, 'utf8'));
  assert.equal(hydrated.mode, 'quick');
  assert.equal(hydrated.current_stage, 'quick_intake');
});
