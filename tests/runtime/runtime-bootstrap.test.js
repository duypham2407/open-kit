import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-runtime-bootstrap-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('bootstrapRuntimeFoundation builds config, capabilities, managers, tools, hooks, and env metadata', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "backgroundTask": { "enabled": true },
      "notifications": { "enabled": true },
      "tmux": { "enabled": true, "layout": "main-vertical" }
    }`
  );

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      HOME: homeRoot,
    },
  });

  assert.equal(result.configResult.config.backgroundTask.enabled, true);
  assert.ok(result.capabilities.some((entry) => entry.id === 'capability.runtime-bootstrap'));
  assert.equal(result.managers.managers['manager.background'].enabled, true);
  assert.equal(result.managers.managers['manager.notifications'].enabled, true);
  assert.equal(result.managers.managers['manager.tmux'].enabled, true);
  assert.ok(result.tools.toolList.some((entry) => entry.id === 'tool.workflow-state'));
  assert.ok(result.hooks.hookList.some((entry) => entry.id === 'hook.resume-context'));
  assert.ok(result.categories.categories.some((entry) => entry.id === 'deep'));
  assert.ok(result.specialists.specialists.some((entry) => entry.id === 'specialist.oracle'));
  assert.equal(Array.isArray(result.skills.skills), true);
  assert.equal(Array.isArray(result.commands), true);
  assert.ok(result.mcpPlatform.builtin.some((entry) => entry.id === 'mcp.websearch'));
  assert.equal(result.runtimeInterface.environment.OPENKIT_RUNTIME_FOUNDATION, '1');
  assert.ok(Array.isArray(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_CAPABILITIES)));
  assert.ok(Array.isArray(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_MCPS)));
  assert.equal(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_CONFIG_CONTENT).tmux.enabled, true);
});
