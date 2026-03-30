export function createBackgroundOutputTool({ backgroundManager }) {
  return {
    id: 'tool.background-output',
    execute(runId) {
      return backgroundManager.get(runId)?.output ?? null;
    },
  };
}
