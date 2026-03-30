import { analyzeSessions } from './session-analysis.js';

export function createSessionListTool({ sessionStateManager }) {
  return {
    id: 'tool.session-list',
    name: 'Session List Tool',
    description: 'Lists recorded runtime sessions with resumability analysis.',
    family: 'session',
    stage: 'active',
    status: 'active',
    execute(options = {}) {
      return analyzeSessions(sessionStateManager.list(), options);
    },
  };
}
