export function createParallelSafetyHook() {
  return {
    id: 'hook.parallel-safety-guard',
    name: 'Parallel Safety Guard',
    stage: 'planned',
    run({ parallelMode = 'off' } = {}) {
      return { parallelMode };
    },
  };
}
