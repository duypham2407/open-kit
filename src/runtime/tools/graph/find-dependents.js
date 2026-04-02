export function createFindDependentsTool({ projectGraphManager }) {
  return {
    id: 'tool.find-dependents',
    name: 'Find Dependents Tool',
    description:
      'Find what files import a given file (its reverse dependencies / dependents). ' +
      'Pass { filePath, depth? } where depth defaults to 1. ' +
      'Returns the list of files that depend on the target file.',
    family: 'graph',
    stage: 'foundation',
    status: projectGraphManager?.available ? 'active' : 'degraded',
    async execute(input = {}) {
      if (!projectGraphManager?.available) {
        return {
          status: 'unavailable',
          reason: 'Project graph database is not available. Run openkit doctor for details.',
        };
      }

      const filePath = typeof input === 'string' ? input : input.filePath;
      if (!filePath) {
        return { status: 'error', reason: 'filePath is required.' };
      }

      return projectGraphManager.getDependents(filePath, {
        depth: input.depth ?? 1,
      });
    },
  };
}
