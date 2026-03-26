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
