import { listBundledSkills } from '../../../capabilities/skill-catalog.js';

function matchesValue(values = [], expected) {
  if (!expected) {
    return true;
  }
  return values.includes(expected) || values.includes('all');
}

export function createSkillIndexTool() {
  return {
    id: 'tool.skill-index',
    name: 'Skill Index',
    description: 'Lists bundled skills with canonical metadata, status, triggers, and MCP recommendations.',
    family: 'capability',
    status: 'active',
    async execute(input = {}) {
      const tag = input.tag ?? input.category;
      const skills = listBundledSkills().filter((entry) => {
        if (tag && !(entry.tags ?? []).includes(tag) && entry.category !== tag) {
          return false;
        }
        if (input.role && !matchesValue(entry.roles, input.role)) {
          return false;
        }
        if (input.stage && !matchesValue(entry.stages, input.stage)) {
          return false;
        }
        if (input.status && entry.status !== input.status) {
          return false;
        }
        if (input.support_level && entry.support_level !== input.support_level) {
          return false;
        }
        if (input.includeUnavailable !== true && entry.capabilityState === 'unavailable') {
          return false;
        }
        return true;
      });
      return { status: 'ok', validationSurface: 'runtime_tooling', skills };
    },
  };
}
