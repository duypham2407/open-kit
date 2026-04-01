export function dispatchMcpCall(mcpPlatform, mcpName, input = {}) {
  const builtin = mcpPlatform.builtin.find((entry) => entry.name === mcpName || entry.id === mcpName);
  if (!builtin) {
    return {
      status: 'unknown-mcp',
      mcp: mcpName,
      input,
      available: (mcpPlatform.builtin ?? []).map((entry) => entry.name ?? entry.id).filter(Boolean),
    };
  }

  return {
    mcp: builtin.name,
    status: 'dispatched',
    input,
    source: builtin.transport,
  };
}
