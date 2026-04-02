export function createFindSymbolTool({ projectGraphManager }) {
  return {
    id: 'tool.find-symbol',
    name: 'Find Symbol Tool',
    description:
      'Search the project import graph for a symbol by name. ' +
      'Pass { name } to find all files that declare or export the given symbol.',
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

      const name = typeof input === 'string' ? input : input.name;
      if (!name) {
        return { status: 'error', reason: 'name is required.' };
      }

      return projectGraphManager.findSymbol(name);
    },
  };
}
