function uniqueIds(values = []) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export function inspectBackgroundDoctor(backgroundManager, workflowKernel = null) {
  const runs = backgroundManager?.list?.() ?? [];
  const runtimeStatus = workflowKernel?.showRuntimeStatusRelaxed?.() ?? workflowKernel?.showRuntimeStatus?.() ?? null;
  const workflowBackgroundRunSummary = runtimeStatus?.runtimeContext?.backgroundRunSummary ?? null;
  const staleLinkedRuns = workflowBackgroundRunSummary?.staleLinkedRunIds ?? [];
  const longRunningRuns = workflowBackgroundRunSummary?.longRunningRunIds ?? [];
  const staleRunningRuns = uniqueIds([...staleLinkedRuns, ...longRunningRuns]);

  return {
    backgroundEnabled: backgroundManager?.enabled ?? false,
    runCount: runs.length,
    persistentStoreActive: Boolean(backgroundManager?.persistentStore),
    activeRunCount: runs.filter((run) => run.status === 'running').length,
    linkedTaskRuns: runs.filter((run) => Boolean(run.task_id ?? run.link?.taskId)).length,
    continuationStatePresent: Boolean(backgroundManager?.persistentStore?.root),
    staleLinkedRuns,
    longRunningRuns,
    staleRunningRuns,
  };
}
