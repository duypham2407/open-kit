export function createSessionReadTool({ sessionStateManager }) {
  return {
    id: 'tool.session-read',
    execute(index = 0) {
      return sessionStateManager.list()[index] ?? null;
    },
  };
}
