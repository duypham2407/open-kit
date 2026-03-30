export function inspectModelDoctor(modelRuntime) {
  return {
    resolvedModels: modelRuntime?.resolvedModels?.length ?? 0,
  };
}
