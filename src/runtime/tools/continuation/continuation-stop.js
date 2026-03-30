export function createContinuationStopTool({ continuationStateManager }) {
  return {
    id: 'tool.continuation-stop',
    name: 'Continuation Stop Tool',
    description: 'Stops continuation tracking and records an explicit stop reason.',
    family: 'continuation',
    stage: 'active',
    status: 'active',
    execute(input = {}) {
      return continuationStateManager.stop(input);
    },
  };
}
