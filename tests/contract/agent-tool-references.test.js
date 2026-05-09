import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'registry.json'), 'utf8'));
const registeredTools = new Set(
  (registry.components?.runtimeTools ?? []).map((t) => t.id),
);

const agentDir = path.join(projectRoot, 'agents');
const agentFiles = fs.readdirSync(agentDir).filter((name) => name.endsWith('.md'));

const TOOL_REFERENCE_PATTERN = /`(tool\.[a-z][a-z0-9-]+)`/g;

for (const agentFile of agentFiles) {
  test(`agent ${agentFile} references only registered tool IDs`, () => {
    const content = fs.readFileSync(path.join(agentDir, agentFile), 'utf8');
    const referenced = new Set();
    for (const match of content.matchAll(TOOL_REFERENCE_PATTERN)) {
      referenced.add(match[1]);
    }

    const missing = [...referenced].filter((id) => !registeredTools.has(id));
    assert.deepEqual(
      missing,
      [],
      `${agentFile} references tool IDs that are not in registry.json#runtimeTools: ${missing.join(', ')}`,
    );
  });
}
