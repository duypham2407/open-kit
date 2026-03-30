import { createRulesInjectorHook } from './transform/rules-injector-hook.js';

export function createSkillHooks({ skills = [], config = {} }) {
  return [
    createRulesInjectorHook(config.rulesInjector),
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
