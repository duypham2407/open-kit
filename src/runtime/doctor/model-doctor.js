export function inspectModelDoctor(modelRuntime) {
  return {
    resolvedModels: modelRuntime?.resolvedModels?.length ?? 0,
    uniqueResolvedModels: [...new Set(modelRuntime?.resolvedModels ?? [])].length,
    diagnostics: modelRuntime?.diagnostics ?? null,
    fallbackChains: modelRuntime?.fallbackChains ?? [],
    resolutionTrace: modelRuntime?.resolutionTrace ?? [],
  };
}
