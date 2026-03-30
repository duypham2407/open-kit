import { recoverSessionState } from '../recovery/session-recovery.js';

export function createContinuationHooks({ sessionStateManager, workflowKernel, continuationStateManager = null, config = {} }) {
  const attentionOnRisk = config?.continuationRuntime?.attentionOnRisk !== false;

  return [
    {
      id: 'hook.continuation-runtime',
      name: 'Continuation Runtime Hook',
      stage: 'foundation',
      run() {
        const latestSession = sessionStateManager?.latest?.() ?? null;
        const recovery = recoverSessionState(latestSession, {
          workflowRuntime: workflowKernel,
          continuationStateManager,
        });
        const needsAttention = attentionOnRisk && recovery.continuationRisk.length > 0;
        const status = needsAttention
          ? 'attention-required'
          : recovery.resumable
            ? 'continuable'
            : 'planned';

        return {
          status,
          resumable: recovery.resumable,
          needsAttention,
          latestSession: recovery.latestSession,
          nextAction: recovery.nextAction,
          recommendedAction: recovery.recommendedAction,
          continuationRisk: recovery.continuationRisk,
          guidance: recovery.guidance,
          continuation: recovery.continuation,
          backgroundRunCount: recovery.backgroundRunCount,
        };
      },
    },
  ];
}
