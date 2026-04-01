export function createWorkItemBridge({ projectRoot, workflowKernel = null, actionModelStateManager = null }) {
  return {
    projectRoot,
    workflowKernel,
    linkRunToWorkItem({ runId, workItemId = null, taskId = null, customStatePath = null }) {
      const runtimeState = workflowKernel?.showRuntimeStatus?.(customStatePath) ?? null;
      return {
        runId,
        workItemId,
        taskId,
        customStatePath,
        workflowStage: runtimeState?.state?.current_stage ?? null,
        workflowMode: runtimeState?.state?.mode ?? null,
      };
    },
    onRunStarted({ runId, title, payload = {}, workItemId = null, taskId = null, customStatePath = null }) {
      if (!workflowKernel) {
        return null;
      }

      const result = workflowKernel.startBackgroundRun({
        title,
        payload: {
          source: 'runtime-background-manager',
          runId,
          ...payload,
        },
        workItemId,
        taskId,
        customStatePath,
      });
      return result?.run?.run_id ?? null;
    },
    onRunCompleted({ runId, workflowRunId = null, output = null, taskId = null, workItemId = null, customStatePath = null, actionTracking = null }) {
      if (!workflowKernel) {
        return null;
      }

      if (actionTracking?.subjectId && actionTracking?.actionKey) {
        actionModelStateManager?.recordSuccess?.({
          subjectId: actionTracking.subjectId,
          actionKey: actionTracking.actionKey,
        });
      }

      const result = workflowKernel.completeBackgroundRun({ runId: workflowRunId ?? runId, output, customStatePath });
      if (workItemId && taskId) {
        const task = workflowKernel.listTasks(workItemId, customStatePath)?.tasks?.find((entry) => entry.task_id === taskId) ?? null;

        if (task?.status === 'in_progress') {
          workflowKernel.setTaskStatus({
            workItemId,
            taskId,
            status: 'dev_done',
            customStatePath,
          });

          if (task.qa_owner) {
            workflowKernel.setTaskStatus({
              workItemId,
              taskId,
              status: 'qa_ready',
              customStatePath,
            });
          }
        }

        workflowKernel.recordVerificationEvidence({
          id: `runtime-${workflowRunId ?? runId}`,
          kind: 'runtime',
          scope: taskId,
          summary: `Background run '${workflowRunId ?? runId}' completed for task '${taskId}'.`,
          source: 'runtime-background-manager',
          artifact_refs: [],
        }, customStatePath);
      }
      return result;
    },
    onRunCancelled({ runId, workflowRunId = null, customStatePath = null, actionTracking = null }) {
      if (!workflowKernel) {
        return null;
      }

      if (actionTracking?.subjectId && actionTracking?.actionKey) {
        actionModelStateManager?.recordFailure?.({
          subjectId: actionTracking.subjectId,
          actionKey: actionTracking.actionKey,
          detail: 'background run cancelled',
        });
      }

      return workflowKernel.cancelBackgroundRun({ runId: workflowRunId ?? runId, customStatePath });
    },
  };
}
