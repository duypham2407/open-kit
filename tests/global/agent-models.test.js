import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildAgentModelConfigOverrides,
  clearAgentModel,
  isValidModelId,
  readAgentCatalog,
  readAgentModelSettings,
  setAgentModel,
} from '../../src/global/agent-models.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openkit-agent-models-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('agent model settings persist provider-qualified model ids', () => {
  const tempDir = makeTempDir();
  const settingsPath = path.join(tempDir, 'agent-models.json');

  setAgentModel(settingsPath, 'qa-agent', 'openai/gpt-5');
  const settings = readAgentModelSettings(settingsPath);

  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
  assert.deepEqual(buildAgentModelConfigOverrides(settingsPath), {
    agent: {
      'qa-agent': {
        model: 'openai/gpt-5',
      },
    },
  });
});

test('agent model settings can persist variants alongside model ids', () => {
  const tempDir = makeTempDir();
  const settingsPath = path.join(tempDir, 'agent-models.json');

  setAgentModel(settingsPath, 'qa-agent', 'openai/gpt-5', 'high');
  const settings = readAgentModelSettings(settingsPath);

  assert.equal(settings.agentModels['qa-agent'].model, 'openai/gpt-5');
  assert.equal(settings.agentModels['qa-agent'].variant, 'high');
  assert.deepEqual(buildAgentModelConfigOverrides(settingsPath), {
    agent: {
      'qa-agent': {
        model: 'openai/gpt-5',
        variant: 'high',
      },
    },
  });
});

test('agent model settings can clear a saved override', () => {
  const tempDir = makeTempDir();
  const settingsPath = path.join(tempDir, 'agent-models.json');

  setAgentModel(settingsPath, 'qa-agent', 'openai/gpt-5');
  clearAgentModel(settingsPath, 'qa-agent');

  const settings = readAgentModelSettings(settingsPath);
  assert.equal(settings.agentModels['qa-agent'], undefined);
  assert.deepEqual(buildAgentModelConfigOverrides(settingsPath), {});
});

test('agent catalog derives OpenCode agent ids from registry paths', () => {
  const tempDir = makeTempDir();
  const registryPath = path.join(tempDir, 'registry.json');

  writeJson(registryPath, {
    components: {
      agents: [
        {
          id: 'agent.master-orchestrator',
          name: 'Master Orchestrator',
          role: 'primary',
          path: 'agents/master-orchestrator.md',
        },
        {
          id: 'agent.code-reviewer',
          name: 'Code Reviewer',
          role: 'helper',
          path: 'agents/code-reviewer.md',
        },
      ],
    },
  });

  assert.deepEqual(readAgentCatalog(registryPath), [
    {
      id: 'master-orchestrator',
      name: 'Master Orchestrator',
      role: 'primary',
      path: 'agents/master-orchestrator.md',
      registryId: 'agent.master-orchestrator',
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      role: 'helper',
      path: 'agents/code-reviewer.md',
      registryId: 'agent.code-reviewer',
    },
  ]);
});

test('model ids must be provider-qualified', () => {
  assert.equal(isValidModelId('openai/gpt-5'), true);
  assert.equal(isValidModelId('anthropic/claude-sonnet-4-5'), true);
  assert.equal(isValidModelId('gpt-5'), false);
  assert.equal(isValidModelId('openai/'), false);
});
