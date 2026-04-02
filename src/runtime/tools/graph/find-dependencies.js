export function createFindDependenciesTool({ projectGraphManager }) {
  return {
    id: 'tool.find-dependencies',
    name: 'Find Dependencies Tool',
    description:
      'Find what files a given file imports (its dependencies). ' +
      'Pass { filePath, depth? } where depth defaults to 1. ' +
      'Returns the list of files that the target file depends on.',
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

      return projectGraphManager.getDependencies(filePath, {
        depth: input.depth ?? 1,
      });
    },
  };
}
