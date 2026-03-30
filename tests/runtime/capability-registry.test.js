import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCapabilityIndex,
  getRuntimeCapability,
  listRuntimeCapabilities,
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
