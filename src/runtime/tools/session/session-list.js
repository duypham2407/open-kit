export function createSessionListTool({ sessionStateManager }) {
  return {
    id: 'tool.session-list',
    execute() {
      return sessionStateManager.list();
    },
  };
}
