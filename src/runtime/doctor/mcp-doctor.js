export function inspectMcpDoctor(mcpPlatform) {
  return {
    builtinMcps: mcpPlatform?.builtin?.length ?? 0,
    loadedConfigPath: mcpPlatform?.loaded?.path ?? null,
    loadedConfigSource: mcpPlatform?.loaded?.source ?? null,
    loadedServerCount: mcpPlatform?.loadedServers?.length ?? 0,
    enabledBuiltinIds: mcpPlatform?.enabledBuiltinIds ?? [],
  };
}
