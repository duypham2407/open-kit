export function createImportGraphTool({ projectGraphManager }) {
  return {
    id: 'tool.import-graph',
    name: 'Import Graph Tool',
    description:
      'Query the project import graph. ' +
      'Pass { action: "index" } to trigger project indexing, ' +
      '{ action: "status" } for graph status, or ' +
      '{ action: "index-file", filePath } to index a single file.',
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

      const action = input.action ?? 'status';

      switch (action) {
        case 'status':
          return projectGraphManager.describe();

        case 'index':
          return projectGraphManager.indexProject({
            maxFiles: input.maxFiles ?? 2000,
          });

        case 'index-file': {
          if (!input.filePath) {
            return { status: 'error', reason: 'filePath is required for index-file action.' };
          }
          return projectGraphManager.indexFile(input.filePath);
        }

        case 'summary':
          return projectGraphManager.getGraphSummary();

        default:
          return { status: 'error', reason: `Unknown action: ${action}. Use status, index, index-file, or summary.` };
      }
    },
  };
}
