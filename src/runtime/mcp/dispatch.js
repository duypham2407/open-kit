export function dispatchMcpCall(mcpPlatform, mcpName, input = {}) {
  const builtin = mcpPlatform.builtin.find((entry) => entry.name === mcpName || entry.id === mcpName);
  if (!builtin) {
    throw new Error(`Unknown MCP '${mcpName}'`);
  }

  return {
    mcp: builtin.name,
    status: 'dispatched',
    input,
    source: builtin.transport,
  };
}
