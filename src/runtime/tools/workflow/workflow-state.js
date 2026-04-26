export function createWorkflowStateTool({ projectRoot, workflowKernel }) {
  return {
    id: 'tool.workflow-state',
    description: 'Reads governed workflow runtime state',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'compatibility_only',
    validationSurface: 'compatibility_runtime',
    execute(input = 'status') {
      const command = typeof input === 'string' ? input : input?.command ?? 'status';
      const customStatePath = typeof input === 'string' ? null : input?.customStatePath ?? null;

      if (command === 'status') {
        return workflowKernel.showRuntimeStatus(customStatePath);
      }

      if (command === 'show') {
        return workflowKernel.showState(customStatePath);
      }

      if (command === 'doctor') {
        return workflowKernel.runDoctor(customStatePath);
      }

      if (command === 'metrics') {
        return workflowKernel.getWorkflowMetrics(customStatePath);
      }

      return {
        command,
        projectRoot,
        customStatePath,
      };
    },
  };
}
