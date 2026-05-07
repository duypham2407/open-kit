import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { normalizeRuntimeProjectRoot } from '../../src/runtime/project-root.js';
import { resolveAutoFallbackState } from '../../src/runtime/recovery/model-fallback.js';

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
  assert.ok(result.capabilities.some((entry) => entry.id === 'capability.syntax-parsing'));
  assert.ok(result.tools.toolFamilies.some((entry) => entry.family === 'session'));
  assert.ok(result.tools.toolFamilies.some((entry) => entry.family === 'syntax'));
  assert.ok(result.tools.toolList.some((entry) => entry.id === 'tool.syntax-outline'));
  assert.ok(result.runtimeInterface.runtimeState.continuation);
  assert.ok(result.runtimeInterface.runtimeState.syntaxIndex);
  assert.equal(result.runtimeInterface.environment.OPENKIT_RUNTIME_FOUNDATION, '1');
  assert.ok(Array.isArray(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_CAPABILITIES)));
  assert.ok(Array.isArray(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_MCPS)));
  assert.equal(JSON.parse(result.runtimeInterface.environment.OPENKIT_RUNTIME_CONFIG_CONTENT).tmux.enabled, true);
});

test('bootstrapRuntimeFoundation exposes caller runtime session id to managers and environment', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      HOME: homeRoot,
      OPENKIT_RUNTIME_SESSION_ID: 'bootstrap-session-a',
    },
  });

  assert.equal(result.managers.sessionProfileManager.sessionId, 'bootstrap-session-a');
  assert.equal(result.runtimeInterface.environment.OPENKIT_RUNTIME_SESSION_ID, 'bootstrap-session-a');
});

test('bootstrapRuntimeFoundation exposes disabled unconfigured supervisor health as non-fatal runtime state', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  const result = bootstrapRuntimeFoundation({
    projectRoot,
    env: {
      HOME: homeRoot,
    },
  });

  const supervisorManager = result.runtimeInterface.managers.find((manager) => manager.id === 'manager.supervisor-dialogue');
  assert.equal(supervisorManager.enabled, false);
  assert.equal(supervisorManager.availability, 'not_configured');
  assert.equal(supervisorManager.validation_surface, 'runtime_tooling');
  assert.equal(result.runtimeInterface.runtimeState.supervisorDialogue.health.status, 'disabled');
  assert.equal(result.runtimeInterface.runtimeState.supervisorDialogue.health.availability, 'not_configured');
  assert.equal(result.runtimeInterface.runtimeState.supervisorDialogue.adapter.transport, 'unconfigured');
  assert.equal(result.runtimeInterface.runtimeState.supervisorDialogue.validation_surface, 'runtime_tooling');
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

test('runtime project-root normalization expands leaked cwd placeholders without using managed runtime roots', () => {
  const projectRoot = fs.realpathSync.native(makeTempDir());
  const managedRuntimeRoot = fs.realpathSync.native(makeTempDir());
  const kitRoot = fs.realpathSync.native(makeTempDir());
  writeText(path.join(projectRoot, 'package.json'), '{"name":"project-root-fixture"}\n');
  writeText(path.join(managedRuntimeRoot, '.opencode', 'workflow-state.json'), '{}\n');

  const result = normalizeRuntimeProjectRoot({
    projectRoot: path.join(path.dirname(projectRoot), '{cwd}'),
    env: {
      OPENKIT_PROJECT_ROOT: path.join(path.dirname(projectRoot), '{cwd}'),
      OPENKIT_REPOSITORY_ROOT: projectRoot,
      OPENKIT_WORKFLOW_STATE: path.join(managedRuntimeRoot, '.opencode', 'workflow-state.json'),
      OPENKIT_KIT_ROOT: kitRoot,
    },
    cwd: managedRuntimeRoot,
  });

  assert.equal(result.projectRoot, projectRoot);
  assert.equal(result.source, 'env.OPENKIT_REPOSITORY_ROOT');
  assert.notEqual(result.projectRoot, managedRuntimeRoot);
  assert.notEqual(result.projectRoot, kitRoot);
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
  assert.equal(oracleResolution.autoFallback.enabled, true);
  assert.equal(oracleResolution.autoFallback.afterFailures, 3);

  const oracleExecution = result.modelRuntime.executionState.find((entry) => entry.subjectId === 'specialist.oracle');
  assert.equal(oracleExecution.shouldUseFallback, false);
  assert.equal(oracleExecution.threshold, 3);
  assert.equal(oracleExecution.activeModel, 'openai/gpt-5.4');
});

test('bootstrapRuntimeFoundation computes execution fallback selection after repeated failures', () => {
  const execution = resolveAutoFallbackState({
    primaryModel: 'openai/gpt-5.4',
    fallbackEntries: [{ model: 'anthropic/claude-sonnet-4-6', variant: 'high' }],
    autoFallback: {
      enabled: true,
      afterFailures: 3,
    },
    failureCount: 3,
  });

  assert.equal(execution.threshold, 3);
  assert.equal(execution.failureCount, 3);
  assert.equal(execution.shouldUseFallback, true);
  assert.equal(execution.activeModel, 'anthropic/claude-sonnet-4-6');
  assert.equal(execution.activeVariant, 'high');
});

test('bootstrapRuntimeFoundation switches to second profile after an action failure and resets after success', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  writeText(
    path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc'),
    `{
      "modelExecution": {
        "quickSwitchProfiles": {
          "enabled": true
        }
      },
      "agents": {
        "specialist.oracle": {
          "profiles": [
            { "model": "openai/gpt-5.4", "variant": "high" },
            { "model": "azure/gpt-5.4", "variant": "high" }
          ]
        }
      }
    }`
  );

  let result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: homeRoot },
  });

  let oracleResolution = result.modelRuntime.resolutions.find((entry) => entry.trace.subjectId === 'specialist.oracle');
  assert.equal(oracleResolution.model, 'openai/gpt-5.4');
  assert.equal(oracleResolution.selectedProfileIndex, 0);

  result.managers.actionModelStateManager.recordFailure({
    subjectId: 'specialist.oracle',
    actionKey: 'specialist:specialist.oracle',
    detail: 'provider timeout',
  });

  result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: homeRoot },
  });
  oracleResolution = result.modelRuntime.resolutions.find((entry) => entry.trace.subjectId === 'specialist.oracle');
  assert.equal(oracleResolution.model, 'azure/gpt-5.4');
  assert.equal(oracleResolution.selectedProfileIndex, 1);

  result.managers.actionModelStateManager.recordSuccess({
    subjectId: 'specialist.oracle',
    actionKey: 'specialist:specialist.oracle',
  });

  result = bootstrapRuntimeFoundation({
    projectRoot,
    env: { HOME: homeRoot },
  });
  oracleResolution = result.modelRuntime.resolutions.find((entry) => entry.trace.subjectId === 'specialist.oracle');
  assert.equal(oracleResolution.model, 'openai/gpt-5.4');
  assert.equal(oracleResolution.selectedProfileIndex, 0);
});
