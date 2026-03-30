export function createBackgroundCancelTool({ backgroundManager }) {
  return {
    id: 'tool.background-cancel',
    description: 'Cancels delegated background run',
    execute(input) {
      if (typeof input === 'string') {
        return backgroundManager.cancel(input);
      }

      return backgroundManager.cancel(input?.runId, input?.customStatePath ?? null);
    },
  };
}
