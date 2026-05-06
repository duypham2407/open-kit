import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRuntimeCapabilityGraph,
  createCapabilityIndex,
  getRuntimeCapability,
  listBundledMcpCapabilities,
  listBundledSkillCapabilities,
  listRuntimeCapabilities,
  STANDARD_CAPABILITY_STATES,
  VALIDATION_SURFACES,
} from '../../src/runtime/capability-registry.js';
import {
  assertCapabilityGraph,
  CAPABILITY_GRAPH_FAMILIES,
  CAPABILITY_LOADABILITY_VALUES,
  CAPABILITY_SIDE_EFFECT_LEVELS,
  normalizeSkillToGraphNode,
} from '../../src/capabilities/capability-graph.js';

test('listRuntimeCapabilities exposes foundation capabilities by default', () => {
  const capabilities = listRuntimeCapabilities({
    config: {
      runtime: {
        featureFlags: {
          managers: true,
          tools: true,
          hooks: true,
          capabilityDiagnostics: true,
        },
      },
      disabled: {
        capabilities: [],
      },
    },
  });

  assert.ok(capabilities.some((entry) => entry.id === 'capability.runtime-bootstrap'));
  assert.ok(capabilities.some((entry) => entry.id === 'capability.manager-layer'));
  assert.ok(capabilities.some((entry) => entry.id === 'capability.tool-registry'));
  assert.ok(capabilities.some((entry) => entry.id === 'capability.capability-registry'));
  assert.ok(capabilities.some((entry) => entry.id === 'capability.session-tooling'));
  assert.ok(capabilities.some((entry) => entry.id === 'capability.continuation-control'));
});

test('listRuntimeCapabilities respects disabled capability ids and feature flags', () => {
  const capabilities = listRuntimeCapabilities({
    config: {
      runtime: {
        featureFlags: {
          hooks: false,
        },
      },
      disabled: {
        capabilities: ['capability.background-execution'],
      },
    },
  });

  assert.equal(capabilities.some((entry) => entry.id === 'capability.hook-registry'), false);
  assert.equal(capabilities.some((entry) => entry.id === 'capability.background-execution'), false);
});

test('createCapabilityIndex and getRuntimeCapability expose runtime capability metadata', () => {
  const config = {
    runtime: {
      featureFlags: {
        managers: true,
        tools: true,
        hooks: true,
        capabilityDiagnostics: true,
      },
    },
    disabled: {
      capabilities: [],
    },
  };
  const capabilityIndex = createCapabilityIndex({ config });

  assert.equal(capabilityIndex['capability.runtime-config-layering'].status, 'active');
  assert.equal(capabilityIndex['capability.background-execution'].status, 'foundation');
  assert.equal(
    getRuntimeCapability('capability.capability-registry', { config })?.category,
    'foundation'
  );
});

test('runtime capabilities expose standardized capability states and validation surfaces', () => {
  const capabilities = listRuntimeCapabilities({
    config: {
      runtime: {
        featureFlags: {
          managers: true,
          tools: true,
          hooks: true,
          capabilityDiagnostics: true,
        },
      },
      disabled: {
        capabilities: [],
      },
    },
  });

  assert.deepEqual(STANDARD_CAPABILITY_STATES, [
    'available',
    'unavailable',
    'degraded',
    'preview',
    'compatibility_only',
    'not_configured',
  ]);
  assert.ok(VALIDATION_SURFACES.includes('global_cli'));
  assert.ok(VALIDATION_SURFACES.includes('runtime_tooling'));
  assert.ok(VALIDATION_SURFACES.includes('package'));
  assert.ok(VALIDATION_SURFACES.includes('target_project_app'));
  assert.ok(capabilities.length > 0);

  for (const capability of capabilities) {
    assert.ok(STANDARD_CAPABILITY_STATES.includes(capability.capabilityState));
    assert.ok(VALIDATION_SURFACES.includes(capability.validationSurface));
  }

  assert.equal(
    capabilities.find((entry) => entry.id === 'capability.runtime-bootstrap')?.capabilityState,
    'available'
  );
  assert.equal(
    capabilities.find((entry) => entry.id === 'capability.background-execution')?.capabilityState,
    'preview'
  );
});

