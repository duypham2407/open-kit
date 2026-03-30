export function createRuntimeStatusHook({ capabilitySummary, workflowKernel, sessionStateManager = null }) {
  return {
    id: 'hook.runtime-status',
    name: 'Runtime Status Hook',
    stage: 'foundation',
    run() {
      const workflowRuntime = workflowKernel?.showRuntimeStatusRelaxed?.() ?? workflowKernel?.showRuntimeStatus?.() ?? null;
      return {
        capabilitySummary,
        workflowRuntime,
        latestSession: sessionStateManager?.latest?.() ?? null,
      };
    },
  };
}
