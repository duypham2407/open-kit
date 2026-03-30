export function createRuntimeStatusHook({ capabilitySummary }) {
  return {
    id: 'hook.runtime-status',
    name: 'Runtime Status Hook',
    stage: 'foundation',
    run() {
      return capabilitySummary;
    },
  };
}