test('runtime capability registry exposes bundled MCP and skill catalog capabilities', () => {
  const mcps = listBundledMcpCapabilities();
  const skills = listBundledSkillCapabilities();

  assert.ok(mcps.some((entry) => entry.id === 'mcp.context7'));
  assert.ok(mcps.some((entry) => entry.id === 'mcp.augment_context_engine'));
  assert.ok(skills.some((entry) => entry.id === 'skill.verification-before-completion'));
  assert.ok(skills.some((entry) => entry.id === 'skill.rust-router'));

  const context7 = mcps.find((entry) => entry.id === 'mcp.context7');
  assert.equal(context7.capabilityState, 'not_configured');
  assert.equal(context7.validationSurface, 'runtime_tooling');
  assert.deepEqual(context7.secretEnvVars, ['CONTEXT7_API_KEY']);

  const rustRouter = skills.find((entry) => entry.id === 'skill.rust-router');
  assert.equal(rustRouter.status, 'foundation');
  assert.equal(rustRouter.skillStatus, 'preview');
  assert.equal(rustRouter.capabilityState, 'unavailable');
  assert.equal(rustRouter.support_level, 'stub');
  assert.match(rustRouter.limitations.join('\n'), /no bundled skill file/i);
  assert.ok(Array.isArray(rustRouter.recommended_mcps));

  const verification = skills.find((entry) => entry.id === 'skill.verification-before-completion');
  assert.equal(verification.skillStatus, 'stable');
  assert.equal(verification.capabilityState, 'available');
  assert.deepEqual(verification.roles.includes('FullstackAgent'), true);
});

test('capability graph normalizes runtime, MCP, skill, metadata-only, and target validation nodes', () => {
  const graph = buildRuntimeCapabilityGraph();
  assertCapabilityGraph(graph);

  assert.equal(graph.schema, 'openkit/capability-graph@1');
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.summary.total >= graph.nodes.length);
  assert.ok(CAPABILITY_GRAPH_FAMILIES.includes('metadata_only_skill'));
  assert.ok(CAPABILITY_LOADABILITY_VALUES.includes('non_loadable'));
  assert.ok(CAPABILITY_SIDE_EFFECT_LEVELS.includes('workflow_mutating'));

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const openkitMcp = byId.get('mcp.openkit');
  const context7Mcp = byId.get('mcp.context7');
  const gitMcp = byId.get('mcp.git');
  const verificationSkill = byId.get('skill.verification-before-completion');
  const rustRouter = byId.get('skill.rust-router');
  const runtimeCodemod = byId.get('capability.codemod');
  const targetTestProbe = byId.get('target_project.validation.test-run');

  assert.equal(openkitMcp.family, 'bundled_mcp');
  assert.equal(openkitMcp.ownership, 'openkit-bundled');
  assert.equal(openkitMcp.surface, 'runtime_tooling');
  assert.equal(openkitMcp.sideEffectLevel, 'workflow_mutating');
  assert.ok(openkitMcp.relationships.some((relationship) => relationship.targetId === 'skill.verification-before-completion'));

  assert.equal(context7Mcp.state, 'not_configured');
  assert.equal(context7Mcp.locality, 'external');
  assert.equal(context7Mcp.metadata.enabled, false);
  assert.equal(context7Mcp.metadata.keyState.CONTEXT7_API_KEY, 'not_configured');
  assert.ok(context7Mcp.caveats.some((caveat) => /secret|key/i.test(caveat)));
  assert.ok(context7Mcp.nextActions.some((action) => /set-key|doctor/i.test(action)));

  assert.equal(gitMcp.sideEffectLevel, 'git_mutating');
  assert.equal(gitMcp.lifecycle, 'policy_gated');
  assert.equal(gitMcp.metadata.policy.destructiveOperations, 'blocked');

  assert.equal(verificationSkill.family, 'skill');
  assert.equal(verificationSkill.loadability, 'loadable');
  assert.equal(verificationSkill.sideEffectLevel, 'read_only');
  assert.ok(verificationSkill.roles.includes('FullstackAgent'));
  assert.ok(verificationSkill.stages.includes('full_implementation'));
  assert.ok(verificationSkill.relationships.some((relationship) => relationship.targetId === 'mcp.openkit'));

  assert.equal(rustRouter.family, 'metadata_only_skill');
  assert.equal(rustRouter.state, 'unavailable');
  assert.equal(rustRouter.loadability, 'non_loadable');
  assert.equal(rustRouter.sideEffectLevel, 'metadata_only');
  assert.ok(rustRouter.caveats.some((caveat) => /cannot be loaded|metadata/i.test(caveat)));
  assert.ok(rustRouter.nextActions.some((action) => /fallback|bundled skill body/i.test(action)));

  assert.equal(runtimeCodemod.family, 'runtime_tool');
  assert.equal(runtimeCodemod.sideEffectLevel, 'local_mutating');
  assert.equal(runtimeCodemod.locality, 'local');
  assert.ok(runtimeCodemod.caveats.some((caveat) => /policy/i.test(caveat)));

  assert.equal(targetTestProbe.family, 'target_project_validation_probe');
  assert.equal(targetTestProbe.surface, 'target_project_app');
  assert.equal(targetTestProbe.state, 'not_configured');
  assert.equal(targetTestProbe.loadability, 'not_applicable');
  assert.ok(targetTestProbe.caveats.some((caveat) => /not target-project validation evidence/i.test(caveat)));
});

