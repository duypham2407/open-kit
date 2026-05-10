import test from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_SCHEMAS } from '../../mcp-server/tool-schemas.js';

test('tool.workflow-state schema is registered', () => {
  assert.ok(TOOL_SCHEMAS['tool.workflow-state'], 'schema entry missing');
  assert.ok(TOOL_SCHEMAS['tool.workflow-state'].inputSchema, 'inputSchema missing');
});

test('tool.workflow-state schema documents workItemId, not command', () => {
  const schema = TOOL_SCHEMAS['tool.workflow-state'].inputSchema;
  const props = schema.properties ?? {};
  assert.ok(
    'workItemId' in props,
    'inputSchema must declare workItemId (the property the handler reads)',
  );
  assert.ok(
    !('command' in props),
    'inputSchema must not declare command — the handler does not read it',
  );
});

test('tool.workflow-state workItemId property is a string with a description', () => {
  const prop = TOOL_SCHEMAS['tool.workflow-state']?.inputSchema?.properties?.workItemId;
  assert.ok(prop, 'workItemId property must exist before type/description checks');
  assert.equal(prop.type, 'string');
  assert.equal(typeof prop.description, 'string');
  assert.ok(prop.description.length > 0);
});
