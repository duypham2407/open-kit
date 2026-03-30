export function mergeRuntimeSkills(skills = []) {
  const byName = new Map();

  for (const skill of skills) {
    if (!byName.has(skill.name)) {
      byName.set(skill.name, skill);
    }
  }

  return [...byName.values()];
}
