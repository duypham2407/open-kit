import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { createMcpPlatform } from '../../src/runtime/mcp/index.js';
import { createContextInjection } from '../../src/runtime/context/index.js';
import { createSkillRegistry } from '../../src/runtime/skills/index.js';
import { loadRuntimeCommands } from '../../src/runtime/commands/index.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-runtime-platform-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('runtime foundation exposes categories, specialists, models, and mcp platform', () => {
  const projectRoot = makeTempDir();
  const result = bootstrapRuntimeFoundation({ projectRoot, env: { HOME: makeTempDir() } });

  assert.ok(result.categories.categories.some((entry) => entry.id === 'deep'));
  assert.ok(result.specialists.specialists.some((entry) => entry.id === 'specialist.oracle'));
  assert.ok(result.modelRuntime.resolvedModels.length > 0);
  assert.ok(result.mcpPlatform.builtin.some((entry) => entry.id === 'mcp.websearch'));
});

test('background manager can spawn, complete, and cancel runs', () => {
  const projectRoot = makeTempDir();
  const foundation = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  const run = foundation.managers.backgroundManager.spawn({
    title: 'index codebase',
    payload: { type: 'explore' },
  });

  assert.equal(run, null);

  foundation.managers.backgroundManager.enabled = true;
  const liveRun = foundation.managers.backgroundManager.spawn({
    title: 'index codebase',
    payload: { type: 'explore' },
    workItemId: 'FEATURE-1',
  });
  assert.ok(liveRun.id.startsWith('bg_'));
  foundation.managers.backgroundManager.complete(liveRun.id, { summary: 'done' });
  assert.equal(foundation.managers.backgroundManager.get(liveRun.id).status, 'completed');
  foundation.managers.backgroundManager.cancel(liveRun.id);
  assert.equal(foundation.managers.backgroundManager.get(liveRun.id).status, 'cancelled');
});

test('skill and command loaders discover added runtime surfaces', () => {
  const projectRoot = makeTempDir();
  writeText(path.join(projectRoot, 'README.md'), '# project');
  writeText(path.join(projectRoot, 'AGENTS.md'), '# agents');
  writeText(path.join(projectRoot, 'skills', 'custom-skill', 'SKILL.md'), '# custom-skill');
  writeText(path.join(projectRoot, 'commands', 'init-deep.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'refactor.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'start-work.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'handoff.md'), '# Command');
  writeText(path.join(projectRoot, 'commands', 'stop-continuation.md'), '# Command');

  const skillRegistry = createSkillRegistry({ projectRoot, env: { HOME: makeTempDir() } });
  const commands = loadRuntimeCommands({ projectRoot });
  const context = createContextInjection({ projectRoot, mode: 'full', category: 'deep' });

  assert.ok(skillRegistry.skills.some((entry) => entry.name === 'custom-skill'));
  assert.equal(commands.length, 5);
  assert.equal(context.agentsPath, path.join(projectRoot, 'AGENTS.md'));
  assert.equal(context.readmePath, path.join(projectRoot, 'README.md'));
  assert.equal(context.rules.mode, 'full');
});

test('mcp platform loads builtin mcps and optional config file', () => {
  const projectRoot = makeTempDir();
  writeText(
    path.join(projectRoot, '.mcp.json'),
    JSON.stringify({ token: '${TEST_TOKEN}', servers: ['custom'] })
  );

  const platform = createMcpPlatform({
    projectRoot,
    env: {
      TEST_TOKEN: 'secret',
    },
    config: {
      mcps: {
        builtin: {
          websearch: true,
          docsSearch: false,
        },
      },
    },
  });

  assert.equal(platform.builtin.length, 3);
  assert.equal(platform.loaded.config.token, 'secret');
  assert.deepEqual(platform.enabledBuiltinIds, ['websearch']);
});
