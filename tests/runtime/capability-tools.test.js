import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { bootstrapRuntimeFoundation } from '../../src/runtime/index.js';
import { addCustomMcpEntry } from '../../src/global/mcp/custom-mcp-store.js';
import { setMcpEnabled } from '../../src/global/mcp/mcp-config-store.js';
import { CapabilityRegistryManager } from '../../src/runtime/managers/capability-registry-manager.js';

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
  assert.equal(result.resolver.schema, 'openkit/capability-resolver@1');
  assert.ok(result.resolver.selected.length <= result.resolver.limits.maxCandidates);
  assert.ok(result.resolver.selected.some((entry) => entry.capabilityId === 'skill.vercel-react-best-practices'));
  assert.match(result.resolver.summary, /does not activate|preferred|blocked/i);
});

test('capability router rank mode returns bounded graph-backed selection groups without activation', async () => {
  const projectRoot = makeTempDir('openkit-capability-rank-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-capability-rank-home-'), PATH: '' } });

  const result = await getTool(runtime, 'tool.capability-router').execute({
    rank: true,
    intent: 'debug React render performance issue',
    mode: 'full',
    role: 'FullstackAgent',
    stage: 'full_implementation',
    tags: ['frontend', 'performance'],
    maxCandidates: 2,
  });

  assert.equal(result.schema, 'openkit/capability-resolver@1');
  assert.equal(result.status, 'ok');
  assert.equal(result.validationSurface, 'runtime_tooling');
  assert.equal(result.workflow.mode, 'full');
  assert.ok(result.selected.length <= 2);
  assert.ok(result.downgraded.length <= 2);
  assert.ok(result.blocked.length <= 2);
  assert.ok(result.unavailable.length <= 2);
  assert.ok(result.suppressed.length <= 2);
  assert.ok(result.counts.graphNodes > result.selected.length);

  const selected = result.selected[0];
  assert.equal(selected.capabilityId, 'skill.vercel-react-best-practices');
  assert.equal(selected.activation.eligible, true);
  assert.match(selected.activation.reason, /does not activate/i);
  assert.ok(selected.reasons.some((reason) => ['tag', 'domainSignal', 'role', 'stage'].includes(reason.field)));
  assert.equal(JSON.stringify(result).includes('You are running within'), false);

  const ledger = await getTool(runtime, 'tool.capability-ledger').execute({ action: 'list', limit: 20 });
  assert.ok(ledger.entries.some((entry) => entry.actionType === 'rank' && entry.outcome === 'selected' && entry.capability.id === 'skill.vercel-react-best-practices'));
  assert.equal(JSON.stringify(ledger).includes(SENTINEL), false);
});

test('capability ledger sanitizes secrets and provider payload fields', () => {
  const manager = new CapabilityRegistryManager({
    mcpHealthManager: { list: () => [] },
    skillMcpManager: { listBindings: () => [] },
  });

  const entry = manager.appendDecision({
    workflow: { mode: 'full', stage: 'full_implementation', role: 'FullstackAgent' },
    capability: {
      id: 'mcp.context7',
      family: 'external',
      ownership: 'openkit-bundled',
      state: 'available',
      surface: 'runtime_tooling',
      metadata: { keyState: { CONTEXT7_API_KEY: SENTINEL }, providerPayload: { token: SENTINEL } },
    },
    actionType: 'execute',
    outcome: 'failed',
    reason: `provider failed with CONTEXT7_API_KEY=${SENTINEL}`,
    caveats: [`raw token ${SENTINEL}`],
  });

  const serialized = JSON.stringify(entry);
  assert.equal(serialized.includes(SENTINEL), false);
  assert.equal(serialized.includes('providerPayload'), false);
  assert.match(entry.reason, /\[REDACTED\]/);
  assert.equal(manager.listDecisions().persistence, 'memory');
  assert.ok(manager.listDecisions().caveats.some((caveat) => /not persisted/i.test(caveat)));
});

