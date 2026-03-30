export function createRulesInjectorHook() {
  return {
    id: 'hook.rules-injector',
    name: 'Rules Injector Hook',
    stage: 'planned',
    run() {
      return {
        status: 'planned',
      };
    },
  };
}
