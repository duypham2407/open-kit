export function createRuntimeSummaryTool({ workflowKernel }) {
  return {
    id: 'tool.runtime-summary',
    description: 'Reads workflow-backed runtime summary',
    execute(input = {}) {
      const customStatePath = input?.customStatePath ?? null;
      return workflowKernel.showRuntimeStatus(customStatePath)?.runtimeContext ?? null;
    },
  };
}
