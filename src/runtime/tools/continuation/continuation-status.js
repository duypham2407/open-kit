export function createContinuationStatusTool({ continuationStateManager, workflowKernel, sessionStateManager }) {
  return {
    id: 'tool.continuation-status',
    name: 'Continuation Status Tool',
    description: 'Reads persistent continuation state and next-step context.',
    family: 'continuation',
    stage: 'active',
    status: 'active',
    execute() {
      const state = continuationStateManager?.summary?.() ?? null;
      const latestSession = sessionStateManager?.latest?.() ?? null;
      const runtimeStatus = workflowKernel?.showRuntimeStatusRelaxed?.() ?? workflowKernel?.showRuntimeStatus?.() ?? null;

      return {
        continuation: state,
        latestSession,
        runtimeStatus,
      };
    },
  };
}
