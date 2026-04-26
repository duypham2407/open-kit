export function createCapabilityRouterTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.capability-router',
    name: 'Capability Router',
    description: 'Routes an intent, skill, or MCP id to the best available capability.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      return { validationSurface: 'runtime_tooling', ...capabilityRegistryManager.routeCapability(input) };
    },
  };
}
