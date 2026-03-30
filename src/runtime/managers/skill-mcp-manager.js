export class SkillMcpManager {
  constructor({ registry = [] } = {}) {
    this.registry = registry;
  }

  listBindings() {
    return [...this.registry];
  }

  registerSkillBindings(skills = []) {
    const nextBindings = skills.flatMap((skill) =>
      (skill.mcpRefs ?? []).map((mcpId) => ({
        skill: skill.name,
        scope: skill.scope,
        mcpId,
      }))
    );
    this.registry = nextBindings;
    return this.listBindings();
  }
}
