export function createCapabilityHealthTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.capability-health',
    name: 'Capability Health',
    description: 'Runs read-only local capability health checks.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      return { status: 'ok', validationSurface: 'runtime_tooling', ...capabilityRegistryManager.health(input) };
    },
  };
}
