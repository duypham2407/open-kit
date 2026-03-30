import { recoverSessionState } from '../../recovery/session-recovery.js';

export function createResumeContextHook({ projectRoot, workflowKernel, sessionStateManager, continuationStateManager = null }) {
  return {
    id: 'hook.resume-context',
    name: 'Resume Context Hook',
    stage: 'foundation',
    run() {
      const latestSession = sessionStateManager?.latest?.() ?? null;
      const recovery = recoverSessionState(latestSession, {
        workflowRuntime: workflowKernel,
        continuationStateManager,
      });
      return {
        projectRoot,
        advice: 'Use workflow-state resume-summary for explicit resume context.',
        nextAction: recovery.nextAction,
        recommendedAction: recovery.recommendedAction,
        activeWorkItemId: recovery.runtimeStatus?.runtimeContext?.activeWorkItemId ?? latestSession?.activeWorkItemId ?? null,
        backgroundRunCount: recovery.backgroundRunCount,
        continuationRisk: recovery.continuationRisk,
        continuation: recovery.continuation,
        resumable: recovery.resumable,
        latestSession,
      };
    },
  };
}
