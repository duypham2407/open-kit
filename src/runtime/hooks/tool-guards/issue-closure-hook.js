export function createIssueClosureHook({ workflowKernel }) {
  return {
    id: 'hook.issue-closure-guard',
    name: 'Issue Closure Guard',
    stage: 'planned',
    run({ openIssues = 0 } = {}) {
      const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
      const activeOpenIssues = runtimeStatus?.runtimeContext?.issueTelemetry?.open ?? openIssues;
      const repeatedIssues = runtimeStatus?.runtimeContext?.issueTelemetry?.repeated ?? 0;
      return {
        allowed: activeOpenIssues === 0,
        openIssues: activeOpenIssues,
        repeatedIssues,
        blocked: activeOpenIssues > 0,
        blockedBy: activeOpenIssues > 0 ? ['open-issues'] : [],
        reason: activeOpenIssues > 0 ? 'open issues must be resolved before closure' : null,
      };
    },
  };
}
