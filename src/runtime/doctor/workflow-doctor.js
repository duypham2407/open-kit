export function inspectWorkflowDoctor(workflowKernel) {
  const runtimeStatus = workflowKernel?.showRuntimeStatusRelaxed?.() ?? workflowKernel?.showRuntimeStatus?.() ?? null;
  const runtimeContext = runtimeStatus?.runtimeContext ?? null;
  const activeTasks = runtimeContext?.taskBoardSummary?.activeTasks ?? [];
  const parallelization = runtimeContext?.parallelization ?? null;
  const orchestrationHealth = runtimeContext?.orchestrationHealth ?? {
    blocked: false,
    dispatchable: false,
    reason: null,
    recommendedAction: null,
  };

  return {
    status: workflowKernel?.available ? (runtimeStatus ? 'connected' : 'configured') : 'unavailable',
    mode: runtimeStatus?.state?.mode ?? null,
    stage: runtimeStatus?.state?.current_stage ?? null,
    activeWorkItemId: runtimeStatus?.runtimeContext?.activeWorkItemId ?? null,
    nextAction: runtimeStatus?.runtimeContext?.nextAction ?? null,
    taskBoardPresent: runtimeContext?.taskBoardPresent ?? false,
    taskBoardSummary: runtimeContext?.taskBoardSummary ?? null,
    migrationSliceBoardPresent: runtimeContext?.migrationSliceBoardPresent ?? false,
    migrationSliceSummary: runtimeContext?.migrationSliceSummary ?? null,
    migrationSliceReadiness: runtimeContext?.migrationSliceReadiness ?? null,
    migrationSliceBoardValid: runtimeContext?.migrationSliceBoardValid ?? null,
    migrationSliceBoardError: runtimeContext?.migrationSliceBoardError ?? null,
    activeTasks,
    parallelization,
    backgroundRunSummary: runtimeContext?.backgroundRunSummary ?? null,
    verificationReadiness: runtimeContext?.verificationReadiness ?? null,
    issueTelemetry: runtimeContext?.issueTelemetry ?? null,
    orchestrationHealth,
  };
}
