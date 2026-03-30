export function createSessionSearchTool({ sessionStateManager }) {
  return {
    id: 'tool.session-search',
    execute(query) {
      const text = String(query ?? '').toLowerCase();
      return sessionStateManager.list().filter((entry) =>
        JSON.stringify(entry).toLowerCase().includes(text)
      );
    },
  };
}
