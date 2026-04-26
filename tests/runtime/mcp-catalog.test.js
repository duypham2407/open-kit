import test from 'node:test';
import assert from 'node:assert/strict';

import { listMcpCatalogEntries } from '../../src/capabilities/mcp-catalog.js';
import { STANDARD_CAPABILITY_STATES } from '../../src/capabilities/status.js';

const REQUIRED_MCPS = [
  'openkit',
  'chrome-devtools',
  'playwright',
  'context7',
  'grep_app',
  'websearch',
  'sequential-thinking',
  'git',
  'augment_context_engine',
];

test('MCP catalog includes default capability pack entries', () => {
  const entries = listMcpCatalogEntries();
  const ids = entries.map((entry) => entry.id);

  for (const requiredId of REQUIRED_MCPS) {
    assert.ok(ids.includes(requiredId), `expected MCP catalog to include ${requiredId}`);
  }
});

test('key-required MCP catalog entries use placeholders and never raw keys', () => {
  const entries = listMcpCatalogEntries();
  const keyRequired = entries.filter((entry) => (entry.secretBindings ?? []).some((binding) => binding.required));

  assert.ok(keyRequired.length > 0);

  for (const entry of keyRequired) {
    assert.equal(entry.status, 'not_configured');
    for (const binding of entry.secretBindings) {
      assert.equal(binding.placeholder, `\${${binding.envVar}}`);
      assert.equal(entry.profileEntry.environment[binding.envVar], binding.placeholder);
      assert.match(binding.configureCommand, new RegExp(`set-key ${entry.id}`));
    }

    const serialized = JSON.stringify(entry);
    assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]/);
    assert.doesNotMatch(serialized, /API_KEY=/);
  }
});

test('MCP catalog labels optional, preview, and policy-gated entries', () => {
  const byId = new Map(listMcpCatalogEntries().map((entry) => [entry.id, entry]));

  assert.equal(byId.get('augment_context_engine').lifecycle, 'optional');
  assert.equal(byId.get('augment_context_engine').optional, true);
  assert.equal(byId.get('git').lifecycle, 'policy_gated');
  assert.equal(byId.get('git').policy.destructiveOperations, 'blocked');
  assert.equal(byId.get('sequential-thinking').lifecycle, 'preview');

  for (const entry of byId.values()) {
    assert.ok(STANDARD_CAPABILITY_STATES.includes(entry.status), `${entry.id} has non-standard status`);
  }
});
