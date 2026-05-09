import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { ensureWorkspaceShim } from '../../src/global/workspace-shim.js';

function makeFakePaths(root) {
  const opencodeHome = path.join(root, 'oc-home');
  const kitRoot = path.join(opencodeHome, 'kits', 'openkit');
  const workspaceRoot = path.join(opencodeHome, 'workspaces', 'wsX', 'openkit');
  const opencodeDir = path.join(workspaceRoot, '.opencode');
  const projectRoot = path.join(root, 'project');

  fs.mkdirSync(kitRoot, { recursive: true });
  fs.writeFileSync(path.join(kitRoot, 'AGENTS.md'), '# Test', 'utf8');
  fs.mkdirSync(path.join(kitRoot, 'context'), { recursive: true });
  fs.mkdirSync(path.join(kitRoot, 'docs', 'templates'), { recursive: true });
  fs.mkdirSync(opencodeDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.opencode'), { recursive: true });

  return {
    projectRoot,
    workspaceRoot,
    workspaceShimDir: path.join(projectRoot, '.opencode', 'openkit'),
    workspaceShimContextDir: path.join(projectRoot, '.opencode', 'openkit', 'context'),
    workspaceShimTemplatesDir: path.join(projectRoot, '.opencode', 'openkit', 'docs', 'templates'),
    workspaceShimAgentsPath: path.join(projectRoot, '.opencode', 'openkit', 'AGENTS.md'),
    workspaceShimWorkflowStatePath: path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.json'),
    workspaceShimWorkflowCliPath: path.join(projectRoot, '.opencode', 'openkit', 'workflow-state.js'),
    workspaceShimWorkItemsDir: path.join(projectRoot, '.opencode', 'openkit', 'work-items'),
    kitRoot,
    workflowStatePath: path.join(opencodeDir, 'workflow-state.json'),
    workItemsDir: path.join(opencodeDir, 'work-items'),
  };
}

test('shim does not crash when workspace state does not exist yet', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-fresh-'));
  const paths = makeFakePaths(root);

  // Should not throw
  ensureWorkspaceShim(paths);

  // Shim dir was created
  assert.ok(fs.existsSync(paths.workspaceShimDir), '.opencode/openkit/ should exist');
  assert.ok(fs.existsSync(paths.workspaceShimAgentsPath), 'AGENTS.md shim should exist');
  // workflow-state.json mirror should NOT exist yet (no source to copy from)
  // — but the absence should not be an error
});

test('shim re-run after state is created syncs the mirror', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-resync-'));
  const paths = makeFakePaths(root);
  ensureWorkspaceShim(paths);

  // Simulate MO bootstrap by writing the workspace state
  fs.writeFileSync(
    paths.workflowStatePath,
    JSON.stringify({ mode: 'quick', current_stage: 'quick_intake' }, null, 2)
  );

  ensureWorkspaceShim(paths);

  assert.ok(fs.existsSync(paths.workspaceShimWorkflowStatePath), 'mirror should be created on second run');
  const synced = JSON.parse(fs.readFileSync(paths.workspaceShimWorkflowStatePath, 'utf8'));
  assert.equal(synced.mode, 'quick');
  assert.equal(synced.current_stage, 'quick_intake');
});
