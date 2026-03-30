import path from 'node:path';

export function createWorkflowStateTool({ projectRoot }) {
  return {
    id: 'tool.workflow-state',
    execute(command = 'status') {
      return {
        command,
        cliPath: path.join(projectRoot, '.opencode', 'workflow-state.js'),
      };
    },
  };
}
