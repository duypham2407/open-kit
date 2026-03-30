export function createSkillMcpRegistry(skills = []) {
  return skills
    .filter((skill) => Array.isArray(skill.mcpRefs) && skill.mcpRefs.length > 0)
    .map((skill) => ({
      skill: skill.name,
      mcps: [...skill.mcpRefs],
    }));
}
