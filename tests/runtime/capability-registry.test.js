import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCapabilityIndex,
  getRuntimeCapability,
  listBundledMcpCapabilities,
  listBundledSkillCapabilities,
  listRuntimeCapabilities,
  STANDARD_CAPABILITY_STATES,
  VALIDATION_SURFACES,
} from '../../src/runtime/capability-registry.js';

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
  assert.equal(rustRouter.capabilityState, 'unavailable');
  assert.match(rustRouter.limitations.join('\n'), /not currently packaged/i);
});