test('capability graph preserves statuses, validation surfaces, freshness, and relationships', () => {
  const graph = buildRuntimeCapabilityGraph();

  for (const node of graph.nodes) {
    assert.ok(STANDARD_CAPABILITY_STATES.includes(node.state), `${node.id} uses unsupported state`);
    assert.ok(VALIDATION_SURFACES.includes(node.surface), `${node.id} uses unsupported surface`);
    assert.ok(node.freshness.state, `${node.id} includes freshness state`);
    assert.ok(Array.isArray(node.caveats), `${node.id} caveats are list-shaped`);
    assert.ok(Array.isArray(node.nextActions), `${node.id} nextActions are list-shaped`);
    assert.ok(Array.isArray(node.relationships), `${node.id} relationships are list-shaped`);
  }

  const relationshipPairs = graph.relationships.map((relationship) => `${relationship.sourceId}->${relationship.targetId}`);
  assert.ok(relationshipPairs.includes('skill.verification-before-completion->mcp.openkit'));
  assert.ok(relationshipPairs.includes('mcp.openkit->skill.verification-before-completion'));
  assert.equal(graph.summary.surfaces.runtime_tooling > 0, true);
  assert.equal(graph.summary.surfaces.target_project_app > 0, true);
  assert.equal(graph.summary.loadability.non_loadable > 0, true);
});

test('capability graph treats stub skills as discoverable but non-loadable', () => {
  const node = normalizeSkillToGraphNode({
    id: 'skill.example-stub',
    name: 'example-stub',
    displayName: 'Example Stub',
    description: 'Metadata-only example skill.',
    path: 'skills/example-stub/SKILL.md',
    status: 'preview',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    source: { kind: 'stub', origin: 'openkit' },
    support_level: 'stub',
    packaging: { source: 'repo', installBundle: false, bundledPath: null },
    tags: ['example'],
    roles: ['FullstackAgent'],
    stages: ['full_implementation'],
    triggers: [{ kind: 'keyword', value: 'example' }],
    recommended_mcps: [],
    limitations: [],
    sourceExists: true,
    bundleExists: false,
    bundled: false,
  });

  assert.equal(node.family, 'metadata_only_skill');
  assert.equal(node.loadability, 'non_loadable');
  assert.equal(node.sideEffectLevel, 'metadata_only');
  assert.ok(node.caveats.some((caveat) => /cannot be loaded|metadata/i.test(caveat)));
  assert.ok(node.nextActions.some((action) => /fallback|bundled skill body/i.test(action)));
});
