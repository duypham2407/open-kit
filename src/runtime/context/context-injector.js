import { loadDirectoryAgents } from './directory-agents-loader.js';
import { loadProjectReadme } from './readme-loader.js';
import { createWorkflowStateContext } from './workflow-state-context.js';

export function createContextInjection({ projectRoot, mode = null, category = null } = {}) {
  return {
    agentsPath: loadDirectoryAgents(projectRoot),
    readmePath: loadProjectReadme(projectRoot),
    workflow: createWorkflowStateContext(projectRoot),
    rules: {
      mode,
      category,
    },
  };
}
