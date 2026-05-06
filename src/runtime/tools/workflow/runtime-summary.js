export function createRuntimeSummaryTool({ workflowKernel, capabilityRegistryManager = null }) {
  return {
    id: 'tool.runtime-summary',
    description: 'Reads workflow-backed runtime summary with bounded capability readiness',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'compatibility_runtime',
    execute(input = {}) {
      const customStatePath = input?.customStatePath ?? null;
      const result = workflowKernel.showRuntimeStatus(customStatePath);
      const runtimeContext = result?.runtimeContext ?? null;
      const readiness = buildBoundedCapabilityReadiness({ capabilityRegistryManager, input });
      if (!runtimeContext) {
        return {
          status: 'no-context',
          message: 'Workflow kernel returned no runtime context',
          ...readiness,
        };
      }
      return {
        status: 'ok',
        runtimeContext,
        ...readiness,
      };
    },
  };
}

function buildBoundedCapabilityReadiness({ capabilityRegistryManager, input = {} } = {}) {
  const capabilityReadiness = capabilityRegistryManager?.buildReadModel?.({
    scope: input?.scope ?? 'openkit',
    maxNextActions: input?.maxNextActions ?? 5,
  }) ?? null;

  return {
    capabilityReadiness,
    capabilityOrchestration: capabilityReadiness ? {
      schema: capabilityReadiness.schema,
      status: capabilityReadiness.status,
      validationSurface: capabilityReadiness.validationSurface,
      freshnessLabel: capabilityReadiness.freshnessLabel,
      graph: {
        total: capabilityReadiness.graph?.total ?? 0,
        statusDistribution: capabilityReadiness.graph?.statusDistribution ?? {},
        policyGatedCount: capabilityReadiness.graph?.policyGatedCount ?? 0,
        metadataOnlySkills: capabilityReadiness.graph?.metadataOnlySkills ?? 0,
        unavailableSkills: capabilityReadiness.graph?.unavailableSkills ?? 0,
      },
      readiness: capabilityReadiness.readiness,
      ledger: capabilityReadiness.ledger,
      nextActions: capabilityReadiness.nextActions,
    } : null,
  };
}
