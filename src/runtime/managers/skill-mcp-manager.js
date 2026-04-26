export class SkillMcpManager {
  constructor({ registry = [] } = {}) {
    this.registry = registry;
  }

  listBindings() {
    return [...this.registry];
  }

  registerSkillBindings(skills = []) {
    const nextBindings = skills.flatMap((skill) =>
      [...(skill.mcpRefs ?? []), ...(skill.optionalMcpRefs ?? [])].map((mcpId) => ({
        skill: skill.name,
        scope: skill.scope,
        mcpId,
        optional: (skill.optionalMcpRefs ?? []).includes(mcpId),
      }))
    );
    this.registry = nextBindings;
    return this.listBindings();
  }
}
