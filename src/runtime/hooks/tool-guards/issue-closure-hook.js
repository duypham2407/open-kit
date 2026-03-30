export function createIssueClosureHook() {
  return {
    id: 'hook.issue-closure-guard',
    name: 'Issue Closure Guard',
    stage: 'planned',
    run({ openIssues = 0 } = {}) {
      return { allowed: openIssues === 0 };
    },
  };
}
