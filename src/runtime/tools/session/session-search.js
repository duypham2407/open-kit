import { analyzeSessions } from './session-analysis.js';

export function createSessionSearchTool({ sessionStateManager }) {
  return {
    id: 'tool.session-search',
    name: 'Session Search Tool',
    description: 'Searches recorded runtime sessions and highlights resume candidates.',
    family: 'session',
    stage: 'active',
    status: 'active',
    execute(input = {}) {
      const query = typeof input === 'string' ? input : input?.query;
      return analyzeSessions(sessionStateManager.list(), {
        ...(typeof input === 'object' && input !== null ? input : {}),
        query,
      });
    },
  };
}
