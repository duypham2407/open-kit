export function inspectCapabilityDoctor(runtimeFoundation) {
  return {
    capabilities: runtimeFoundation?.capabilities?.length ?? 0,
  };
}
