export function createSkillMcpBindingsTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.skill-mcp-bindings',
    name: 'Skill MCP Bindings',
    description: 'Lists skill-to-MCP binding read model from the bundled catalog.',
    family: 'capability',
    status: 'active',
    async execute() {
      return { status: 'ok', validationSurface: 'runtime_tooling', bindings: capabilityRegistryManager.listSkillMcpBindings() };
    },
  };
}
