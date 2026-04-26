export function inspectCapabilityDoctor(runtimeFoundation) {
  const toolFamilies = runtimeFoundation?.tools?.toolFamilies ?? [];
  const capabilities = runtimeFoundation?.capabilities ?? [];
  const capabilityStatuses = Object.fromEntries(
    capabilities.map((capability) => [capability.id, capability.status])
  );
  const capabilityStateById = Object.fromEntries(
    capabilities.map((capability) => [capability.id, capability.capabilityState ?? capability.status])
  );
  const validationSurfaceById = Object.fromEntries(
    capabilities.map((capability) => [capability.id, capability.validationSurface ?? 'runtime_tooling'])
  );

  return {
    capabilities: capabilities.length,
    enabledManagers: runtimeFoundation?.managers?.managerList?.filter((entry) => entry.enabled).length ?? 0,
    tools: runtimeFoundation?.tools?.toolList?.length ?? 0,
    hooks: runtimeFoundation?.hooks?.hookList?.length ?? 0,
    toolFamilies,
    capabilityStatuses,
    capabilityStateById,
    validationSurfaceById,
    capabilityVocabulary: runtimeFoundation?.runtimeInterface?.capabilityVocabulary ?? [],
    validationSurfaces: runtimeFoundation?.runtimeInterface?.validationSurfaces ?? [],
  };
}