test('capability readiness read model is bounded, fresh/cached labeled, and reports target app validation unavailable', async () => {
  const projectRoot = makeTempDir('openkit-capability-readiness-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-capability-readiness-home-'), PATH: '' } });

  await getTool(runtime, 'tool.capability-router').execute({
    rank: true,
    intent: 'browser ui page inspection',
    mode: 'full',
    role: 'QAAgent',
    stage: 'full_qa',
    maxCandidates: 3,
  });
  const result = await getTool(runtime, 'tool.capability-readiness').execute({ maxNextActions: 4 });

  assert.equal(result.schema, 'openkit/capability-read-model@1');
  assert.equal(result.status, 'ok');
  assert.ok(result.graph.total > 0);
  assert.ok(result.graph.familyCounts.skill > 0);
  assert.ok(result.graph.metadataOnlySkills > 0);
  assert.ok(result.graph.unavailableSkills > 0);
  assert.ok(result.graph.policyGatedCount > 0);
  assert.ok(['fresh', 'cached', 'stale', 'unknown'].includes(result.freshnessLabel));
  assert.ok(result.readiness.browser.total > 0);
  assert.equal(typeof result.readiness.external.total, 'number');
  assert.ok(Object.hasOwn(result.readiness.external.states, 'available'));
  assert.equal(result.readiness.targetProjectValidation.surface, 'target_project_app');
  assert.equal(result.readiness.targetProjectValidation.state, 'unavailable');
  assert.ok(result.ownership.bundled > 0);
  assert.ok(result.ownership.runtime > 0);
  assert.ok(result.nextActions.length <= 4);
  assert.ok(result.ledger.total > 0);
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('runtime summary exposes bounded capability readiness without full catalog dumps', async () => {
  const projectRoot = makeTempDir('openkit-runtime-summary-readiness-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-runtime-summary-readiness-home-'), PATH: '' } });

  await getTool(runtime, 'tool.capability-router').execute({
    rank: true,
    intent: 'debug React render performance issue',
    mode: 'full',
    role: 'FullstackAgent',
    stage: 'full_implementation',
    tags: ['frontend', 'performance'],
    maxCandidates: 2,
  });
  const result = await getTool(runtime, 'tool.runtime-summary').execute({ maxNextActions: 3 });

  assert.equal(result.status, 'no-context');
  assert.equal(result.message, 'Workflow kernel returned no runtime context');
  assert.equal(result.capabilityReadiness.schema, 'openkit/capability-read-model@1');
  assert.equal(result.capabilityOrchestration.schema, 'openkit/capability-read-model@1');
  assert.equal(result.capabilityOrchestration.validationSurface, 'runtime_tooling');
  assert.equal(result.capabilityOrchestration.readiness.targetProjectValidation.surface, 'target_project_app');
  assert.equal(result.capabilityOrchestration.readiness.targetProjectValidation.state, 'unavailable');
  assert.ok(result.capabilityOrchestration.nextActions.length <= 3);
  assert.ok(result.capabilityOrchestration.graph.total > 0);
  assert.equal(result.capabilityOrchestration.graph.familyCounts, undefined);
  assert.equal(result.capabilityOrchestration.graph.freshness, undefined);
  assert.equal(result.capabilityOrchestration.ownership, undefined);
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('capability decision ledger persists through runtime root and records selection decisions', async () => {
  const projectRoot = makeTempDir('openkit-capability-ledger-project-');
  const env = { OPENCODE_HOME: makeTempDir('openkit-capability-ledger-home-'), PATH: '' };
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env });

  const node = runtime.managers.capabilityRegistryManager.buildCapabilityGraph().nodes.find((entry) => entry.id === 'skill.verification-before-completion');
  const selection = runtime.managers.capabilityRegistryManager.selectCapability({ node, mode: 'full', stage: 'full_implementation', role: 'FullstackAgent' });
  const ledger = await getTool(runtime, 'tool.capability-ledger').execute({ action: 'list', capabilityId: node.id, limit: 5 });
  const reloadedManager = new CapabilityRegistryManager({
    mcpHealthManager: { list: () => [] },
    skillMcpManager: { listBindings: () => [] },
    runtimeRoot: projectRoot,
  });

  assert.equal(selection.eligible, true);
  assert.ok(ledger.entries.some((entry) => entry.actionType === 'select' && entry.outcome === 'selected'));
  assert.equal(ledger.persistence, 'file');
  assert.ok(reloadedManager.listDecisions({ capabilityId: node.id }).entries.length > 0);
});

test('capability router rank mode handles metadata-only skills as rankable but non-loadable', async () => {
  const projectRoot = makeTempDir('openkit-capability-rank-metadata-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-capability-rank-metadata-home-'), PATH: '' } });

  const result = await getTool(runtime, 'tool.capability-router').execute({
    rank: true,
    skillName: 'rust-router',
    mode: 'full',
    role: 'FullstackAgent',
    stage: 'full_implementation',
    includePreview: true,
    maxCandidates: 3,
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.selected.length, 0);
  const rustRouter = result.unavailable.find((entry) => entry.capabilityId === 'skill.rust-router');
  assert.ok(rustRouter);
  assert.match(rustRouter.reason, /metadata-only|never loadable/i);
  assert.ok(rustRouter.caveats.some((caveat) => /cannot be loaded|metadata/i.test(caveat)));
  assert.ok(rustRouter.nextActions.some((action) => /fallback|bundled skill body/i.test(action)));
});

