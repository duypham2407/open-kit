import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { addCustomMcpEntry } from '../../src/global/mcp/custom-mcp-store.js';

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
  const verification = result.skills.find((entry) => entry.name === 'verification-before-completion');
  assert.equal(verification.status, 'stable');
  assert.equal(verification.capabilityState, 'available');
  assert.equal(verification.support_level, 'maintained');
  assert.ok(Array.isArray(verification.recommended_mcps));
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

test('runtime capability inventory and MCP doctor include custom MCP ownership metadata', async () => {
  const projectRoot = makeTempDir('openkit-custom-capability-project-');
  const opencodeHome = makeTempDir('openkit-custom-capability-home-');
  const env = { OPENCODE_HOME: opencodeHome, PATH: '' };
  addCustomMcpEntry({
    id: 'custom-local',
    displayName: 'Custom Local',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom-server.js'], environment: { CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}' } },
    secretBindings: [{ id: 'custom-token', envVar: 'CUSTOM_MCP_TOKEN', required: true, placeholder: '${CUSTOM_MCP_TOKEN}', source: 'custom' }],
    riskWarnings: ['Local custom MCP execution can run code on this machine.'],
  }, { env });

  const runtime = bootstrapRuntimeFoundation({ projectRoot, env });
  const inventory = await getTool(runtime, 'tool.capability-inventory').execute({ scope: 'openkit' });
  const doctor = await getTool(runtime, 'tool.mcp-doctor').execute({ scope: 'openkit' });
  const custom = inventory.mcps.find((entry) => entry.mcpId === 'custom-local');

  assert.equal(custom.kind, 'custom');
  assert.equal(custom.origin, 'local');
  assert.equal(custom.ownership, 'openkit-managed-custom');
  assert.equal(custom.keyState.CUSTOM_MCP_TOKEN, 'missing');
  assert.ok(doctor.issues.some((issue) => issue.mcpId === 'custom-local' && issue.state === 'not_configured'));
  assert.equal(JSON.stringify(doctor).includes(SENTINEL), false);
});

test('capability guidance summary is compact, advisory, role-aware, and redacted', async () => {
  const projectRoot = makeTempDir('openkit-capability-guidance-project-');
  const opencodeHome = makeTempDir('openkit-capability-guidance-home-');
  const env = { OPENCODE_HOME: opencodeHome, CUSTOM_MCP_TOKEN: SENTINEL, PATH: '' };
  addCustomMcpEntry({
    id: 'custom-guidance',
    displayName: 'Custom Guidance',
    origin: 'local',
    ownership: 'openkit-managed-custom',
    enabled: { openkit: true, global: false },
    definition: { type: 'local', command: ['node', '/tmp/custom-guidance.js'], environment: { CUSTOM_MCP_TOKEN: '${CUSTOM_MCP_TOKEN}' } },
    secretBindings: [{ id: 'custom-token', envVar: 'CUSTOM_MCP_TOKEN', required: true, placeholder: '${CUSTOM_MCP_TOKEN}', source: 'custom' }],
  }, { env });
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env });

  const result = await getTool(runtime, 'tool.capability-router').execute({
    summary: true,
    mode: 'full',
    stage: 'full_implementation',
    role: 'FullstackAgent',
    status: 'in_progress',
  });
  const rendered = result.renderedLines.join('\n');

  assert.equal(result.status, 'ok');
  assert.equal(result.validationSurface, 'runtime_tooling');
  assert.equal(result.workflowContext.mode, 'full');
  assert.equal(result.workflowContext.stage, 'full_implementation');
  assert.equal(result.workflowContext.owner, 'FullstackAgent');
  assert.ok(result.renderedLines.length <= result.limits.maxLines);
  assert.ok(rendered.length <= result.limits.maxChars);
  assert.match(rendered, /advisory only; no skill or MCP was auto-activated/i);
  assert.match(rendered, /Fullstack Agent implements approved solution-package work/i);
  assert.match(rendered, /custom-guidance \(custom_mcp/);
  assert.match(rendered, /origin=local/);
  assert.match(rendered, /not bundled defaults/i);
  assert.match(rendered, /target app validation: unavailable/i);
  assert.equal(rendered.includes(SENTINEL), false);
  assert.doesNotMatch(rendered, /# using-skills|RED-GREEN-REFACTOR|You are running within/i);
  assert.doesNotMatch(rendered, /\b(loaded|ran|verified|healthy now)\b/i);
});

