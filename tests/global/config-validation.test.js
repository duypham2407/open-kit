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
