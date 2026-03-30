export function createWriteGuardHook({ workflowKernel }) {
  return {
    id: 'hook.write-guard',
    name: 'Write Guard Hook',
    stage: 'planned',
    run({ path, workItemId = null, taskId = null }) {
      const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
      const currentMode = runtimeStatus?.state?.mode ?? null;
      const taskBoardPresent = runtimeStatus?.runtimeContext?.taskBoardPresent ?? false;
      const blockedBy = [];

      if (currentMode === 'quick' && taskId && !workItemId) {
        blockedBy.push('task-write-outside-work-item');
      }

      if (currentMode === 'full' && taskId && !taskBoardPresent) {
        blockedBy.push('missing-task-board');
      }

      return {
        path,
        workItemId,
        taskId,
        allowed: blockedBy.length === 0,
        mode: currentMode,
        taskBoardPresent,
        blockedBy,
        reason:
          blockedBy[0] === 'task-write-outside-work-item'
            ? 'quick mode does not allow task-scoped writes without an explicit work item'
            : blockedBy[0] === 'missing-task-board'
              ? 'full-delivery task-scoped writes require an active task board'
              : null,
      };
    },
  };
}
