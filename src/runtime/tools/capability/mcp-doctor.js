export function createMcpDoctorTool({ capabilityRegistryManager }) {
  return {
    id: 'tool.mcp-doctor',
    name: 'MCP Doctor',
    description: 'Read-only doctor report for bundled MCP capability pack readiness.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      const health = capabilityRegistryManager.health(input);
      const mcps = health.mcps ?? [];
      const issues = mcps.flatMap((entry) => {
        const problems = [];
        if (entry.enabled && entry.capabilityState === 'not_configured') {
          problems.push({ mcpId: entry.mcpId, state: entry.capabilityState, guidance: entry.guidance });
        }
        if (entry.enabled && entry.capabilityState === 'unavailable') {
          problems.push({ mcpId: entry.mcpId, state: entry.capabilityState, guidance: entry.guidance });
        }
        return problems;
      });

      return {
        status: issues.length > 0 ? 'degraded' : 'ok',
        validationSurface: 'runtime_tooling',
        scope: input.scope ?? 'openkit',
        total: mcps.length,
        issues,
        mcps,
      };
    },
  };
}
