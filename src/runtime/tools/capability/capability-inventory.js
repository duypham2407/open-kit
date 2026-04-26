export function createCapabilityInventoryTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.capability-inventory',
    name: 'Capability Inventory',
    description: 'Lists bundled MCP and skill capabilities with redacted key state.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      const { mcps, skills } = capabilityRegistryManager.listCapabilities(input);
      return { status: 'ok', validationSurface: 'runtime_tooling', mcps, skills };
    },
  };
}
