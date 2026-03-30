export function inspectCapabilityDoctor(runtimeFoundation) {
  const toolFamilies = runtimeFoundation?.tools?.toolFamilies ?? [];
  const capabilityStatuses = Object.fromEntries(
    (runtimeFoundation?.capabilities ?? []).map((capability) => [capability.id, capability.status])
  );

  return {
    capabilities: runtimeFoundation?.capabilities?.length ?? 0,
    enabledManagers: runtimeFoundation?.managers?.managerList?.filter((entry) => entry.enabled).length ?? 0,
    tools: runtimeFoundation?.tools?.toolList?.length ?? 0,
    hooks: runtimeFoundation?.hooks?.hookList?.length ?? 0,
    toolFamilies,
    capabilityStatuses,
  };
}
