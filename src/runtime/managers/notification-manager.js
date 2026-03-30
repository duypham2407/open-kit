export class NotificationManager {
  constructor({ enabled = false } = {}) {
    this.enabled = enabled;
    this.events = [];
  }

  notify(event) {
    if (!this.enabled) {
      return null;
    }

    const entry = {
      ...event,
      createdAt: new Date().toISOString(),
    };
    this.events.push(entry);
    return entry;
  }

  list() {
    return [...this.events];
  }
}
