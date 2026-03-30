import path from 'node:path';

export function createWorkflowStateContext(projectRoot) {
  return {
    workflowStatePath: path.join(projectRoot, '.opencode', 'workflow-state.json'),
  };
}
