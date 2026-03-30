export function recoverSessionState(
  session = null,
  { workflowRuntime = null, backgroundManager = null, continuationStateManager = null } = {}
) {
  const runtimeStatus = workflowRuntime?.showRuntimeStatusRelaxed?.() ?? workflowRuntime?.showRuntimeStatus?.() ?? null;
  const latestBackgroundRuns = backgroundManager?.list?.() ?? workflowRuntime?.listBackgroundRuns?.()?.runs ?? [];
  const latestSession = session ?? null;
  const continuation = continuationStateManager?.summary?.() ?? null;
  const currentState = runtimeStatus?.state ?? null;
  const runtimeContext = runtimeStatus?.runtimeContext ?? null;
  const verificationReadiness = runtimeStatus?.runtimeContext?.verificationReadiness ?? null;
  const issueTelemetry = runtimeStatus?.runtimeContext?.issueTelemetry ?? null;
  const taskBoardSummary = runtimeStatus?.runtimeContext?.taskBoardSummary ?? null;
  const orchestrationHealth = runtimeContext?.orchestrationHealth ?? null;
  const continuationRisk = [];
  const verificationEvidenceCount = Array.isArray(currentState?.verification_evidence)
    ? currentState.verification_evidence.length
    : 0;
  const implementationStarted =
    currentState?.mode === 'full' && ['full_implementation', 'full_code_review', 'full_qa', 'full_done'].includes(currentState?.current_stage);
  const latestSessionNextAction = latestSession?.nextAction ?? null;
  const nextAction = orchestrationHealth?.recommendedAction ?? runtimeContext?.nextAction ?? latestSessionNextAction;

  if (verificationReadiness?.status === 'missing-evidence') {
    continuationRisk.push('missing-verification-evidence');
  }

  if (verificationReadiness?.status === 'not-required-yet' && implementationStarted && verificationEvidenceCount === 0) {
    continuationRisk.push('missing-verification-evidence');
  }

  if ((issueTelemetry?.open ?? 0) > 0) {
    continuationRisk.push('open-issues');
  }

  if (orchestrationHealth?.blocked === true) {
    continuationRisk.push('no-ready-or-active-tasks');
  }

  if (continuation?.status === 'stopped') {
    continuationRisk.push('continuation-stopped');
  }

  if ((continuation?.remainingActionCount ?? 0) > 0) {
    continuationRisk.push('unfinished-continuation-actions');
  }

  const guidance = [];

  if (orchestrationHealth?.recommendedAction) {
    guidance.push(orchestrationHealth.recommendedAction);
  }

  if (verificationReadiness?.status === 'missing-evidence') {
    guidance.push('Record the required verification evidence before attempting closure.');
  }

  if (verificationReadiness?.status === 'not-required-yet' && implementationStarted && verificationEvidenceCount === 0) {
    guidance.push('Start recording verification evidence now so implementation handoff is resumable.');
  }

  if ((issueTelemetry?.open ?? 0) > 0) {
    guidance.push('Resolve or reroute open issues before advancing the work item.');
  }

  if (continuation?.status === 'stopped' && continuation?.stoppedReason) {
    guidance.push(`Continuation was stopped explicitly: ${continuation.stoppedReason}.`);
  }

  if ((continuation?.remainingActionCount ?? 0) > 0) {
    guidance.push('Review the saved continuation remaining actions before resuming delegated work.');
  }

  return {
    status: latestSession || runtimeStatus ? 'recovered' : 'empty',
    session: latestSession,
    latestSession,
    runtimeStatus,
    backgroundRunCount: latestBackgroundRuns.length,
    nextAction,
    continuationRisk,
    verificationReadiness,
    issueTelemetry,
    taskBoardSummary,
    orchestrationHealth,
    continuation,
    recommendedAction: guidance[0] ?? null,
    guidance,
    resumable: Boolean(latestSession || latestBackgroundRuns.length > 0 || nextAction),
  };
}
