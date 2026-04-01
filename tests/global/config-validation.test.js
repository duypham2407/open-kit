import test from 'node:test';
import assert from 'node:assert/strict';

import { validateAgentModelSettings } from '../../src/runtime/config-validation.js';

test('agent model settings validation warns on malformed shapes and unknown keys', () => {
  const warnings = validateAgentModelSettings({
    agentModels: {
      'qa-agent': {
        model: '',
        variant: 42,
        temperature: 0.2,
      },
      'bad-agent': 'not-an-object',
    },
  });

  assert.match(warnings.join('\n'), /agentModels\.qa-agent\.model must be a non-empty string/);
  assert.match(warnings.join('\n'), /agentModels\.qa-agent\.variant must be a string/);
  assert.match(warnings.join('\n'), /agentModels\.qa-agent\.temperature is unknown and will be ignored/);
  assert.match(warnings.join('\n'), /agentModels\.bad-agent must be an object/);
});

test('agent model settings validation accepts fallback chains and auto-fallback policy', () => {
  const warnings = validateAgentModelSettings({
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5',
        fallback_models: ['openai/gpt-5-mini', { model: 'anthropic/claude-sonnet-4-5', variant: 'high' }],
        auto_fallback: {
          enabled: true,
          after_failures: 3,
        },
      },
    },
  });

  assert.deepEqual(warnings, []);
});

test('agent model settings validation accepts up to two quick-switch profiles', () => {
  const warnings = validateAgentModelSettings({
    agentModels: {
      'qa-agent': {
        model: 'openai/gpt-5.4',
        profiles: [
          { model: 'openai/gpt-5.4', variant: 'high' },
          { model: 'azure/gpt-5.4', variant: 'high' },
        ],
      },
    },
  });

  assert.deepEqual(warnings, []);
});
