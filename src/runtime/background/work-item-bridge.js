export function createWorkItemBridge({ projectRoot }) {
  return {
    projectRoot,
    linkRunToWorkItem({ runId, workItemId = null, taskId = null }) {
      return {
        runId,
        workItemId,
        taskId,
      };
    },
  };
}
