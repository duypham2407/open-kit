import test from 'node:test';
import assert from 'node:assert/strict';
import { createComprehensiveContextTool } from '../../src/runtime/tools/context/comprehensive-context.js';

test('comprehensive-context tool executes', async () => {
  const mockManager = {
    gatherTaskContext: async ({ task }) => ({
      primaryContext: [{ file: '/test.js', symbol: 'test' }],
      metadata: { confidenceScore: 0.8 }
    })
  };

  const tool = createComprehensiveContextTool({ contextAssemblyManager: mockManager });

  assert.strictEqual(tool.id, 'tool.comprehensive-context');

  const result = await tool.execute({
    task: 'Test task',
    focus: ['/test.js']
  });

  assert.ok(result.primaryContext);
  assert.strictEqual(result.metadata.confidenceScore, 0.8);
});
