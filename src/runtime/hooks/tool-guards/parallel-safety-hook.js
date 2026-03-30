export function createParallelSafetyHook({ workflowKernel }) {
  return {
    id: 'hook.parallel-safety-guard',
    name: 'Parallel Safety Guard',
    stage: 'planned',
    run({ parallelMode = 'off', workItemId = null } = {}) {
      const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
      const workflowParallelMode = runtimeStatus?.parallelization?.parallel_mode ?? 'none';
      const maxActiveExecutionTracks = runtimeStatus?.parallelization?.max_active_execution_tracks ?? null;
      const mode = runtimeStatus?.state?.mode ?? null;
      const blocked = mode === 'quick' && parallelMode !== 'off';
      const blockedBy = [];

      if (blocked) {
        blockedBy.push('quick-mode-no-parallelism');
      }

      if (!blocked && workflowParallelMode === 'none' && parallelMode !== 'off') {
        blockedBy.push('workflow-parallelization-disabled');
      }

      return {
        parallelMode,
        workflowParallelMode,
        maxActiveExecutionTracks,
        workItemId,
        blocked: blocked || blockedBy.length > 0,
        allowed: !blocked && blockedBy.length === 0,
        blockedBy,
        reason:
          blockedBy[0] === 'quick-mode-no-parallelism'
            ? 'quick mode does not support parallel execution'
            : blockedBy[0] === 'workflow-parallelization-disabled'
              ? 'workflow parallelization is currently disabled for the active work item'
              : null,
      };
    },
  };
}