test('capability router rank mode applies safer-local and policy guardrails', async () => {
  const projectRoot = makeTempDir('openkit-capability-rank-guardrails-project-');
  const runtime = bootstrapRuntimeFoundation({ projectRoot, env: { OPENCODE_HOME: makeTempDir('openkit-capability-rank-guardrails-home-'), PATH: '' } });
  const router = getTool(runtime, 'tool.capability-router');

  const localResult = await router.execute({
    rank: true,
    intent: 'inspect syntax parsing ast graph diagnostics',
    mode: 'full',
    role: 'FullstackAgent',
    stage: 'full_implementation',
    maxCandidates: 3,
  });
  assert.equal(localResult.status, 'ok');
  assert.equal(localResult.selected[0].activation.eligible, true);
  assert.ok(localResult.selected[0].reasons.some((reason) => reason.field === 'locality' && reason.value === 'local'));
  assert.ok(['read_only', 'diagnostic'].includes(localResult.selected[0].reasons.find((reason) => reason.field === 'sideEffectLevel')?.value));

  const browserResult = await router.execute({
    rank: true,
    intent: 'browser ui page inspection',
    mode: 'full',
    role: 'QAAgent',
    stage: 'full_qa',
    maxCandidates: 5,
  });
  assert.ok(browserResult.blocked.some((entry) => entry.policyGate === 'allowBrowser'));
  assert.ok(browserResult.blocked.some((entry) => /browser/i.test(entry.reason)));

  const mutatingResult = await router.execute({
    rank: true,
    intent: 'codemod apply migration',
    mode: 'migration',
    role: 'FullstackAgent',
    stage: 'migration_upgrade',
    maxCandidates: 5,
  });
  assert.ok(mutatingResult.blocked.some((entry) => entry.policyGate === 'allowMutating'));
});

test('activation policy gates git and local mutating capabilities before execution', () => {
  const manager = new CapabilityRegistryManager({
    mcpHealthManager: { list: () => [] },
    skillMcpManager: { listBindings: () => [] },
  });

  const gitSelection = manager.selectCapability({
    node: {
      id: 'mcp.git',
      family: 'bundled_mcp',
      state: 'preview',
      loadability: 'not_applicable',
      sideEffectLevel: 'git_mutating',
      locality: 'local',
      surface: 'runtime_tooling',
      lifecycle: 'policy_gated',
      roles: [],
      stages: [],
      caveats: [],
      nextActions: [],
      metadata: { enabled: true, mcpId: 'git' },
    },
    allowMutating: true,
    explicitUserIntent: false,
    taskRelevant: true,
    command: 'git reset --hard HEAD',
  });
  assert.equal(gitSelection.eligible, false);
  assert.equal(gitSelection.outcome, 'blocked');
  assert.equal(gitSelection.policy.sideEffectLevel, 'destructive');
  assert.match(gitSelection.reason, /dangerous|blocked/i);

  const localMutatingSelection = manager.selectCapability({
    node: {
      id: 'capability.codemod',
      family: 'runtime_tool',
      state: 'available',
      loadability: 'not_applicable',
      sideEffectLevel: 'local_mutating',
      locality: 'local',
      surface: 'runtime_tooling',
      roles: [],
      stages: [],
      caveats: [],
      nextActions: [],
      metadata: {},
    },
  });
  assert.equal(localMutatingSelection.eligible, false);
  assert.equal(localMutatingSelection.outcome, 'needs_confirmation');
  assert.equal(localMutatingSelection.policy.outcome, 'needs_confirmation');
});

