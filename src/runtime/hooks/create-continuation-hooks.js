export function createContinuationHooks() {
  return [
    {
      id: 'hook.continuation-runtime',
      name: 'Continuation Runtime Hook',
      stage: 'planned',
      run() {
        return { status: 'planned' };
      },
    },
  ];
}
