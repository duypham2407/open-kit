export function createContinuationStartTool({ continuationStateManager, workflowKernel }) {
  return {
    id: 'tool.continuation-start',
    name: 'Continuation Start Tool',
    description: 'Starts bounded continuation tracking without advancing workflow state.',
    family: 'continuation',
    stage: 'active',
    status: 'active',
    execute(input = {}) {
      const runtimeStatus = workflowKernel?.showRuntimeStatusRelaxed?.() ?? workflowKernel?.showRuntimeStatus?.() ?? null;
      return continuationStateManager.start({
        ...input,
        workItemId: input.workItemId ?? runtimeStatus?.runtimeContext?.activeWorkItemId ?? null,
        mode: input.mode ?? runtimeStatus?.state?.mode ?? null,
        stage: input.stage ?? runtimeStatus?.state?.current_stage ?? null,
      });
    },
  };
}
