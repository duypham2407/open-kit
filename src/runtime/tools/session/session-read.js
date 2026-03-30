import { summarizeSession } from './session-analysis.js';

export function createSessionReadTool({ sessionStateManager }) {
  return {
    id: 'tool.session-read',
    name: 'Session Read Tool',
    description: 'Reads one recorded runtime session with a normalized summary.',
    family: 'session',
    stage: 'active',
    status: 'active',
    execute(input = 0) {
      const sessions = sessionStateManager.list();
      const session = typeof input === 'string'
        ? sessions.find((entry) => entry.session_id === input) ?? null
        : sessions[input] ?? null;

      if (!session) {
        return null;
      }

      return {
        session,
        summary: summarizeSession(session),
      };
    },
  };
}
