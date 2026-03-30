export function createWriteGuardHook() {
  return {
    id: 'hook.write-guard',
    name: 'Write Guard Hook',
    stage: 'planned',
    run({ path }) {
      return { path, allowed: true };
    },
  };
}
