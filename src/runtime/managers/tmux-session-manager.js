export class TmuxSessionManager {
  constructor({ enabled = false, layout = 'main-vertical' } = {}) {
    this.enabled = enabled;
    this.layout = layout;
    this.sessions = [];
  }

  createSession(title) {
    if (!this.enabled) {
      return null;
    }

    const session = {
      id: `tmux-${this.sessions.length + 1}`,
      title,
      layout: this.layout,
    };
    this.sessions.push(session);
    return session;
  }

  listSessions() {
    return [...this.sessions];
  }

  cleanup() {
    this.sessions = [];
  }
}
