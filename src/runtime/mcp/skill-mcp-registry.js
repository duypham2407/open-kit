export function createSkillMcpRegistry(skills = []) {
  return skills
    .filter((skill) => Array.isArray(skill.recommended_mcps) && skill.recommended_mcps.length > 0)
    .map((skill) => ({
      skill: skill.name,
      mcps: skill.recommended_mcps.map((mcpRef) => ({
        id: mcpRef.id,
        relationship: mcpRef.relationship,
        reason: mcpRef.reason,
      })),
    }));
}
