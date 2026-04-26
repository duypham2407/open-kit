import { listBundledSkills } from '../../../capabilities/skill-catalog.js';

export function createSkillIndexTool() {
  return {
    id: 'tool.skill-index',
    name: 'Skill Index',
    description: 'Lists bundled skills with status, triggers, and MCP references.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      const skills = listBundledSkills().filter((entry) => !input.category || entry.category === input.category);
      return { status: 'ok', validationSurface: 'runtime_tooling', skills };
    },
  };
}
