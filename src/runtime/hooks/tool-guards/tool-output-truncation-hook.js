export function createToolOutputTruncationHook() {
  return {
    id: 'hook.tool-output-truncation',
    name: 'Tool Output Truncation Hook',
    stage: 'planned',
    run({ output }) {
      return { output };
    },
  };
}
