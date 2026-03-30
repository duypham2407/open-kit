export function createStageReadinessHook() {
  return {
    id: 'hook.stage-readiness-guard',
    name: 'Stage Readiness Guard',
    stage: 'planned',
    run({ ready = true } = {}) {
      return { ready };
    },
  };
}
