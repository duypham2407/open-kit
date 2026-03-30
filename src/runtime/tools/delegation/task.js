export function createDelegationTaskTool({ backgroundManager }) {
  return {
    id: 'tool.delegation-task',
    execute(input) {
      return backgroundManager.spawn(input);
    },
  };
}
