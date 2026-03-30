export function inspectInstallDoctor({ classification = 'unknown', rootManifestPath = null, runtimeManifestPath = null } = {}) {
  return {
    status: 'foundation',
    classification,
    rootManifestPath,
    runtimeManifestPath,
  };
}
