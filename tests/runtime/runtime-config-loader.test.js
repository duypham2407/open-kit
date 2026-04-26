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
  assert.equal(result.config.supervisorDialogue.enabled, false);
  assert.equal(result.config.supervisorDialogue.openclaw.transport, 'unconfigured');
});

test('loadRuntimeConfig accepts disabled unconfigured supervisor dialogue as valid non-fatal config', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "supervisorDialogue": {
        "enabled": false,
        "openclaw": {
          "transport": "unconfigured",
          "url": null,
          "command": null,
          "args": []
        }
      }
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.supervisorDialogue.enabled, false);
  assert.equal(result.config.supervisorDialogue.openclaw.transport, 'unconfigured');
  assert.deepEqual(result.warnings.filter((warning) => warning.includes('supervisorDialogue')), []);
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

test('loadRuntimeConfig supports global and per-agent auto-fallback settings', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "modelExecution": {
        "autoFallback": {
          "enabled": true,
          "afterFailures": 3
        }
      },
      "agents": {
        "specialist.oracle": {
          "model": "openai/gpt-5.4",
          "fallback_models": [
            { "model": "anthropic/claude-sonnet-4-6", "variant": "high" }
          ],
          "auto_fallback": {
            "enabled": true,
            "after_failures": 4
          }
        }
      }
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.modelExecution.autoFallback.enabled, true);
  assert.equal(result.config.modelExecution.autoFallback.afterFailures, 3);
  assert.equal(result.config.agents['specialist.oracle'].auto_fallback.enabled, true);
  assert.equal(result.config.agents['specialist.oracle'].auto_fallback.after_failures, 4);
});

test('loadRuntimeConfig supports dual quick-switch profiles for an agent', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
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

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.modelExecution.quickSwitchProfiles.enabled, true);
  assert.equal(result.config.agents['specialist.oracle'].profiles.length, 2);
  assert.equal(result.config.agents['specialist.oracle'].profiles[1].model, 'azure/gpt-5.4');
});

// ---------------------------------------------------------------------------
// Embedding config validation
// ---------------------------------------------------------------------------

test('loadRuntimeConfig returns embedding defaults', () => {
  const projectRoot = makeTempDir();

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.embedding.enabled, false);
  assert.equal(result.config.embedding.provider, 'openai');
  assert.equal(result.config.embedding.model, 'openai/text-embedding-3-small');
  assert.equal(result.config.embedding.dimensions, 1536);
  assert.equal(result.config.embedding.batchSize, 20);
});

test('loadRuntimeConfig merges embedding config from project', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "embedding": {
        "enabled": true,
        "provider": "ollama",
        "model": "ollama/nomic-embed-text",
        "dimensions": 768,
        "batchSize": 50
      }
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.embedding.enabled, true);
  assert.equal(result.config.embedding.provider, 'ollama');
  assert.equal(result.config.embedding.model, 'ollama/nomic-embed-text');
  assert.equal(result.config.embedding.dimensions, 768);
  assert.equal(result.config.embedding.batchSize, 50);
});

test('loadRuntimeConfig rejects invalid embedding provider', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "embedding": {
        "provider": "nonexistent"
      }
    }`
  );

  assert.throws(
    () => loadRuntimeConfig({ projectRoot, env: { HOME: makeTempDir() } }),
    /embedding\.provider must be one of/i
  );
});

test('loadRuntimeConfig rejects invalid embedding dimensions', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "embedding": {
        "dimensions": -1
      }
    }`
  );

  assert.throws(
    () => loadRuntimeConfig({ projectRoot, env: { HOME: makeTempDir() } }),
    /embedding\.dimensions must be a positive integer/i
  );
});

test('loadRuntimeConfig accepts valid custom embedding config', () => {
  const projectRoot = makeTempDir();
  const projectConfigPath = path.join(projectRoot, '.opencode', 'openkit.runtime.jsonc');

  writeText(
    projectConfigPath,
    `{
      "embedding": {
        "enabled": true,
        "provider": "custom",
        "model": "myco/my-embed",
        "dimensions": 512,
        "baseUrl": "https://my-api.example.com/v1",
        "apiKey": "sk-test-123"
      }
    }`
  );

  const result = loadRuntimeConfig({
    projectRoot,
    env: { HOME: makeTempDir() },
  });

  assert.equal(result.config.embedding.enabled, true);
  assert.equal(result.config.embedding.provider, 'custom');
  assert.equal(result.config.embedding.baseUrl, 'https://my-api.example.com/v1');
});
