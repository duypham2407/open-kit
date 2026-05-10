import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_SCHEMAS } from '../../mcp-server/tool-schemas.js';

test('TOOL_SCHEMAS includes tool.bootstrap-workflow', () => {
  assert.ok(
    TOOL_SCHEMAS['tool.bootstrap-workflow'],
    'tool.bootstrap-workflow must have an MCP schema entry — without it, src/mcp-server/index.js filters the tool out of mcpTools',
  );
});

test('tool.bootstrap-workflow schema declares lane, description, featureSlug, archivePrior', () => {
  const schema = TOOL_SCHEMAS['tool.bootstrap-workflow'].inputSchema;
  assert.equal(schema.type, 'object');
  const props = schema.properties ?? {};
  assert.ok('lane' in props, 'lane property required');
  assert.ok('description' in props, 'description property required');
  assert.ok('featureSlug' in props, 'featureSlug property required (optional input)');
  assert.ok('archivePrior' in props, 'archivePrior property required (optional input)');
});

test('tool.bootstrap-workflow lane is enum [quick, full, migration]', () => {
  const lane = TOOL_SCHEMAS['tool.bootstrap-workflow'].inputSchema.properties.lane;
  assert.equal(lane.type, 'string');
  assert.deepEqual(lane.enum, ['quick', 'full', 'migration']);
});

test('tool.bootstrap-workflow required array lists lane and description', () => {
  const schema = TOOL_SCHEMAS['tool.bootstrap-workflow'].inputSchema;
  assert.ok(Array.isArray(schema.required), 'required array must be declared');
  assert.ok(schema.required.includes('lane'));
  assert.ok(schema.required.includes('description'));
});
