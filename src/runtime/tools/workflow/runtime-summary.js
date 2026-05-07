export function createRuntimeSummaryTool({ workflowKernel }) {
  return {
    id: 'tool.runtime-summary',
    description: 'Reads workflow-backed runtime summary',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'compatibility_runtime',
    execute(input = {}) {
      const customStatePath = input?.customStatePath ?? null;
      const result = workflowKernel.showRuntimeStatus(customStatePath);
      const runtimeContext = result?.runtimeContext ?? null;
      if (!runtimeContext) {
        return { status: 'no-context', message: 'Workflow kernel returned no runtime context' };
      }
      return { status: 'ok', runtimeContext };
    },
  };
}
