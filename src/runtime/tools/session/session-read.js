import { summarizeSession } from './session-analysis.js';

function sortNewestFirst(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left?.recorded_at ?? 0).getTime();
    const rightTime = new Date(right?.recorded_at ?? 0).getTime();
    return rightTime - leftTime;
  });
}

export function createSessionReadTool({ sessionStateManager }) {
  return {
    id: 'tool.session-read',
    name: 'Session Read Tool',
    description: 'Reads one recorded runtime session with a normalized summary.',
    family: 'session',
    stage: 'active',
    status: 'active',
    execute(input = 0) {
      const sessions = sortNewestFirst(sessionStateManager.list());
      const session = typeof input === 'string'
        ? sessions.find((entry) => entry.session_id === input) ?? null
        : sessions[input] ?? null;

      if (!session) {
        return { status: 'not-found', message: `No session found for input: ${JSON.stringify(input)}` };
      }

      return {
        status: 'ok',
        session,
        summary: summarizeSession(session),
      };
    },
  };
}
