import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadRuntimeConfig } from '../../src/runtime/runtime-config-loader.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-runtime-config-'));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('loadRuntimeConfig returns defaults when no runtime config files exist', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();

  const result = loadRuntimeConfig({
    projectRoot,
    env: {
      HOME: homeRoot,
    },
  });

  assert.equal(result.projectConfigPath, null);
  assert.equal(result.userConfigPath, null);
  assert.equal(result.config.runtime.enabled, true);
  assert.equal(result.config.browserAutomation.provider, 'playwright');
  assert.equal(result.config.backgroundTask.enabled, false);
});

test('loadRuntimeConfig merges user and project JSONC with project precedence', () => {
  const projectRoot = makeTempDir();
  const homeRoot = makeTempDir();
  const userConfigPath = path.join(homeRoot, '.config', 'opencode', 'openkit.runtime.jsonc');
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    userConfigPath,
    `{
      // user defaults
      "backgroundTask": {
        "enabled": true,
        "providerConcurrency": {
          "anthropic": 2,
        },
      },
      "notifications": {
        "enabled": true,
      },
      "disabled": {
        "tools": ["tool.background-task"],
      },
    }`
  );

  writeText(
    projectConfigPath,
    `{
      "backgroundTask": {
        "modelConcurrency": {
          "openai/gpt-5.4": 4,
        },
      },
      "browserAutomation": {
        "provider": "playwright-cli",
      },
      "experimental": {
        "taskSystem": true,
      },
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: {
      HOME: homeRoot,
    },
  });

  assert.equal(result.userConfigPath, userConfigPath);
  assert.equal(result.projectConfigPath, projectConfigPath);
  assert.equal(result.config.backgroundTask.enabled, true);
  assert.equal(result.config.backgroundTask.providerConcurrency.anthropic, 2);
  assert.equal(result.config.backgroundTask.modelConcurrency['openai/gpt-5.4'], 4);
  assert.equal(result.config.notifications.enabled, true);
  assert.equal(result.config.browserAutomation.provider, 'playwright-cli');
  assert.equal(result.config.experimental.taskSystem, true);
  assert.deepEqual(result.config.disabled.tools, ['tool.background-task']);
});

test('loadRuntimeConfig throws a clear error for invalid config shape', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "disabled": {
        "tools": true,
      },
    }`
  );

  assert.throws(
    () => loadRuntimeConfig({ projectRoot, env: { HOME: makeTempDir() } }),
    /disabled\.tools must be an array/i
  );
});

test('loadRuntimeConfig migrates legacy runtime config keys', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "disabled_tools": ["tool.workflow-state"],
      "background_task": {
        "enabled": true
      },
      "mcp": {
        "builtin": {
          "websearch": true
        }
      }
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.deepEqual(result.config.disabled.tools, ['tool.workflow-state']);
  assert.equal(result.config.backgroundTask.enabled, true);
  assert.equal(result.config.mcps.builtin.websearch, true);
  assert.match(result.warnings.join('\n'), /disabled_tools -> disabled\.tools/);
  assert.match(result.warnings.join('\n'), /background_task -> backgroundTask/);
  assert.match(result.warnings.join('\n'), /mcp -> mcps/);
});

test('loadRuntimeConfig materializes file-based prompt references for agents and categories', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');
  const promptPath = path.join(projectRoot, 'prompts', 'specialist.md');
  const categoryPromptPath = path.join(projectRoot, 'prompts', 'deep-category.md');

  writeText(promptPath, 'You are a custom Oracle prompt.');
  writeText(categoryPromptPath, 'Favor deliberate deep reasoning.');
  writeText(
    projectConfigPath,
    `{
      "agents": {
        "specialist.oracle": {
          "prompt": "file://./prompts/specialist.md"
        }
      },
      "categories": {
        "deep": {
          "prompt_append": "file://./prompts/deep-category.md"
        }
      }
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.agents['specialist.oracle'].prompt, 'You are a custom Oracle prompt.');
  assert.equal(result.config.categories.deep.prompt_append, 'Favor deliberate deep reasoning.');
});

test('loadRuntimeConfig validates richer agent and category model settings', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "agents": {
        "specialist.oracle": {
          "fallback_models": [{ "variant": "high" }]
        }
      }
    }`
  );

  assert.throws(
    () => loadRuntimeConfig({ projectRoot, env: { HOME: makeTempDir() } }),
    /fallback_models entries must be non-empty strings or objects with a non-empty model field/i
  );
});

test('loadRuntimeConfig validates hook settings', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "hooks": {
        "toolOutputTruncation": {
          "maxChars": 0
        },
        "rulesInjector": {
          "byMode": {
            "full": ["", 1]
          }
        }
      }
    }`
  );

  assert.throws(
    () => loadRuntimeConfig({ projectRoot, env: { HOME: makeTempDir() } }),
    /hooks\.toolOutputTruncation\.maxChars must be a positive integer|hooks\.rulesInjector\.byMode\.full entries must be non-empty strings/i
  );
});
