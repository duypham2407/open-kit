export function createDelegationTaskTool({ backgroundManager, delegationSupervisor }) {
  return {
    id: 'tool.delegation-task',
    description: 'Dispatches delegated background work',
    execute(input) {
      if (input?.dispatchReadyTask && input?.workItemId) {
        const actionTracking = input?.__actionTracking ?? null;
        return delegationSupervisor.dispatchReadyTask({
          workItemId: input.workItemId,
          requestedBy: input.requestedBy,
          owner: input.owner,
          customStatePath: input.customStatePath,
          actionTracking,
        });
      }
      return backgroundManager.spawn(input);
    },
  };
}
