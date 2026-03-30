export function inspectMcpDoctor(mcpPlatform) {
  return {
    builtinMcps: mcpPlatform?.builtin?.length ?? 0,
  };
}
