export function createContinuationHandoffTool({ continuationStateManager }) {
  return {
    id: 'tool.continuation-handoff',
    name: 'Continuation Handoff Tool',
    description: 'Records handoff summary, remaining actions, and learnings for the next session.',
    family: 'continuation',
    stage: 'active',
    status: 'active',
    execute(input = {}) {
      return continuationStateManager.handoff(input);
    },
  };
}
