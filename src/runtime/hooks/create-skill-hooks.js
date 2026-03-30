import { createRulesInjectorHook } from './transform/rules-injector-hook.js';

export function createSkillHooks({ skills = [] }) {
  return [
    createRulesInjectorHook(),
    {
      id: 'hook.skill-loader',
      name: 'Skill Loader Hook',
      stage: 'foundation',
      run() {
        return {
          loadedSkillNames: skills.map((skill) => skill.name),
        };
      },
    },
  ];
}
