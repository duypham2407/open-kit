export function createBackgroundCancelTool({ backgroundManager }) {
  return {
    id: 'tool.background-cancel',
    execute(runId) {
      return backgroundManager.cancel(runId);
    },
  };
}
