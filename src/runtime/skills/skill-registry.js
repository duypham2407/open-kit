import { mergeRuntimeSkills } from './skill-merger.js';
import { loadRuntimeSkills } from './skill-loader.js';

export function createSkillRegistry(options = {}) {
  const skills = mergeRuntimeSkills(loadRuntimeSkills(options));
  return {
    skills,
    byName: Object.fromEntries(skills.map((entry) => [entry.name, entry])),
  };
}
