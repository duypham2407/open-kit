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
  assert.ok(result.capabilities.some((entry) => entry.id === 'capability.session-tooling'));
  assert.ok(result.capabilities.some((entry) => entry.id === 'capability.continuation-control'));
  assert.ok(result.tools.toolFamilies.some((entry) => entry.family === 'session'));
  assert.ok(result.runtimeInterface.runtimeState.continuation);
  assert.equal(result.runtimeInterface.environment.OPENKIT_RUNTIME_FOUNDATION, '1');
  assert.ok(Array.isArray(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_CAPABILITIES)));
  assert.ok(Array.isArray(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_MCPS)));
  assert.equal(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_CONFIG_CONTENT).tmux.enabled, true);
});

test('bootstrapRuntimeFoundation read-only mode does not materialize background runtime state', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      HOME: homeRoot,
    },
    mode: 'read-only',
  });

  assert.equal(result.managers.managers['manager.background'].enabled, false);
  assert.equal(fs.existsSync(path.join(projectRoot, '.opencode')), false);
});

test('bootstrapRuntimeFoundation applies category and specialist overrides with model-resolution trace', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "disabled": {
        "categories": ["writing"],
        "agents": ["specialist.explore"]
      },
      "categories": {
        "deep": {
          "model": "anthropic/claude-opus-4-6",
          "fallback_models": [
            "openai/gpt-5.4",
            { "model": "google/gemini-3.1-pro", "variant": "high" }
          ],
          "prompt_append": "Favor parity-preserving investigation."
        }
      },
      "agents": {
        "specialist.oracle": {
          "model": "openai/gpt-5.4",
          "fallback_models": [
            { "model": "anthropic/claude-sonnet-4-6", "variant": "high" }
          ],
          "prompt_append": "Stay read-only and architecture-focused.",
          "reasoningEffort": "high"
        }
      }
    }`
  );

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: homeRoot },
  });

  assert.equal(result.categories.categories.some((entry) => entry.id === 'writing'), false);
  assert.equal(result.specialists.specialists.some((entry) => entry.id === 'specialist.explore'), false);

  const deepTrace = result.modelRuntime.resolutionTrace.find((entry) => entry.subjectId === 'deep');
  assert.equal(deepTrace.resolvedModel, 'anthropic/claude-opus-4-6');
  assert.equal(deepTrace.selectedFrom, 'category-config');
  assert.equal(deepTrace.fallbackEntries.length, 2);

  const oracleResolution = result.modelRuntime.resolutions.find((entry) => entry.trace.subjectId === 'specialist.oracle');
  assert.equal(oracleResolution.model, 'openai/gpt-5.4');
  assert.equal(oracleResolution.promptAppend, 'Stay read-only and architecture-focused.');
  assert.equal(oracleResolution.reasoningEffort, 'high');
  assert.deepEqual(oracleResolution.fallbackModels, ['anthropic/claude-sonnet-4-6']);
});
