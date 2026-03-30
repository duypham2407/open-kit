import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'registry.json'), 'utf8'));

test('registry agents include audience and mode metadata', () => {
  for (const agent of registry.components.agents ?? []) {
    assert.equal(typeof agent.audience, 'string');
    assert.ok(Array.isArray(agent.modes));
    assert.ok(agent.modes.length > 0);
  }
});

test('registry commands include audience, surface, and mode metadata', () => {
  for (const command of registry.components.commands ?? []) {
    assert.equal(typeof command.audience, 'string');
    assert.equal(typeof command.surface, 'string');
    assert.ok(Array.isArray(command.modes));
    assert.ok(command.modes.length > 0);
  }
});

test('registry skills include role and mode metadata', () => {
  for (const skill of registry.components.skills ?? []) {
    assert.equal(typeof skill.audience, 'string');
    assert.ok(Array.isArray(skill.typicalRoles));
    assert.ok(Array.isArray(skill.modes));
    assert.ok(skill.modes.length > 0);
  }
});

test('registry docs include runtime surfaces reference', () => {
  const docs = registry.components.docs ?? [];
  const runtimeSurfaces = docs.find((entry) => entry.id === 'doc.runtime-surfaces');
  assert.ok(runtimeSurfaces);
  assert.equal(runtimeSurfaces.path, 'context/core/runtime-surfaces.md');
});

test('registry includes runtime capability, manager, tool, and hook metadata', () => {
  assert.ok(Array.isArray(registry.components.capabilities));
  assert.ok(Array.isArray(registry.components.managers));
  assert.ok(Array.isArray(registry.components.runtimeTools));
  assert.ok(Array.isArray(registry.components.runtimeHooks));

  const capability = registry.components.capabilities.find(
    (entry) => entry.id === 'capability.runtime-bootstrap'
  );
  const manager = registry.components.managers.find((entry) => entry.id === 'manager.config-handler');
  const tool = registry.components.runtimeTools.find((entry) => entry.id === 'tool.workflow-state');
  const hook = registry.components.runtimeHooks.find(
    (entry) => entry.id === 'runtime-hook.runtime-config-validation'
  );

  assert.ok(capability);
  assert.equal(capability.path, 'src/runtime/index.js');
  assert.ok(manager);
  assert.ok(tool);
  assert.ok(hook);
});
