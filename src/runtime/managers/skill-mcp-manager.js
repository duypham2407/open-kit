export class SkillMcpManager {
  constructor({ registry = [] } = {}) {
    this.registry = registry;
  }

  listBindings() {
    return [...this.registry];
  }
}
