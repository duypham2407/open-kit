import { loadDirectoryAgents } from './directory-agents-loader.js';
import { loadProjectReadme } from './readme-loader.js';
import { createWorkflowStateContext } from './workflow-state-context.js';

export function createContextInjection({ projectRoot, mode = null, category = null, hooks = null } = {}) {
  let injectedRules = [];

  if (hooks?.['hook.rules-injector']) {
    try {
      const result = hooks['hook.rules-injector'].run({ mode, category });
      if (result?.rules && Array.isArray(result.rules)) {
        injectedRules = result.rules;
      }
    } catch {
      // Rules injection is best-effort; do not block context creation
    }
  }

  return {
    agentsPath: loadDirectoryAgents(projectRoot),
    readmePath: loadProjectReadme(projectRoot),
    workflow: createWorkflowStateContext(projectRoot),
    rules: {
      mode,
      category,
    },
    injectedRules,
  };
}
