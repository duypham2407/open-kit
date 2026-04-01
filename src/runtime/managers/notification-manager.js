export class NotificationManager {
  constructor({ enabled = false } = {}) {
    this.enabled = enabled;
    this.events = [];
    this.maxEvents = 500;
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
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return entry;
  }

  list() {
    return [...this.events];
  }
}
