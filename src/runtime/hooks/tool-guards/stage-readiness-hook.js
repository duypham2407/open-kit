export function createStageReadinessHook({ workflowKernel }) {
  return {
    id: 'hook.stage-readiness-guard',
    name: 'Stage Readiness Guard',
    stage: 'planned',
    run({ requiredStages = [] } = {}) {
      const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
      const currentStage = runtimeStatus?.state?.current_stage ?? null;
      const allowed = requiredStages.length === 0 || requiredStages.includes(currentStage);
      return {
        ready: allowed,
        currentStage,
        requiredStages,
        blocked: !allowed,
        reason: allowed ? null : `current stage '${currentStage ?? 'unknown'}' is not in the allowed stage set`,
        blockedBy: allowed ? [] : ['stage-mismatch'],
      };
    },
  };
}
