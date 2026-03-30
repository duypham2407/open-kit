export function createBackgroundOutputTool({ backgroundManager }) {
  return {
    id: 'tool.background-output',
    description: 'Reads delegated background run output',
    execute(runId) {
      const run = backgroundManager.get(runId);
      return run
        ? {
            runId,
            workflowRunId: run.workflowRunId ?? null,
            status: run.status,
            output: run.output ?? null,
            link: run.link ?? null,
          }
        : null;
    },
  };
}
