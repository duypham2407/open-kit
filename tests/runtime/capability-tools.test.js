import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';

const SENTINEL = 'sk-openkit-runtime-sentinel-941';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function getTool(runtime, id) {
  return runtime.tools.tools[id];
}

test('runtime capability inventory tool lists MCPs and skills with redacted key state', async () => {
  const projectRoot = makeTempDir('openkit-capability-tools-project-');
  const opencodeHome = makeTempDir('openkit-capability-tools-home-');
  fs.mkdirSync(path.join(opencodeHome, 'openkit'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(opencodeHome, 'openkit', 'secrets.env'), `CONTEXT7_API_KEY=${SENTINEL}\n`, { mode: 0o600 });

  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: opencodeHome, PATH: process.env.PATH ?? '' } });
  const result = await getTool(runtime, 'tool.capability-inventory').execute({ scope: 'openkit' });

  assert.equal(result.status, 'ok');
  assert.equal(result.validationSurface, 'runtime_tooling');
  assert.ok(result.mcps.some((entry) => entry.mcpId === 'context7'));
  assert.ok(result.skills.some((entry) => entry.name === 'verification-before-completion'));
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.equal(result.mcps.find((entry) => entry.mcpId === 'context7').keyState.CONTEXT7_API_KEY, 'present_redacted');
});

test('runtime capability router returns next-action guidance for not configured capabilities', async () => {
  const projectRoot = makeTempDir('openkit-capability-router-project-');
  const opencodeHome = makeTempDir('openkit-capability-router-home-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: opencodeHome, PATH: '' } });

  const result = await getTool(runtime, 'tool.capability-router').execute({ intent: 'library docs', mcpId: 'context7' });

  assert.equal(result.status, 'not_configured');
  assert.match(result.guidance, /set-key context7/);
  assert.equal(result.validationSurface, 'runtime_tooling');
});

test('runtime capability health labels optional augment and policy-gated git honestly', async () => {
  const projectRoot = makeTempDir('openkit-capability-health-project-');
  const opencodeHome = makeTempDir('openkit-capability-health-home-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: opencodeHome, PATH: '' } });

  const health = await getTool(runtime, 'tool.capability-health').execute({ scope: 'openkit' });

  const augment = health.mcps.find((entry) => entry.mcpId === 'augment_context_engine');
  const git = health.mcps.find((entry) => entry.mcpId === 'git');
  assert.equal(augment.optional, true);
  assert.ok(['unavailable', 'degraded'].includes(augment.capabilityState));
  assert.equal(git.lifecycle, 'policy_gated');
  assert.equal(git.policy.destructiveOperations, 'blocked');
});

test('runtime MCP doctor tool reports read-only redacted capability readiness', async () => {
  const projectRoot = makeTempDir('openkit-mcp-doctor-project-');
  const opencodeHome = makeTempDir('openkit-mcp-doctor-home-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: opencodeHome, PATH: '' } });

  const result = await getTool(runtime, 'tool.mcp-doctor').execute({ scope: 'openkit' });

  assert.equal(result.validationSurface, 'runtime_tooling');
  assert.ok(['ok', 'degraded'].includes(result.status));
  assert.ok(result.mcps.some((entry) => entry.mcpId === 'context7'));
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('skill index and skill MCP bindings tools expose catalog relationships', async () => {
  const projectRoot = makeTempDir('openkit-skill-index-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-skill-index-home-') } });

  const skillIndex = await getTool(runtime, 'tool.skill-index').execute({ category: 'frontend' });
  const bindings = await getTool(runtime, 'tool.skill-mcp-bindings').execute({});

  assert.equal(skillIndex.status, 'ok');
  assert.ok(skillIndex.skills.some((entry) => entry.name === 'vercel-react-best-practices'));
  assert.equal(bindings.status, 'ok');
  assert.ok(bindings.bindings.some((entry) => entry.mcpId === 'chrome-devtools' || entry.mcpId === 'playwright'));
});