test('capability guidance guardrails cover workflow roles and migration/quick semantics', async () => {
  const projectRoot = makeTempDir('openkit-capability-guardrails-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-capability-guardrails-home-'), PATH: '' } });
  const router = getTool(runtime, 'tool.capability-router');
  const scenarios = [
    ['MasterOrchestrator', 'full_intake', 'full', /controls routing, state, dispatch, approvals, and readiness only/i, /do not implement, review, QA, or author scope\/solution content/i],
    ['ProductLead', 'full_product', 'full', /defines problem, business rules, scope, and acceptance criteria/i, /do not take implementation or architecture ownership/i],
    ['SolutionLead', 'full_solution', 'full', /plans technical direction, sequencing, validation, and capability discovery/i, /do not rewrite product scope or implement/i],
    ['FullstackAgent', 'full_implementation', 'full', /implements approved solution-package work/i, /QA ownership, review approval, and product\/scope changes stay separate/i],
    ['CodeReviewer', 'full_code_review', 'full', /checks scope\/solution compliance first/i, /do not implement fixes or claim QA closure/i],
    ['QAAgent', 'full_qa', 'full', /verifies behavior, evidence, runtime health, and issue classification/i, /do not implement, bypass review, or approve closure/i],
    ['QuickAgent', 'quick_plan', 'quick', /single quick-lane owner/i, /do not introduce full-delivery handoffs or task-board assumptions/i],
    ['FullstackAgent', 'migration_upgrade', 'migration', /preserves baseline, compatibility, parity, staged upgrade, rollback, review, and verification semantics/i, /do not assume full-delivery task-board behavior/i],
  ];

  for (const [role, stage, mode, mustInclude, mustAlsoInclude] of scenarios) {
    const result = await router.execute({ summary: true, mode, stage, role, status: 'in_progress' });
    const rendered = result.renderedLines.join('\n');
    assert.match(rendered, mustInclude, `${role}/${stage} missing expected guardrail`);
    assert.match(rendered, mustAlsoInclude, `${role}/${stage} missing boundary caveat`);
    assert.match(rendered, /advisory only/i);
  }
});

test('capability guidance reports unknown workflow state without guessing role ownership', async () => {
  const projectRoot = makeTempDir('openkit-capability-unknown-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-capability-unknown-home-'), PATH: '' } });

  const result = await getTool(runtime, 'tool.capability-router').execute({ summary: true });
  const rendered = result.renderedLines.join('\n');

  assert.equal(result.status, 'degraded');
  assert.equal(result.workflowContext.mode, 'unknown');
  assert.match(rendered, /Unknown workflow state/);
  assert.match(rendered, /generic capability discovery/);
  assert.match(rendered, /Do not guess lane, stage, owner, or approval authority/);
});

test('skill index and skill MCP bindings tools expose catalog relationships', async () => {
  const projectRoot = makeTempDir('openkit-skill-index-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-skill-index-home-') } });

  const skillIndex = await getTool(runtime, 'tool.skill-index').execute({ tag: 'frontend', role: 'FullstackAgent', stage: 'full_implementation', status: 'stable' });
  const bindings = await getTool(runtime, 'tool.skill-mcp-bindings').execute({});

  assert.equal(skillIndex.status, 'ok');
  assert.ok(skillIndex.skills.some((entry) => entry.name === 'vercel-react-best-practices'));
  assert.ok(skillIndex.skills.every((entry) => entry.status === 'stable'));
  assert.ok(skillIndex.skills.every((entry) => entry.roles.includes('FullstackAgent') || entry.roles.includes('all')));
  assert.ok(skillIndex.skills.every((entry) => entry.stages.includes('full_implementation') || entry.stages.includes('all')));
  assert.equal(bindings.status, 'ok');
  const browserBinding = bindings.bindings.find((entry) => entry.mcpId === 'chrome-devtools' || entry.mcpId === 'playwright');
  assert.ok(browserBinding);
  assert.ok(['primary', 'supporting', 'optional'].includes(browserBinding.relationship));
  assert.ok(['stable', 'preview', 'experimental'].includes(browserBinding.skillStatus));
  assert.equal(typeof browserBinding.mcpKnown, 'boolean');
});

test('capability router recommends metadata-backed skills with explainable stable-first output', async () => {
  const projectRoot = makeTempDir('openkit-skill-router-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-skill-router-home-'), PATH: '' } });

  const result = await getTool(runtime, 'tool.capability-router').execute({
    intent: 'debug a React render performance issue',
    role: 'FullstackAgent',
    stage: 'full_implementation',
    tags: ['frontend', 'performance'],
  });

  assert.equal(result.validationSurface, 'runtime_tooling');
  assert.equal(result.matchStatus, 'matched');
  assert.equal(result.selectedSkill.name, 'vercel-react-best-practices');
  assert.equal(result.selectedSkill.status, 'stable');
  assert.ok(result.selectionReasons.some((reason) => reason.field === 'trigger' || reason.field === 'tag'));
  assert.ok(Array.isArray(result.suppressedCandidates));
  assert.ok(Array.isArray(result.recommendedMcps));
  assert.match(result.guidance, /Load the selected skill explicitly/i);
});

test('capability router reports no metadata-backed match instead of silent fallback', async () => {
  const projectRoot = makeTempDir('openkit-skill-router-nomatch-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-skill-router-nomatch-home-'), PATH: '' } });

  const result = await getTool(runtime, 'tool.capability-router').execute({
    intent: 'quantum toaster calibration',
    role: 'FullstackAgent',
    stage: 'full_implementation',
    tags: ['nonexistent-skill-domain'],
    includePreview: false,
    includeExperimental: false,
  });

  assert.equal(result.validationSurface, 'runtime_tooling');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.matchStatus, 'no_match');
  assert.match(result.guidance, /No metadata-backed skill match/i);
});

test('runtime interface summarizes skill maturity separately from capability state', async () => {
  const projectRoot = makeTempDir('openkit-runtime-interface-skill-summary-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-runtime-interface-skill-summary-home-'), PATH: '' } });

  const summary = runtime.runtimeInterface.capabilityPack.skillSummary;
  assert.ok(summary.total > 0);
  assert.ok(summary.maturity.stable > 0);
  assert.ok(summary.maturity.preview > 0);
  assert.ok(summary.capabilityStates.available > 0);
  assert.ok(summary.capabilityStates.unavailable > 0);
  assert.ok(summary.supportLevels.maintained > 0);
  assert.ok(summary.supportLevels.stub > 0);
});
