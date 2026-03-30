export class SessionStateManager {
  constructor({ projectRoot }) {
    this.projectRoot = projectRoot;
    this.sessions = [];
  }

  record(session) {
    this.sessions.push({
      ...session,
      projectRoot: this.projectRoot,
    });
  }

  list() {
    return [...this.sessions];
  }
}
