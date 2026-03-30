function normalizeRuleList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

export function createRulesInjectorHook(config = {}) {
  const always = normalizeRuleList(config?.always);
  const byMode = config?.byMode && typeof config.byMode === 'object' ? config.byMode : {};
  const byCategory = config?.byCategory && typeof config.byCategory === 'object' ? config.byCategory : {};

  return {
    id: 'hook.rules-injector',
    name: 'Rules Injector Hook',
    stage: 'foundation',
    run({ mode = null, category = null } = {}) {
      const modeRules = normalizeRuleList(mode ? byMode[mode] : []);
      const categoryRules = normalizeRuleList(category ? byCategory[category] : []);
      const rules = [...always, ...modeRules, ...categoryRules];

      return {
        status: rules.length > 0 ? 'configured' : 'idle',
        mode,
        category,
        rules,
        sources: {
          always,
          mode: modeRules,
          category: categoryRules,
        },
      };
    },
  };
}
