import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import { chooseModelInteractively } from '../../src/cli/commands/agent-model-selection.js';

function makeIo(answers = []) {
  return {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    async prompt() {
      return answers.shift() ?? '';
    },
  };
}

test('strict interactive model selection only returns discovered model entries', async () => {
  const io = makeIo(['1', 'openai/not-discovered', '2']);
  const rl = {
    async question(label) {
      return io.prompt(label);
    },
    close() {},
  };
  const runModels = (provider, { verbose }) => {
    assert.equal(provider, '');
    assert.equal(verbose, true);
    return {
      status: 0,
      stdout: [
        'openai/gpt-5',
        '{"variants":{}}',
        'openai/gpt-5-mini',
        '{"variants":{}}',
      ].join('\n'),
      stderr: '',
    };
  };

  const selection = await chooseModelInteractively(rl, io, {
    env: {},
    refresh: false,
    verbose: false,
    strict: true,
    runModels,
  });

  assert.deepEqual(selection, {
    modelId: 'openai/gpt-5-mini',
    variants: {},
  });
});
