export class ToolMetadataStore {
  constructor() {
    this.entries = [];
    this.maxEntries = 500;
  }

  remember(entry) {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  list() {
    return [...this.entries];
  }
}
