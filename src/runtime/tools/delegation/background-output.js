export function createBackgroundOutputTool({ backgroundManager }) {
  return {
    id: 'tool.background-output',
    description: 'Reads delegated background run output',
    execute(runId) {
      const run = backgroundManager.get(runId);
      if (!run) {
        return { status: 'not-found', runId, message: `No background run found for id: ${runId}` };
      }
      return {
        status: run.status,
        runId,
        workflowRunId: run.workflowRunId ?? null,
        output: run.output ?? null,
        link: run.link ?? null,
      };
    },
  };
}
