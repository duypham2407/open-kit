export function createMcpDispatchTool({ mcpPlatform }) {
  return {
    id: 'tool.mcp-dispatch',
    execute(mcpName, input) {
      return mcpPlatform.dispatch(mcpName, input);
    },
  };
}
