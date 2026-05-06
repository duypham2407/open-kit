export function createCapabilityReadinessTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.capability-readiness',
    name: 'Capability Readiness',
    description: 'Returns a bounded sanitized capability dashboard read model.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      return capabilityRegistryManager.buildReadModel(input);
    },
  };
}
