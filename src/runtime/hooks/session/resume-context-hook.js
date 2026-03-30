export function createResumeContextHook({ projectRoot }) {
  return {
    id: 'hook.resume-context',
    name: 'Resume Context Hook',
    stage: 'foundation',
    run() {
      return {
        projectRoot,
        advice: 'Use workflow-state resume-summary for explicit resume context.',
      };
    },
  };
}
