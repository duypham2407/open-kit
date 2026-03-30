export class ToolMetadataStore {
  constructor() {
    this.entries = [];
  }

  remember(entry) {
    this.entries.push(entry);
  }

  list() {
    return [...this.entries];
  }
}