test('activation policy reports missing key, placeholder key, and disabled MCP as unavailable', () => {
  const manager = new CapabilityRegistryManager({
    mcpHealthManager: { list: () => [] },
    skillMcpManager: { listBindings: () => [] },
  });
  const baseMcp = {
    family: 'bundled_mcp',
    state: 'available',
    loadability: 'not_applicable',
    sideEffectLevel: 'external_read',
    locality: 'external',
    surface: 'runtime_tooling',
    roles: [],
    stages: [],
    caveats: [],
    nextActions: [],
  };

  const missing = manager.selectCapability({
    node: { ...baseMcp, id: 'mcp.context7', metadata: { enabled: true, mcpId: 'context7', keyState: { CONTEXT7_API_KEY: 'missing' } } },
    allowExternal: true,
    taskRelevant: true,
  });
  assert.equal(missing.outcome, 'unavailable');
  assert.match(missing.reason, /secret|key/i);

  const placeholder = manager.selectCapability({
    node: { ...baseMcp, id: 'mcp.websearch', metadata: { enabled: true, mcpId: 'websearch', keyState: { WEBSEARCH_API_KEY: '${WEBSEARCH_API_KEY}' } } },
    allowExternal: true,
    taskRelevant: true,
  });
  assert.equal(placeholder.outcome, 'unavailable');
  assert.match(placeholder.reason, /placeholder|key/i);

  const disabled = manager.selectCapability({
    node: { ...baseMcp, id: 'mcp.grep_app', metadata: { enabled: false, mcpId: 'grep_app', keyState: { GREP_APP_API_KEY: 'present_redacted' } } },
    allowExternal: true,
    taskRelevant: true,
  });
  assert.equal(disabled.outcome, 'unavailable');
  assert.match(disabled.reason, /disabled/i);
});

test('manager graph uses current MCP health readiness for bundled keys and scope enablement', async () => {
  const projectRoot = makeTempDir('openkit-policy-health-project-');
  const opencodeHome = makeTempDir('openkit-policy-health-home-');
  const env = { OPENCODE_HOME: opencodeHome, PATH: process.env.PATH ?? '' };
  fs.mkdirSync(path.join(opencodeHome, 'openkit'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(opencodeHome, 'openkit', 'secrets.env'), `CONTEXT7_API_KEY=${SENTINEL}\n`, { mode: 0o600 });
  setMcpEnabled('context7', true, { env, scope: 'openkit' });

  const runtime = bootstrapRuntimeFoundation({ projectRoot, env });
  const result = await getTool(runtime, 'tool.capability-router').execute({
    rank: true,
    mcpId: 'context7',
    allowExternal: true,
    taskRelevant: true,
    maxCandidates: 3,
  });

  const context7 = result.selected.find((entry) => entry.capabilityId === 'mcp.context7')
    ?? result.downgraded.find((entry) => entry.capabilityId === 'mcp.context7')
    ?? result.blocked.find((entry) => entry.capabilityId === 'mcp.context7')
    ?? result.unavailable.find((entry) => entry.capabilityId === 'mcp.context7');
  assert.ok(context7);
  assert.notEqual(context7.reason, 'capability is not configured for execution');
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
});

test('activation policy requires browser and external allowances plus task relevance', () => {
  const manager = new CapabilityRegistryManager({
    mcpHealthManager: { list: () => [] },
    skillMcpManager: { listBindings: () => [] },
  });

  const browser = {
    id: 'mcp.playwright',
    family: 'bundled_mcp',
    state: 'available',
    loadability: 'not_applicable',
    sideEffectLevel: 'browser_mutating',
    locality: 'browser',
    surface: 'runtime_tooling',
    roles: [],
    stages: [],
    caveats: [],
    nextActions: [],
    metadata: { enabled: true, mcpId: 'playwright' },
  };
  assert.equal(manager.selectCapability({ node: browser, allowBrowser: false, taskRelevant: true }).outcome, 'blocked');
  assert.equal(manager.selectCapability({ node: browser, allowBrowser: true, taskRelevant: false }).outcome, 'blocked');

  const browserAllowed = manager.selectCapability({ node: browser, allowBrowser: true, allowMutating: true, taskRelevant: true });
  assert.equal(browserAllowed.eligible, true);
  assert.equal(browserAllowed.policy.outcome, 'approved');

  const external = {
    ...browser,
    id: 'mcp.websearch',
    sideEffectLevel: 'external_read',
    locality: 'external',
    metadata: { enabled: true, mcpId: 'websearch', keyState: { WEBSEARCH_API_KEY: 'present_redacted' } },
  };
  assert.equal(manager.selectCapability({ node: external, allowExternal: false, taskRelevant: true }).outcome, 'blocked');
  assert.equal(manager.selectCapability({ node: external, allowExternal: true, taskRelevant: false }).outcome, 'blocked');
  assert.equal(manager.selectCapability({ node: external, allowExternal: true, taskRelevant: true }).policy.outcome, 'approved');
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
